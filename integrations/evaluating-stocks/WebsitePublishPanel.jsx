import {useEffect,useState} from 'react'
import {api} from '../api.js'
import Markdown from './Markdown.jsx'

export default function WebsitePublishPanel({runId}) {
  const [data,setData]=useState(null),[form,setForm]=useState(null),[preview,setPreview]=useState(null)
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[approved,setApproved]=useState(false)
  const [result,setResult]=useState(null),[revision,setRevision]=useState(0),[requestId,setRequestId]=useState(()=>crypto.randomUUID())
  const [sourceText,setSourceText]=useState('')
  useEffect(()=>{let active=true;api.websiteDraft(runId).then(d=>{if(active){setData(d);setForm(d.editorial)}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[runId])
  function change(key,value){setForm(f=>({...f,[key]:value}));setApproved(false);setPreview(null);setResult(null);setRequestId(crypto.randomUUID())}
  async function inspect(){setBusy(true);setError('');try{const d=await api.websitePreview(runId,form);setPreview(d.article);setRevision(d.revision);if(!d.connected)setError('Vorschau bereit; die Website-Verbindung konnte noch nicht bestätigt werden.')}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function push(){setBusy(true);setError('');try{const d=await api.websitePush(runId,{publication_id:requestId,editorial:form,approved,expected_revision:revision});setResult(d);setRevision(d.revision);setApproved(false);setRequestId(crypto.randomUUID())}catch(e){setError(e.message)}finally{setBusy(false)}}
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
      <button type="button" className="ghost" disabled={busy} onClick={inspect}>Entwurf speichern & prüfen</button>
      {preview&&<section className="website-preview"><h2>{preview.title}</h2><p>{preview.description}</p><Markdown text={preview.thesis}/><h3>Kennzahlen</h3><div className="website-edit-grid">{preview.metrics.map(m=><div key={m.key}><strong>{m.label}: {m.value}</strong><p>{m.explanation}</p><small>{m.period} · {m.source}</small></div>)}</div><h3>Memo</h3><Markdown text={preview.memo}/><p>{preview.sources.length} Quellen werden übertragen. Private Research-Notizen gehören nicht zum Paket.</p></section>}
      <label className="website-approval"><input type="checkbox" checked={approved} disabled={!preview} onChange={e=>setApproved(e.target.checked)}/>Ich habe Text, Kennzahlen, Quellen und Themen geprüft und gebe diesen Beitrag frei.</label>
      <button type="button" className="primary" disabled={busy||!approved||!preview||!data.eligible||!data.connection.configured} onClick={push}>{busy?'Übertragung läuft …':revision?'Aktualisierte Version veröffentlichen':'Auf Website veröffentlichen'}</button>
      {result&&<p role="status">Veröffentlicht als Version {result.revision}. <a href={result.url} target="_blank" rel="noopener noreferrer">Artikel ansehen ↗</a></p>}
    </>}
  </details>
}
