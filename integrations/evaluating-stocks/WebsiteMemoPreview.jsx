const bands=['Strong Buy','Buy','Hold','Sell','Strong Sell']
export default function WebsiteMemoPreview({article:a}) {
  const o=a.memo_overview
  if(!o)return null
  function metrics(items){return <div className="website-edit-grid">{items.map(m=><div key={m.key}><strong>{m.label}: {m.value}</strong><p>{m.explanation}</p><small>{m.period} · {m.source}{m.source_url&&<> · <a href={m.source_url} target="_blank" rel="noopener noreferrer">Quelle ↗</a></>}</small></div>)}</div>}
  return <section aria-label="Mitveröffentlichte Unternehmensübersicht">
    <h3>Unternehmen im Überblick · wird mitveröffentlicht</h3>
    <p><strong>Modellurteil: {a.model_verdict||'Nicht verfügbar'}</strong> · {a.model_score??'–'} / 100</p>
    <p>{bands.map(b=><span key={b}>{b===a.model_verdict?<strong>[{b}]</strong>:b}{b!==bands.at(-1)?' · ':''}</span>)}</p>
    <p><strong>Piotroski-F-Score: {o.piotroski.score==null?'Nicht verfügbar':o.piotroski.score+' / 9'}</strong><br/><small>{o.piotroski.period} · {o.piotroski.source}{o.piotroski.source_url&&<> · <a href={o.piotroski.source_url} target="_blank" rel="noopener noreferrer">Quelle ↗</a></>}</small></p>
    <div className="website-edit-grid">{o.questions.map(q=><div key={q.group}><h4>{q.question}</h4><strong>{q.answer}</strong><p>{q.detail}</p><p>{q.note}</p><small>Vergleichssignal: {({green:'über dem Vergleich',amber:'Mittelfeld',red:'unter dem Vergleich',unknown:'Daten fehlen'})[q.signal]}</small></div>)}</div>
    <h4>Wo das Geld herkommt und hingeht</h4><p>{o.money_story}</p>{metrics(o.money_metrics)}
    <h4>Kosten und Ergebnis</h4>{o.costs.length?metrics(o.costs):<p>Keine belastbare Kostenaufteilung vorhanden.</p>}<p>Kostenarten können ineinander enthalten sein. Umsatz und Cashflow sind keine gleichartigen Größen. Zeiträume und Quellen bitte einzeln prüfen.</p>
    {o.dilution&&<p>{o.dilution}</p>}
    {o.street&&<p><strong>Analystenkonsens: {o.street.verdict}</strong>{o.street.analysts!==null&&<> · {o.street.analysts} Analysten</>}<br/>{o.street.meaning}</p>}
    {a.top_risk&&<p><strong>Wichtigstes Risiko:</strong> {a.top_risk}</p>}
    {!!o.reliability.length&&<><h4>Datenlücken & Besonderheiten</h4><ul>{o.reliability.map((r,i)=><li key={i}>{r}</li>)}</ul></>}
  </section>
}
