import test from 'node:test';
import assert from 'node:assert/strict';
import {blockedSource,findBlockedSources} from '../lib/source-policy.ts';

test('sources without redistribution rights are detected wherever they declare provenance',()=>{
  // Genau die Formen, die in bereits veröffentlichten Beiträgen vorkamen.
  assert.equal(findBlockedSources({metrics:[{source:'Yahoo Finance via yfinance get_info'}]}).length,1);
  assert.equal(findBlockedSources({sources:[{title:'Kennzahlen',url:'https://finance.yahoo.com/quote/ARQQ'}]}).length,1);
  assert.equal(findBlockedSources({memo_overview:{piotroski:{source:'Yahoo annual statements via yfinance'}}}).length,1);
  assert.equal(findBlockedSources({editorial_review:{rights_basis:'Daten aus FRED'}}).length,1);
  const finding=findBlockedSources({metrics:[{source:'Yahoo-Finanzbericht'}]})[0];
  assert.equal(finding.label,'Yahoo Finance');
  assert.match(finding.path,/metrics/);
});

test('prose may discuss a blocked provider as long as no figure comes from it',()=>{
  assert.deepEqual(findBlockedSources({memo:'Yahoo war einst ein Portalbetreiber.',thesis:'Vergleich mit Yahoo Finance'}),[]);
  assert.deepEqual(findBlockedSources({title:'Yahoo als Unternehmen',description:'Yahoo Finance im Vergleich'}),[]);
});

test('permitted sources pass unchanged',()=>{
  assert.deepEqual(findBlockedSources({
    sources:[{title:'Jahresbericht 2025',url:'https://www.sec.gov/edgar'},{title:'IR',url:'https://ir.arqit.uk/'}],
    metrics:[{source:'SEC EDGAR 10-K',source_url:'https://www.sec.gov/edgar'}],
    editorial_review:{rights_basis:'Eurostat mit Quellenangabe'},
  }),[]);
});

test('every blocked provider is recognised and empty values stay harmless',()=>{
  for(const [value,label] of [['https://finance.yahoo.com','Yahoo Finance'],['stlouisfed.org','FRED (St. Louis Fed)'],
    ['Alpha Vantage','Alpha Vantage'],['finnhub.io','Finnhub'],['Twelve Data','Twelve Data'],
    ['financialmodelingprep.com','Financial Modeling Prep']] as const)
    assert.equal(blockedSource(value)?.label,label,value);
  assert.equal(blockedSource(''),null);
  assert.equal(blockedSource(undefined),null);
});
