import {accountConfig, accountStorageConfig} from '@/lib/account-runtime';
import {accountJson, accountRedirect, readSession, sameOrigin, sessionCookie, smallForm} from '@/lib/account-http';
import {emailSchema, hashToken, loginTokenAccount, pauseEmails, requestEmailLink, savePreferences, sessionAccount, unsubscribe, verifyEmailLink} from '@/lib/accounts';
import {companyCatalog} from '@/lib/content';

export async function POST(request: Request, {params}: {params: Promise<{action: string}>}) {
  const {action} = await params;
  const config = accountStorageConfig();
  if (!config) return accountJson({detail: 'Die E-Mail-Anmeldung ist noch nicht eingerichtet.'}, 503);
  const {db, base, secret} = config;
  if (action === 'unsubscribe') {
    // RFC 8058 one-click unsubscribe is an authenticated capability, not a session action.
    const url = new URL(request.url);
    const ok = await unsubscribe(db, secret, url.searchParams.get('id') || '', url.searchParams.get('signature') || '');
    if (sameOrigin(request, base)) return accountRedirect(base, '/konto/abbestellen?result=' + (ok ? 'done' : 'invalid'));
    return accountJson({detail: ok ? 'Alle E-Mail-Updates abbestellt.' : 'Ungültiger Abmeldelink.'}, ok ? 200 : 400);
  }
  if (!sameOrigin(request, base)) return accountJson({detail: 'Anfrage nicht erlaubt.'}, 403);
  if (!['request-link', 'verify', 'preferences', 'pause', 'logout', 'delete'].includes(action)) return accountJson({detail: 'Nicht gefunden.'}, 404);
  let form: URLSearchParams;
  try { form = await smallForm(request); } catch { return accountJson({detail: 'Ungültiges Formular.'}, 400); }
  if (action === 'request-link') {
    const signup = accountConfig();
    if (!signup) return accountRedirect(base, '/konto?status=unavailable');
    const parsed = emailSchema.safeParse(form.get('email'));
    if (!parsed.success) return accountRedirect(base, '/konto?status=invalid-email');
    try {
      const requested=form.get('ticker')||'';
      const ticker=requested&&(await companyCatalog()).some(c=>c.ticker===requested)?requested:undefined;
      if (!form.get('website')) await requestEmailLink(db, parsed.data, request.headers.get('cf-connecting-ip') || 'unknown', secret, base, signup.send,Date.now(),ticker);
      return accountRedirect(base, '/konto?status=sent');
    } catch { return accountRedirect(base, '/konto?status=unavailable'); }
  }
  if (action === 'verify') {
    const pending=await loginTokenAccount(db,form.get('token')||'');
    const token = await verifyEmailLink(db, form.get('token') || '');
    return token ? accountRedirect(base, '/konto?status=verified'+(pending?.requested_ticker?'&ticker='+encodeURIComponent(pending.requested_ticker):''), sessionCookie(token, base))
      : accountRedirect(base, '/konto?status=expired');
  }
  const session = readSession(request);
  const account = await sessionAccount(db, session);
  if (!account || !session) return accountRedirect(base, '/konto?status=login-required', sessionCookie('', base, true));
  if (action === 'pause') {
    await pauseEmails(db,account.id);
    return accountRedirect(base,'/konto?status=paused');
  }
  if (action === 'logout') {
    await db.prepare('DELETE FROM account_sessions WHERE token_hash=?').bind(await hashToken(session)).run();
    return accountRedirect(base, '/konto?status=logged-out', sessionCookie('', base, true));
  }
  if (action === 'delete') {
    if (form.get('confirm') !== 'delete') return accountRedirect(base, '/konto?status=invalid');
    await db.prepare('DELETE FROM subscribers WHERE id=?').bind(account.id).run();
    return accountRedirect(base, '/konto?status=deleted', sessionCookie('', base, true));
  }
  const catalog = await companyCatalog();
  const input = {generalNews: form.get('generalNews') === 'on', tickers: form.getAll('tickers'), consent: form.get('consent') === 'on'};
  try { await savePreferences(db, account.id, input, catalog.map(company => company.ticker)); }
  catch { return accountRedirect(base, '/konto?status=invalid'); }
  return accountRedirect(base, '/konto?status=saved');
}

export async function GET() {
  // Neither link scanners nor browser prefetches can verify, sign out or unsubscribe.
  return new Response(null, {status: 405, headers: {Allow: 'POST', 'Cache-Control': 'no-store'}});
}
