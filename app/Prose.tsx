import {parseProse} from '../lib/prose';

function inline(text:string) {
  return text.split(/(`+[^`]+`+|\*\*[^*]+\*\*)/g).map((part,i)=>
    part.startsWith('`')?<code key={i}>{part.replace(/^`+|`+$/g,'')}</code>:
    part.startsWith('**')?<strong key={i}>{part.slice(2,-2)}</strong>:part);
}

export function Prose({text}:{text:string}) {
  return <div className="prose">{parseProse(text).map((block,i)=>{
    if(block.type==='table')return <div key={i} className="prose-table" role="region" aria-label={'Tabelle: '+block.headers.join(', ')} tabIndex={0}>
      <table><thead><tr>{block.headers.map((cell,j)=><th key={j} scope="col" style={{textAlign:block.alignments[j]}}>{inline(cell)}</th>)}</tr></thead>
        <tbody>{block.rows.map((row,j)=><tr key={j}>{row.map((cell,k)=><td key={k} style={{textAlign:block.alignments[k]}}>{inline(cell)}</td>)}</tr>)}</tbody>
      </table>
    </div>;
    if(block.type==='heading')return <h3 key={i}>{inline(block.text)}</h3>;
    if(block.type==='list')return <ul key={i}>{block.items.map((item,j)=><li key={j}>{inline(item)}</li>)}</ul>;
    return <p key={i}>{inline(block.text)}</p>;
  })}</div>;
}
