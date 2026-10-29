import {accountStorageConfig} from '@/lib/account-runtime';
import {equalTokens, TOKEN_PATTERN, unsubscribeSignature} from '@/lib/accounts';

export default async function Unsubscribe({searchParams}: {searchParams: Promise<{id?: string; signature?: string; result?: string}>}) {
  const {id = '', signature = '', result} = await searchParams;
  const config = accountStorageConfig();
  const valid = config && TOKEN_PATTERN.test(signature) && equalTokens(signature, await unsubscribeSignature(config.secret, id));
  return <main id="inhalt" className="container narrow account-page"><section className="page-heading"><p className="eyebrow">Deine Entscheidung</p><h1>E-Mail-Updates abbestellen</h1></section><section className="account-panel">
    {result === 'done' ? <><h2>Du erhältst keine weiteren Updates.</h2><p>Alle E-Mail-Abonnements wurden beendet. Bereits laufende Zustellungen können noch eintreffen.</p><a className="read-link" href="/konto">Zum Konto ↗</a></> : valid ? <><p>Du kannst alle E-Mail-Updates ohne Anmeldung abbestellen. Dein Konto bleibt bestehen.</p><form action={'/api/account/unsubscribe?id=' + encodeURIComponent(id) + '&signature=' + signature} method="post"><button type="submit">Alle E-Mail-Updates abbestellen</button></form><p className="account-note"><a className="read-link" href="/konto">Stattdessen meine Auswahl ändern ↗</a></p></> : <><p>Dieser Abmeldelink ist ungültig oder derzeit nicht verfügbar.</p><a className="read-link" href="/konto">Updates im Konto verwalten ↗</a></>}
  </section></main>;
}
