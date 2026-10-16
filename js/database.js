// Database service: versioned schema, CRUD, indexed queries, atomic multi-store writes, sync queue.
// v2 (Phase 2): adds the device-local `syncMeta` store (binding, cursors, device id). It is deliberately NOT part of
// SCHEMA, so backups/export/import/clearAll never touch it. Phase 1 data is untouched by the v1 -> v2 upgrade.
(function(g){
const NAME='task_time_db',VER=2;let db;
const SCHEMA={tasks:['status','categoryId','dueAt','createdAt','deletedAt'],sessions:['taskId','startedAt'],categories:[],settings:[],syncQueue:['status'],appState:[]};
const EXTRA={syncMeta:[]};
const uid=()=>Date.now().toString(36)+'-'+Array.from(crypto.getRandomValues(new Uint32Array(3)),n=>n.toString(36)).join('');
const open=()=>db?Promise.resolve(db):new Promise((res,rej)=>{
 const r=indexedDB.open(NAME,VER);
 // Idempotent: only creates what is missing, so v1 -> v2 keeps every existing record.
 r.onupgradeneeded=()=>{const d=r.result;
  for(const s in SCHEMA){if(!d.objectStoreNames.contains(s)){const o=d.createObjectStore(s,{keyPath:'id'});SCHEMA[s].forEach(i=>o.createIndex(i,i))}}
  for(const s in EXTRA){if(!d.objectStoreNames.contains(s))d.createObjectStore(s,{keyPath:'id'})}};
 r.onsuccess=()=>{db=r.result;db.onversionchange=()=>db.close();res(db)};
 r.onerror=()=>rej(r.error);r.onblocked=()=>rej(new Error('DB blocked'))});
// run(stores, mode, fn(tx)->request); resolves after the transaction COMMITS.
const run=(s,m,f)=>open().then(d=>new Promise((res,rej)=>{const t=d.transaction(s,m);let q;try{q=f(t)}catch(e){t.abort();return rej(e)}
 t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error('Transaction aborted'))}));
const changed=()=>{try{g.dispatchEvent(new Event('tt:localchange'))}catch(e){}};
const DB={uid,open,
 all:s=>run(s,'readonly',t=>t.objectStore(s).getAll()),
 get:(s,id)=>run(s,'readonly',t=>t.objectStore(s).get(id)),
 byIndex:(s,i,v)=>run(s,'readonly',t=>t.objectStore(s).index(i).getAll(v)),
 put:(s,v)=>run(s,'readwrite',t=>t.objectStore(s).put(v)),
 del:(s,id)=>run(s,'readwrite',t=>t.objectStore(s).delete(id)),
 // Save locally FIRST; enqueue sync op in the same transaction. Queue id is deterministic per entity ("store:id"),
 // so repeated edits coalesce into ONE pending op (bounded queue, no duplicate uploads).
 save(store,rec,op='update'){return run([store,'syncQueue'],'readwrite',t=>{const q=t.objectStore('syncQueue'),qid=store+':'+rec.id,r=q.get(qid);
  r.onsuccess=()=>{const o=r.result;q.put({id:qid,entityType:store,entityId:rec.id,operation:o&&o.operation==='create'&&op==='update'?'create':op,createdAt:o?o.createdAt:Date.now(),retryCount:0,nextAttemptAt:0,status:'pending',lastError:null})};
  return t.objectStore(store).put(rec)}).then(v=>{changed();return v})},
 // Atomic read-modify-write of ONE record + its queue entry. fn(rec,op)->{rec?,op?} ; op:null deletes the queue entry.
 atomic(store,id,fn){return run([store,'syncQueue'],'readwrite',t=>{const s=t.objectStore(store),q=t.objectStore('syncQueue'),qid=store+':'+id;let out={};
  const a=s.get(id);a.onsuccess=()=>{const b=q.get(qid);b.onsuccess=()=>{out=fn(a.result,b.result)||{};if(out.rec)s.put(out.rec);if(out.op===null)q.delete(qid);else if(out.op)q.put(out.op)}};
  return{get result(){return out}}})},
 queueReplaceAll:ops=>run(['syncQueue'],'readwrite',t=>{const s=t.objectStore('syncQueue');s.clear();let l;ops.forEach(o=>{l=s.put(o)});return l}),
 metaGet:k=>run(['syncMeta'],'readonly',t=>t.objectStore('syncMeta').get(k)).then(r=>r?r.value:null),
 metaPut:(k,v)=>run(['syncMeta'],'readwrite',t=>t.objectStore('syncMeta').put({id:k,value:v})),
 async seed(cats){for(const c of cats){if(!await DB.get('categories',c.id))await DB.put('categories',c)}}, // fixed ids => no duplicates
 async exportAll(){const o={};for(const s in SCHEMA)o[s]=await DB.all(s);return o},
 // Replace all data in ONE transaction; any error aborts and keeps old data.
 replaceAll(data){return run(Object.keys(SCHEMA),'readwrite',t=>{let last;for(const s in SCHEMA){const st=t.objectStore(s);st.clear();(data[s]||[]).forEach(r=>{last=st.put(r)})}return last})},
 clearAll(){return run(Object.keys(SCHEMA),'readwrite',t=>{let l;for(const s in SCHEMA)l=t.objectStore(s).clear();return l})}
};
g.TT=g.TT||{};g.TT.DB=DB;g.TT.SCHEMA=SCHEMA;
})(window);
