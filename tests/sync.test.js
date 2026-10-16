const test=require('node:test'),assert=require('node:assert/strict');
const {createEngine,STORES}=require('../js/sync-engine.js');
const {createMemoryStore}=require('./helpers/memory-store.js');const {fakeCloud}=require('./helpers/fake-cloud.js');
function device(cloud,uid,name,opts={}){const store=createMemoryStore();let u=uid,clock=opts.clock||{t:1e12};
 const engine=createEngine({store,cloud,getUid:()=>u,getEmail:()=>'a@b.c',now:()=>clock.t,rand:()=>1,afterWipe:opts.afterWipe});
 store.metaPut('deviceId',name);return{store,engine,setUid:x=>{u=x},clock}}
const task=(id,over={})=>({id,title:'T-'+id,description:'',categoryId:null,priority:'medium',status:'pending',estimatedMinutes:null,dueAt:null,recurrence:'none',createdAt:1000,updatedAt:1000,deletedAt:null,syncStatus:'pending',...over});
const bound=async(d,uid)=>{await d.store.metaPut('binding',{uid,decision:'merged',cursors:{},boundAt:1,lastSyncAt:null,profileDone:true})};

test('local-first: push marks synced only after cloud success, queue drains, repeat sync is idempotent',async()=>{
 const c=fakeCloud(),d=device(c,'u1','devA');await bound(d,'u1');await d.store.save('tasks',task('t1'),'create');
 c.offline=true;let r=await d.engine.syncNow();assert.equal(r.ok,false);
 assert.equal((await d.store.get('tasks','t1')).syncStatus,'pending');assert.equal((await d.engine.status()).pending,1);
 c.offline=false;d.clock.t+=10*60000;r=await d.engine.syncNow();assert.equal(r.ok,true);
 const t=await d.store.get('tasks','t1');assert.equal(t.syncStatus,'synced');assert.ok(t.remoteVersion);assert.equal((await d.engine.status()).pending,0);
 const w=c.writes;await d.engine.syncNow();await d.engine.syncNow();assert.equal(c.writes,w,'no duplicate writes');assert.equal(c.count('u1','tasks'),1);
 assert.ok((await d.engine.status()).lastSyncAt);});
test('retry uses exponential backoff and respects nextAttemptAt (force bypasses)',async()=>{
 const c=fakeCloud(),d=device(c,'u1','devA');await bound(d,'u1');await d.store.save('tasks',task('t1'),'create');c.offline=true;
 const delays=[];for(let i=0;i<4;i++){await d.engine.syncNow({force:true});const q=(await d.store.queueAll())[0];delays.push(q.nextAttemptAt-d.clock.t);assert.equal(q.retryCount,i+1);assert.equal(q.status,'pending')}
 assert.deepEqual(delays,[2000,4000,8000,16000]);
 c.offline=false;const before=c.writes;let r=await d.engine.syncNow();assert.equal(c.writes,before,'op not due yet => not attempted');
 d.clock.t+=20000;r=await d.engine.syncNow();assert.equal(r.ok,true);assert.equal(c.writes,before+1);});
test('concurrent syncNow calls never double-upload',async()=>{
 const c=fakeCloud(),d=device(c,'u1','devA');await bound(d,'u1');for(let i=0;i<5;i++)await d.store.save('tasks',task('t'+i),'create');
 await Promise.all([d.engine.syncNow(),d.engine.syncNow(),d.engine.syncNow()]);assert.equal(c.writes,5);assert.equal(c.count('u1','tasks'),5);});
test('pull is idempotent and never duplicates records',async()=>{
 const c=fakeCloud(),a=device(c,'u1','devA'),b=device(c,'u1','devB');await bound(a,'u1');await a.store.save('tasks',task('t1',{title:'one'}),'create');await a.engine.syncNow();
 await b.engine.syncNow();await b.engine.syncNow();assert.equal((await b.store.all('tasks')).length,1);assert.equal((await b.store.get('tasks','t1')).title,'one');assert.equal((await b.engine.status()).pending,0);});
test('empty/unavailable cloud never erases local data',async()=>{
 const c=fakeCloud(),d=device(c,'u1','devA');await bound(d,'u1');await d.store.save('tasks',task('t1'),'create');await d.engine.syncNow();
 c.offline=true;await d.engine.syncNow();c.offline=false;
 const c2=fakeCloud(); // cloud wiped / empty
 const d2=device(c2,'u1','devA');d2.store._data.tasks.set('t1',await d.store.get('tasks','t1'));await bound(d2,'u1');await d2.engine.syncNow();
 assert.equal((await d2.store.all('tasks')).length,1);});
test('conflict: newer edit wins, older never overwrites newer, loser is logged',async()=>{
 const c=fakeCloud(),a=device(c,'u1','devA'),b=device(c,'u1','devB');await bound(a,'u1');await bound(b,'u1');
 await a.store.save('tasks',task('t1',{title:'base',updatedAt:1000}),'create');await a.engine.syncNow();await b.engine.syncNow();
 await a.store.save('tasks',{...await a.store.get('tasks','t1'),title:'A-late',updatedAt:5000,syncStatus:'pending'});
 await b.store.save('tasks',{...await b.store.get('tasks','t1'),title:'B-early',updatedAt:3000,syncStatus:'pending'});
 await a.engine.syncNow();                                   // A pushes the NEWER edit first
 await b.engine.syncNow();                                   // B (older) must lose
 assert.equal(c.peek('u1','tasks','t1').title,'A-late');assert.equal((await b.store.get('tasks','t1')).title,'A-late');
 const log=await b.engine.conflicts();assert.equal(log.length,1);assert.equal(log[0].winner,'remote');assert.equal(log[0].loser.title,'B-early');
 assert.equal((await b.engine.status()).pending,0);});
test('conflict: older device pushes first, newer device then wins via precondition path',async()=>{
 const c=fakeCloud(),a=device(c,'u1','devA'),b=device(c,'u1','devB');await bound(a,'u1');await bound(b,'u1');
 await a.store.save('tasks',task('t1',{updatedAt:1000}),'create');await a.engine.syncNow();await b.engine.syncNow();
 await a.store.save('tasks',{...await a.store.get('tasks','t1'),title:'A-old',updatedAt:2000,syncStatus:'pending'});
 await b.store.save('tasks',{...await b.store.get('tasks','t1'),title:'B-new',updatedAt:9000,syncStatus:'pending'});
 await a.engine.syncNow();await b.engine.syncNow();assert.equal(c.peek('u1','tasks','t1').title,'B-new');
 await a.engine.syncNow();assert.equal((await a.store.get('tasks','t1')).title,'B-new');});
test('conflict tie is broken deterministically by deviceId (same winner everywhere)',async()=>{
 const c=fakeCloud(),a=device(c,'u1','devA'),b=device(c,'u1','devB');await bound(a,'u1');await bound(b,'u1');
 await a.store.save('tasks',task('t1',{updatedAt:1000}),'create');await a.engine.syncNow();await b.engine.syncNow();
 await a.store.save('tasks',{...await a.store.get('tasks','t1'),title:'from-A',updatedAt:7000,syncStatus:'pending'});
 await b.store.save('tasks',{...await b.store.get('tasks','t1'),title:'from-B',updatedAt:7000,syncStatus:'pending'});
 await a.engine.syncNow();await b.engine.syncNow();await a.engine.syncNow();
 assert.equal((await a.store.get('tasks','t1')).title,(await b.store.get('tasks','t1')).title);assert.equal(c.peek('u1','tasks','t1').title,'from-B');});
test('deletion syncs as tombstone, is kept locally, and propagates to other devices',async()=>{
 const c=fakeCloud(),a=device(c,'u1','devA'),b=device(c,'u1','devB');await bound(a,'u1');await bound(b,'u1');
 await a.store.save('tasks',task('t1'),'create');await a.engine.syncNow();await b.engine.syncNow();
 await a.store.save('tasks',{...await a.store.get('tasks','t1'),deletedAt:4000,updatedAt:4000,syncStatus:'pending'},'delete');
 await a.engine.syncNow();assert.equal(c.peek('u1','tasks','t1').deletedAt,4000);assert.ok(await a.store.get('tasks','t1'),'tombstone kept');
 await b.engine.syncNow();assert.equal((await b.store.get('tasks','t1')).deletedAt,4000);});
test('policy: an edit newer than a remote delete restores the record (documented LWW)',async()=>{
 const c=fakeCloud(),a=device(c,'u1','devA'),b=device(c,'u1','devB');await bound(a,'u1');await bound(b,'u1');
 await a.store.save('tasks',task('t1'),'create');await a.engine.syncNow();await b.engine.syncNow();
 await a.store.save('tasks',{...await a.store.get('tasks','t1'),deletedAt:4000,updatedAt:4000,syncStatus:'pending'},'delete');await a.engine.syncNow();
 await b.store.save('tasks',{...await b.store.get('tasks','t1'),title:'revived',updatedAt:8000,syncStatus:'pending'});await b.engine.syncNow();
 assert.equal(c.peek('u1','tasks','t1').title,'revived');assert.equal(c.peek('u1','tasks','t1').deletedAt,null);});
test('first sign-in with existing local data does NOT upload until the user approves import',async()=>{
 const c=fakeCloud(),d=device(c,'u1','devA');await d.store.save('tasks',task('t1'),'create');
 let r=await d.engine.syncNow();assert.equal(r.skipped,'needs-decision');assert.equal(c.writes,0);assert.equal(c.count('u1','tasks'),0);
 assert.equal((await d.engine.status()).state,'needs-decision');
 r=await d.engine.importLocal();assert.equal(r.ok,true);assert.equal(c.count('u1','tasks'),1);const w=c.writes;await d.engine.syncNow();assert.equal(c.writes,w);});
test('fresh install (no local data) binds automatically; seeds are not uploaded',async()=>{
 const c=fakeCloud(),d=device(c,'u1','devA');await d.store.put('categories',{id:'cat-work',name:{bn:'কাজ',en:'Work'},createdAt:0,deletedAt:null});
 const r=await d.engine.syncNow();assert.equal(r.ok,true);assert.equal(c.count('u1','categories'),0);});
test('account switching: other account never receives or sees local data without explicit replace',async()=>{
 const c=fakeCloud();let wiped=0;const a=device(c,'uA','devA',{afterWipe:async()=>{wiped++}});await bound(a,'uA');
 await a.store.save('tasks',task('secretA'),'create');await a.engine.syncNow();
 c.remoteEdit('uB','tasks','taskB',task('taskB',{title:'B data'}));
 a.setUid('uB');const r=await a.engine.syncNow();assert.equal(r.skipped,'mismatch');
 assert.equal(c.count('uB','tasks'),1,'uB cloud untouched');assert.equal(c.peek('uB','tasks','secretA'),undefined);
 assert.ok(c.calls.filter(x=>x[1]==='uB'&&x[0]==='upsert').length===0);
 await a.engine.replaceLocalWithCloud();assert.equal(wiped,1);
 const ids=(await a.store.all('tasks')).map(x=>x.id);assert.deepEqual(ids,['taskB']);assert.equal(c.peek('uA','tasks','secretA').title,'T-secretA','uA cloud data intact');
 assert.equal((await a.store.metaGet('binding')).uid,'uB');});
test('replaceLocalWithCloud refused when not in needs-decision/mismatch',async()=>{
 const c=fakeCloud(),d=device(c,'u1','devA');await bound(d,'u1');await assert.rejects(()=>d.engine.replaceLocalWithCloud(),/not_allowed/)});
test('permanent errors mark the op failed (visible), keep data, and can be retried',async()=>{
 const c=fakeCloud(),d=device(c,'u1','devA');await bound(d,'u1');await d.store.save('tasks',task('t1'),'create');c.failures.push(['upsert','permanent']);
 let r=await d.engine.syncNow();assert.equal(r.ok,false);let s=await d.engine.status();assert.equal(s.failed,1);assert.equal(s.state,'error');assert.equal((await d.store.get('tasks','t1')).syncStatus,'pending');
 await d.engine.syncNow();assert.equal(c.count('u1','tasks'),0,'failed ops are not retried automatically');
 await d.engine.retryFailed();r=await d.engine.syncNow();assert.equal(r.ok,true);assert.equal(c.count('u1','tasks'),1);});
test('auth failure aborts the run with auth-required and keeps the queue',async()=>{
 const c=fakeCloud(),d=device(c,'u1','devA');await bound(d,'u1');await d.store.save('tasks',task('t1'),'create');c.failures.push(['pull','auth']);
 const r=await d.engine.syncNow();assert.equal(r.kind,'auth');assert.equal((await d.engine.status()).state,'auth-required');assert.equal((await d.engine.status()).pending,1);});
test('lastSyncAt is only set by a fully successful run',async()=>{
 const c=fakeCloud(),d=device(c,'u1','devA');await bound(d,'u1');await d.store.save('tasks',task('t1'),'create');c.offline=true;await d.engine.syncNow();
 assert.equal((await d.engine.status()).lastSyncAt,null);c.offline=false;d.clock.t+=60000;await d.engine.syncNow();assert.equal((await d.engine.status()).lastSyncAt,d.clock.t);});
test('edit during an in-flight push stays pending (not wrongly marked synced)',async()=>{
 const c=fakeCloud(),d=device(c,'u1','devA');await bound(d,'u1');await d.store.save('tasks',task('t1',{updatedAt:1000}),'create');
 const orig=c.upsert;c.upsert=async(...a)=>{const r=await orig(...a);await d.store.save('tasks',{...await d.store.get('tasks','t1'),title:'edited-mid-flight',updatedAt:2000,syncStatus:'pending'});return r};
 await d.engine.syncNow({});c.upsert=orig;
 const t=await d.store.get('tasks','t1');assert.equal(t.title,'edited-mid-flight');
 await d.engine.syncNow();assert.equal(c.peek('u1','tasks','t1').title,'edited-mid-flight');assert.equal((await d.store.get('tasks','t1')).syncStatus,'synced');});
test('importing a backup while bound re-queues everything and resets cursors',async()=>{
 const c=fakeCloud(),d=device(c,'u1','devA');await bound(d,'u1');d.store._data.tasks.set('x',task('x'));
 await d.engine.afterImport();assert.equal((await d.engine.status()).pending,1);await d.engine.syncNow();assert.equal(c.count('u1','tasks'),1);});
test('sessions and settings sync too; user-scoped storage keeps accounts apart',async()=>{
 const c=fakeCloud(),d=device(c,'u1','devA');await bound(d,'u1');
 await d.store.save('sessions',{id:'s1',taskId:'t1',startedAt:1,endedAt:2,durationMs:1,accumulatedMs:1,notes:'',createdAt:2,updatedAt:2,deletedAt:null},'create');
 await d.store.save('settings',{id:'prefs',theme:'dark',lang:'bn',updatedAt:3},'update');await d.engine.syncNow();
 assert.equal(c.count('u1','sessions'),1);assert.equal(c.count('u1','settings'),1);assert.equal(c.count('u2','sessions'),0);});
