import {cookies} from 'next/headers';
import {accountConfig, accountStorageConfig} from '@/lib/account-runtime';
import {SESSION_COOKIE, sessionAccount, selectedTickers} from '@/lib/accounts';
import {companyCatalog} from '@/lib/content';
import Preferences from './Preferences';

const messages: Record<string, string> = {
  sent: 'Bitte prüfe dein E-Mail-Postfach und den Spamordner. Wenn der Versand möglich ist, erhältst du einen Link. Häufige Anfragen werden begrenzt. Der Link ist 15 Minuten gültig.',
  verified: 'Deine E-Mail-Adresse ist bestätigt. Wähle jetzt deine Updates aus.',
  expired: 'Dieser Link ist abgelaufen oder wurde bereits verwendet. Fordere einen neuen Zugangslink an.',
  saved: 'Deine Auswahl wurde gespeichert.',
  paused: 'Deine Updates sind pausiert. Deine Unternehmensauswahl bleibt gespeichert.',
  'invalid-email': 'Bitte gib eine gültige E-Mail-Adresse ein.',
  invalid: 'Die Auswahl wurde nicht gespeichert. Prüfe deine Unternehmen und bestätige den E-Mail-Versand.',
  unavailable: 'Der E-Mail-Versand ist gerade nicht verfügbar. Bitte versuche es später erneut.',
  'login-required': 'Bitte melde dich mit einem neuen E-Mail-Link an.',
  'logged-out': 'Du bist auf diesem Gerät abgemeldet.',
  deleted: 'Dein Konto und deine Abonnements wurden gelöscht.',
};

export default async function Account({searchParams}: {searchParams: Promise<{status?: string; ticker?: string}>}) {
  const params = await searchParams;
  const config = accountStorageConfig();
  const signupEnabled = Boolean(accountConfig());
  const jar = await cookies();
  const account = config ? await sessionAccount(config.db, jar.get(SESSION_COOKIE)?.value) : null;
  const catalog = await companyCatalog();
  const selected = account && config ? await selectedTickers(config.db, account.id) : [];
  const suggestedCompany=catalog.find(company=>company.ticker===params.ticker);
  const suggested=suggestedCompany?.ticker||null;
  const message = params.status ? messages[params.status] : undefined;
  return <main id="inhalt" className="container account-page">
    <section className="page-heading"><p className="eyebrow">Dein TechThese</p><h1>{account ? 'Deine Themen. Dein Postfach.' : suggestedCompany?'Neue Beiträge zu '+suggestedCompany.name+' erhalten':'Bleib bei deinen Themen.'}</h1><p>{account ? 'Du entscheidest, welche Beiträge dich per E-Mail erreichen.' : 'Neue Analysen per E-Mail – zu allen Beiträgen oder nur zu den Unternehmen, die dich interessieren.'}</p></section>
    {message && <p className="account-status" role="status">{message}</p>}
    {!signupEnabled && <p className="account-status" role="status">Die E-Mail-Anmeldung ist noch nicht freigeschaltet. Bitte schau später wieder vorbei.</p>}
    {account ? <div className="account-grid">
      <section className="account-panel"><h2>Deine E-Mail-Updates</h2>{suggested && !selected.includes(suggested) && <p className="account-status">{suggested} ist vorausgewählt. Bestätige und speichere deine Auswahl, um Updates zu erhalten.</p>}
        <Preferences companies={catalog.map(({ticker, name}) => ({ticker, name}))} selected={suggested ? [...new Set([...selected, suggested])] : selected} generalNews={Boolean(account.general_news)} active={account.consent_at!==null}/>
      </section>
      <aside className="account-panel account-summary"><p className="eyebrow">Dein Zugang</p><h2>E-Mail bestätigt</h2><p className="account-email">{account.email}</p><p>Du brauchst kein Passwort. Mit einem neuen E-Mail-Link kannst du dich auch auf einem anderen Gerät anmelden.</p><p className="muted">{account.consent_at ? 'E-Mail-Updates sind für deine gespeicherte Auswahl aktiv.' : 'Du erhältst derzeit keine E-Mail-Updates.'}</p><form action="/api/account/logout" method="post"><button className="account-secondary" type="submit">Auf diesem Gerät abmelden</button></form>
        <details className="account-delete"><summary>Konto löschen</summary><p>Deine E-Mail-Adresse, Auswahl und gespeicherten Zugänge werden gelöscht. Bereits versendete E-Mails bleiben in deinem Postfach.</p><form action="/api/account/delete" method="post"><label className="account-choice"><input type="checkbox" name="confirm" value="delete" required/><span>Ich möchte mein Konto dauerhaft löschen.</span></label><button type="submit" className="account-secondary">Konto dauerhaft löschen</button></form></details>
      </aside>
    </div> : <div className="account-grid">
      <section className="account-panel"><h2>{suggestedCompany?suggestedCompany.name+' folgen':'Mit E-Mail starten'}</h2><p>Neu hier oder schon registriert? Gib deine E-Mail-Adresse ein. Wir schicken dir einen sicheren Zugangslink.</p>
        <form className="account-form" action="/api/account/request-link" method="post">{suggested&&<input type="hidden" name="ticker" value={suggested}/>}<label htmlFor="account-email">E-Mail-Adresse</label><input id="account-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="du@beispiel.de" required disabled={!signupEnabled}/><div className="account-honeypot" aria-hidden="true"><label>Website<input name="website" tabIndex={-1} autoComplete="off"/></label></div><button type="submit" disabled={!signupEnabled}>Zugangslink per E-Mail erhalten</button></form>
        <p className="muted account-note">Mit der Anmeldung bestellst du noch keine Updates. Diese wählst und bestätigst du anschließend in deinem Konto. <a href="/rechtliches#email-updates">Datenschutz</a></p>
      </section>
      <aside className="account-panel account-summary"><p className="eyebrow">So funktioniert’s</p><ol className="account-steps"><li><strong>E-Mail angeben</strong><span>Kein Passwort und kein öffentlicher Benutzername.</span></li><li><strong>Zugang bestätigen</strong><span>Link im Postfach öffnen und deine E-Mail bestätigen.</span></li><li><strong>Deine Auswahl treffen</strong><span>Alle neuen Beiträge oder einzelne Unternehmen. Jederzeit änderbar und abbestellbar.</span></li></ol></aside>
    </div>}
  </main>;
}
