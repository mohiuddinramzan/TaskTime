// Run: node --test tests/   (Node 18+, no dependencies)
const test=require('node:test'),assert=require('node:assert');
const T=require('../js/timer.js'),TS=require('../js/task-service.js'),R=require('../js/reports.js'),U=require('../js/utils.js');
test('running elapsed uses timestamps',()=>{const s=T.begin('t','s1',1000);assert.equal(T.elapsed(s,6000),5000)});
test('paused timer does not accumulate',()=>{let s=T.begin('t','s1',0);s=T.pause(s,3000);assert.equal(T.elapsed(s,99999),3000)});
test('resume continues from accumulated',()=>{let s=T.begin('t','s1',0);s=T.pause(s,3000);s=T.resume(s,10000);assert.equal(T.elapsed(s,12000),5000)});
test('session built with stable id and exact duration (idempotent id)',()=>{let s=T.begin('t','sid',0);s=T.pause(s,4000);const a=T.toSession(s,9000),b=T.toSession(s,50000);assert.equal(a.id,b.id);assert.equal(a.durationMs,4000)});
test('task validation',()=>{assert.ok(TS.validate({title:' ',priority:'low',status:'pending'}).title);assert.ok(TS.validate({title:'x',priority:'urgent',status:'pending'}).priority);assert.deepEqual(TS.validate({title:'x',priority:'low',status:'pending',estimatedMinutes:5}),{})});
test('report ranges',()=>{const n=new Date(2026,9,15,12).getTime();const [a,b]=R.range('7',n);assert.equal((b-a)/864e5,7);assert.throws(()=>R.range('custom',n,5,1))});
test('report uses saved sessions only',()=>{const n=new Date(2026,9,15,12).getTime(),r=R.range('today',n);const x=R.build([{taskId:'a',startedAt:n,durationMs:6e4},{taskId:'a',startedAt:n-9e8,durationMs:5}],[{id:'a',title:'A',categoryId:'c'}],r,6e4);assert.equal(x.total,6e4);assert.equal(x.goalDays,1)});
test('csv escaping',()=>{assert.equal(U.csv([['a,b','q"x','=1+1']]),'"a,b","q""x",\'=1+1')});
test('report keeps per-day per-category totals (stacked chart) and streak counts consecutive days',()=>{
 const n=new Date(2026,9,15,12).getTime(),D=864e5;const r=R.range('7',n);
 const ss=[{taskId:'a',startedAt:n,durationMs:6e4},{taskId:'b',startedAt:n,durationMs:3e4},{taskId:'a',startedAt:n-D,durationMs:1e3},{taskId:'a',startedAt:n-3*D,durationMs:1e3}];
 const x=R.build(ss,[{id:'a',categoryId:'c1'},{id:'b',categoryId:'c2'}],r,1);const k=R.dk(n);assert.deepEqual(x.dayCat[k],{c1:6e4,c2:3e4});
 assert.equal(R.streak(ss,n),2);assert.equal(R.streak([],n),0);assert.equal(R.streak([{startedAt:n-D}],n),1,'streak survives until the day ends');assert.equal(R.streak([{startedAt:n-2*D}],n),0)});
