import {useEffect,useId,useRef,useState} from 'react'
import {api} from '../api.js'
import Markdown from './Markdown.jsx'

const disclosureFields = [
  {
    key: 'rights_basis', label: 'Kommerzielle Nutzungsrechte', minLength: 30, maxLength: 3000,
    prompt: 'Eigene Texte, verwendete Daten und konkrete Lizenz oder Freigabe',
    lead: 'Dokumentierte Grundlage für die kommerzielle Nutzung\n',
  },
  {
    key: 'conflicts', label: 'Interessenkonflikte', minLength: 20, maxLength: 3000,
    prompt: 'Tatsächliche eigene Positionen, Vergütungen und Beziehungen. Falls keine bestehen, gib das ausdrücklich an.',
    lead: 'Angaben zu eigenen Positionen, Vergütungen und Beziehungen\n',
  },
  {
    key: 'advertising_details', label: 'Finanzierung dieses Beitrags', minLength: 20, maxLength: 2000,
    prompt: 'Wer hat den Beitrag finanziert oder beauftragt? Gab es eine Vergütung?',
    lead: 'Angaben zu Finanzierung, Auftraggebern und Vergütung\n',
  },
]

const noDisclosure = /^(?:nein|kein(?:e|er|en|em|es)?|keine angaben|nicht bekannt|unklar|offen)[.!]?$/i
const disclosurePlaceholder = '[bitte ergänzen]'

function formattedDisclosures(form) {
  const patch={}
  for(const {key,lead,maxLength} of disclosureFields){
    const notes=form?.[key]?.trim()
    if(!notes||notes===lead.trim()||notes.startsWith(lead)||notes.toLowerCase().includes(disclosurePlaceholder))continue
    const answer = notes.toLowerCase().replace(/[.!]$/, '')
    if (key === 'conflicts' && ['keine', 'keiner', 'nein'].includes(answer)) {
      patch[key] = 'Der Autor gibt an, dass für diesen Beitrag keine Interessenkonflikte bestehen.'
      continue
    }
    if (key === 'advertising_details' && ['keiner', 'keine', 'nein'].includes(answer)) {
      patch[key] = 'Der Autor gibt an, dass es für diesen Beitrag keinen externen Geldgeber oder Auftraggeber gab.'
      continue
    }
    if(noDisclosure.test(notes))continue
    const entries=notes.split(/\r?\n/).map(line=>line.trim().replace(/^[-*•]\s+/, '')).filter(Boolean)
    if(!entries.some(entry=>/[\p{L}\p{N}]/u.test(entry)))continue
    const formatted=lead+entries.join(' · ')
    if(formatted.length<=maxLength)patch[key]=formatted
  }
  return patch
}

const requiredTextFields = [
  ['title', 'Titel', 5, 180],
  ['slug', 'Artikeladresse', 3, 150],
  ['author', 'Autor', 2, 120],
  ['description', 'Kurzbeschreibung', 20, 320],
  ['thesis', 'Deine Analyse & These', 20, 30000],
  ['memo', 'Memo für die Leser', 20, 60000],
  ...disclosureFields.map(({key,label,minLength,maxLength})=>[key,label,minLength,maxLength]),
]

function fieldChecks(draft) {
  const checks = requiredTextFields.map(([key,label,min,max])=>{
    const value = draft[key] || ''
    const length = Array.from(value.trim()).length
    let issue = ''
    if (length === 0) issue = 'fehlt'
    else if (disclosureFields.some(field=>field.key===key)&&value.toLowerCase().includes(disclosurePlaceholder)) issue = 'Vorlage prüfen und Platzhalter ersetzen'
    else if (key === 'rights_basis' && noDisclosure.test(value.replace(/^Dokumentierte Grundlage für die kommerzielle Nutzung\s*/i, '').trim())) issue = 'konkrete Lizenz, Freigabe oder eigene Rechte angeben'
    else if (length < min) issue = `mindestens ${min} Zeichen`
    else if (Array.from(value).length > max) issue = `höchstens ${max} Zeichen`
    else if (key === 'slug' && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) issue = 'Kleinbuchstaben, Ziffern und Bindestriche verwenden'
    return {key,label,issue}
  })
  return [...checks,{key:'topics',label:'Themenbereiche',issue:draft.topics.length?'':'mindestens ein Thema auswählen'}]
}

function canSaveDraft(fields) {
  return !fields.some(({key,issue})=>issue&&!disclosureFields.some(field=>field.key===key))
}

export default function WebsitePublishPanel({runId,expanded=false}) {
  const [data,setData]=useState(null),[form,setForm]=useState(null),[saved,setSaved]=useState(false)
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[approved,setApproved]=useState(false)
  const [result,setResult]=useState(null),[revision,setRevision]=useState(0),[requestId,setRequestId]=useState(()=>crypto.randomUUID())
  const [sourceText,setSourceText]=useState('')
  const [notifySubscribers,setNotifySubscribers]=useState(false)
  const [researchSuggestion,setResearchSuggestion]=useState(null)
  const [assistantApplied,setAssistantApplied]=useState(false)
  const [editingWithModel,setEditingWithModel]=useState(false)
  const [assistantError,setAssistantError]=useState('')
  const [checks,setChecks]=useState({edited:false,facts_checked:false,commercial_rights_confirmed:false})
  const [reviewIssues,setReviewIssues]=useState([])
  const editVersion=useRef(0)
  const topicHintId=useId()
  const reviewed=Object.values(checks).every(Boolean)
  const hasTopics=(form?.topics.length??0)>0
  const fields=form?fieldChecks(form):[]
  const fieldIssues=fields.filter(({issue})=>issue)
  const canReview=saved&&fieldIssues.length===0&&reviewIssues.length===0
  const disclosureDrafts=formattedDisclosures(form)
  useEffect(()=>{let active=true;api.websiteDraft(runId).then(d=>{if(active){setData(d);setForm(d.editorial);setSourceText((d.editorial.additional_sources||[]).map(s=>s.title+' | '+s.url).join('\n'))}}).catch(e=>{if(active)setError(e.message)});return()=>{active=false}},[runId])
  function updateDraft(patch){
    editVersion.current+=1
    setError('')
    setAssistantError('')
    setNotifySubscribers(false)
    setChecks({edited:false,facts_checked:false,commercial_rights_confirmed:false})
    setForm(previous=>({...previous,...patch}))
    setApproved(false)
    setSaved(false)
    setResult(null)
    setRequestId(crypto.randomUUID())
  }
  function change(key,value){updateDraft({[key]:value})}
  async function suggestEdits(){
    const version=editVersion.current
    const defaults=data.defaults||{}
    const thesis=form.thesis.trim().length>=20?form.thesis:defaults.thesis
    const memo=form.memo.trim().length>=20?form.memo:defaults.memo
    setEditingWithModel(true)
    setAssistantError('')
    setAssistantApplied(false)
    try{
      const description=form.description.trim()
      const suggestion=await api.websiteEditorialSuggestion(runId,{
        thesis,memo,suggest_topics:!hasTopics,
        suggest_description:description.length<20||description===defaults.description,
      })
      if(version!==editVersion.current)return
      const metadata={}
      for(const key of ['title','author','slug',...disclosureFields.map(field=>field.key)]){
        if(!form[key]?.trim()&&defaults[key])metadata[key]=defaults[key]
      }
      if(!form.original_analysis_at&&data.article.data_as_of)metadata.original_analysis_at=data.article.data_as_of
      const patch={...metadata,...disclosureDrafts,...suggestion}
      const nextDraft={...form,...patch}
      updateDraft(patch)
      setAssistantApplied(true)
      if(canSaveDraft(fieldChecks(nextDraft)))await inspect(nextDraft)
    }catch(e){
      if(version===editVersion.current)setAssistantError(e.message)
    }finally{setEditingWithModel(false)}
  }
  async function inspect(draft=form){
    const version=editVersion.current
    setBusy(true);setError('');setApproved(false)
    try{
      const d=await api.websitePreview(runId,draft)
      if(version!==editVersion.current)return
      setSaved(true)
      setReviewIssues(d.review_issues||[])
      setRevision(d.revision)
      setData(previous=>({...previous,eligible:d.eligible,connection:d.connection}))
      if(!d.connected)setError('Entwurf gespeichert. Die Verbindung zu TechThese konnte noch nicht bestätigt werden.')
      else if(d.warning)setError(d.warning)
    }catch(e){if(version===editVersion.current)setError(e.message)}finally{setBusy(false)}
  }
  async function loadResearch(){setBusy(true);setError('');try{setResearchSuggestion(await api.websiteResearch(runId))}catch(e){setError(e.message)}finally{setBusy(false)}}
  function addResearch(){
    const research=[form.research,researchSuggestion.text].filter(Boolean).join('\n\n')
    if(research.length>20000){setError('Bitte die Recherche auf höchstens 20.000 Zeichen kürzen.');return}
    const sources=[...(form.additional_sources||[])]
    for(const source of researchSuggestion.sources)if(!sources.some(s=>s.url===source.url))sources.push(source)
    if(sources.length>40){setError('Bitte die Quellenliste auf höchstens 40 Einträge kürzen.');return}
    updateDraft({research,additional_sources:sources})
    setSourceText(sources.map(s=>s.title+' | '+s.url).join('\n'))
    setResearchSuggestion(null)
  }
  async function push(){setBusy(true);setError('');try{const d=await api.websitePush(runId,{publication_id:requestId,editorial:form,approved,notify_subscribers:notifySubscribers,...checks,expected_revision:revision,target_url:data.connection.url});setResult(d);setRevision(d.revision);setApproved(false);setRequestId(crypto.randomUUID())}catch(e){setError(e.message)}finally{setBusy(false)}}
  return <details className="lifecycle-card website-publish" open={expanded || undefined}><summary>Auf TechThese veröffentlichen · Analyse & Memo</summary>
    <p>Ergänze deine Analyse, prüfe den lesbaren Memo-Text und ordne den Beitrag den passenden Themen zu.</p>
    {error&&<div className="error" role="alert">{error}</div>}
    {!form&&!error&&<p>Veröffentlichungsentwurf wird geladen …</p>}
    {form&&<><p className="muted small">Ziel: {data.connection.url||'Website noch nicht verbunden'} · {data.eligible?'Auswertung freigegeben':'Auswertung noch nicht zur Veröffentlichung geeignet'}</p>
      <div className="website-edit-grid"><label>Titel<input value={form.title} onChange={e=>change('title',e.target.value)} maxLength={180}/></label><label>Artikeladresse<input value={form.slug} readOnly={form.mode==='update'} onChange={e=>change('slug',e.target.value)} pattern="[a-z0-9]+(-[a-z0-9]+)*"/></label><label>Autor<input value={form.author} onChange={e=>change('author',e.target.value)}/></label><label>Ursprüngliche Analyse vom<input type="date" value={form.original_analysis_at?.slice(0,10)||''} onChange={e=>change('original_analysis_at',e.target.value?e.target.value+'T00:00:00Z':'')}/></label></div>
      <fieldset className="website-mode"><legend>Art der Veröffentlichung</legend>
        <label><input type="radio" name={`mode-${runId}`} checked={form.mode!=='update'} onChange={()=>updateDraft({mode:'new',slug:data.new_slug})}/>Neuer Beitrag · die bisherige Analyse bleibt online, wer dem Unternehmen folgt, wird benachrichtigt</label>
        <label><input type="radio" name={`mode-${runId}`} checked={form.mode==='update'} disabled={!data.existing?.length} onChange={()=>updateDraft({mode:'update',slug:data.existing[0].slug})}/>Aktualisierung eines bestehenden Beitrags · ersetzt dessen Inhalt{!data.existing?.length&&' (zu diesem Unternehmen gibt es noch keinen)'}</label>
        {form.mode==='update'&&data.existing?.length>0&&<label>Beitrag<select value={form.slug} onChange={e=>change('slug',e.target.value)}>{data.existing.map(a=><option key={a.slug} value={a.slug}>{a.title} · {(a.published_at||'').slice(0,10)} · Fassung {a.revision}</option>)}</select></label>}
      </fieldset>
      <label>Kurzbeschreibung<textarea aria-label="Kurzbeschreibung" rows={3} value={form.description} onChange={e=>change('description',e.target.value)} maxLength={320}/></label>
      <fieldset aria-describedby={topicHintId}>
        <legend>Themenbereiche</legend>
        <p id={topicHintId} className="muted small">Wähle mindestens einen passenden Themenbereich. Mehrfachauswahl ist möglich.</p>
        <div className="website-topics">{data.topics.map(t=><label key={t.id}><input type="checkbox" checked={form.topics.includes(t.id)} onChange={e=>change('topics',e.target.checked?[...form.topics,t.id]:form.topics.filter(id=>id!==t.id))}/>{t.name}</label>)}</div>
      </fieldset>
      <fieldset disabled={busy||!data.eligible}><legend>Redaktionsassistent</legend>
        <p>Der Assistent füllt den Entwurf aus und formuliert bei Bedarf die Kurzbeschreibung zum Unternehmen. Trage belegte Nutzungsrechte, Interessenkonflikte und Finanzierung unten als Stichpunkte ein, damit er auch diese drei Felder ausarbeiten kann.</p>
        <button type="button" className="ghost" disabled={editingWithModel} onClick={suggestEdits}>{editingWithModel?'Publikationsentwurf wird ausgearbeitet …':'Publikationsentwurf ausfüllen'}</button>
        {assistantError&&<p className="error" role="alert">{assistantError}</p>}
        {assistantApplied&&<p role="status">Der Assistent hat den Entwurf ausgefüllt. Die Feldprüfung steht bei „Entwurf speichern & prüfen“.</p>}
      </fieldset>
      <label>Deine Analyse & These<textarea aria-label="Deine Analyse & These" rows={7} value={form.thesis} onChange={e=>change('thesis',e.target.value)}/></label>
      <fieldset disabled={busy}><legend>Recherche & Memo verbinden</legend>
        <p>Die Recherche erscheint zusammen mit deiner These vor dem finanziellen Memo. Quellen und Datenstand bleiben sichtbar; das gespeicherte Modellurteil bleibt unverändert.</p>
        <button type="button" className="ghost" onClick={loadResearch}>{busy?'Recherche wird geladen …':'Recherchevorschlag laden · OpenAlex, Metriq & gespeicherte Meldungen'}</button>
        {researchSuggestion&&<section aria-label="Recherchevorschlag">{researchSuggestion.warnings.map((warning,i)=><p key={i} className="muted small">{warning}</p>)}
          {researchSuggestion.text&&<><Markdown text={researchSuggestion.text} preserveNumbers/><ul>{researchSuggestion.sources.map(source=><li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a></li>)}</ul><button type="button" onClick={addResearch}>Recherche und Quellen in den Entwurf übernehmen</button></>}
        </section>}
        <label>Recherche für die Leser<textarea aria-label="Recherche für die Leser" rows={9} maxLength={20000} value={form.research||''} onChange={e=>change('research',e.target.value)} placeholder="Forschungsergebnis oder Projekt, Datum, Unternehmensrolle und Quelle; danach Bedeutung und Grenzen für die Investmentthese."/></label>
        <p className="muted small">Projektbeteiligungen benötigen einen eigenen Beleg. OpenAlex-Suchtreffer bestätigen keine Unternehmensrolle. Ergänze geprüfte Projekte mit Rolle, Datum, Quelle und wirtschaftlicher Bedeutung. Zusätzliche Belege unten in die Quellenliste aufnehmen.</p>
      </fieldset>
      <label>Memo für die Leser<textarea aria-label="Memo für die Leser" rows={12} value={form.memo} onChange={e=>change('memo',e.target.value)}/></label>
      <label>Weitere Quellen für deine Analyse · je Zeile: Titel | https://Adresse<textarea aria-label="Weitere Quellen" rows={3} value={sourceText} onChange={e=>{setSourceText(e.target.value);change('additional_sources',e.target.value.split('\n').filter(s=>s.trim()).map(s=>{const at=s.indexOf('|');return {title:at<0?s.trim():s.slice(0,at).trim(),url:at<0?'':s.slice(at+1).trim()}}))}}/></label>
      <fieldset><legend>Rechte und Transparenz für eine Website mit Werbeeinnahmen</legend>
      <p>Trage deine tatsächlichen Angaben als Stichpunkte ein. „Publikationsentwurf ausfüllen“ arbeitet sie lokal aus.</p>
      {disclosureFields.map(({key,label,prompt,minLength,maxLength})=><label key={key}>{label}
        <small>{prompt}</small><textarea value={form[key]||''} onChange={e=>change(key,e.target.value)} minLength={minLength} maxLength={maxLength}/>
      </label>)}
      {Object.keys(disclosureDrafts).length>0&&<button type="button" className="ghost" disabled={busy} onClick={()=>updateDraft(disclosureDrafts)}>Angaben ausformulieren</button>}
      <p>Allgemeine Werbeeinnahmen sind vorgesehen. Bezahlte Beiträge und Affiliate-Inhalte bleiben bis zur gesonderten Prüfung gesperrt. Ein Quellenlink ersetzt keine kommerzielle Datenlizenz.</p></fieldset>
      {fieldIssues.length>0&&<div className="error"><strong>Diese Felder brauchen noch Angaben oder eine Korrektur.</strong><ul>{fieldIssues.map(({key,label,issue})=><li key={key}>{label} ({issue})</li>)}</ul></div>}
      <details><summary>Feldprüfung · {fields.length-fieldIssues.length} von {fields.length} Pflichtfeldern ausgefüllt</summary>
        <ul>{fields.map(({key,label,issue})=><li key={key}>{label} ({issue||'ausgefüllt'})</li>)}
          <li>Ursprüngliche Analyse vom ({form.original_analysis_at?'ausgefüllt':'optional · leer'})</li>
          <li>Recherche für die Leser ({form.research?.trim()?'ausgefüllt':'optional · leer'})</li>
          <li>Weitere Quellen ({form.additional_sources?.length?'ausgefüllt':'optional · leer'})</li>
        </ul>
      </details>
      <button type="button" className="ghost" disabled={busy||editingWithModel||!canSaveDraft(fields)} onClick={()=>inspect()}>Entwurf speichern & prüfen</button>
      {saved&&reviewIssues.length>0&&<div className="error" role="alert"><strong>Entwurf gespeichert. Vor der Freigabe fehlen noch folgende Schritte.</strong><ul>{reviewIssues.map(issue=><li key={issue}>{issue}</li>)}</ul></div>}
      {canReview&&<p role="status">Entwurf gespeichert. Du kannst jetzt die redaktionelle Prüfung bestätigen.</p>}
      <fieldset disabled={!canReview||busy}><legend>Prüfung dieses Entwurfs</legend>{[
        ['edited','Ich habe die redaktionelle Überarbeitung geprüft und Analyse und Memo vollständig gelesen.'],
        ['facts_checked','Ich habe Fakten, Quellen, Datenstand, Risiken und Interessenkonflikte geprüft.'],
        ['commercial_rights_confirmed','Die erforderlichen Rechte für die Veröffentlichung einschließlich kommerzieller Nutzung liegen vor; die Grundlage ist oben dokumentiert.']
      ].map(([key,label])=><label key={key}><input type="checkbox" checked={checks[key]} onChange={e=>{setChecks(c=>({...c,[key]:e.target.checked}));setApproved(false)}}/>{label}</label>)}</fieldset>
      {saved&&<div className="website-notify"><label><input type="checkbox" checked={notifySubscribers} disabled={busy} onChange={e=>{setNotifySubscribers(e.target.checked);setApproved(false);setRequestId(crypto.randomUUID())}}/>Abonnentenbenachrichtigung anfragen</label><p className="muted small">Der E-Mail-Versand hängt vom Zustelldienst der Zielwebsite ab.</p></div>}
      <label className="website-approval"><input type="checkbox" checked={approved} disabled={!canReview||!reviewed||busy} onChange={e=>setApproved(e.target.checked)}/>Ich habe Text, Kennzahlen, Quellen und Themen geprüft und gebe diesen Beitrag frei.</label>
      <button type="button" className="primary" disabled={busy||!reviewed||!approved||!canReview||!data.eligible||!data.connection.configured} onClick={push}>{busy?'Bitte warten …':revision?'Aktualisierte Version veröffentlichen':'Auf Website veröffentlichen'}</button>
      {result&&<p role="status">Veröffentlicht als Version {result.revision}. <a href={result.url} target="_blank" rel="noopener noreferrer">Artikel ansehen ↗</a>{typeof result.notifications_queued==='number'?<> · {result.notifications_queued} E-Mail-Benachrichtigungen vorgemerkt.</>:result.notification_requested&&<> · Benachrichtigungswunsch gespeichert.</>}</p>}
    </>}
  </details>
}
