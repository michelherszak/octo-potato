'use client';

import {useMemo,useState} from 'react';
import type {VisitorFunnel} from '@/lib/analytics';
import {layout,NODE_WIDTH,percent,seconds,WIDTH,HEIGHT} from '@/lib/visitor-flow';

type Hover={title:string;detail:string;x:number;y:number};

export default function VisitorFlow({funnel}:{funnel:VisitorFunnel}){
  const [hover,setHover]=useState<Hover|null>(null);
  const {boxes,ribbons}=useMemo(()=>layout(funnel),[funnel]);
  if(!funnel.sessions)return <div className="admin-empty"><h3>Noch keine Statistikdaten</h3><p>Der Besuchsverlauf erscheint hier, sobald ein Besucher der anonymen Statistik zugestimmt hat.</p></div>;
  const firstExit=funnel.nodes.filter(node=>node.kind==='exit'&&node.step===1).reduce((sum,node)=>sum+node.sessions,0);
  return <div className="flow">
    <div className="flow-legend">
      <span><i className="flow-swatch is-continue" aria-hidden="true"/> Weiter zur nächsten Seite</span>
      <span><i className="flow-swatch is-exit" aria-hidden="true"/> Absprung</span>
      <span><i className="flow-swatch is-fast" aria-hidden="true"/> Kurzaufenthalt: halbe Verweildauer unter 10 Sekunden</span>
      <span className="flow-note">{funnel.sessions} Besuche · Pause über 30 Minuten zählt als neuer Besuch</span>
    </div>
    <div className="flow-canvas" onMouseLeave={()=>setHover(null)}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`Besuchsverlauf über ${funnel.steps} Seiten. ${funnel.sessions} Besuche, davon ${firstExit} Absprünge nach der ersten Seite.`}>
        {Array.from({length:funnel.steps},(_,step)=><text key={step} className="flow-step" x={boxes.find(box=>box.column===step)?.x??0} y={18}>{step+1}. Seite</text>)}
        <g>{ribbons.map(ribbon=><path key={ribbon.id} d={ribbon.path} className={'flow-ribbon '+(ribbon.kind==='exit'?'is-exit':'is-continue')}
          onMouseEnter={event=>setHover({title:ribbon.from+' → '+ribbon.to,detail:ribbon.sessions+' Besuche · '+percent(ribbon.sessions,funnel.sessions)+' aller Besuche',x:event.clientX,y:event.clientY})}
          onMouseMove={event=>setHover(current=>current?{...current,x:event.clientX,y:event.clientY}:current)}/>)}</g>
        <g>{boxes.map(box=><rect key={box.id} x={box.x} y={box.y} width={NODE_WIDTH} height={box.height} rx={3} className={'flow-node '+(box.isExit?'is-exit':'is-continue')+(box.fastShare!==null&&box.fastShare>=0.5?' is-fast':'')}
          onMouseEnter={event=>setHover({title:box.label,detail:box.sessions+' Besuche · '+percent(box.sessions,funnel.sessions)+' · '+(box.medianDwellMs===null?'Verweildauer nicht messbar':'Verweildauer im Mittel '+seconds(box.medianDwellMs)),x:event.clientX,y:event.clientY})}
          onMouseMove={event=>setHover(current=>current?{...current,x:event.clientX,y:event.clientY}:current)}/>)}</g>
        <g>{boxes.filter(box=>box.height>=14).map(box=><text key={box.id+'-label'} className={'flow-label '+(box.isExit?'is-exit':'')}
          x={box.x+NODE_WIDTH+6} y={box.y+box.height/2+4}>{box.label} <tspan className="flow-value">{box.sessions}</tspan>{box.medianDwellMs!==null&&<tspan className="flow-dwell"> · ø {seconds(box.medianDwellMs)}</tspan>}{box.fastShare!==null&&box.fastShare>=0.5&&<tspan className="flow-dwell is-fast"> · kurz</tspan>}</text>)}</g>
      </svg>
      {hover&&<div className="flow-tooltip" style={{left:hover.x,top:hover.y}} role="status"><strong>{hover.title}</strong><span>{hover.detail}</span></div>}
    </div>
    <details className="flow-table">
      <summary>Zahlen als Tabelle</summary>
      <table>
        <caption>Besuche je Seite und Stufe, mit Absprüngen und mittlerer Verweildauer</caption>
        <thead><tr><th scope="col">Stufe</th><th scope="col">Seite</th><th scope="col">Besuche</th><th scope="col">Anteil</th><th scope="col">Verweildauer</th></tr></thead>
        <tbody>{boxes.map(box=><tr key={box.id+'-row'} className={box.isExit?'is-exit':''}>
          <td>{box.isExit?'—':box.column+1}</td><td>{box.label}</td><td>{box.sessions}</td><td>{percent(box.sessions,funnel.sessions)}</td><td>{box.medianDwellMs===null?'—':seconds(box.medianDwellMs)+(box.fastShare!==null&&box.fastShare>=0.5?' (kurz)':'')}</td>
        </tr>)}</tbody>
      </table>
    </details>
  </div>;
}
