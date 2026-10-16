// Fake Firestore-like cloud with the semantics the engine relies on: per-uid isolation, updateTime preconditions,
// server-assigned monotonic syncedAt, offline switch and error injection. Counts writes to prove idempotency.
function fakeCloud(){
 const users=new Map();let tick=0;const c={offline:false,failures:[],writes:0,reads:0,calls:[]};
 const ts=()=>new Date(Date.UTC(2026,0,1)+(++tick)*1000).toISOString().replace('.000Z','.000000Z');
 const coll=(uid,s)=>{if(!users.has(uid))users.set(uid,{});const u=users.get(uid);return u[s]||(u[s]=new Map())};
 const E=(kind,m)=>Object.assign(new Error(m||kind),{kind});
 const gate=op=>{if(c.offline)throw E('network','NETWORK');const i=c.failures.findIndex(f=>f[0]===op||f[0]==='*');if(i>=0)throw E(c.failures.splice(i,1)[0][1])};
 const strip=r=>{const{syncStatus,remoteVersion,...x}=r;return JSON.parse(JSON.stringify(x))};
 Object.assign(c,{
  async upsert(uid,s,rec,{remoteVersion,deviceId}={}){c.calls.push(['upsert',uid,s,rec.id]);gate('upsert');const m=coll(uid,s),cur=m.get(rec.id);
   if(remoteVersion){if(!cur||cur.version!==remoteVersion)throw E('precondition')}else if(cur)throw E('precondition');
   if(cur&&(rec.updatedAt??0)<(cur.rec.updatedAt??0))throw E('permanent','rules: updatedAt must not go backwards');
   const t=ts();m.set(rec.id,{rec:strip(rec),version:t,syncedAt:t,deviceId});c.writes++;return{version:t}},
  async fetch(uid,s,id){c.calls.push(['fetch',uid,s,id]);gate('fetch');c.reads++;const x=coll(uid,s).get(id);return x?{rec:JSON.parse(JSON.stringify(x.rec)),version:x.version,deviceId:x.deviceId,syncedAt:x.syncedAt}:null},
  async pull(uid,s,cursor,limit=200){c.calls.push(['pull',uid,s]);gate('pull');c.reads++;
   const all=[...coll(uid,s).values()].filter(x=>!cursor||x.syncedAt>=cursor).sort((a,b)=>a.syncedAt<b.syncedAt?-1:1).slice(0,limit);
   return{docs:all.map(x=>({rec:JSON.parse(JSON.stringify(x.rec)),version:x.version,deviceId:x.deviceId,syncedAt:x.syncedAt})),hasMore:all.length>=limit}},
  async putProfile(uid){c.calls.push(['profile',uid]);gate('profile')},
  // test helpers
  peek:(uid,s,id)=>{const x=coll(uid,s).get(id);return x&&x.rec},count:(uid,s)=>coll(uid,s).size,
  remoteEdit(uid,s,id,patch,deviceId='dev-remote'){const m=coll(uid,s),cur=m.get(id),t=ts();const rec={...(cur?cur.rec:{id}),...patch};m.set(id,{rec,version:t,syncedAt:t,deviceId})}});
 return c}
module.exports={fakeCloud};
