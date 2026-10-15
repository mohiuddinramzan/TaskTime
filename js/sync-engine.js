// FUTURE INTEGRATION INTERFACE ONLY. Firebase is NOT implemented in Phase 1; nothing here touches the network.
// Phase 2: provide an adapter {push(ops)} and call TT.sync.setAdapter(adapter). Entity writes already append to the
// persistent syncQueue (status pending|done|failed) in the same transaction as the local save.
(function(g){
let adapter=null;
g.TT.sync={isEnabled:()=>!!adapter,
 setAdapter(a){if(!a||typeof a.push!=='function')throw new Error('adapter needs push()');adapter=a},
 pending:()=>g.TT.DB.byIndex('syncQueue','status','pending'),
 async flush(){if(!adapter)return{skipped:true};const ops=await this.pending();
  try{await adapter.push(ops);for(const o of ops)await g.TT.DB.put('syncQueue',{...o,status:'done'})}
  catch(e){for(const o of ops)await g.TT.DB.put('syncQueue',{...o,retryCount:o.retryCount+1,status:o.retryCount>=4?'failed':'pending'})}}};
})(window);
