import type {VisitorFunnel} from './analytics.ts';

export const WIDTH=960;
export const HEIGHT=420;
const PAD={top:34,bottom:26,left:8,right:188};
export const NODE_WIDTH=13;
const NODE_GAP=2;

export type Box={id:string;label:string;column:number;sessions:number;x:number;y:number;height:number;isExit:boolean;medianDwellMs:number|null;fastShare:number|null};
export type Ribbon={id:string;path:string;sessions:number;kind:'continue'|'exit';from:string;to:string};

export const seconds=(ms:number)=>ms>=60_000?Math.round(ms/60_000)+' min':Math.max(1,Math.round(ms/1000))+' s';
export const percent=(part:number,whole:number)=>whole?Math.round((part/whole)*100)+' %':'0 %';

export function layout(funnel:VisitorFunnel){
  const columns=funnel.steps+1;
  const columnWidth=(WIDTH-PAD.left-PAD.right-NODE_WIDTH)/(columns-1);
  const plotHeight=HEIGHT-PAD.top-PAD.bottom;
  const boxes:Box[]=[];
  for(let column=0;column<columns;column++){
    const entries=funnel.nodes.filter(node=>node.step===column);
    const total=entries.reduce((sum,entry)=>sum+entry.sessions,0);
    const gaps=NODE_GAP*Math.max(0,entries.length-1);
    const scale=total?(plotHeight-gaps)/total:0;
    let y=PAD.top;
    for(const entry of entries){
      const height=Math.max(3,entry.sessions*scale);
      boxes.push({
        id:entry.id,label:entry.kind==='exit'?'Absprung: '+entry.label:entry.label,
        column,sessions:entry.sessions,x:PAD.left+column*columnWidth,y,height,
        isExit:entry.kind==='exit',medianDwellMs:entry.medianDwellMs,
        fastShare:entry.measured?entry.fast/entry.measured:null,
      });
      y+=height+NODE_GAP;
    }
  }
  const byId=new Map(boxes.map(box=>[box.id,box] as const));
  const outUsed=new Map<string,number>();
  const inUsed=new Map<string,number>();
  const ribbons:Ribbon[]=[];
  // Bänder in Spaltenreihenfolge legen, damit sich Quell- und Zielkanten deckungsgleich stapeln.
  const sorted=[...funnel.links].sort((a,b)=>{
    const from=byId.get(a.from),to=byId.get(b.from);
    return (from?.y||0)-(to?.y||0)||(byId.get(a.to)?.y||0)-(byId.get(b.to)?.y||0);
  });
  for(const link of sorted){
    const source=byId.get(link.from);
    const target=byId.get(link.to);
    if(!source||!target)continue;
    const thickness=Math.max(1,link.sessions*(source.height/Math.max(1,source.sessions)));
    const sourceOffset=outUsed.get(source.id)||0;
    const targetOffset=inUsed.get(target.id)||0;
    const y0=source.y+sourceOffset;
    const y1=target.y+targetOffset;
    outUsed.set(source.id,sourceOffset+thickness);
    inUsed.set(target.id,targetOffset+thickness);
    const x0=source.x+NODE_WIDTH;
    const x1=target.x;
    const curve=(x0+x1)/2;
    const path=`M${x0},${y0} C${curve},${y0} ${curve},${y1} ${x1},${y1} L${x1},${y1+thickness} C${curve},${y1+thickness} ${curve},${y0+thickness} ${x0},${y0+thickness} Z`;
    ribbons.push({id:link.from+'>'+link.to,path,sessions:link.sessions,kind:link.kind,from:source.label,to:target.label});
  }
  return {boxes,ribbons,columnWidth};
}

