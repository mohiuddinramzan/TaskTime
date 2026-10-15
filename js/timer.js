// Timer engine. Source of truth = timestamps in IndexedDB (appState 'timer'), never interval ticks.
// LIMITATION: JS cannot run while the page is frozen/closed or the Android process is killed. On reopen, elapsed is
// recomputed as accumulatedMs + (now - startedAt), so a RUNNING timer still reflects wall-clock time, but no code
// (alerts/notifications) executes meanwhile. Native Android support (Phase 2) is needed for that.
(function(g){
const elapsed=(s,now=Date.now())=>!s?0:s.accumulatedMs+(s.status==='running'?Math.max(0,now-s.startedAt):0);
const T={elapsed,
 begin(taskId,id,now=Date.now()){return{id:'timer',sessionId:id,taskId,status:'running',startedAt:now,accumulatedMs:0,notes:'',origStartedAt:now}},
 pause(s,now=Date.now()){return s.status!=='running'?s:{...s,status:'paused',accumulatedMs:elapsed(s,now),startedAt:null}},
 resume(s,now=Date.now()){return s.status!=='paused'?s:{...s,status:'running',startedAt:now}},
 toSession(s,now=Date.now()){const d=Math.round(elapsed(s,now));return{id:s.sessionId,taskId:s.taskId,startedAt:s.origStartedAt,endedAt:now,durationMs:d,accumulatedMs:d,notes:s.notes||'',createdAt:now,deletedAt:null,syncStatus:'pending'}}};
if(typeof window!=='undefined'){const {DB}=g.TT;Object.assign(T,{
 get:()=>DB.get('appState','timer'),
 async start(taskId){if(await T.get())throw new Error('timer_active');const s=T.begin(taskId,DB.uid());await DB.put('appState',s);return s},
 async set(f){const s=await T.get();if(!s)return null;const n=f(s);await DB.put('appState',n);return n},
 // session write + timer clear in ONE transaction; session id fixed at start => idempotent, no duplicate sessions
 async finish(notes){const s=await T.get();if(!s)return null;const ses=T.toSession({...s,notes:notes??s.notes});
  const d=await DB.open();await new Promise((res,rej)=>{const t=d.transaction(['sessions','appState','syncQueue'],'readwrite');
   t.objectStore('sessions').put(ses);t.objectStore('appState').delete('timer');
   t.objectStore('syncQueue').put({id:DB.uid(),entityType:'sessions',entityId:ses.id,operation:'create',createdAt:Date.now(),retryCount:0,status:'pending'});
   t.oncomplete=res;t.onerror=t.onabort=()=>rej(t.error)});return ses},
 cancel:()=>DB.del('appState','timer')})}
g.TT=g.TT||{};g.TT.timer=T;if(typeof module!=='undefined')module.exports=T;
})(typeof window!=='undefined'?window:globalThis);
