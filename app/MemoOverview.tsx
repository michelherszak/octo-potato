import type {Article} from '../lib/contract';
import {ratingBands,type MemoOverviewData} from '../lib/memo-overview';

const explanations:Record<string,string>={
  'Strong Buy':'Das Modell stuft die Aktie im Vergleich zu ähnlichen Unternehmen besonders positiv ein.',
  Buy:'Das Modell stuft die Aktie im Vergleich zu ähnlichen Unternehmen positiv ein.',
  Hold:'Das Modell ordnet die Aktie im Mittelfeld ein.',
  Sell:'Das Modell stuft die Aktie im Vergleich zu ähnlichen Unternehmen kritisch ein.',
  'Strong Sell':'Das Modell stuft die Aktie im Vergleich zu ähnlichen Unternehmen besonders kritisch ein.',
};
function Metric({metric:m}:{metric:MemoOverviewData['money_metrics'][number]}) {
  return <div className="memo-money-item"><span>{m.label}</span><strong>{m.value}</strong><p>{m.explanation}</p><small>{m.period}<br/>{m.source_url?<a href={m.source_url} target="_blank" rel="noopener noreferrer">{m.source} ↗</a>:m.source}</small></div>;
}
export default function MemoOverview({article:a}:{article:Article}) {
  const o=a.memo_overview;
  if(!o&&!a.model_verdict)return null;
  const piot=o?.piotroski;
  const known=ratingBands.some(b=>b===a.model_verdict);
  return <section id="ueberblick" className="memo-overview" aria-labelledby="memo-overview-title">
    <div className="memo-overview-heading"><div><p className="eyebrow">Die Lage des Unternehmens</p><h2 id="memo-overview-title">Verstehen, bevor du urteilst.</h2></div><a href="#quellen">Datenstand & Quellen ↗</a></div>
    <p className="memo-intro">Wie verdient {a.company||'das Unternehmen'} Geld? Was bleibt übrig, wie solide sind die Finanzen und was spricht für oder gegen die Aktie?</p>
    <div className="memo-assessment-grid">
      <section className="memo-panel memo-rating"><p className="eyebrow">Einschätzung des Bewertungsmodells</p><div className="memo-rating-head"><h3>{a.model_verdict||'Nicht verfügbar'}</h3>{a.model_score!==null&&<span>{a.model_score.toLocaleString('de-DE')} <small>/ 100</small></span>}</div>
        <ol className="memo-rating-scale" aria-label="Bewertung von Strong Buy bis Strong Sell">{ratingBands.map(b=><li key={b} className={a.model_verdict===b?'selected':''} aria-current={a.model_verdict===b?'step':undefined}>{b}{a.model_verdict===b&&<span className="sr-only"> · aktuelle Einschätzung</span>}</li>)}</ol>
        <p>{known?explanations[a.model_verdict]:'Für diesen Datenstand liegt keine Einordnung auf der fünfstufigen Skala vor.'}</p><small>Ein Modellurteil zum gespeicherten Datenstand. Der Modellwert ist keine Renditewahrscheinlichkeit; er ist vom Piotroski-F-Score zu unterscheiden.</small>
      </section>
      <section className="memo-panel"><p className="eyebrow">Finanzielle Verfassung</p><h3>Piotroski-F-Score</h3><div className="memo-piot-value">{piot?.score!=null?<><strong>{piot.score}</strong><span>/ 9 Kriterien erfüllt</span></>:<strong className="memo-unavailable">Nicht verfügbar</strong>}</div>
        <div className="memo-piot-track" aria-hidden="true">{Array.from({length:9},(_,i)=><i key={i} className={piot?.score!=null&&i<piot.score?'filled':''}/>)}</div>
        <p>Neun Prüfungen zu Profitabilität, Finanzierung und operativer Entwicklung. Mehr erfüllte Kriterien sprechen für eine stärkere finanzielle Verfassung nach diesem Verfahren.</p><small>{piot?.score!=null?<>{piot.period}<br/>{piot.source_url?<a href={piot.source_url} target="_blank" rel="noopener noreferrer">{piot.source} ↗</a>:piot.source}</>:'Die gespeicherte Auswertung enthält keinen vollständigen Score. Fehlende Daten zählen hier nicht als null Punkte.'}</small>
      </section>
    </div>
    {!!o?.questions.length&&<section className="memo-section"><div className="memo-section-heading"><span>01</span><h3>Vier Fragen an das Unternehmen</h3></div><p className="muted">Die Signale vergleichen das Unternehmen mit ähnlichen Firmen. Die Begründung erklärt, was dahintersteht.</p><div className="memo-question-grid">{o.questions.map(q=><article key={q.group} className="memo-question"><p className="memo-question-label">{q.question}</p><strong><i className={'memo-signal '+q.signal} aria-hidden="true"/>{q.answer}</strong><p>{q.detail}</p>{q.note&&<p>{q.note}</p>}<small>{({green:'Über dem Vergleich',amber:'Im Mittelfeld',red:'Unter dem Vergleich',unknown:'Daten fehlen'})[q.signal]}</small></article>)}</div></section>}
    {o&&<section id="geldfluesse" className="memo-section"><div className="memo-section-heading"><span>02</span><h3>Wo das Geld herkommt – und hingeht</h3></div>{o.money_story&&<p className="memo-money-story">{o.money_story}</p>}
      {o.money_metrics.length?<div className="memo-money-grid">{o.money_metrics.map(m=><Metric key={m.key} metric={m}/>)}</div>:<p className="muted">Zu Umsatz und Cashflow liegen keine übertragbaren Zahlen vor.</p>}
      <p className="memo-accounting-note">Umsatz, Gewinn und Cashflow beschreiben unterschiedliche Dinge. Umsatz ist kein Geldüberschuss; der operative Cashflow zeigt den Geldfluss aus dem laufenden Geschäft, der freie Cashflow berücksichtigt zusätzlich Investitionen.</p>
      <h4>Wofür entstehen Kosten?</h4>{o.costs.length?<><div className="memo-costs">{o.costs.map(m=><Metric key={m.key} metric={m}/>)}</div><p className="muted">Kostenarten können ineinander enthalten sein. Die Werte werden deshalb nicht addiert. Beachte den Zeitraum an jeder Zahl.</p></>:<p className="muted">Eine belastbare Aufschlüsselung, etwa für Herstellung, Forschung oder Verwaltung, ist in dieser Auswertung nicht vorhanden.</p>}
      {o.dilution&&<aside className="memo-dilution"><strong>Was bedeutet das für Aktionäre?</strong><p>{o.dilution}</p></aside>}
    </section>}
    {o?.street&&<section className="memo-section memo-street"><div><p className="eyebrow">Eine zweite Perspektive</p><h3>Modell und Analysten im Vergleich</h3><p>{o.street.meaning}</p></div><div className="memo-street-values"><div><span>Dieses Modell</span><strong>{a.model_verdict||'Nicht verfügbar'}</strong></div><div><span>Analystenkonsens{o.street.analysts!==null?' · '+o.street.analysts+' Analysten':''}</span><strong>{o.street.verdict}</strong></div></div><small>Modell und Analystenkonsens sind unterschiedliche Einschätzungen und können voneinander abweichen.</small></section>}
    {(a.top_risk||!!o?.reliability.length)&&<section className="memo-section memo-uncertainty"><div className="memo-section-heading"><span>03</span><h3>Was die Einschätzung begrenzt</h3></div>{a.top_risk&&<div><strong>Das wichtigste Risiko</strong><p>{a.top_risk}</p></div>}{!!o?.reliability.length&&<><h4>Datenlücken & Besonderheiten</h4><ul>{o.reliability.map((text,i)=><li key={i}>{text}</li>)}</ul></>}<a href="#memo">Die vollständige Herleitung im Memo lesen ↓</a></section>}
  </section>;
}
