import {useEffect,useState} from 'react'
import {api} from '../api.js'
import Markdown from './Markdown.jsx'
import WebsiteMemoPreview from './WebsiteMemoPreview.jsx'

export default function WebsitePublishPanel({runId}) {
  const [data,setData]=useState(null),[form,setForm]=useState(null),[preview,setPreview]=useState(null)
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[approved,setApproved]=useState(false)
  const [result,setResult]=useState(null),[revision,setRevision]=useState(0),[requestId,setRequestId]=useState(()=>crypto.randomUUID())
  const [sourceText,setSourceText]=useState('')
  const [notifySubscribers,setNotifySubscribers]=useState(false)
  const [checks,setChecks]=useState({edited:false,facts_checked:false,commercial_rights_confirmed:false})
  const reviewed=Object.values(checks).every(Boolean)
  useEffect(()=>{let active=true;api.websiteDraft(runId).then(d=>{if(active){setData(d);setForm(d.editorial);setSourceText((d.editorial.additional_sources||[]).map(s=>s.title+' | '+s.url).join('\n'))}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[runId])
  function change(key,value){setNotifySubscribers(false);setChecks({edited:false,facts_checked:false,commercial_rights_confirmed:false});setForm(f=>({...f,[key]:value}));setApproved(false);setPreview(null);setResult(null);setRequestId(crypto.randomUUID())}
  async function inspect(){setBusy(true);setError('');setApproved(false);try{const d=await api.websitePreview(runId,form);setPreview(d.article);setRevision(d.revision);setData(previous=>({...previous,connection:d.connection}));if(!d.connected)setError('Vorschau bereit; die Website-Verbindung konnte noch nicht bestätigt werden.')}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function push(){setBusy(true);setError('');try{const d=await api.websitePush(runId,{publication_id:requestId,editorial:form,approved,notify_subscribers:notifySubscribers,...checks,expected_revision:revision,target_url:data.connection.url});setResult(d);setRevision(d.revision);setApproved(false);setRequestId(crypto.randomUUID())}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <details className="lifecycle-card website-publish"><summary>Auf TechThese veröffentlichen · Analyse & Memo</summary>
    <p>Ergänze deine Analyse, prüfe den lesbaren Memo-Text und ordne den Beitrag den passenden Themen zu.</p>
    {error&&<div className="error" role="alert">{error}</div>}
    {!form&&!error&&<p>Veröffentlichungsentwurf wird geladen …</p>}
    {form&&<><p className="muted small">Ziel: {data.connection.url||'Website noch nicht verbunden'} · {data.eligible?'Auswertung freigegeben':'Auswertung noch nicht zur Veröffentlichung geeignet'}</p>
      <div className="website-edit-grid"><label>Titel<input value={form.title} onChange={e=>change('title',e.target.value)} maxLength={180}/></label><label>Artikeladresse<input value={form.slug} onChange={e=>change('slug',e.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*"/></label><label>Autor<input value={form.author} onChange={e=>change('author',e.target.value)}/></label><label>Ursprüngliche Analyse vom<input type="date" value={form.original_analysis_at?.slice(0,10)||''} onChange={e=>change('original_analysis_at',e.target.value?e.target.value+'T00:00:00Z':'')}/></label></div>
      <label>Kurzbeschreibung<textarea aria-label="Kurzbeschreibung" rows={3} value={form.description} onChange={e=>change('description',e.target.value)} maxLength={320}/></label>
      <fieldset><legend>Themenbereiche · mehrere möglich</legend><div className="website-topics">{data.topics.map(t=><label key={t.id}><input type="checkbox" checked={form.topics.includes(t.id)} onChange={e=>change('topics',e.target.checked?[...form.topics,t.id]:form.topics.filter(id=>id!==t.id))}/>{t.name}</label>)}</div></fieldset>
      <label>Deine Analyse & These<textarea aria-label="Deine Analyse & These" rows={7} value={form.thesis} onChange={e=>change('thesis',e.target.value)}/></label>
      <label>Memo für die Leser<textarea aria-label="Memo für die Leser" rows={12} value={form.memo} onChange={e=>change('memo',e.target.value)}/></label>
      <label>Weitere Quellen für deine Analyse · je Zeile: Titel | https://Adresse<textarea aria-label="Weitere Quellen" rows={3} value={sourceText} onChange={e=>{setSourceText(e.target.value);change('additional_sources',e.target.value.split('\n').filter(s=>s.trim()).map(s=>{const at=s.indexOf('|');return {title:at<0?s.trim():s.slice(0,at).trim(),url:at<0?'':s.slice(at+1).trim()}}))}}/></label>
      <fieldset><legend>Rechte und Transparenz für eine Website mit Werbeeinnahmen</legend>
      <label>Kommerzielle Nutzungsrechte · Herkunft, eigene Texte und konkrete Lizenzen<textarea value={form.rights_basis||''} onChange={e=>change('rights_basis',e.target.value)} minLength={30}/></label>
      <label>Interessenkonflikte · eigene Positionen, Vergütungen, Beziehungen; auch wenn keine bestehen<textarea value={form.conflicts||''} onChange={e=>change('conflicts',e.target.value)} minLength={20}/></label>
      <label>Finanzierung dieses Beitrags · konkrete Angaben zu Vergütung und Auftraggebern<textarea value={form.advertising_details||''} onChange={e=>change('advertising_details',e.target.value)} minLength={20}/></label>
      <p>Allgemeine Werbeeinnahmen sind vorgesehen. Bezahlte Beiträge und Affiliate-Inhalte bleiben bis zur gesonderten Prüfung gesperrt. Ein Quellenlink ersetzt keine kommerzielle Datenlizenz.</p></fieldset>
      <button type="button" className="ghost" disabled={busy} onClick={inspect}>Entwurf speichern & prüfen</button>
      {preview&&<section className="website-preview"><h2>{preview.title}</h2><p>{preview.description}</p><WebsiteMemoPreview article={preview}/><Markdown text={preview.thesis}/><h3>Rechte & Interessenkonflikte</h3><p>{form.rights_basis}</p><p>{form.conflicts}</p><p>{form.advertising_details}</p><h3>Kennzahlen</h3><div className="website-edit-grid">{preview.metrics.map(m=><div key={m.key}><strong>{m.label}: {m.value}</strong><p>{m.explanation}</p><small>{m.period} · {m.source}</small></div>)}</div><h3>Memo</h3><Markdown text={preview.memo}/><p>{preview.sources.length} Quellen werden übertragen. Private Research-Notizen gehören nicht zum Paket.</p></section>}
      <fieldset disabled={!preview||busy}><legend>Prüfung dieses Entwurfs</legend>{[
        ['edited','Ich habe Analyse und Memo selbst redaktionell nachbearbeitet und vollständig gelesen.'],
        ['facts_checked','Ich habe Fakten, Quellen, Datenstand, Risiken und Interessenkonflikte geprüft.'],
        ['commercial_rights_confirmed','Die erforderlichen Rechte für die Veröffentlichung einschließlich kommerzieller Nutzung liegen vor; die Grundlage ist oben dokumentiert.']
      ].map(([key,label])=><label key={key}><input type="checkbox" checked={checks[key]} onChange={e=>{setChecks(c=>({...c,[key]:e.target.checked}));setApproved(false)}}/>{label}</label>)}</fieldset>
      {preview&&<div className="website-notify">{revision>0?<label><input type="checkbox" checked={notifySubscribers} onChange={e=>{setNotifySubscribers(e.target.checked);setApproved(false);setRequestId(crypto.randomUUID())}}/>Abonnenten über diese inhaltliche Aktualisierung informieren.</label>:<p>Neue Beiträge werden automatisch an bestätigte Abonnenten des Unternehmens gemeldet.</p>}<p className="muted small">Wiederholte Übertragungen lösen keine zweite E-Mail aus. Kleine Korrekturen kannst du ohne Benachrichtigung veröffentlichen.</p></div>}
      <label className="website-approval"><input type="checkbox" checked={approved} disabled={!preview||!reviewed||busy} onChange={e=>setApproved(e.target.checked)}/>Ich habe Text, Kennzahlen, Quellen und Themen geprüft und gebe diesen Beitrag frei.</label>
      <button type="button" className="primary" disabled={busy||!reviewed||!approved||!preview||!data.eligible||!data.connection.configured} onClick={push}>{busy?'Übertragung läuft …':revision?'Aktualisierte Version veröffentlichen':'Auf Website veröffentlichen'}</button>
      {result&&<p role="status">Veröffentlicht als Version {result.revision}. <a href={result.url} target="_blank" rel="noopener noreferrer">Artikel ansehen ↗</a>{typeof result.notifications_queued==='number'&&<> · {result.notifications_queued} E-Mail-Benachrichtigungen vorgemerkt.</>}</p>}
    </>}
  </details>
}
