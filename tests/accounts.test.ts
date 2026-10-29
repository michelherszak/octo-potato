import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync, readdirSync} from 'node:fs';
import {requestEmailLink, verifyEmailLink, sessionAccount, selectedTickers, savePreferences, hashToken,
  loginTokenAccount, unsubscribe, unsubscribeSignature, cleanupAccounts, pauseEmails, CONSENT_VERSION} from '../lib/accounts.ts';
import {sameOrigin, sessionCookie, smallForm} from '../lib/account-http.ts';
import {dispatchArticleEmails} from '../lib/notifications.ts';
import {budgetedSender} from '../lib/email-budget.ts';
import {emailLayout} from '../lib/email-layout.ts';
import {EmailDeferred,resendSender, type EmailMessage, type EmailSender} from '../lib/email.ts';
import {importArticle} from '../lib/import-service.ts';
import {seeds} from '../lib/seeds.ts';
import {articleSchema, storedArticleSchema} from '../lib/contract.ts';

const now = Date.parse('2026-10-27T12:00:00Z');
const base = 'https://techthese.example';
const secret = 'test-only-account-secret-not-for-production';
function database() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys=ON');
  for (const file of readdirSync(new URL('../drizzle/', import.meta.url)).filter(file => file.endsWith('.sql')).sort())
    sqlite.exec(readFileSync(new URL('../drizzle/' + file, import.meta.url), 'utf8'));
  function prepare(sql: string) {
    let values: unknown[] = [];
    return {
      bind(...args: unknown[]) {values = args; return this;},
      async first() {return sqlite.prepare(sql).get(...values as never[]) || null;},
      async all() {const result = sqlite.prepare(sql).all(...values as never[]); return {results: result, meta: {changes: result.length}};},
      async run() {return {meta: {changes: Number(sqlite.prepare(sql).run(...values as never[]).changes)}};},
    };
  }
  return {sqlite, prepare, async batch(statements: {run(): Promise<unknown>}[]) {
    sqlite.exec('BEGIN');
    try {const result = []; for (const statement of statements) result.push(await statement.run()); sqlite.exec('COMMIT'); return result;}
    catch (error) {sqlite.exec('ROLLBACK'); throw error;}
  }} as unknown as D1Database & {sqlite: DatabaseSync};
}
function mailbox() {
  const messages: {message: EmailMessage; key: string}[] = [];
  const send: EmailSender = async (message, key) => {messages.push({message, key});};
  return {messages, send};
}
async function register(db: D1Database, email = 'reader@example.test') {
  const mail = mailbox();
  await requestEmailLink(db, email, email, secret, base, mail.send, now);
  const token = new URL(mail.messages[0].message.text.match(/https:\/\/[^\s]+/)![0]).searchParams.get('token')!;
  const session = await verifyEmailLink(db, token, now + 1);
  const account = await sessionAccount(db, session!, now + 2);
  return {mail, token, session: session!, account: account!};
}
function article() {
  const {example, ...value} = seeds[0]; void example;
  return {...articleSchema.parse(value), ticker: 'RKLB', company: 'Rocket Lab', editorial_review: {
    reviewer: 'Test Editor', reviewed_at: '2026-10-27T12:00:00Z', edited: true as const, facts_checked: true as const,
    commercial_rights_confirmed: true as const, rights_basis: 'Own licensed research in this fixture.', conflicts: 'No positions or compensation in this test.',
    advertising: 'none' as const, advertising_details: 'No paid content or affiliate relationships in this test.',
  }};
}
async function publish(db: D1Database, offset = 10) {
  const packet = {publication_id: crypto.randomUUID(), expected_revision: 0, article: article()};
  await importArticle(db, packet, base, new Date(now + offset).toISOString());
  return packet;
}

test('email verification creates an account with no subscriptions; tokens are hashed and single-use', async () => {
  const db = database();
  const {token, session, account} = await register(db, ' Reader@Example.Test ');
  assert.equal(account.email, 'reader@example.test');
  assert.equal(account.general_news, 0);
  assert.equal(account.consent_at, null);
  assert.equal(await verifyEmailLink(db, token, now + 3), null);
  assert.equal(await loginTokenAccount(db, token, now + 3), null);
  assert.equal(db.sqlite.prepare('SELECT token_hash FROM account_sessions').get()!.token_hash, await hashToken(session));
  assert.equal(await sessionAccount(db, session, now + 31 * 24 * 60 * 60_000), null);
});

test('verification link GET lookups do not consume tokens; expired/forged tokens never authenticate', async () => {
  const db = database(), mail = mailbox();
  await requestEmailLink(db, 'a@example.test', 'ip', secret, base, mail.send, now);
  const token = mail.messages[0].message.text.match(/token=([a-f0-9]+)/)![1];
  assert.equal((await loginTokenAccount(db, token, now))?.email, 'a@example.test');
  assert.ok(await loginTokenAccount(db, token, now));
  assert.equal(await verifyEmailLink(db, token, now + 15 * 60_000), null);
  assert.equal(await verifyEmailLink(db, 'f'.repeat(64), now), null);
  assert.equal(await sessionAccount(db, 'f'.repeat(64), now), null);
  assert.equal(db.sqlite.prepare('SELECT verified_at FROM subscribers').get()!.verified_at, null);
});

test('requesting access again preserves existing account and subscriptions; account addresses remain unique', async () => {
  const db = database(), {account} = await register(db);
  await savePreferences(db, account.id, {generalNews: false, tickers: ['RKLB'], consent: true}, ['RKLB'], now + 2);
  const mail = mailbox();
  await requestEmailLink(db, 'READER@example.test', 'other-device', secret, base, mail.send, now + 3);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM subscribers').get()!.n, 1);
  assert.deepEqual(await selectedTickers(db, account.id), ['RKLB']);
});

test('rate limits work across requests without storing raw IPs or addresses in the limiter', async () => {
  const db = database(), mail = mailbox();
  for (let i = 0; i < 4; i++) await requestEmailLink(db, 'a@example.test', '192.0.2.1', secret, base, mail.send, now);
  assert.equal(mail.messages.length, 3);
  for (let i = 0; i < 11; i++) await requestEmailLink(db, `b${i}@example.test`, '192.0.2.2', secret, base, mail.send, now);
  assert.equal(mail.messages.length, 13);
  const rows = db.sqlite.prepare('SELECT key FROM signup_rate_limits').all();
  assert.ok(rows.every(row => /^[a-f0-9]{64}$/.test(row.key as string)));
});

test('failed verification deliveries do not leave a usable token', async () => {
  const db = database();
  await assert.rejects(requestEmailLink(db, 'a@example.test', 'ip', secret, base, async () => {throw new Error('offline');}, now));
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM email_login_tokens').get()!.n, 0);
});

test('subscriptions require explicit consent and valid companies, and support pausing', async () => {
  const db = database(), {account} = await register(db);
  await assert.rejects(savePreferences(db, account.id, {generalNews: true, tickers: [], consent: false}, ['RKLB'], now));
  await assert.rejects(savePreferences(db, account.id, {generalNews: false, tickers: ['FAKE'], consent: true}, ['RKLB'], now));
  await savePreferences(db, account.id, {generalNews: false, tickers: ['RKLB', 'RKLB'], consent: true}, ['RKLB'], now);
  assert.deepEqual(await selectedTickers(db, account.id), ['RKLB']);
  assert.equal(db.sqlite.prepare('SELECT consent_version FROM subscribers').get()!.consent_version, CONSENT_VERSION);
  await savePreferences(db, account.id, {generalNews: false, tickers: [], consent: false}, [], now + 1);
  assert.equal(db.sqlite.prepare('SELECT consent_at FROM subscribers').get()!.consent_at, null);
  assert.deepEqual(await selectedTickers(db, account.id), []);
});

test('article queue targets confirmed selections, deduplicates overlapping interests, imports and revisions', async () => {
  const db = database();
  const general = await register(db, 'general@example.test'), stock = await register(db, 'stock@example.test');
  const both = await register(db, 'both@example.test'), other = await register(db, 'other@example.test');
  await register(db, 'no-consent@example.test');
  for (const [reader, generalNews, tickers] of [[general, true, []], [stock, false, ['RKLB']], [both, true, ['RKLB']], [other, false, ['PL']]] as const)
    await savePreferences(db, reader.account.id, {generalNews, tickers, consent: true}, ['RKLB', 'PL'], now + 3);
  const packet = await publish(db);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM email_deliveries').get()!.n, 3);
  await importArticle(db, packet, base);
  await importArticle(db, {...packet, publication_id: crypto.randomUUID(), expected_revision: 1, article: {...packet.article, title: 'Updated article title for the fixture'}}, base);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM email_deliveries').get()!.n, 3);
  const mail = mailbox();
  assert.deepEqual(await dispatchArticleEmails(db, secret, base, mail.send, now + 20), {sent: 3, skipped: 0, retried: 0});
  assert.equal(mail.messages.length, 3);
  assert.ok(mail.messages.every(row => row.message.headers?.['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click'));
  assert.equal((await dispatchArticleEmails(db, secret, base, mail.send, now + 30)).sent, 0);
});

test('unsubscribe capability cannot log in, rejects forgery and prevents pending sends', async () => {
  const db = database(), {account} = await register(db);
  await savePreferences(db, account.id, {generalNews: true, tickers: [], consent: true}, [], now + 2);
  await publish(db);
  const signature = await unsubscribeSignature(secret, account.id);
  assert.equal(await unsubscribe(db, secret, account.id, 'f'.repeat(64), now + 11), false);
  assert.equal(await sessionAccount(db, signature, now + 11), null);
  assert.equal(await unsubscribe(db, secret, account.id, signature, now + 12), true);
  assert.equal(await unsubscribe(db, secret, account.id, signature, now + 13), true);
  const mail = mailbox();
  await dispatchArticleEmails(db, secret, base, mail.send, now + 20);
  assert.equal(mail.messages.length, 0);
  assert.equal(db.sqlite.prepare('SELECT consent_at FROM subscribers').get()!.consent_at, null);
});

test('preference changes and revoked consent are checked immediately before dispatch', async () => {
  const db = database(), {account} = await register(db);
  await savePreferences(db, account.id, {generalNews: false, tickers: ['RKLB'], consent: true}, ['RKLB', 'PL'], now + 2);
  await publish(db);
  await savePreferences(db, account.id, {generalNews: false, tickers: ['PL'], consent: true}, ['RKLB', 'PL'], now + 11);
  const mail = mailbox();
  await dispatchArticleEmails(db, secret, base, mail.send, now + 20);
  assert.equal(mail.messages.length, 0);
});

test('delivery retries use an identical provider request even after article edits', async () => {
  const db = database(), {account} = await register(db);
  await savePreferences(db, account.id, {generalNews: true, tickers: [], consent: true}, [], now + 2);
  const packet = await publish(db), attempts: {message: EmailMessage; key: string}[] = [];
  const send: EmailSender = async (message, key) => {attempts.push({message, key}); if (attempts.length === 1) throw new Error('lost acknowledgement');};
  assert.equal((await dispatchArticleEmails(db, secret, base, send, now + 20)).retried, 1);
  await importArticle(db, {...packet, publication_id: crypto.randomUUID(), expected_revision: 1, article: {...packet.article, title: 'Changed title after sending attempt'}}, base);
  assert.equal((await dispatchArticleEmails(db, secret, base, send, now + 3 * 60_000)).sent, 1);
  assert.deepEqual(attempts[0], attempts[1]);
});

test('concurrent dispatchers cannot claim the same active delivery', async () => {
  const db = database(), {account} = await register(db);
  await savePreferences(db, account.id, {generalNews: true, tickers: [], consent: true}, [], now + 2);
  await publish(db);
  let count = 0;
  const send: EmailSender = async () => {count++; const second = await dispatchArticleEmails(db, secret, base, async () => {count++;}, now + 21); assert.equal(second.sent, 0);};
  await dispatchArticleEmails(db, secret, base, send, now + 20);
  assert.equal(count, 1);
});

test('cleanup purges expired unverified accounts and deletion cascades private records', async () => {
  const db = database(), {account} = await register(db);
  await savePreferences(db, account.id, {generalNews: true, tickers: ['RKLB'], consent: true}, ['RKLB'], now + 2);
  await publish(db);
  await db.prepare('DELETE FROM subscribers WHERE id=?').bind(account.id).run();
  for (const table of ['account_sessions', 'email_login_tokens', 'stock_subscriptions', 'email_deliveries'])
    assert.equal(db.sqlite.prepare(`SELECT count(*) n FROM ${table}`).get()!.n, 0);
  await requestEmailLink(db, 'pending@example.test', 'ip', secret, base, mailbox().send, now);
  await cleanupAccounts(db, now + 8 * 24 * 60 * 60_000);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM subscribers').get()!.n, 0);
});

test('account forms enforce same origin, bounded input and secure session cookies', async () => {
  assert.equal(sameOrigin(new Request(base, {headers: {Origin: base}}), base), true);
  assert.equal(sameOrigin(new Request(base, {headers: {Origin: 'https://evil.example'}}), base), false);
  assert.equal(sameOrigin(new Request(base), base), false);
  assert.match(sessionCookie('token', base), /HttpOnly; SameSite=Lax; Path=\/; Max-Age=2592000; Secure/);
  assert.match(sessionCookie('', base, true), /Max-Age=0/);
  await assert.rejects(smallForm(new Request(base, {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: 'x='.padEnd(20_000, 'a')})));
});

test('Resend transport uses individual recipients, idempotency and no provider-error disclosure', async () => {
  let captured: RequestInit | undefined;
  const sender = resendSender('test-key', 'TechThese <updates@example.test>', (async (_url, init) => {captured = init; return new Response('{}');}) as typeof fetch);
  await sender({to: 'reader@example.test', subject: 'Subject', text: 'Content'}, 'unique-key');
  assert.deepEqual(JSON.parse(captured!.body as string).to, ['reader@example.test']);
  assert.equal((captured!.headers as Record<string, string>)['Idempotency-Key'], 'unique-key');
  const failing = resendSender('test-key', 'sender@example.test', (async () => new Response('private provider details', {status: 429})) as typeof fetch);
  await assert.rejects(failing({to: 'reader@example.test', subject: 'S', text: 'C'}, 'key'), EmailDeferred);
});

test('stored publication metadata remains readable without weakening the import contract', () => {
  const value = {...article(), revision: 1, published_at: new Date(now).toISOString(), updated_at: new Date(now).toISOString()};
  assert.equal(storedArticleSchema.safeParse(value).success, true);
  assert.equal(articleSchema.safeParse(value).success, false);
});


test('company selection survives a login link without enabling a subscription',async()=>{
  const db=database(),mail=mailbox();
  await requestEmailLink(db,'reader@example.test','ip',secret,base,mail.send,now,'RKLB');
  const token=mail.messages[0].message.text.match(/token=([a-f0-9]+)/)![1];
  assert.equal((await loginTokenAccount(db,token,now))?.requested_ticker,'RKLB');
  const session=await verifyEmailLink(db,token,now+1),account=await sessionAccount(db,session!,now+2);
  assert.equal(account!.consent_at,null);assert.deepEqual(await selectedTickers(db,account!.id),[]);
});
test('pausing preserves company choices but cancels queued updates until renewed consent',async()=>{
  const db=database(),{account}=await register(db);
  await savePreferences(db,account.id,{generalNews:false,tickers:['RKLB'],consent:true},['RKLB'],now+2);
  await publish(db);await pauseEmails(db,account.id,now+11);
  assert.deepEqual(await selectedTickers(db,account.id),['RKLB']);
  assert.equal(db.sqlite.prepare('SELECT consent_at FROM subscribers').get()!.consent_at,null);
  const mail=mailbox();await dispatchArticleEmails(db,secret,base,mail.send,now+20);assert.equal(mail.messages.length,0);
  await savePreferences(db,account.id,{generalNews:false,tickers:['RKLB'],consent:true},['RKLB'],now+21);
  assert.equal(db.sqlite.prepare("SELECT count(*) n FROM email_deliveries WHERE status='pending'").get()!.n,0);
});
test('explicit revision alerts are versioned and cannot be enabled by reusing an earlier request identity',async()=>{
  const db=database(),{account}=await register(db);
  await savePreferences(db,account.id,{generalNews:false,tickers:['RKLB'],consent:true},['RKLB'],now+2);
  const first=await publish(db);
  const silent={...first,publication_id:crypto.randomUUID(),expected_revision:1,article:{...first.article,title:'Eine kleine redaktionelle Korrektur'}};
  await importArticle(db,silent,base,new Date(now+12).toISOString());
  await assert.rejects(importArticle(db,{...silent,notify_subscribers:true},base));
  const announced={...first,publication_id:crypto.randomUUID(),expected_revision:2,notify_subscribers:true,article:{...first.article,title:'Neue Zahlen: Die Lage hat sich verändert'}};
  const result=await importArticle(db,announced,base,new Date(now+14).toISOString());
  assert.equal(result.notifications_queued,1);
  await importArticle(db,announced,base,new Date(now+15).toISOString());
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM email_deliveries').get()!.n,2);
  const mail=mailbox();await dispatchArticleEmails(db,secret,base,mail.send,now+20);
  assert.equal(mail.messages.length,2);
  assert.ok(mail.messages.some(m=>m.message.subject.includes('Aktualisierte Analyse')));
  assert.ok(mail.messages.some(m=>m.message.text.includes(announced.article.title)));
  assert.ok(mail.messages.some(m=>m.message.text.includes(first.article.title)));
  assert.ok(mail.messages.every(m=>m.message.html?.includes('Alle Updates abbestellen')));
});
test('a daily send budget counts recipients and lets stable retries through once',async()=>{
  const db=database(),mail=mailbox();let clock=now;
  const send=budgetedSender(db,mail.send,1,()=>clock);
  const message={to:'reader@example.test',subject:'Test',text:'Test'};
  await send(message,'one');await send(message,'one');
  await assert.rejects(send(message,'two'),EmailDeferred);
  assert.equal(db.sqlite.prepare('SELECT count(*) n FROM email_send_budget').get()!.n,1);
  clock=now+86_400_000;await send(message,'two');assert.equal(mail.messages.length,3);
});
test('quota deferrals wait for tomorrow without consuming retry attempts or expiring an unsent event',async()=>{
  const db=database(),{account}=await register(db),mail=mailbox();let clock=now;
  await savePreferences(db,account.id,{generalNews:true,tickers:[],consent:true},[],now+2);
  await publish(db);
  const send=budgetedSender(db,mail.send,1,()=>clock);
  await send({to:'a@example.test',subject:'Budget already used',text:'Test'},'used');
  await dispatchArticleEmails(db,secret,base,send,now+20);
  const delivery=db.sqlite.prepare('SELECT attempts,first_attempt_at,status FROM email_deliveries').get()!;
  assert.equal(delivery.attempts,0);assert.equal(delivery.first_attempt_at,null);assert.equal(delivery.status,'pending');
  clock=now+86_400_000;
  assert.equal((await dispatchArticleEmails(db,secret,base,send,clock)).sent,1);
});
test('HTML email templates escape article content and include no remote tracking resources',()=>{
  const html=emailLayout({eyebrow:'News',title:'<img src=x onerror=alert(1)>',description:'A & B',button:'Read',url:base+'/article',footer:'Footer',footerUrl:base+'/konto'});
  assert.ok(html.includes('&lt;img'));assert.ok(html.includes('A &amp; B'));
  assert.equal(html.includes('<img'),false);assert.equal(html.includes('<script'),false);
});
