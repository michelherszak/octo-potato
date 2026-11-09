import test from 'node:test';
import assert from 'node:assert/strict';
import {articleSchema} from '../lib/contract.ts';
import {articleForDisplay} from '../lib/source-display.ts';
import {seeds} from '../lib/seeds.ts';

test('public articles hide Yahoo source fields while preserving data and original stored provenance',()=>{
  const metric={key:'revenue_ttm',label:'Umsatz',value:'10 Mio. USD',explanation:'Gespeicherter Umsatz.',
    period:'2026',source:'Yahoo Finance via yfinance',source_url:'https://finance.yahoo.com/quote/ARQQ/financials/'};
  const {example,...seed}=seeds[0];void example;
  const article=articleSchema.parse({...seed,metrics:[metric],sources:[
    {title:'Yahoo Finance',url:'https://finance.yahoo.com/quote/ARQQ'},
    {title:'Geschäftsbericht',url:'https://ir.arqit.uk/'},
  ],memo_overview:{questions:[],money_story:'Geldfluss',money_metrics:[metric],costs:[metric],
    piotroski:{score:7,period:'2026',source:'yfinance'},street:null,reliability:[],dilution:''}});
  const before=JSON.stringify(article);
  const shown=articleForDisplay(article);
  assert.equal(shown.metrics[0].value,metric.value);
  assert.equal(shown.metrics[0].source,'');
  assert.equal(shown.metrics[0].source_url,undefined);
  assert.deepEqual(shown.sources,[{title:'Geschäftsbericht',url:'https://ir.arqit.uk/'}]);
  assert.equal(shown.memo_overview?.costs[0].source,'');
  assert.equal(shown.memo_overview?.money_metrics[0].source_url,undefined);
  assert.equal(shown.memo_overview?.piotroski.score,7);
  assert.equal(shown.memo_overview?.piotroski.source,'');
  assert.equal(JSON.stringify(article),before);
});
