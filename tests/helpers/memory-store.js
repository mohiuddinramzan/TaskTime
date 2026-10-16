// In-memory twin of the TT.DB contract used by the sync engine (same atomic()/queue/meta semantics).
const clone=x=>x===undefined?x:JSON.parse(JSON.stringify(x));
function createMemoryStore(){
 const data={categories:new Map(),settings:new Map(),tasks:new Map(),sessions:new Map()};let queue=new Map(),meta=new Map();
 const tbl=s=>{if(!data[s])throw new Error('no store '+s);return data[s]};
 return{
  _data:data,_queue:()=>queue,_meta:meta,
  async get(s,id){return clone(tbl(s).get(id))},async all(s){return[...tbl(s).values()].map(clone)},async put(s,r){tbl(s).set(r.id,clone(r))},
  // mimics DB.save(): record + coalesced queue entry in one step
  async save(s,r,op='update'){tbl(s).set(r.id,clone(r));const id=s+':'+r.id,o=queue.get(id);
   queue.set(id,{id,entityType:s,entityId:r.id,operation:o&&o.operation==='create'&&op==='update'?'create':op,createdAt:o?o.createdAt:Date.now(),retryCount:0,nextAttemptAt:0,status:'pending',lastError:null})},
  async atomic(s,id,fn){const qid=s+':'+id,out=fn(clone(tbl(s).get(id)),clone(queue.get(qid)))||{};if(out.rec)tbl(s).set(id,clone(out.rec));if(out.op===null)queue.delete(qid);else if(out.op)queue.set(qid,clone(out.op));return out},
  async queueAll(){return[...queue.values()].map(clone)},async queuePut(o){queue.set(o.id,clone(o))},async queueDel(id){queue.delete(id)},
  async queueReplaceAll(ops){queue=new Map(ops.map(o=>[o.id,clone(o)]))},
  async metaGet(k){return meta.has(k)?clone(meta.get(k)):null},async metaPut(k,v){meta.set(k,clone(v))},
  async wipe(){for(const m of Object.values(data))m.clear();queue=new Map()}};
}
module.exports={createMemoryStore};
