const test=require('node:test'),assert=require('node:assert/strict');const T=require('../js/timer.js');
// Simulates Android killing the WebView process: only the persisted (JSON) timer state survives.
test('running timer recovers elapsed time from persisted timestamps after process death',()=>{
 const s=T.begin('t1','sid1',1_000);const persisted=JSON.stringify(s);const reopened=JSON.parse(persisted);
 assert.equal(T.elapsed(reopened,1_000+90*60_000),90*60_000);});
test('paused timer recovers exact accumulated time after restart and resumes correctly',()=>{
 let s=T.begin('t1','sid1',0);s=T.pause(s,5_000);const back=JSON.parse(JSON.stringify(s));
 assert.equal(T.elapsed(back,10**9),5_000);const r=T.resume(back,20_000);assert.equal(T.elapsed(r,23_000),8_000)});
test('finishing after recovery creates ONE session with a stable id and updatedAt for sync',()=>{
 const s=JSON.parse(JSON.stringify(T.begin('t1','sid-fixed',0)));const a=T.toSession(s,60_000),b=T.toSession(s,60_000);
 assert.equal(a.id,'sid-fixed');assert.equal(a.id,b.id);assert.equal(a.durationMs,60_000);assert.equal(a.updatedAt,60_000);assert.equal(a.deletedAt,null)});
