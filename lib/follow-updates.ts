import {pauseEmails,type AccountDatabase} from './accounts.ts';

// Wortlaut der Einwilligung im Kontobereich. Ändert sich der Text, muss sich die Version ändern.
export const ACCOUNT_CONSENT_VERSION='konto-updates-2026-11-09';

type LinkedSubscriber={id:string;consent_at:number|null;general_news:number};

// Das Supabase-Konto und der E-Mail-Versand teilen sich die bestätigte Adresse.
async function linkedSubscriber(db:AccountDatabase,email:string){
  return db.prepare('SELECT id,consent_at,general_news FROM subscribers WHERE email=? AND verified_at IS NOT NULL')
    .bind(email).first<LinkedSubscriber>();
}

export async function emailUpdateStatus(db:AccountDatabase,email:string){
  const subscriber=await linkedSubscriber(db,email);
  return {enabled:Boolean(subscriber?.consent_at),generalNews:Boolean(subscriber?.general_news)};
}

// company_follows ist die einzige Liste. stock_subscriptions spiegelt sie, solange eingewilligt ist;
// ohne Einwilligung bleibt der Spiegel leer, und der Versand findet niemanden.
function mirrorStatements(db:AccountDatabase,userId:string,subscriberId:string){
  return [
    db.prepare('DELETE FROM stock_subscriptions WHERE subscriber_id=?').bind(subscriberId),
    db.prepare(`INSERT INTO stock_subscriptions(subscriber_id,ticker)
      SELECT ?,ticker FROM company_follows WHERE user_id=?
        AND EXISTS(SELECT 1 FROM subscribers WHERE id=? AND verified_at IS NOT NULL AND consent_at IS NOT NULL)`)
      .bind(subscriberId,userId,subscriberId),
    // Wer nicht mehr folgt, bekommt auch bereits eingereihte Mails zu diesem Unternehmen nicht.
    db.prepare(`UPDATE email_deliveries SET status='skipped' WHERE subscriber_id=? AND status='pending'
      AND NOT EXISTS(SELECT 1 FROM subscribers s JOIN article_versions a ON a.publication_id=email_deliveries.publication_id
        WHERE s.id=? AND s.consent_at IS NOT NULL AND (s.general_news=1 OR EXISTS(
          SELECT 1 FROM stock_subscriptions ss WHERE ss.subscriber_id=s.id AND ss.ticker=json_extract(a.payload,'$.ticker'))))`)
      .bind(subscriberId,subscriberId),
  ];
}

export async function syncFollowSubscriptions(db:AccountDatabase,userId:string,email:string){
  const subscriber=await linkedSubscriber(db,email);
  if(subscriber)await db.batch(mirrorStatements(db,userId,subscriber.id));
}

export async function enableEmailUpdates(db:AccountDatabase,userId:string,email:string,generalNews:boolean,now=Date.now()){
  const existing=await db.prepare('SELECT id FROM subscribers WHERE email=?').bind(email).first<{id:string}>();
  const id=existing?.id||crypto.randomUUID();
  // Supabase hat die Adresse bereits bestätigt, ein zweiter Zugangslink ist nicht nötig.
  const upsert=existing
    ?db.prepare(`UPDATE subscribers SET verified_at=COALESCE(verified_at,?),general_news=?,consent_at=?,consent_version=?,preferences_at=? WHERE id=?`)
      .bind(now,Number(generalNews),now,ACCOUNT_CONSENT_VERSION,now,id)
    :db.prepare(`INSERT INTO subscribers(id,email,created_at,verified_at,general_news,consent_at,consent_version,preferences_at)
      VALUES(?,?,?,?,?,?,?,?)`).bind(id,email,now,now,Number(generalNews),now,ACCOUNT_CONSENT_VERSION,now);
  await db.batch([
    upsert,
    // Eine frühere Auswahl aus dem reinen E-Mail-Zugang geht nicht verloren, sie wandert in die Kontoliste.
    db.prepare(`INSERT INTO company_follows(user_id,ticker,created_at)
      SELECT ?,ticker,? FROM stock_subscriptions WHERE subscriber_id=? ON CONFLICT(user_id,ticker) DO NOTHING`)
      .bind(userId,now,id),
    ...mirrorStatements(db,userId,id),
  ]);
}

export async function disableEmailUpdates(db:AccountDatabase,email:string,now=Date.now()){
  const subscriber=await linkedSubscriber(db,email);
  if(subscriber)await pauseEmails(db,subscriber.id,now);
}

// Bei Kontolöschung darf keine Adresse im Versand zurückbleiben.
export function deleteEmailUpdateStatements(db:AccountDatabase,email:string){
  const ofSubscriber='(SELECT id FROM subscribers WHERE email=?)';
  return [
    db.prepare(`DELETE FROM email_deliveries WHERE subscriber_id IN ${ofSubscriber}`).bind(email),
    db.prepare(`DELETE FROM stock_subscriptions WHERE subscriber_id IN ${ofSubscriber}`).bind(email),
    db.prepare(`DELETE FROM account_sessions WHERE subscriber_id IN ${ofSubscriber}`).bind(email),
    db.prepare(`DELETE FROM email_login_tokens WHERE subscriber_id IN ${ofSubscriber}`).bind(email),
    db.prepare('DELETE FROM subscribers WHERE email=?').bind(email),
  ];
}
