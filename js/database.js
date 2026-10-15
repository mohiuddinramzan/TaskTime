// Database service: versioned schema, CRUD, indexed queries, atomic multi-store writes, sync queue.
(function(g){
const NAME='task_time_db',VER=1;let db;
const SCHEMA={tasks:['status','categoryId','dueAt','createdAt','deletedAt'],sessions:['taskId','startedAt'],categories:[],settings:[],syncQueue:['status'],appState:[]};
const uid=()=>Date.now().toString(36)+'-'+Array.from(crypto.getRandomValues(new Uint32Array(3)),n=>n.toString(36)).join('');
const open=()=>db?Promise.resolve(db):new Promise((res,rej)=>{
 const r=indexedDB.open(NAME,VER);
 r.onupgradeneeded=()=>{const d=r.result;for(const s in SCHEMA){if(!d.objectStoreNames.contains(s)){const o=d.createObjectStore(s,{keyPath:'id'});SCHEMA[s].forEach(i=>o.createIndex(i,i))}}}; // future migrations: branch on event.oldVersion
 r.onsuccess=()=>{db=r.result;db.onversionchange=()=>db.close();res(db)};
 r.onerror=()=>rej(r.error);r.onblocked=()=>rej(new Error('DB blocked'))});
// run(stores, mode, fn(tx)->request); resolves after the transaction COMMITS.
const run=(s,m,f)=>open().then(d=>new Promise((res,rej)=>{const t=d.transaction(s,m);let q;try{q=f(t)}catch(e){t.abort();return rej(e)}
 t.oncomplete=()=>res(q&&q.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error||new Error('Transaction aborted'))}));
const DB={uid,open,
 all:s=>run(s,'readonly',t=>t.objectStore(s).getAll()),
 get:(s,id)=>run(s,'readonly',t=>t.objectStore(s).get(id)),
 byIndex:(s,i,v)=>run(s,'readonly',t=>t.objectStore(s).index(i).getAll(v)),
 put:(s,v)=>run(s,'readwrite',t=>t.objectStore(s).put(v)),
 del:(s,id)=>run(s,'readwrite',t=>t.objectStore(s).delete(id)),
 // Save locally FIRST; enqueue sync op in the same transaction (Phase 2 reads syncQueue).
 save(store,rec,op='update'){return run([store,'syncQueue'],'readwrite',t=>{t.objectStore('syncQueue').put({id:uid(),entityType:store,entityId:rec.id,operation:op,createdAt:Date.now(),retryCount:0,status:'pending'});return t.objectStore(store).put(rec)})},
 async seed(cats){for(const c of cats){if(!await DB.get('categories',c.id))await DB.put('categories',c)}}, // fixed ids => no duplicates
 async exportAll(){const o={};for(const s in SCHEMA)o[s]=await DB.all(s);return o},
 // Replace all data in ONE transaction; any error aborts and keeps old data.
 replaceAll(data){return run(Object.keys(SCHEMA),'readwrite',t=>{let last;for(const s in SCHEMA){const st=t.objectStore(s);st.clear();(data[s]||[]).forEach(r=>{last=st.put(r)})}return last})},
 clearAll(){return run(Object.keys(SCHEMA),'readwrite',t=>{let l;for(const s in SCHEMA)l=t.objectStore(s).clear();return l})}
};
g.TT=g.TT||{};g.TT.DB=DB;g.TT.SCHEMA=SCHEMA;
})(window);
