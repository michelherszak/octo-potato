'use client';

import {useMemo, useState} from 'react';

type Company = {ticker: string; name: string};
export default function Preferences({companies, selected, generalNews, active}: {companies: Company[]; selected: string[]; generalNews: boolean; active: boolean}) {
  const [query, setQuery] = useState('');
  const [tickers, setTickers] = useState(selected);
  const [general, setGeneral] = useState(generalNews);
  const [consent, setConsent] = useState(false);
  const visible = useMemo(() => companies.filter(company => `${company.name} ${company.ticker}`.toLowerCase().includes(query.toLowerCase().trim())), [companies, query]);
  const hasSelection = general || tickers.length > 0;
  return <><form className="account-form" action="/api/account/preferences" method="post">
    <fieldset className="account-fieldset">
      <legend>Was möchtest du lesen?</legend>
      <label className="account-choice account-general"><input type="checkbox" name="generalNews" checked={general} onChange={event => setGeneral(event.target.checked)}/><span><strong>Alle neuen Beiträge</strong><small>Neue Technologieanalysen und Aktienmemos aus der gesamten Redaktion.</small></span></label>
      <p className="muted">Oder folge einzelnen Unternehmen. Wenn du alle Beiträge auswählst, sind diese bereits enthalten.</p>
      <label htmlFor="stock-search">Unternehmen oder Börsenkürzel suchen</label>
      <input id="stock-search" type="search" placeholder="Zum Beispiel Rocket Lab oder RKLB" value={query} onChange={event => setQuery(event.target.value)}/>
      <p className="muted" aria-live="polite">{tickers.length} Unternehmen ausgewählt · {visible.length} angezeigt</p>
      {tickers.filter(ticker => !visible.some(company => company.ticker === ticker)).map(ticker => <input key={ticker} type="hidden" name="tickers" value={ticker}/>)}
      <div className="account-stock-list">{visible.map(company => <label className="account-choice" key={company.ticker}>
        <input type="checkbox" name="tickers" value={company.ticker} checked={tickers.includes(company.ticker)} onChange={event => setTickers(previous => event.target.checked ? [...previous, company.ticker] : previous.filter(ticker => ticker !== company.ticker))}/>
        <span><strong>{company.name}</strong><small>{company.ticker}</small></span>
      </label>)}{!visible.length && <p>Kein passendes Unternehmen gefunden.</p>}</div>
    </fieldset>
    <label className="account-choice account-consent"><input type="checkbox" name="consent" checked={consent} required={hasSelection} onChange={event => setConsent(event.target.checked)}/><span>Ich möchte E-Mails zu meiner Auswahl erhalten. Ich kann diese Einwilligung jederzeit im Konto oder über den Abmeldelink in jeder E-Mail widerrufen. <a href="/rechtliches#email-updates">Datenschutzhinweise</a></span></label>
    <div className="account-actions"><button type="submit">{hasSelection ? 'Auswahl speichern' : 'Alle Updates pausieren'}</button><span className="muted">Neue Beiträge und ausdrücklich angekündigte Memo-Aktualisierungen. Keine laufenden Kursalarme.</span></div>
  </form>{active&&<form className="account-pause" action="/api/account/pause" method="post"><button className="account-secondary" type="submit">Alle Updates pausieren</button><p className="muted">Deine Unternehmensauswahl bleibt gespeichert. Zum Fortsetzen bestätigst du sie erneut.</p></form>}</>;
}
