import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {articleSchema} from '../lib/contract.ts';
import {memoOverviewSchema} from '../lib/memo-overview.ts';
import {seeds} from '../lib/seeds.ts';

function overview(){
  const script=`import importlib.util,json,sys
spec=importlib.util.spec_from_file_location('memo',sys.argv[1]); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
print(json.dumps(m.build_memo_overview({'created_at':'2026-10-28T12:00:00Z','fundamentals_currency':'EUR','figures':{'piotroski_f_score':7,'revenue_ttm':10000000,'operating_cash_flow':-500000,'free_cash_flow':0},'plain':{'questions':[{'group':'quality','question':{'de':'Verdient die Firma Geld?'},'answer':{'de':'Noch nicht'},'light':'red'}]},'pl_breakdown':{'year':2025,'research_and_development':100000}})))`;
  return JSON.parse(execFileSync('python3',['-c',script,new URL('../integrations/evaluating-stocks/website_memo.py',import.meta.url).pathname],{encoding:'utf8'}));
}
test('actual Python overview export is accepted by the website contract',()=>{
  const o=memoOverviewSchema.parse(overview());
  assert.equal(o.piotroski.score,7);assert.equal(o.money_metrics.length,3);
  const {example,...article}=seeds[0];void example;
  assert.equal(articleSchema.safeParse({...article,memo_overview:o}).success,true);
  assert.equal(articleSchema.safeParse(article).success,true);
});
test('overview rejects impossible scores, private fields and unsafe links',()=>{
  const o=overview();
  for(const score of [-1,10,3.5])assert.equal(memoOverviewSchema.safeParse({...o,piotroski:{...o.piotroski,score}}).success,false);
  assert.equal(memoOverviewSchema.safeParse({...o,portfolio:'private'}).success,false);
  assert.equal(memoOverviewSchema.safeParse({...o,money_metrics:[{...o.money_metrics[0],source_url:'javascript:bad'}]}).success,false);
});
