(function(g){
const STORES=['tasks','sessions','categories','settings','syncQueue','appState'];
function validate(o){if(!o||typeof o!=='object'||o.app!=='task_time'||!Number.isInteger(o.version)||!o.data)throw new Error('invalid_backup');
 for(const s of STORES){const a=o.data[s];if(!Array.isArray(a))throw new Error('missing_'+s);const ids=new Set();
  for(const r of a){if(!r||typeof r.id!=='string'||!r.id)throw new Error('bad_id_'+s);if(ids.has(r.id))throw new Error('dup_id_'+s);ids.add(r.id)}}
 o.data.tasks.forEach(t=>{if(Object.keys(g.TT.tasks.validate(t)).length)throw new Error('bad_task')});
 o.data.sessions.forEach(s=>{if(!Number.isInteger(s.durationMs)||s.durationMs<0||!Number.isFinite(s.startedAt))throw new Error('bad_session')});return o}
const api={validate,STORES,
 async exportJSON(){return JSON.stringify({app:'task_time',version:1,exportedAt:Date.now(),data:await g.TT.DB.exportAll()})},
 async parse(text){let o;try{o=JSON.parse(text)}catch{throw new Error('invalid_json')}return validate(o)}, // caller confirms, then DB.replaceAll(o.data)
 async csv(){const {DB,U}=g.TT;const [t,s]=await Promise.all([DB.all('tasks'),DB.all('sessions')]);const tm=Object.fromEntries(t.map(x=>[x.id,x.title]));
  return U.csv([['type','id','title','status','priority','estimatedMinutes','dueAt','startedAt','endedAt','durationMs','notes']].concat(
   t.filter(x=>!x.deletedAt).map(x=>['task',x.id,x.title,x.status,x.priority,x.estimatedMinutes??'',x.dueAt?new Date(x.dueAt).toISOString():'','','','','']),
   s.filter(x=>!x.deletedAt).map(x=>['session',x.id,tm[x.taskId]||'','','','','',new Date(x.startedAt).toISOString(),new Date(x.endedAt).toISOString(),x.durationMs,x.notes])))},
 download(name,text,type){ // Android WebView cannot save blob: downloads; use the single narrow native bridge when present
  if(g.TTNative&&typeof g.TTNative.postMessage==='function'){g.TTNative.postMessage(JSON.stringify({type:'saveFile',name,mime:type,content:text}));return}
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1e3)}};
g.TT=g.TT||{};g.TT.backup=api;
})(window);
