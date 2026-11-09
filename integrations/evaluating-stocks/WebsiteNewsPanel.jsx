import {useState} from 'react'
import {api} from '../api.js'

// Meldungen der letzten 30 Tage aus SEC EDGAR. Geladen wird erst auf Knopfdruck,
// damit nicht jedes geöffnete Memo eine Anfrage bei der SEC auslöst.
export default function WebsiteNewsPanel({runId}) {
  const [data,setData]=useState(null),[entries,setEntries]=useState([])
  const [reviewer,setReviewer]=useState(''),[conflicts,setConflicts]=useState('')
  const [approved,setApproved]=useState(false),[requestId,setRequestId]=useState(()=>crypto.randomUUID())
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[result,setResult]=useState(null)
  const selected=entries.filter(e=>e.include)
  const complete=selected.every(e=>e.headline.trim().length>=8)&&reviewer.trim().length>=2&&conflicts.trim().length>=20

  function changed(){setApproved(false);setResult(null);setRequestId(crypto.randomUUID())}
  function edit(index,key,value){setEntries(list=>list.map((e,i)=>i===index?{...e,[key]:value}:e));changed()}
  async function load(){setBusy(true);setError('');try{const d=await api.websiteNews(runId);setData(d);setEntries(d.drafts);changed()}catch(e){setError(e.message)}finally{setBusy(false)}}
  async function push(){setBusy(true);setError('');try{setResult(await api.websiteNewsPush(runId,{approved,publication_id:requestId,target_url:data.target_url,reviewer,conflicts,entries}))}catch(e){setError(e.message)}finally{setBusy(false)}}

  return <details className="lifecycle-card website-publish website-news"><summary>Auf TechThese veröffentlichen · Meldungen der letzten 30 Tage</summary>
    <p>Pflichtveröffentlichungen bei der SEC als Grundlage. Überschrift und Zusammenfassung schreibst du in eigenen Worten; verlinkt wird die Originaleinreichung.</p>
    {error&&<div className="error" role="alert">{error}</div>}
    <button type="button" className="ghost" disabled={busy} onClick={load}>{busy&&!data?'Meldungen werden geladen …':data?'Erneut laden':'Meldungen laden'}</button>
    {data&&<>
      <p className="muted small">{data.name} ({data.ticker}) · {data.since} bis {data.until} · {entries.length} Entwürfe · Ziel: {data.target_url}</p>
      {!entries.length&&<p>In diesem Zeitraum gibt es keine Einreichungen, die als Meldung infrage kommen. Eine leere Übertragung zeigt auf der Website „keine Ereignisse“.</p>}
      <ol className="website-news-list">{entries.map((e,index)=><li key={e.date+e.category+index} className={e.include?'':'is-off'}>
        <label className="website-news-pick"><input type="checkbox" checked={e.include} onChange={x=>edit(index,'include',x.target.checked)}/>{e.date} · {data.categories[e.category]} · <a href={e.source_url} target="_blank" rel="noopener noreferrer">{e.source} ↗</a></label>
        {e.hint&&<p className="muted small">Titel der Anlage: {e.hint}</p>}
        {e.include&&<><label>Überschrift in eigenen Worten<input value={e.headline} maxLength={180} onChange={x=>edit(index,'headline',x.target.value)}/></label>
          <label>Zusammenfassung · optional<textarea rows={2} maxLength={600} value={e.summary} onChange={x=>edit(index,'summary',x.target.value)}/></label></>}
      </li>)}</ol>
      <fieldset><legend>Prüfung</legend>
        <label>Geprüft von<input value={reviewer} maxLength={120} onChange={x=>{setReviewer(x.target.value);changed()}}/></label>
        <label>Interessenkonflikte · auch wenn keine bestehen<textarea rows={2} value={conflicts} minLength={20} onChange={x=>{setConflicts(x.target.value);changed()}}/></label>
      </fieldset>
      <label className="website-approval"><input type="checkbox" checked={approved} disabled={!complete||busy} onChange={x=>setApproved(x.target.checked)}/>Ich habe die ausgewählten Meldungen gegen die Originaleinreichungen geprüft und gebe sie frei.</label>
      <button type="button" className="primary" disabled={busy||!approved||!complete} onClick={push}>{busy?'Übertragung läuft …':`${selected.length} ${selected.length===1?'Meldung':'Meldungen'} übertragen`}</button>
      {result&&<p role="status">Übertragen: {result.items} {result.items===1?'Meldung':'Meldungen'}. <a href={data.target_url+'/unternehmen/'+encodeURIComponent(data.ticker)} target="_blank" rel="noopener noreferrer">Unternehmensseite ansehen ↗</a></p>}
    </>}
  </details>
}
