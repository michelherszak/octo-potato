export type ProseBlock =
  | {type:'paragraph'|'heading';text:string}
  | {type:'list';items:string[]}
  | {type:'table';headers:string[];alignments:('left'|'center'|'right')[];rows:string[][]};

// Split only structural pipes; escaped pipes and inline code belong to the cell.
function cells(line:string):string[]|null {
  const parts:string[]=[];
  let part='',codeRun=0;
  for(let i=0;i<line.length;i++){
    const char=line[i];
    if(char==='\\'&&i+1<line.length){
      const next=line[++i];
      part+=next==='|'?'|':'\\'+next;
    }else if(char==='`'){
      let length=1;
      while(line[i+1]==='`'){length++;i++;}
      if(!codeRun)codeRun=length;
      else if(codeRun===length)codeRun=0;
      part+='`'.repeat(length);
    }else if(char==='|'&&!codeRun){parts.push(part.trim());part='';}
    else part+=char;
  }
  if(!parts.length)return null;
  parts.push(part.trim());
  if(line.trimStart().startsWith('|'))parts.shift();
  if(parts.at(-1)===''&&line.trimEnd().endsWith('|'))parts.pop();
  return parts;
}

function tableHeader(header:string,separator:string){
  const headers=cells(header),markers=cells(separator);
  if(!headers?.length||!headers.some(Boolean)||markers?.length!==headers.length||!markers.every(cell=>/^:?-{3,}:?$/.test(cell)))return null;
  return {headers,alignments:markers.map(cell=>cell.endsWith(':')?(cell.startsWith(':')?'center':'right'):'left') as ('left'|'center'|'right')[]};
}

// Some imported memos have lost table newlines: "| A | B | | --- | --- | ...".
// Recover only complete, consistent tables, leaving ordinary pipe text intact.
function expandCollapsedTable(line:string):string[] {
  const pieces=line.split(/(?<!\\)\|[ \t]+\|/);
  if(pieces.length<3)return [line];
  const lines=pieces.map((part,i)=>(i?'|':'')+part+(i<pieces.length-1?'|':''));
  const header=tableHeader(lines[0],lines[1]);
  if(!header||!lines.slice(2).every(row=>cells(row)?.length===header.headers.length))return [line];
  return lines;
}

export function parseProse(text:string):ProseBlock[] {
  const lines=text.replace(/\r\n?/g,'\n').split('\n').flatMap(expandCollapsedTable);
  const blocks:ProseBlock[]=[];
  let paragraph:string[]=[];
  const flush=()=>{if(paragraph.length){blocks.push({type:'paragraph',text:paragraph.join('\n')});paragraph=[];}};
  for(let i=0;i<lines.length;i++){
    const line=lines[i].trim();
    if(!line){flush();continue;}
    const table=i+1<lines.length?tableHeader(line,lines[i+1].trim()):null;
    if(table){
      flush();
      const rows:string[][]=[];
      i++;
      while(i+1<lines.length){
        const row=cells(lines[i+1].trim());
        if(!row||row.length!==table.headers.length)break;
        rows.push(row);i++;
      }
      blocks.push({type:'table',...table,rows});
    }else if(/^#{1,3} /.test(line)){
      flush();blocks.push({type:'heading',text:line.replace(/^#{1,3} /,'')});
    }else if(/^[-*] /.test(line)){
      flush();
      const previous=blocks.at(-1);
      if(previous?.type==='list')previous.items.push(line.slice(2));
      else blocks.push({type:'list',items:[line.slice(2)]});
    }else paragraph.push(lines[i]);
  }
  flush();
  return blocks;
}
