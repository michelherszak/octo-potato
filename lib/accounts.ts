import {z} from 'zod';
import {emailLayout} from './email-layout.ts';
import type {EmailSender} from './email.ts';

export type AccountDatabase = Pick<D1Database, 'prepare' | 'batch'>;
export const SESSION_SECONDS = 30 * 24 * 60 * 60;
export const CONSENT_VERSION = 'email-updates-2026-10-27';
export const SESSION_COOKIE = 'techthese_session';
export const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
export const emailSchema = z.string().trim().max(254).email().transform(value => value.toLowerCase());
export const preferencesSchema = z.object({
  generalNews: z.boolean(),
  tickers: z.array(z.string().min(1).max(30)).max(100).transform(values => [...new Set(values)]),
  consent: z.boolean(),
}).strict().refine(value => !(value.generalNews || value.tickers.length) || value.consent, 'Bitte bestätige den E-Mail-Versand.');

export type Subscriber = {
  id: string; email: string; verified_at: number | null; general_news: number;
  consent_at: number | null; consent_version: string | null;
};

export function randomToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}
const bytes = (value: string) => new TextEncoder().encode(value);
const hex = (value: ArrayBuffer) => Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join('');
export async function hashToken(value: string) { return hex(await crypto.subtle.digest('SHA-256', bytes(value))); }
export async function signValue(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', bytes(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, bytes(value)));
}
export function equalTokens(a: string, b: string) {
  if (a.length !== b.length) return false;
  let different = 0;
  for (let i = 0; i < a.length; i++) different |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return different === 0;
}

async function takeLimit(db: AccountDatabase, key: string, maximum: number, expiresAt: number) {
  const result = await db.prepare(`INSERT INTO signup_rate_limits(key,hits,expires_at) VALUES(?,1,?)
    ON CONFLICT(key) DO UPDATE SET hits=hits+1 WHERE hits < ?`).bind(key, expiresAt, maximum).run();
  return result.meta.changes > 0;
}

export async function requestEmailLink(
  db: AccountDatabase, emailInput: unknown, ip: string, secret: string, base: string, send: EmailSender, now = Date.now(), requestedTicker?: string,
) {
  const email = emailSchema.parse(emailInput);
  const window = Math.floor(now / (15 * 60_000));
  const expiry = (window + 1) * 15 * 60_000;
  // HMACs prevent dictionary recovery of addresses/IPs from rate-limit keys.
  const ipKey = await signValue(secret, `ip:${ip}:${window}`);
  const emailKey = await signValue(secret, `email:${email}:${window}`);
  if (!await takeLimit(db, ipKey, 10, expiry)) return;
  if (!await takeLimit(db, emailKey, 3, expiry)) return;
  await db.prepare('INSERT INTO subscribers(id,email,created_at) VALUES(?,?,?) ON CONFLICT(email) DO NOTHING')
    .bind(crypto.randomUUID(), email, now).run();
  const subscriber = await db.prepare('SELECT id FROM subscribers WHERE email=?').bind(email).first<{id: string}>();
  if (!subscriber) throw new Error('Account could not be created.');
  const token = randomToken();
  const tokenHash = await hashToken(token);
  await db.prepare('INSERT INTO email_login_tokens(token_hash,subscriber_id,expires_at,requested_ticker) VALUES(?,?,?,?)')
    .bind(tokenHash, subscriber.id, now + 15 * 60_000, requestedTicker||null).run();
  try {
    await send({to: email, subject: 'Dein Zugang zu TechThese', html:emailLayout({eyebrow:'Dein TechThese',title:'Bleib bei deinen Unternehmen.',description:'Bestätige deine E-Mail-Adresse und öffne dein Konto. Dort wählst du deine Unternehmen und bestätigst die gewünschten Updates.',button:'E-Mail bestätigen',url:base+'/konto/bestaetigen?token='+token,footer:'Der Link gilt 15 Minuten und kann einmal verwendet werden. Falls du ihn nicht angefordert hast, ignoriere diese E-Mail.',footerUrl:base+'/konto'}), text:
      `Hallo!\n\nBestätige deine E-Mail-Adresse und öffne dein TechThese-Konto:\n${base}/konto/bestaetigen?token=${token}\n\nDer Link ist 15 Minuten gültig und kann einmal verwendet werden. Erst in deinem Konto wählst du aus, welche E-Mail-Updates du möchtest.\n\nFalls du diesen Zugang nicht angefordert hast, ignoriere diese E-Mail.\n\nTechThese\n${base}/rechtliches`}, `login/${tokenHash}`);
  } catch (error) {
    await db.prepare('DELETE FROM email_login_tokens WHERE token_hash=?').bind(tokenHash).run();
    throw error;
  }
}

export async function loginTokenAccount(db: AccountDatabase, token: string, now = Date.now()) {
  if (!TOKEN_PATTERN.test(token)) return null;
  return db.prepare(`SELECT s.email,t.requested_ticker FROM email_login_tokens t JOIN subscribers s ON s.id=t.subscriber_id
    WHERE t.token_hash=? AND t.expires_at>?`).bind(await hashToken(token), now).first<{email: string; requested_ticker: string|null}>();
}

export async function verifyEmailLink(db: AccountDatabase, token: string, now = Date.now()) {
  if (!TOKEN_PATTERN.test(token)) return null;
  const hash = await hashToken(token);
  const sessionToken = randomToken();
  const sessionHash = await hashToken(sessionToken);
  const results = await db.batch([
    db.prepare(`INSERT INTO account_sessions(token_hash,subscriber_id,expires_at)
      SELECT ?,subscriber_id,? FROM email_login_tokens WHERE token_hash=? AND expires_at>?`)
      .bind(sessionHash, now + SESSION_SECONDS * 1000, hash, now),
    db.prepare(`UPDATE subscribers SET verified_at=COALESCE(verified_at,?)
      WHERE id IN(SELECT subscriber_id FROM account_sessions WHERE token_hash=?)`).bind(now, sessionHash),
    db.prepare('DELETE FROM email_login_tokens WHERE token_hash=?').bind(hash),
  ]);
  return results[0].meta.changes ? sessionToken : null;
}

export async function sessionAccount(db: AccountDatabase, token: string | undefined, now = Date.now()) {
  if (!token || !TOKEN_PATTERN.test(token)) return null;
  return db.prepare(`SELECT s.id,s.email,s.verified_at,s.general_news,s.consent_at,s.consent_version FROM account_sessions a
    JOIN subscribers s ON s.id=a.subscriber_id WHERE a.token_hash=? AND a.expires_at>? AND s.verified_at IS NOT NULL`)
    .bind(await hashToken(token), now).first<Subscriber>();
}

export async function selectedTickers(db: AccountDatabase, id: string) {
  const {results} = await db.prepare('SELECT ticker FROM stock_subscriptions WHERE subscriber_id=? ORDER BY ticker').bind(id).all<{ticker: string}>();
  return results.map(row => row.ticker);
}

export async function savePreferences(db: AccountDatabase, id: string, input: unknown, allowedTickers: string[], now = Date.now()) {
  const preferences = preferencesSchema.parse(input);
  if (preferences.tickers.some(ticker => !allowedTickers.includes(ticker))) throw new Error('Unbekanntes Unternehmen.');
  const active = preferences.generalNews || preferences.tickers.length > 0;
  await db.batch([
    db.prepare(`UPDATE subscribers SET general_news=?,consent_at=?,consent_version=?,preferences_at=? WHERE id=? AND verified_at IS NOT NULL`)
      .bind(Number(preferences.generalNews), active ? now : null, active ? CONSENT_VERSION : null, now, id),
    db.prepare('DELETE FROM stock_subscriptions WHERE subscriber_id=?').bind(id),
    ...preferences.tickers.map(ticker => db.prepare(`INSERT INTO stock_subscriptions(subscriber_id,ticker)
      SELECT id,? FROM subscribers WHERE id=? AND verified_at IS NOT NULL AND consent_at IS NOT NULL`).bind(ticker, id)),
    // Changes cancel pending mail; the dispatcher rechecks consent too.
    db.prepare(`UPDATE email_deliveries SET status='skipped' WHERE subscriber_id=? AND status='pending'
      AND NOT EXISTS(SELECT 1 FROM subscribers s JOIN article_versions a ON a.publication_id=email_deliveries.publication_id
      WHERE s.id=? AND s.consent_at IS NOT NULL AND (s.general_news=1 OR EXISTS(
        SELECT 1 FROM stock_subscriptions ss WHERE ss.subscriber_id=s.id AND ss.ticker=json_extract(a.payload,'$.ticker'))))`).bind(id, id),
  ]);
}

export async function pauseEmails(db: AccountDatabase, id: string, now=Date.now()) {
  await db.batch([
    db.prepare('UPDATE subscribers SET consent_at=NULL,consent_version=NULL,preferences_at=? WHERE id=?').bind(now,id),
    db.prepare("UPDATE email_deliveries SET status='skipped' WHERE subscriber_id=? AND status='pending'").bind(id),
  ]);
}

export async function unsubscribeSignature(secret: string, id: string) { return signValue(secret, `unsubscribe:${id}`); }
export async function unsubscribe(db: AccountDatabase, secret: string, id: string, signature: string, now = Date.now()) {
  if (!TOKEN_PATTERN.test(signature) || !equalTokens(signature, await unsubscribeSignature(secret, id))) return false;
  await db.batch([
    db.prepare('UPDATE subscribers SET general_news=0,consent_at=NULL,consent_version=NULL,preferences_at=? WHERE id=?').bind(now, id),
    db.prepare('DELETE FROM stock_subscriptions WHERE subscriber_id=?').bind(id),
    db.prepare("UPDATE email_deliveries SET status='skipped' WHERE subscriber_id=? AND status='pending'").bind(id),
  ]);
  return true;
}

export async function cleanupAccounts(db: AccountDatabase, now = Date.now()) {
  await db.batch([
    db.prepare('DELETE FROM email_login_tokens WHERE expires_at<=?').bind(now),
    db.prepare('DELETE FROM account_sessions WHERE expires_at<=?').bind(now),
    db.prepare('DELETE FROM email_send_budget WHERE day<?').bind(Math.floor(now/86_400_000)-30),
    db.prepare('DELETE FROM signup_rate_limits WHERE expires_at<=?').bind(now),
    db.prepare('DELETE FROM subscribers WHERE verified_at IS NULL AND created_at<?').bind(now - 7 * 24 * 60 * 60_000),
    db.prepare("DELETE FROM email_deliveries WHERE status IN('sent','skipped','failed') AND created_at<?").bind(now - 30 * 24 * 60 * 60_000),
  ]);
}
