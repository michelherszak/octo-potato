import {BENCHMARK,compare,type Bar,type Comparison} from './benchmark.ts';

type Snapshot={bars:Bar[];checkedAt:number;unavailable:boolean};
// Tageskurse ändern sich höchstens einmal je Handelstag; ein Ausfall wird kurz zwischengespeichert.
const TTL=6*60*60_000;
const RETRY=5*60_000;
const MAX_BYTES=1_500_000;
const SYMBOL=/^[A-Z0-9.-]{1,15}$/;

const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'?value as Record<string,unknown>:{};

// Dividendenbereinigte Schlusskurse aus der Chart-Antwort; Lücken werden übersprungen.
export function parseChart(json:unknown):Bar[]{
  const result=object((object(object(json).chart).result as unknown[]|undefined)?.[0]);
  const timestamps=Array.isArray(result.timestamp)?result.timestamp as unknown[]:[];
  const indicators=object(result.indicators);
  const adjusted=object((indicators.adjclose as unknown[]|undefined)?.[0]).adjclose;
  const raw=object((indicators.quote as unknown[]|undefined)?.[0]).close;
  const closes=(Array.isArray(adjusted)?adjusted:Array.isArray(raw)?raw:[]) as unknown[];
  const offset=Number(object(result.meta).gmtoffset)||0;
  const seen=new Set<string>();
  return timestamps.flatMap((stamp,index)=>{
    const price=closes[index];
    if(typeof stamp!=='number'||typeof price!=='number'||!Number.isFinite(price)||price<=0)return [];
    // Datum in der Zeitzone der Börse, nicht in UTC.
    const date=new Date((stamp+offset)*1000).toISOString().slice(0,10);
    if(seen.has(date))return [];
    seen.add(date);
    return [{date,close:price}];
  });
}

async function readLimited(response:Response):Promise<string>{
  if(!response.ok||Number(response.headers.get('content-length'))>MAX_BYTES)throw new Error('Kursdaten nicht verfügbar');
  const reader=response.body?.getReader();
  if(!reader)return '';
  const chunks:Uint8Array[]=[];let length=0;
  try{
    for(;;){
      const {value,done}=await reader.read();
      if(done)break;
      length+=value.byteLength;
      if(length>MAX_BYTES){await reader.cancel();throw new Error('Kursdaten zu groß');}
      chunks.push(value);
    }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  return new TextDecoder().decode(bytes);
}

// Die Adresse ist fest; eingesetzt wird nur ein geprüftes Kürzel. Keine Besucher- oder Kontodaten.
export function createPriceLoader(fetcher:typeof fetch=fetch,clock=Date.now){
  const cache=new Map<string,Snapshot>();
  const pending=new Map<string,Promise<Snapshot>>();
  return async function load(symbol:string):Promise<Snapshot>{
    symbol=symbol.trim().toUpperCase();
    if(!SYMBOL.test(symbol))return {bars:[],checkedAt:clock(),unavailable:true};
    const previous=cache.get(symbol);
    if(previous&&clock()-previous.checkedAt<(previous.unavailable?RETRY:TTL))return previous;
    const existing=pending.get(symbol);
    if(existing)return existing;
    const request=(async()=>{
      let snapshot:Snapshot;
      try{
        const url='https://query1.finance.yahoo.com/v8/finance/chart/'+encodeURIComponent(symbol)+'?'+
          new URLSearchParams({range:'5y',interval:'1d',events:'div,split'});
        const response=await fetcher(url,{headers:{Accept:'application/json','User-Agent':'TechThese/1.0'},
          signal:AbortSignal.timeout(6000),redirect:'manual',
          cf:{cacheTtlByStatus:{'200-299':21600,'400-599':0},cacheEverything:true}} as RequestInit);
        const bars=parseChart(JSON.parse(await readLimited(response)));
        if(bars.length<2)throw new Error('Zu wenige Kurse');
        snapshot={bars,checkedAt:clock(),unavailable:false};
      }catch(error){
        console.warn('Kursdaten nicht verfügbar',symbol,error instanceof Error?error.message:'Abruf fehlgeschlagen');
        // Bekannte Kurse bleiben sichtbar, wenn ein späterer Abruf scheitert.
        snapshot={bars:previous?.bars??[],checkedAt:clock(),unavailable:true};
      }
      if(cache.size>=100)cache.delete(cache.keys().next().value!);
      cache.set(symbol,snapshot);
      return snapshot;
    })();
    pending.set(symbol,request);
    try{return await request;}finally{pending.delete(symbol);}
  };
}

export const loadPrices=createPriceLoader();

export type BenchmarkData={comparison:Comparison;stock:Bar[];benchmark:Bar[]};

// Beide Reihen parallel; fehlt eine, entfällt der Vergleich, ohne die Seite zu stören.
export async function benchmarkData(ticker:string,load=loadPrices):Promise<BenchmarkData|null>{
  const [stock,benchmark]=await Promise.all([load(ticker),load(BENCHMARK.symbol)]);
  if(!stock.bars.length||!benchmark.bars.length)return null;
  const comparison=compare(stock.bars,benchmark.bars);
  return comparison?{comparison,stock:stock.bars,benchmark:benchmark.bars}:null;
}
