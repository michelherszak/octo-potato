import test from 'node:test';
import assert from 'node:assert/strict';
import {analysesFor,newerAnalysis} from '../lib/article-series.ts';

const article=(slug:string,ticker:string,published:string,extra:Record<string,unknown>={})=>
  ({slug,ticker,published_at:published,data_as_of:published,example:false,...extra});

const october=article('mrvl-analyse','MRVL','2026-10-05T10:00:00Z');
const november=article('mrvl-analyse-2026-11-09','MRVL','2026-11-09T10:00:00Z');
const other=article('arqq-analyse','ARQQ','2026-11-20T10:00:00Z');
const demo=article('mrvl-beispiel','MRVL','2026-12-01T10:00:00Z',{example:true});
const all=[october,other,november,demo];

test('analyses of one company are listed newest first without examples',()=>{
  assert.deepEqual(analysesFor(all,'MRVL').map(a=>a.slug),['mrvl-analyse-2026-11-09','mrvl-analyse']);
  assert.deepEqual(analysesFor(all,''),[]);
});

test('an older analysis points to the newest one of the same company',()=>{
  assert.equal(newerAnalysis(october,all)?.slug,'mrvl-analyse-2026-11-09');
});

test('the newest analysis, other companies and examples get no hint',()=>{
  assert.equal(newerAnalysis(november,all),null);
  assert.equal(newerAnalysis(other,all),null);
  assert.equal(newerAnalysis(demo,all),null);
  assert.equal(newerAnalysis(article('ohne','', '2026-01-01T00:00:00Z'),all),null);
});

test('a later correction of the old analysis does not make it the newer one',()=>{
  // Maßgeblich ist die Erstveröffentlichung, nicht die letzte Änderung.
  const corrected={...october,updated_at:'2026-12-15T10:00:00Z'};
  assert.equal(newerAnalysis(corrected,[corrected,november])?.slug,'mrvl-analyse-2026-11-09');
});
