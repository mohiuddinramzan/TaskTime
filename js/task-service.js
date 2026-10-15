(function(g){
const PR=['low','medium','high'],ST=['pending','in_progress','completed'],REC=['none','daily','weekly'];
function validate(t){const e={};const title=String(t.title??'').trim();
 if(!title)e.title='required';else if(title.length>200)e.title='too_long';
 if(!PR.includes(t.priority))e.priority='invalid';if(!ST.includes(t.status))e.status='invalid';
 if(t.estimatedMinutes!=null&&!(Number.isInteger(t.estimatedMinutes)&&t.estimatedMinutes>=0&&t.estimatedMinutes<=10080))e.estimatedMinutes='invalid';
 if(t.dueAt!=null&&!Number.isFinite(t.dueAt))e.dueAt='invalid';
 if(t.recurrence&&!REC.includes(t.recurrence))e.recurrence='invalid';
 return e}
function filter(tasks,f,dayKey){let r=tasks.filter(t=>!t.deletedAt);const q=(f.q||'').toLowerCase();
 if(q)r=r.filter(t=>(t.title+' '+(t.description||'')).toLowerCase().includes(q));
 if(f.status)r=r.filter(t=>t.status===f.status);if(f.categoryId)r=r.filter(t=>t.categoryId===f.categoryId);
 if(f.priority)r=r.filter(t=>t.priority===f.priority);
 if(f.day)r=r.filter(t=>t.dueAt&&dayKey(t.dueAt)===f.day);
 const k=f.sort==='created'?'createdAt':'dueAt';return r.sort((a,b)=>(a[k]??Infinity)-(b[k]??Infinity))}
const api={validate,filter,PR,ST};
if(typeof window!=='undefined'){const {DB}=g.TT;
 const chk=t=>{const e=validate(t);if(Object.keys(e).length)throw Object.assign(new Error('invalid'),{errors:e})};
 Object.assign(api,{
 list:()=>DB.all('tasks'),
 async create(d){const now=Date.now();const t={title:'',description:'',categoryId:null,priority:'medium',status:'pending',estimatedMinutes:null,dueAt:null,recurrence:'none',...d,id:DB.uid(),createdAt:now,updatedAt:now,deletedAt:null,syncStatus:'pending'};
  chk(t);t.title=t.title.trim();await DB.save('tasks',t,'create');return t},
 async update(id,d){const o=await DB.get('tasks',id);if(!o)throw new Error('not_found');const t={...o,...d,id,updatedAt:Date.now(),syncStatus:'pending'};chk(t);t.title=t.title.trim();await DB.save('tasks',t);return t},
 async remove(id){const o=await DB.get('tasks',id);if(o)await DB.save('tasks',{...o,deletedAt:Date.now(),updatedAt:Date.now(),syncStatus:'pending'},'delete')}, // tombstone
 async setDone(id,done){const t=await api.update(id,{status:done?'completed':'pending'});
  if(done&&t.recurrence&&t.recurrence!=='none'){await api.create({...t,status:'pending',dueAt:(t.dueAt||Date.now())+(t.recurrence==='daily'?1:7)*864e5})}return t}})}
g.TT=g.TT||{};g.TT.tasks=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
