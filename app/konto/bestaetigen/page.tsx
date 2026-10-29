import {accountStorageConfig} from '@/lib/account-runtime';
import {loginTokenAccount} from '@/lib/accounts';

export default async function ConfirmEmail({searchParams}: {searchParams: Promise<{token?: string}>}) {
  const {token = ''} = await searchParams;
  const config = accountStorageConfig();
  const account = config ? await loginTokenAccount(config.db, token) : null;
  return <main id="inhalt" className="container narrow account-page"><section className="page-heading"><p className="eyebrow">Sicherer Zugang</p><h1>E-Mail bestätigen</h1></section><section className="account-panel">
    {account ? <><h2>Öffne dein TechThese-Konto</h2><p>Du bestätigst den Zugang für <strong>{account.email}</strong>. Bitte fahre nur fort, wenn du diesen Link selbst angefordert hast.</p><form action="/api/account/verify" method="post"><input type="hidden" name="token" value={token}/><button type="submit">E-Mail bestätigen & zum Konto</button></form><p className="muted account-note">Danach kannst du deine E-Mail-Updates auswählen. Dieser Link allein aktiviert keine Abonnements.</p></> : <><h2>Dieser Link ist nicht verfügbar.</h2><p>Er ist abgelaufen, wurde bereits verwendet oder die Anmeldung ist derzeit nicht freigeschaltet.</p><a className="read-link" href="/konto">Neuen Zugangslink anfordern ↗</a></>}
  </section></main>;
}
