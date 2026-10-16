// Cloud Firestore adapter over the official REST API (users/{uid}/{collection}/{id}). No SDK, no ES modules.
// Timestamps: every app time is an epoch-millisecond INTEGER (same as Phase 1). `syncedAt` is the only Firestore timestamp
// (server REQUEST_TIME set on every write) and is the pull cursor, so late-arriving offline writes are never skipped.
(function(g){
const FS='https://firestore.googleapis.com/v1',SCHEMA_VERSION=2,ID=/^[A-Za-z0-9_-]{1,128}$/;
const FIELDS={ // whitelist = exactly what firebase/firestore.rules permits
 tasks:['id','title','description','categoryId','priority','status','estimatedMinutes','dueAt','recurrence','createdAt','updatedAt','deletedAt'],
 sessions:['id','taskId','startedAt','endedAt','durationMs','accumulatedMs','notes','createdAt','updatedAt','deletedAt'],
 categories:['id','name','createdAt','updatedAt','deletedAt'],
 settings:['id','theme','lang','dailyGoalMin','remindersEnabled','createdAt','updatedAt','deletedAt']};
const nt=s=>typeof s==='string'?s.replace(/(\.\d*?)0+Z$/,'$1Z').replace(/\.Z$/,'Z'):s;
function mkErr(kind,message,status){return Object.assign(new Error(message),{kind,status:status||0})}
function enc(v){if(v===null||v===undefined)return{nullValue:null};
 if(typeof v==='boolean')return{booleanValue:v};if(typeof v==='number')return Number.isInteger(v)?{integerValue:String(v)}:{doubleValue:v};
 if(typeof v==='string')return{stringValue:v};if(Array.isArray(v))return{arrayValue:{values:v.map(enc)}};
 return{mapValue:{fields:encFields(v)}}}
function encFields(o){const f={};for(const k in o)if(o[k]!==undefined)f[k]=enc(o[k]);return f}
function dec(v){if('nullValue'in v)return null;if('booleanValue'in v)return v.booleanValue;if('integerValue'in v)return Number(v.integerValue);if('doubleValue'in v)return v.doubleValue;
 if('stringValue'in v)return v.stringValue;if('timestampValue'in v)return v.timestampValue;if('arrayValue'in v)return(v.arrayValue.values||[]).map(dec);if('mapValue'in v)return decFields(v.mapValue.fields||{});return null}
function decFields(f){const o={};for(const k in f)o[k]=dec(f[k]);return o}
function toCloud(store,rec,deviceId){const o={};for(const k of FIELDS[store])if(rec[k]!==undefined)o[k]=rec[k];
 o.updatedAt=rec.updatedAt??rec.createdAt??0;o.createdAt=rec.createdAt??o.updatedAt;o.deletedAt=rec.deletedAt??null;
 o.schemaVersion=SCHEMA_VERSION;o.deviceId=String(deviceId||'unknown');return o}
function fromDoc(doc){const f=decFields(doc.fields||{});const{schemaVersion,deviceId,syncedAt,...rest}=f;
 return{rec:{...rest,id:f.id||String(doc.name).split('/').pop()},version:nt(doc.updateTime),deviceId:deviceId||'',syncedAt:syncedAt||null}}
function classify(status,body,o={}){const st=body&&body.error&&body.error.status;
 if(status===401||st==='UNAUTHENTICATED')return'auth';
 if(o.precond&&(st==='ALREADY_EXISTS'||st==='FAILED_PRECONDITION'||st==='ABORTED'||status===404||st==='NOT_FOUND'||status===409))return'precondition';
 if(status===403||st==='PERMISSION_DENIED')return'permanent';
 if(status===429||status>=500||st==='RESOURCE_EXHAUSTED'||st==='UNAVAILABLE'||st==='DEADLINE_EXCEEDED')return'transient';
 return'permanent'}
function createStore({config,auth,fetchFn,timeoutMs=20000}){
 const pid=config.projectId,root=`projects/${pid}/databases/(default)/documents`,base=`${FS}/${root}`;
 const chk=(uid,coll,id)=>{if(!ID.test(String(uid||''))||(id!==undefined&&!ID.test(String(id))))throw mkErr('permanent','bad_id');if(coll&&!FIELDS[coll]&&coll!=='profile')throw mkErr('permanent','bad_collection')};
 async function req(method,url,body,o={}){let token;
  try{token=await auth.getIdToken()}catch(e){throw mkErr(e.network?'network':'auth',e.code||'auth')}
  if(o.uid&&(!auth.snapshot().user||auth.snapshot().user.uid!==o.uid))throw mkErr('auth','account_changed');
  const ac=typeof AbortController!=='undefined'?new AbortController():null,tm=ac&&setTimeout(()=>ac.abort(),timeoutMs);let res;
  try{res=await fetchFn(url,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined,signal:ac&&ac.signal})}
  catch(e){throw mkErr('network','NETWORK')}finally{if(tm)clearTimeout(tm)}
  let data=null;try{data=await res.json()}catch(e){}
  if(!res.ok){if(res.status===404&&o.allow404)return null;const m=data&&data.error&&data.error.message;throw mkErr(classify(res.status,data,o),m||('HTTP '+res.status),res.status)}
  return data}
 return{
  async upsert(uid,store,rec,{remoteVersion,deviceId}={}){chk(uid,store,rec.id);
   const write={update:{name:`${root}/users/${uid}/${store}/${rec.id}`,fields:encFields(toCloud(store,rec,deviceId))},
    updateTransforms:[{fieldPath:'syncedAt',setToServerValue:'REQUEST_TIME'}],currentDocument:remoteVersion?{updateTime:remoteVersion}:{exists:false}};
   const r=await req('POST',`${base}:commit`,{writes:[write]},{uid,precond:true});const w=r&&r.writeResults&&r.writeResults[0];
   return{version:nt((w&&w.updateTime)||(r&&r.commitTime))}},
  async fetch(uid,store,id){chk(uid,store,id);const d=await req('GET',`${base}/users/${uid}/${store}/${id}`,null,{uid,allow404:true});return d?fromDoc(d):null},
  async pull(uid,store,cursor,limit=200){chk(uid,store);
   const sq={from:[{collectionId:store}],where:{fieldFilter:{field:{fieldPath:'syncedAt'},op:'GREATER_THAN_OR_EQUAL',value:{timestampValue:cursor||'1970-01-01T00:00:00Z'}}},orderBy:[{field:{fieldPath:'syncedAt'},direction:'ASCENDING'}],limit};
   const r=await req('POST',`${base}/users/${uid}:runQuery`,{structuredQuery:sq},{uid});
   const docs=(Array.isArray(r)?r:[]).filter(x=>x&&x.document).map(x=>fromDoc(x.document));return{docs,hasMore:docs.length>=limit}},
  async putProfile(uid,{email,deviceId,boundAt,now}){chk(uid,'profile','main');const t=now||Date.now();
   const f=encFields({id:'main',email:email||null,createdAt:boundAt||t,updatedAt:t,schemaVersion:SCHEMA_VERSION,deviceId:String(deviceId||'unknown')});
   await req('POST',`${base}:commit`,{writes:[{update:{name:`${root}/users/${uid}/profile/main`,fields:f},updateTransforms:[{fieldPath:'syncedAt',setToServerValue:'REQUEST_TIME'}]}]},{uid})}};
}
const api={createStore,FIELDS,SCHEMA_VERSION,enc,dec,encFields,decFields,toCloud,fromDoc,classify,normTime:nt,mkErr};
g.TT=g.TT||{};g.TT.cloud=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
