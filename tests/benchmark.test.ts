import test from 'node:test';
import assert from 'node:assert/strict';
import {align,compare,sincePublication,type Bar} from '../lib/benchmark.ts';

const close=(a:number,b:number)=>Math.abs(a-b)<1e-9;

// Handelstage ohne Wochenenden, Kurse aus einer Vorschrift erzeugt.
function series(start:string,days:number,price:(index:number)=>number):Bar[]{
  const bars:Bar[]=[];
  const day=new Date(start+'T00:00:00Z');
  for(let index=0;bars.length<days;day.setUTCDate(day.getUTCDate()+1)){
    if(day.getUTCDay()===0||day.getUTCDay()===6)continue;
    bars.push({date:day.toISOString().slice(0,10),close:price(index++)});
  }
  return bars;
}

test('only trading days known to both series are compared',()=>{
  const rows=align([{date:'2026-01-02',close:10},{date:'2026-01-05',close:11}],[{date:'2026-01-05',close:100},{date:'2026-01-06',close:101}]);
  assert.deepEqual(rows,[{date:'2026-01-05',stock:11,benchmark:100}]);
});

test('period returns start at the last trading day on or before the cut-off',()=>{
  // Aktie verdoppelt sich linear, Index steigt um 10 Prozent.
  const n=300;
  const stock=series('2025-09-01',n,i=>100*(1+i/(n-1)));
  const benchmark=series('2025-09-01',n,i=>100*(1+0.1*i/(n-1)));
  const result=compare(stock,benchmark)!;
  const year=result.periods.find(p=>p.id==='1y')!;
  const start=stock.find(b=>b.date===year.from)!;
  assert.ok(close(year.stock,stock.at(-1)!.close/start.close-1));
  assert.ok(close(year.difference,year.stock-year.benchmark));
  assert.ok(year.stock>year.benchmark,'die Aktie liegt vorn');
  const ytd=result.periods.find(p=>p.id==='ytd')!;
  assert.ok(ytd.from<=`${result.asOf.slice(0,4)}-01-01`,'Basis ist der letzte Handelstag des Vorjahres');
  assert.ok(result.relative.at(-1)!.value>100,'relative Stärke steigt bei Mehrleistung');
});

test('a stock that moves exactly with the index has beta one and correlation one',()=>{
  const index=series('2025-06-02',260,i=>100+Math.sin(i/7)*5+i*0.1);
  const twin=index.map(b=>({...b,close:b.close*3}));
  const result=compare(twin,index)!;
  assert.ok(close(result.beta!,1),'beta '+result.beta);
  assert.ok(close(result.correlation!,1),'korrelation '+result.correlation);
  assert.ok(Math.abs(result.periods[0].difference)<1e-9);
});

test('a doubly sensitive stock has beta two',()=>{
  const index=series('2025-06-02',260,i=>100*(1+0.01*Math.sin(i)));
  // Tagesrenditen der Aktie sind genau doppelt so groß wie die des Index.
  const stock:Bar[]=[{...index[0],close:50}];
  for(let i=1;i<index.length;i++)stock.push({date:index[i].date,close:stock[i-1].close*(1+2*(index[i].close/index[i-1].close-1))});
  assert.ok(close(compare(stock,index)!.beta!,2));
});

test('too little history yields no beta instead of a misleading number',()=>{
  const stock=series('2026-10-01',30,i=>10+i),index=series('2026-10-01',30,i=>100+i);
  const result=compare(stock,index)!;
  assert.equal(result.beta,null);
  assert.equal(result.correlation,null);
});

test('drawdown measures the deepest fall from a previous high',()=>{
  const prices=[100,120,90,110,60,80,...Array(20).fill(80)];
  const stock=series('2026-01-05',prices.length,i=>prices[i]);
  const index=series('2026-01-05',prices.length,()=>100);
  const result=compare(stock,index)!;
  assert.ok(close(result.drawdown!.stock,60/120-1));
  assert.equal(result.drawdown!.benchmark,0);
});

test('since publication starts at the close before the publication day',()=>{
  const stock=series('2026-11-02',6,i=>[100,104,110,121,110,132][i]);
  const index=series('2026-11-02',6,i=>[200,202,204,206,208,210][i]);
  // Erschienen am Mittwoch, 4. November: Basis ist der Schlusskurs vom Dienstag (104 bzw. 202).
  const result=sincePublication(stock,index,'2026-11-04T09:00:00Z')!;
  assert.equal(result.from,'2026-11-03');
  assert.ok(close(result.stock,132/104-1));
  assert.ok(close(result.benchmark,210/202-1));
  assert.ok(close(result.difference,result.stock-result.benchmark));
});

test('no result without a later price or with an unusable date',()=>{
  const stock=series('2026-11-02',3,i=>100+i),index=series('2026-11-02',3,i=>200+i);
  assert.equal(sincePublication(stock,index,'2026-11-01'),null,'vor dem ersten Kurs');
  assert.equal(sincePublication(stock,index,'gestern'),null);
  assert.equal(sincePublication([],[],'2026-11-03'),null);
  assert.equal(compare([],[]),null);
});
