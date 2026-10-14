import test from 'node:test';
import assert from 'node:assert/strict';
import {companies} from '../lib/catalog.ts';
import {seeds} from '../lib/seeds.ts';
import {buildSearchEntries,matchesArticle,matchesCompany,matchingTopics,searchSuggestions} from '../lib/search.ts';

const entries=buildSearchEntries(companies,seeds);
test('everyday vocabulary and English aliases lead to the intended topics',()=>{
  for(const [query,topic] of [['Strom','energie'],['Chips','halbleiter'],['AI','ki'],['Kuenstliche Intelligenz','ki'],['quantum','quanten'],['Medizin','biotech']] as const) {
    assert.ok(matchingTopics(query).includes(topic));
  }
  assert.ok(matchesArticle('Chips',seeds[1]));
  assert.ok(matchesCompany('Strom',companies.find(c=>c.ticker==='HUBB')!));
});
test('a full starter question and small spelling mistakes still offer useful entries',()=>{
  assert.ok(searchSuggestions('Was steckt hinter Quantenaktien?',entries).some(e=>e.href==='/themen/quanten'));
  assert.ok(searchSuggestions('Quantem',entries).some(e=>e.href==='/themen/quanten'));
  assert.ok(searchSuggestions('CoreWeav',entries).some(e=>e.href==='/unternehmen/CRWV'));
});
test('exact company symbols rank first and short symbols do not match arbitrary prefixes',()=>{
  assert.equal(searchSuggestions('PL',entries)[0]?.href,'/unternehmen/PL');
  assert.equal(searchSuggestions('AI',entries).some(e=>e.label.startsWith('Ciena')),true);
});
test('broad terms offer topics, companies and actual published articles',()=>{
  const kinds=new Set(searchSuggestions('Quanten',entries).map(e=>e.kind));
  assert.deepEqual(kinds,new Set(['Thema','Unternehmen','Beitrag']));
  const extra={...companies[0],ticker:'NEW',name:'Neu veröffentlichtes Unternehmen'};
  assert.equal(searchSuggestions('NEW',buildSearchEntries([...companies,extra],seeds))[0]?.href,'/unternehmen/NEW');
});
test('empty and unknown queries do not fabricate suggestions',()=>{
  assert.equal(searchSuggestions('',entries).length,0);
  assert.equal(searchSuggestions('zxqv987654',entries).length,0);
  assert.equal(matchesArticle('zxqv987654',seeds[0]),false);
  assert.equal(matchesCompany('zxqv987654',companies[0]),false);
});
