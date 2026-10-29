import {emailLayout,escapeHtml} from './email-layout.ts';
import {storedArticleSchema} from './contract.ts';
import {cleanupAccounts, unsubscribeSignature, type AccountDatabase} from './accounts.ts';
import {EmailDeferred,type EmailSender,type EmailMessage} from './email.ts';

// Run in the same transaction as a new article or an explicitly announced revision. A subscriber
// matching both the general feed and a stock still gets exactly one queue row.
export function articleEmailStatement(db: AccountDatabase, slug: string, publicationId: string, ticker: string, now: number) {
  return db.prepare(`INSERT INTO email_deliveries(id,subscriber_id,article_slug,publication_id,created_at)
    SELECT ? || ':' || s.id,s.id,?,?,? FROM subscribers s
    WHERE s.verified_at IS NOT NULL AND s.consent_at IS NOT NULL
      AND (s.general_news=1 OR EXISTS(SELECT 1 FROM stock_subscriptions ss WHERE ss.subscriber_id=s.id AND ss.ticker=?))
      AND EXISTS(SELECT 1 FROM articles WHERE slug=? AND publication_id=?)
      AND EXISTS(SELECT 1 FROM article_versions WHERE publication_id=?)
    ON CONFLICT(subscriber_id,publication_id) DO NOTHING`).bind(publicationId, slug, publicationId, now, ticker, slug, publicationId, publicationId);
}

type Delivery = {id: string; subscriber_id: string; article_slug: string; publication_id: string; created_at: number; message: string | null; attempts: number; first_attempt_at: number|null};
export async function dispatchArticleEmails(db: AccountDatabase, secret: string, base: string, send: EmailSender, now = Date.now()) {
  await cleanupAccounts(db, now);
  // Resend retains idempotency keys for 24h. Never automatically retry after
  // that window; a lost acknowledgement must not cause a duplicate tomorrow.
  await db.prepare("UPDATE email_deliveries SET status='failed' WHERE status='pending' AND (first_attempt_at<? OR attempts>=5) AND lease_until<=?")
    .bind(now - 23 * 60 * 60_000, now).run();
  const claim = crypto.randomUUID();
  const {results} = await db.prepare(`UPDATE email_deliveries SET claim_id=?,lease_until=?,attempts=attempts+1
    WHERE id IN(SELECT id FROM email_deliveries WHERE status='pending' AND next_attempt_at<=? AND lease_until<=?
      ORDER BY created_at,id LIMIT 10) RETURNING id,subscriber_id,article_slug,publication_id,created_at,message,attempts,first_attempt_at`)
    .bind(claim, now + 5 * 60_000, now, now).all<Delivery>();
  let sent = 0, skipped = 0, retried = 0;
  for (const delivery of results) {
    const subscriber = await db.prepare(`SELECT s.email FROM subscribers s JOIN article_versions a ON a.publication_id=?
      WHERE s.id=? AND s.verified_at IS NOT NULL AND s.consent_at IS NOT NULL
      AND (s.general_news=1 OR EXISTS(SELECT 1 FROM stock_subscriptions ss WHERE ss.subscriber_id=s.id
        AND ss.ticker=json_extract(a.payload,'$.ticker')))`)
      .bind(delivery.publication_id, delivery.subscriber_id).first<{email: string}>();
    const article = await db.prepare('SELECT payload FROM article_versions WHERE publication_id=?').bind(delivery.publication_id).first<{payload: string}>();
    let raw: unknown = null;
    try { raw = article ? JSON.parse(article.payload) : null; } catch { /* Corrupt rows never enter an email. */ }
    const parsed = storedArticleSchema.safeParse(raw);
    if (!subscriber || !parsed.success || !parsed.data.editorial_review || parsed.data.example) {
      await db.prepare("UPDATE email_deliveries SET status='skipped',lease_until=0 WHERE id=? AND claim_id=?").bind(delivery.id, claim).run();
      skipped++;
      continue;
    }
    try {
      let message: EmailMessage;
      if (delivery.message) message = JSON.parse(delivery.message) as EmailMessage;
      else {
        const signature = await unsubscribeSignature(secret, delivery.subscriber_id);
        const query = `id=${encodeURIComponent(delivery.subscriber_id)}&signature=${signature}`;
        const a = parsed.data;
        const updated=(a.revision||1)>1;
        const label=updated?'Aktualisierte Analyse':'Neuer Beitrag';
        const unsubscribeUrl=base+'/konto/abbestellen?'+query;
        const articleUrl=base+'/analysen/'+a.slug;
        const footer='Du erhältst diese E-Mail für deine bestätigte Auswahl. Du kannst deine Unternehmen ändern oder alle Updates abbestellen.';
        const html=emailLayout({eyebrow:label+(a.company?' · '+a.company:''),title:a.title,description:a.description,button:'Beitrag lesen',url:articleUrl,footer,footerUrl:base+'/konto'})
          .replace('</body>',`<p style="text-align:center;font-family:Arial,sans-serif;font-size:11px;padding:0 16px 24px;color:#6b6b7c"><a href="${escapeHtml(unsubscribeUrl)}">Alle Updates abbestellen</a> · <a href="${escapeHtml(base+'/rechtliches#email-updates')}">Datenschutz & Kontakt</a><br>Allgemeine Information, keine individuelle Anlageberatung.</p></body>`);
        message = {to: subscriber.email, subject: `TechThese · ${label}: ${a.title.replace(/[\r\n]/g, ' ')}`,html,text:
          `${label} bei TechThese${a.company?' · '+a.company:a.ticker?' · '+a.ticker:''}\n\n${a.title}\n\n${a.description}\n\nBeitrag lesen:\n${articleUrl}\n\n${footer}\n\nAuswahl ändern: ${base}/konto\nAlle Updates abbestellen: ${unsubscribeUrl}\n\nTechThese · ${base}/rechtliches`,
          headers: {'List-Unsubscribe': `<${base}/api/account/unsubscribe?${query}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'}};
        // Persist the exact provider request before sending, for stable retries.
        await db.prepare('UPDATE email_deliveries SET message=? WHERE id=? AND claim_id=?')
          .bind(JSON.stringify(message), delivery.id, claim).run();
      }
      await db.prepare('UPDATE email_deliveries SET first_attempt_at=COALESCE(first_attempt_at,?) WHERE id=? AND claim_id=?').bind(now,delivery.id,claim).run();
      await send(message, `article/${delivery.id}`);
      await db.prepare("UPDATE email_deliveries SET status='sent',sent_at=?,lease_until=0 WHERE id=? AND claim_id=?")
        .bind(now, delivery.id, claim).run();
      sent++;
    } catch(error) {
      if(error instanceof EmailDeferred){
        await db.prepare('UPDATE email_deliveries SET next_attempt_at=?,lease_until=0,attempts=attempts-1,first_attempt_at=? WHERE id=? AND claim_id=?').bind(error.retryAt,delivery.first_attempt_at,delivery.id,claim).run();
        retried++;continue;
      }
      await db.prepare('UPDATE email_deliveries SET next_attempt_at=?,lease_until=0 WHERE id=? AND claim_id=?')
        .bind(now + Math.min(60, 2 ** delivery.attempts) * 60_000, delivery.id, claim).run();
      retried++;
    }
  }
  return {sent, skipped, retried};
}
