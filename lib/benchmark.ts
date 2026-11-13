// Wertentwicklung einer Aktie gegenüber einem Vergleichsindex. Alle Kurse sind
// dividendenbereinigte Schlusskurse; Renditen werden als Anteil (0.12 = 12 %) geführt.
export type Bar={date:string;close:number};
type Row={date:string;stock:number;benchmark:number};

export const BENCHMARK={symbol:'SPY',name:'S&P 500',note:'abgebildet durch den ETF SPY, Dividenden berücksichtigt'} as const;

export const PERIODS=[
  {id:'1m',label:'1 Monat',months:1},
  {id:'3m',label:'3 Monate',months:3},
  {id:'ytd',label:'Seit Jahresbeginn',months:0},
  {id:'1y',label:'1 Jahr',months:12},
] as const;

export type PeriodResult={id:string;label:string;from:string;stock:number;benchmark:number;difference:number};
export type Comparison={
  asOf:string;periods:PeriodResult[];beta:number|null;correlation:number|null;
  drawdown:{stock:number;benchmark:number}|null;relative:Array<{date:string;value:number}>;
};

// Nur Handelstage, an denen beide Werte einen Kurs haben, sind vergleichbar.
export function align(stock:Bar[],benchmark:Bar[]):Row[]{
  const other=new Map(benchmark.map(bar=>[bar.date,bar.close]));
  return stock.filter(bar=>other.has(bar.date)&&bar.close>0&&other.get(bar.date)!>0)
    .map(bar=>({date:bar.date,stock:bar.close,benchmark:other.get(bar.date)!}))
    .sort((a,b)=>a.date.localeCompare(b.date));
}

function monthsBefore(date:string,months:number){
  const day=new Date(date+'T00:00:00Z');
  const target=new Date(Date.UTC(day.getUTCFullYear(),day.getUTCMonth()-months,day.getUTCDate()));
  // Kein 31. Februar: auf den letzten Tag des Zielmonats begrenzen.
  if(target.getUTCMonth()!==((day.getUTCMonth()-months)%12+12)%12)target.setUTCDate(0);
  return target.toISOString().slice(0,10);
}

// Ausgangspunkt ist der letzte Handelstag vor dem Stichtag, Endpunkt der jüngste gemeinsame Kurs.
function change(rows:Row[],from:string){
  const end=rows.at(-1);
  const start=[...rows].reverse().find(row=>row.date<=from)??null;
  if(!end||!start||start.date===end.date)return null;
  const stock=end.stock/start.stock-1,benchmark=end.benchmark/start.benchmark-1;
  return {from:start.date,stock,benchmark,difference:stock-benchmark};
}

function dailyReturns(rows:Row[]){
  return rows.slice(1).map((row,index)=>({stock:row.stock/rows[index].stock-1,benchmark:row.benchmark/rows[index].benchmark-1}));
}

// Beta und Korrelation über rund ein Börsenjahr; mit zu wenigen Tagen ist beides nicht belastbar.
function sensitivity(rows:Row[]){
  const returns=dailyReturns(rows.slice(-253));
  if(returns.length<60)return {beta:null,correlation:null};
  const mean=(values:number[])=>values.reduce((sum,value)=>sum+value,0)/values.length;
  const s=returns.map(r=>r.stock),b=returns.map(r=>r.benchmark);
  const ms=mean(s),mb=mean(b);
  let cov=0,vs=0,vb=0;
  for(let i=0;i<returns.length;i++){cov+=(s[i]-ms)*(b[i]-mb);vs+=(s[i]-ms)**2;vb+=(b[i]-mb)**2;}
  if(vb===0||vs===0)return {beta:null,correlation:null};
  return {beta:cov/vb,correlation:cov/Math.sqrt(vs*vb)};
}

function maxDrawdown(values:number[]){
  let peak=-Infinity,worst=0;
  for(const value of values){peak=Math.max(peak,value);worst=Math.min(worst,value/peak-1);}
  return worst;
}

export function compare(stock:Bar[],benchmark:Bar[]):Comparison|null{
  const rows=align(stock,benchmark);
  if(rows.length<2)return null;
  const asOf=rows.at(-1)!.date;
  const periods=PERIODS.flatMap(period=>{
    const from=period.id==='ytd'?(Number(asOf.slice(0,4))-1)+'-12-31':monthsBefore(asOf,period.months);
    const result=change(rows,from);
    return result?[{id:period.id,label:period.label,...result}]:[];
  });
  const yearAgo=monthsBefore(asOf,12);
  const year=rows.filter(row=>row.date>=yearAgo);
  const base=year[0];
  // Relative Stärke: Aktie geteilt durch Index, auf 100 gesetzt. Steigt die Linie, liegt die Aktie vorn.
  const relative=year.filter((_,index)=>index%5===0||index===year.length-1)
    .map(row=>({date:row.date,value:100*(row.stock/base.stock)/(row.benchmark/base.benchmark)}));
  return {asOf,periods,...sensitivity(rows),relative,
    drawdown:year.length>20?{stock:maxDrawdown(year.map(r=>r.stock)),benchmark:maxDrawdown(year.map(r=>r.benchmark))}:null};
}

// Entwicklung seit der Veröffentlichung einer Analyse: die ehrliche Bilanz einer These.
export function sincePublication(stock:Bar[],benchmark:Bar[],published:string){
  const rows=align(stock,benchmark);
  const day=published.slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!rows.length)return null;
  // Basis ist der letzte Schlusskurs vor dem Erscheinungstag: der Kurs, den Leser beim Erscheinen kannten.
  // Der Schlusskurs desselben Tages enthielte schon die Bewegung nach der Veröffentlichung.
  const before=[...rows].reverse().find(row=>row.date<day);
  const end=rows.at(-1)!;
  if(!before||end.date<=before.date)return null;
  const stockChange=end.stock/before.stock-1,benchmarkChange=end.benchmark/before.benchmark-1;
  return {from:before.date,asOf:end.date,stock:stockChange,benchmark:benchmarkChange,difference:stockChange-benchmarkChange};
}
