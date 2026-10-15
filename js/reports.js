(function(g){
const DAY=864e5;
const sod=t=>{const d=new Date(t);d.setHours(0,0,0,0);return d.getTime()};
const dk=ts=>{const d=new Date(ts);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
function range(kind,now=Date.now(),from,to){const end=sod(now)+DAY;
 if(kind==='today')return[sod(now),end];if(kind==='7')return[sod(now)-6*DAY,end];if(kind==='30')return[sod(now)-29*DAY,end];
 if(kind==='custom'){if(!(from<=to))throw new Error('bad_range');return[sod(from),sod(to)+DAY]}throw new Error('bad_kind')}
function build(sessions,tasks,[a,b],goalMs){
 const S=sessions.filter(s=>!s.deletedAt&&s.startedAt>=a&&s.startedAt<b),days={};
 for(let t=a;t<b;t+=DAY)days[dk(t)]=0;S.forEach(s=>{days[dk(s.startedAt)]+=s.durationMs});
 const tm=Object.fromEntries(tasks.map(t=>[t.id,t])),byTask={},byCat={};
 S.forEach(s=>{byTask[s.taskId]=(byTask[s.taskId]||0)+s.durationMs;const c=tm[s.taskId]?.categoryId||'none';byCat[c]=(byCat[c]||0)+s.durationMs});
 const total=S.reduce((x,s)=>x+s.durationMs,0),n=Object.keys(days).length;
 return{days,byTask,byCat,total,avg:total/n,nDays:n,goalDays:Object.values(days).filter(v=>goalMs>0&&v>=goalMs).length,
  completed:tasks.filter(t=>!t.deletedAt&&t.status==='completed'&&t.updatedAt>=a&&t.updatedAt<b).length,
  estVsActual:Object.keys(byTask).filter(id=>tm[id]).map(id=>({id,title:tm[id].title,est:(tm[id].estimatedMinutes||0)*6e4,actual:byTask[id]}))}}
const api={range,build,dk};g.TT=g.TT||{};g.TT.reports=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
