import test from 'node:test';
import assert from 'node:assert/strict';
import {isAdminEmail,parsePageView} from '../lib/analytics.ts';

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
