export default function CompanyFollow({ticker,company}:{ticker:string;company:string}) {
  if(!ticker)return null;
  return <aside className="company-follow" aria-label={'Neue Beiträge zu '+(company||ticker)}><div><p className="eyebrow">Bleib bei diesem Unternehmen</p><h2>Neue Analysen zu {company||ticker} erhalten.</h2><p>Neue Beiträge und angekündigte Memo-Aktualisierungen per E-Mail. Du entscheidest, welchen Unternehmen du folgst.</p></div><a className="follow-button" href={'/konto?ticker='+encodeURIComponent(ticker)}>{company||ticker} folgen <span aria-hidden="true">↗</span></a><small>Mit bestätigter E-Mail-Adresse. Jederzeit pausieren oder abbestellen.</small></aside>;
}
