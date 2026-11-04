import test from 'node:test';
import assert from 'node:assert/strict';
import {buildVisitorFunnel,isAdminEmail,parsePageView,routePattern} from '../lib/analytics.ts';

test('analytics accepts only pseudonymous same-site page data',()=>{
  const valid=parsePageView({visitorId:'f5bb0bd6-7047-4bb8-ae24-7d8f13c27af8',path:'/themen/ki',title:'Künstliche Intelligenz'});
  assert.equal(valid.success,true);
  assert.equal(parsePageView({visitorId:'not-an-id',path:'/themen/ki',title:'KI'}).success,false);
  assert.equal(parsePageView({visitorId:'f5bb0bd6-7047-4bb8-ae24-7d8f13c27af8',path:'https://example.com',title:'Extern'}).success,false);
  assert.equal(parsePageView({visitorId:'f5bb0bd6-7047-4bb8-ae24-7d8f13c27af8',path:'//example.com',title:'Extern'}).success,false);
});

test('admin allowlist is case-insensitive and local fallback stays bounded',()=>{
  assert.equal(isAdminEmail('Admin@Example.com','owner@example.com, admin@example.com'),true);
  assert.equal(isAdminEmail('other@example.com','admin@example.com'),false);
  assert.equal(isAdminEmail('seedy@sites.test',undefined,true),true);
  assert.equal(isAdminEmail('seedy@sites.test','admin@example.com',true),false);
});

test('page paths collapse into route patterns for the visitor flow',()=>{
  assert.equal(routePattern('/'),'/');
  assert.equal(routePattern('/unternehmen/ARQQ'),'/unternehmen/:ticker');
  assert.equal(routePattern('/unternehmen'),'/unternehmen');
  assert.equal(routePattern('/analysen/mein-memo?q=1'),'/analysen/:slug');
  assert.equal(routePattern('/themen/ki#top'),'/themen/:thema');
  assert.equal(routePattern('/konto/updates'),'/konto/updates');
});

test('the visitor flow splits sessions, names the exit page and measures dwell time',()=>{
  const minute=60_000;
  const exits=(funnel:ReturnType<typeof buildVisitorFunnel>)=>funnel.nodes.filter(node=>node.kind==='exit');
  const rows=[
    // Besuch 1: Einstieg Katalog, nach 2 Minuten eine Unternehmensseite, dann Absprung.
    {visitor_id:'a',path:'/',visited_at:1_000},
    {visitor_id:'a',path:'/unternehmen/ARQQ',visited_at:1_000+(2*minute)},
    // Besuch 2 derselben Person nach langer Pause: Einstieg Katalog, direkter Absprung.
    {visitor_id:'a',path:'/',visited_at:1_000+(90*minute)},
    // Besuch 3: Einstieg über eine Analyse, danach Absprung.
    {visitor_id:'b',path:'/analysen/memo-eins',visited_at:2_000},
  ];
  const funnel=buildVisitorFunnel(rows);
  assert.equal(funnel.sessions,3);
  const entries=funnel.nodes.filter(node=>node.step===0);
  assert.deepEqual(entries.map(node=>[node.label,node.sessions]),[['/',2],['/analysen/:slug',1]]);
  // Absprünge tragen den Namen der Seite, auf der sie passieren.
  assert.deepEqual(exits(funnel).filter(node=>node.step===1).map(node=>[node.label,node.sessions]).sort(),[['/',1],['/analysen/:slug',1]]);
  assert.deepEqual(exits(funnel).filter(node=>node.step===2).map(node=>[node.label,node.sessions]),[['/unternehmen/:ticker',1]]);
  const continued=funnel.links.filter(link=>link.kind==='continue');
  assert.equal(continued.length,1);
  // Nur die Seite mit einem Folgeaufruf hat eine messbare Verweildauer.
  const katalog=entries.find(node=>node.label==='/')!;
  assert.equal(katalog.measured,1);
  assert.equal(katalog.medianDwellMs,2*minute);
  assert.equal(entries.find(node=>node.label==='/analysen/:slug')!.medianDwellMs,null);
});

test('short visits before leaving are counted as fast bounces',()=>{
  const rows=[];
  // Vier Besuche verlassen die Einstiegsseite nach fünf Sekunden, einer bleibt lange.
  for(let i=0;i<4;i++)rows.push({visitor_id:'f'+i,path:'/',visited_at:i*600_000},{visitor_id:'f'+i,path:'/login',visited_at:i*600_000+5_000});
  rows.push({visitor_id:'slow',path:'/',visited_at:9_000_000},{visitor_id:'slow',path:'/login',visited_at:9_000_000+120_000});
  const funnel=buildVisitorFunnel(rows);
  const entry=funnel.nodes.find(node=>node.step===0)!;
  assert.equal(entry.sessions,5);
  assert.equal(entry.measured,5);
  assert.equal(entry.fast,4);
  assert.equal(entry.medianDwellMs,5_000);
});

test('repeated reloads of one page do not inflate the flow',()=>{
  const funnel=buildVisitorFunnel([
    {visitor_id:'a',path:'/',visited_at:1},
    {visitor_id:'a',path:'/?q=chips',visited_at:2},
    {visitor_id:'a',path:'/',visited_at:3},
  ]);
  assert.equal(funnel.sessions,1);
  assert.equal(funnel.nodes.filter(node=>node.kind==='page').length,1);
  assert.deepEqual(funnel.nodes.filter(node=>node.kind==='exit').map(node=>node.label),['/']);
});
