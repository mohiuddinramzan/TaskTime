// Local-first sync engine (Phase 2). IndexedDB stays the source of truth; the cloud is a replica.
//
// CONFLICT POLICY (documented, deterministic): per record, last-writer-wins on `updatedAt` (client epoch ms; deletes set
// updatedAt=deletedAt, so a delete is just another write). Tie => larger deviceId wins (same answer on every device).
// The LOSING version is never silently dropped: it is stored in syncMeta 'conflicts' (last 20) and surfaced in Settings.
// Detection: every local record remembers `remoteVersion` (Firestore updateTime it was based on). Pushes carry it as a
// precondition (exists:false for new docs), so an older device can never overwrite a newer cloud write; pulls compare it.
// Tombstones: deletes are soft (`deletedAt`) and are NEVER purged locally or remotely in Phase 2.
// Not guaranteed: sync while Android has suspended/killed the app. Sync runs only while the app is in the foreground.
(function(g){
const STORES=['categories','settings','tasks','sessions'],BASE=2000,CAP=300000;
const ts=r=>(r&&(r.updatedAt??r.createdAt))||0;
const nt=s=>typeof s==='string'?s.replace(/(\.\d*?)0+Z$/,'$1Z').replace(/\.Z$/,'Z'):s;
const sameVer=(a,b)=>!!a&&!!b&&nt(a)===nt(b);
const pristine=(s,r)=>s==='categories'&&!(r.createdAt>0)&&!(r.updatedAt>0)&&!r.deletedAt; // untouched built-in seeds are never uploaded
function cmpTime(a,b){if(a===b)return 0;if(!a)return-1;if(!b)return 1;
 const p=s=>{const m=/^(.*?)(?:\.(\d+))?Z$/.exec(s);return[Date.parse(m?m[1]+'Z':s),((m&&m[2])||'').padEnd(9,'0')]};
 const[x,xf]=p(a),[y,yf]=p(b);return x!==y?(x<y?-1:1):xf===yf?0:xf<yf?-1:1}
function remoteWins(remote,local,me){const a=ts(remote.rec),b=ts(local);return a!==b?a>b:String(remote.deviceId||'')>String(me||'')}
const mkErr=(kind,m)=>Object.assign(new Error(m),{kind});

function createEngine(d){
 const S=d.store,cloud=d.cloud||null,now=d.now||Date.now,rand=d.rand||Math.random;
 const subs=new Set();let running=null,again=false,last=null,st={state:cloud?'init':'local-only',error:null},dev=null;
 const backoff=n=>Math.round(Math.min(CAP,BASE*Math.pow(2,n))*(0.5+rand()/2));
 const deviceId=async()=>{if(dev)return dev;let v=await S.metaGet('deviceId');if(!v){v='dev-'+Math.floor(rand()*1e9).toString(36)+now().toString(36);await S.metaPut('deviceId',v)}return dev=v};
 const getB=()=>S.metaGet('binding'),putB=b=>S.metaPut('binding',b);
 const newB=(uid,decision)=>({uid,decision,cursors:{},boundAt:now(),lastSyncAt:null,profileDone:false});
 const mkOp=(s,r,op)=>({id:s+':'+r.id,entityType:s,entityId:r.id,operation:r.deletedAt?'delete':op,createdAt:now(),retryCount:0,nextAttemptAt:0,status:'pending',lastError:null});
 const emit=async()=>{try{last=await status()}catch(e){return}subs.forEach(f=>{try{f(last)}catch(e){}})};
 const setState=async(state,error=null)=>{st={state,error};await emit()};

 async function hasLocalData(){for(const s of STORES){const a=await S.all(s);if(s==='categories'?a.some(r=>!pristine(s,r)):a.length>0)return true}return false}
 async function evaluate(){
  if(!cloud)return{state:'local-only'};
  const uid=await d.getUid();if(!uid)return{state:'signed-out'};
  const b=await getB();
  if(!b){if(await hasLocalData())return{state:'needs-decision'};await putB(newB(uid,'merged'));return{state:'ready'}} // nothing local => nothing to upload silently
  if(b.uid!==uid)return{state:'mismatch',binding:b};
  if(b.decision==='pending')return{state:'needs-decision',binding:b};
  return{state:'ready',binding:b}}
 async function status(){
  const q=await S.queueAll().catch(()=>[]),b=await getB().catch(()=>null),c=(await S.metaGet('conflicts').catch(()=>null))||[];
  const pend=q.filter(o=>o.status==='pending'),t=now(),due=pend.map(o=>o.nextAttemptAt||0).filter(x=>x>t);
  return{state:st.state,error:st.error,uid:await d.getUid(),bound:!!b,boundUid:b?b.uid:null,pending:pend.length,failed:q.filter(o=>o.status==='failed').length,
   nextRetryAt:due.length?Math.min(...due):null,lastSyncAt:b?b.lastSyncAt:null,conflicts:c.length,conflictList:c.slice(-5)}}
 async function refresh(){const ev=await evaluate();if(running)return;
  if(ev.state==='ready'){if(['init','local-only','signed-out','needs-decision','mismatch'].includes(st.state))await setState('idle')}else await setState(ev.state)}

 async function logConflict(store,id,winner,loser){const l=(await S.metaGet('conflicts'))||[];l.push({store,id,at:now(),winner,title:(loser&&loser.title)||'',loser});await S.metaPut('conflicts',l.slice(-20))}
 async function applyRemote(s,remote,me){let changed=false,conflict=null;
  await S.atomic(s,remote.rec.id,(cur,op)=>{
   const take=()=>{changed=true;return{rec:{...remote.rec,syncStatus:'synced',remoteVersion:remote.version},op:null}};
   if(!cur)return take();
   if(!op)return sameVer(cur.remoteVersion,remote.version)?{}:take(); // clean local copy: cloud is authoritative
   if(sameVer(cur.remoteVersion,remote.version))return{};             // dirty, but cloud unchanged since our base: keep ours
   if(remoteWins(remote,cur,me)){conflict={winner:'remote',loser:cur};return take()}
   conflict={winner:'local',loser:remote.rec};return{rec:{...cur,remoteVersion:remote.version}}});
  if(conflict)await logConflict(s,remote.rec.id,conflict.winner,conflict.loser);return changed}
 async function pullAll(uid,changedSet){const me=await deviceId();
  for(const s of STORES){let b=await getB(),cur=(b.cursors||{})[s]||null;
   for(let page=0;page<100;page++){const{docs,hasMore}=await cloud.pull(uid,s,cur);
    for(const x of docs)if(await applyRemote(s,x,me))changedSet.add(s);
    let max=cur;for(const x of docs)if(x.syncedAt&&cmpTime(x.syncedAt,max)>0)max=x.syncedAt;
    if(max!==cur){b=await getB();await putB({...b,cursors:{...b.cursors,[s]:max}})} // cursor advances only after docs were applied
    if(!hasMore)break;if(max===cur)throw mkErr('permanent','pull_stuck');cur=max}}}

 async function resolveConflict(uid,op,local,me){
  const remote=await cloud.fetch(uid,op.entityType,op.entityId);
  if(!remote){await S.atomic(op.entityType,op.entityId,cur=>cur?{rec:{...cur,remoteVersion:null}}:{});return'retry'} // doc vanished: re-create
  let outcome=null,loser=null;
  await S.atomic(op.entityType,op.entityId,(cur,q)=>{if(!cur)return{op:null};
   if(remoteWins(remote,cur,me)){outcome='remote';loser=cur;return{rec:{...remote.rec,syncStatus:'synced',remoteVersion:remote.version},op:null}}
   outcome='local';loser=remote.rec;return{rec:{...cur,remoteVersion:remote.version}}});
  if(outcome){await logConflict(op.entityType,op.entityId,outcome,loser);if(outcome==='remote'&&d.onApplied)pushedChanged.add(op.entityType)}
  return outcome==='local'||outcome===null?'retry':'resolved'}
 let pushedChanged=new Set();
 async function pushOp(uid,op,me){
  for(let a=0;a<3;a++){
   const rec=await S.get(op.entityType,op.entityId);if(!rec){await S.queueDel(op.id);return'gone'}
   try{const r=await cloud.upsert(uid,op.entityType,rec,{remoteVersion:rec.remoteVersion||null,deviceId:me});
    await S.atomic(op.entityType,op.entityId,(cur,q)=>{if(!cur)return{op:null};
     const same=cur.updatedAt===rec.updatedAt&&(cur.deletedAt||null)===(rec.deletedAt||null);
     if(same)return{rec:{...cur,syncStatus:'synced',remoteVersion:r.version},op:null};          // marked synced ONLY after cloud success
     return{rec:{...cur,remoteVersion:r.version},op:q?{...q,retryCount:0,nextAttemptAt:0,status:'pending',lastError:null}:undefined}}); // edited meanwhile: stay pending
    return'pushed'}
   catch(e){if(e.kind==='precondition'){const res=await resolveConflict(uid,op,rec,me);if(res==='retry')continue;return res}
    if(!e.pushed)e.pushed=rec;throw e}}
  return'contention'}
 async function markFailure(op,e){const ran=e.pushed;
  await S.atomic(op.entityType,op.entityId,(cur,q)=>{if(!q)return{};if(ran&&cur&&cur.updatedAt!==ran.updatedAt)return{}; // newer edit already reset the op
   const rc=(q.retryCount||0)+1,base={...q,retryCount:rc,lastError:String(e.message||e.kind)};
   return{op:e.kind==='permanent'?{...base,status:'failed'}:{...base,nextAttemptAt:now()+backoff(rc-1)}}})}
 async function pushAll(uid,force){const me=await deviceId();let ops=(await S.queueAll()).filter(o=>o&&STORES.includes(o.entityType));
  if(force)for(const o of ops)if(o.status==='failed'){o.status='pending';o.retryCount=0;o.nextAttemptAt=0;await S.queuePut(o)}
  ops=ops.filter(o=>o.status==='pending'&&(force||(o.nextAttemptAt||0)<=now())).sort((a,b)=>a.createdAt-b.createdAt);
  let first=null;
  for(const op of ops){try{await pushOp(uid,op,me)}catch(e){first=first||e;if(e.kind==='auth')throw e;await markFailure(op,e);if(e.kind==='network')break}}
  if(first)throw first}
 async function ensureProfile(uid){const b=await getB();if(b.profileDone)return;
  try{await cloud.putProfile(uid,{email:d.getEmail?d.getEmail():null,deviceId:await deviceId(),boundAt:b.boundAt,now:now()});await putB({...(await getB()),profileDone:true})}
  catch(e){if(e.kind==='auth'||e.kind==='network')throw e}}

 async function cycle(force){const ev=await evaluate();
  if(ev.state!=='ready'){await setState(ev.state);return{ok:false,skipped:ev.state}}
  const uid=await d.getUid(),changed=new Set();pushedChanged=new Set();await setState('syncing');
  try{await ensureProfile(uid);let pe=null;try{await pullAll(uid,changed)}catch(e){if(e.kind==='auth')throw e;pe=e} // a failed pull must not stop pushes (preconditions keep them safe) nor skip retry bookkeeping
   await pushAll(uid,force);if(pe)throw pe;
   const b=await getB();await putB({...b,lastSyncAt:now()});await setState('idle');return{ok:true}}
  catch(e){const k=e.kind||'error';await setState(k==='network'?'offline':k==='auth'?'auth-required':'error',String(e.message||k));return{ok:false,error:e.message,kind:k}}
  finally{pushedChanged.forEach(x=>changed.add(x));if(changed.size&&d.onApplied){try{d.onApplied([...changed])}catch(e){}}}}
 function syncNow(o={}){if(running){again=true;return running}
  running=(async()=>{try{let r,n=0;do{again=false;r=await cycle(!!o.force&&n===0);n++}while(again&&n<2&&r.ok);return r}finally{running=null}})();return running}
 const idle=async()=>{if(running)try{await running}catch(e){}};

 async function enqueueAllLocal(){await S.queueReplaceAll([]);
  for(const s of STORES)for(const r of await S.all(s)){if(pristine(s,r))continue;
   await S.atomic(s,r.id,cur=>cur?{rec:{...cur,syncStatus:'pending',remoteVersion:null},op:mkOp(s,cur,'create')}:{})}}
 async function importLocal(){await idle();const ev=await evaluate();if(ev.state!=='needs-decision')throw new Error('not_pending');
  const uid=await d.getUid();await putB(newB(uid,'merged'));await enqueueAllLocal();await refresh();return syncNow({force:true})}
 async function replaceLocalWithCloud(){await idle();const ev=await evaluate();if(ev.state!=='needs-decision'&&ev.state!=='mismatch')throw new Error('not_allowed');
  const uid=await d.getUid();await S.wipe();await putB(newB(uid,'merged'));await S.metaPut('conflicts',[]);if(d.afterWipe)await d.afterWipe();await refresh();return syncNow({force:true})}
 async function afterImport(){await idle();const b=await getB();if(!b||b.decision==='pending')return;await putB({...b,cursors:{}});await enqueueAllLocal();await emit()}
 async function afterClear(){await idle();const b=await getB();if(b)await putB({...b,cursors:{}});await emit()}
 async function retryFailed(){const q=await S.queueAll();for(const o of q)if(o.status==='failed')await S.queuePut({...o,status:'pending',retryCount:0,nextAttemptAt:0});await emit()}
 return{syncNow,status,refresh,evaluate,importLocal,replaceLocalWithCloud,afterImport,afterClear,retryFailed,
  clearConflicts:async()=>{await S.metaPut('conflicts',[]);await emit()},conflicts:async()=>(await S.metaGet('conflicts'))||[],
  pendingOps:async()=>(await S.queueAll()).filter(o=>o.status==='pending'),
  last:()=>last,subscribe(f){subs.add(f);return()=>subs.delete(f)},emit};
}

const api={createEngine,STORES,cmpTime,remoteWins,pristine};

// ---- Browser glue: wires IndexedDB, auth, Firestore REST and best-effort FOREGROUND triggers -------------------------
if(typeof window!=='undefined'&&g.TT&&g.TT.DB){
 const T=g.TT,DB=T.DB;let engine=null,auth=null,timer=null,started=false;const subs=new Set(),fire=()=>{const l=engine?engine.last():null;subs.forEach(f=>{try{f(l)}catch(e){}})};
 const store={get:(s,id)=>DB.get(s,id),all:s=>DB.all(s),put:(s,r)=>DB.put(s,r),atomic:(s,id,fn)=>DB.atomic(s,id,fn),queueAll:()=>DB.all('syncQueue'),queuePut:o=>DB.put('syncQueue',o),queueDel:id=>DB.del('syncQueue',id),
  queueReplaceAll:o=>DB.queueReplaceAll(o),metaGet:k=>DB.metaGet(k),metaPut:(k,v)=>DB.metaPut(k,v),wipe:()=>DB.clearAll()};
 const schedule=ms=>{clearTimeout(timer);timer=setTimeout(async()=>{if(!engine)return;await engine.syncNow();const s=engine.last();
  if(s&&s.pending>0&&(s.state==='offline'||s.state==='error')&&s.nextRetryAt)schedule(Math.max(1000,Math.min(300000,s.nextRetryAt-Date.now()+100)))},ms)};
 const guard=f=>(...a)=>{if(!engine)throw new Error('sync_not_started');return f(...a)};
 T.sync={api,
  async start(o={}){if(started)return;started=true;const cfg=g.TT_FIREBASE_CONFIG,fetchFn=(u,i)=>g.fetch(u,i);let ls=null;try{ls=g.localStorage}catch(e){}
   auth=T.cloudAuth.create({config:cfg,fetchFn,storage:ls||{getItem(){return null},setItem(){},removeItem(){}}});
   const cloud=auth.isConfigured()?T.cloud.createStore({config:cfg,auth,fetchFn}):null;
   engine=createEngine({store,cloud,getUid:()=>{const s=auth.snapshot();return s.user?s.user.uid:null},getEmail:()=>{const s=auth.snapshot();return s.user?s.user.email:null},afterWipe:o.onWipe,onApplied:o.onApplied});
   engine.subscribe(fire);auth.subscribe(()=>{fire();engine.refresh().then(()=>schedule(300))});await auth.init();await engine.refresh();fire();
   g.addEventListener('online',()=>schedule(300));g.addEventListener('tt:native-network',e=>{if(e.detail&&e.detail.online)schedule(300)});g.addEventListener('tt:resume',()=>schedule(300));
   g.addEventListener('tt:localchange',()=>schedule(1500));document.addEventListener('visibilitychange',()=>{if(!document.hidden)schedule(300)});
   setInterval(()=>{if(!document.hidden)schedule(0)},120000); // best-effort only; never relied upon
   schedule(500)},
  auth:()=>auth,isEnabled:()=>!!engine&&!!auth&&auth.isConfigured(),
  status:guard(()=>engine.status()),last:()=>engine?engine.last():null,subscribe:f=>{subs.add(f);return()=>subs.delete(f)},
  syncNow:guard(o=>engine.syncNow(o)),flush:guard(()=>engine.syncNow()),pending:guard(()=>engine.pendingOps()),
  importLocal:guard(()=>engine.importLocal()),replaceLocalWithCloud:guard(()=>engine.replaceLocalWithCloud()),
  afterImport:async()=>{if(engine)await engine.afterImport()},afterClear:async()=>{if(engine)await engine.afterClear()},
  retryFailed:guard(()=>engine.retryFailed()),clearConflicts:guard(()=>engine.clearConflicts()),
  setAdapter(){throw new Error('Phase 2 replaced setAdapter(): the engine is built in (see js/sync-engine.js)')}};
}
g.TT=g.TT||{};g.TT.syncCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
