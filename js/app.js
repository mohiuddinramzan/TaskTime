(function(){
const {DB,U,tasks:TS,timer:TM,reports:RP,settings:SE,backup:BK}=TT,h=U.h,$=s=>document.querySelector(s);
const I={bn:{home:'হোম',tasks:'টাস্ক',timer:'টাইমার',reports:'রিপোর্ট',cal:'ক্যালেন্ডার',set:'সেটিংস',hi:'শুভ দিন',today:'আজকের সময়',goal:'লক্ষ্য',done:'সম্পন্ন',pend:'বাকি',none:'কিছু নেই',online:'অনলাইন',offline:'অফলাইন',title:'শিরোনাম',desc:'বিবরণ',cat:'ক্যাটাগরি',prio:'অগ্রাধিকার',stat:'অবস্থা',est:'আনুমানিক মিনিট',due:'শেষ তারিখ',rec:'পুনরাবৃত্তি',save:'সংরক্ষণ',cancel:'বাতিল',del:'মুছবেন?',start:'শুরু',pause:'বিরতি',resume:'চালু',finish:'শেষ',notes:'নোট',hist:'সেশন ইতিহাস',theme:'থিম',lang:'ভাষা',exp:'JSON এক্সপোর্ট',imp:'ব্যাকআপ ইমপোর্ট',csv:'CSV এক্সপোর্ট',clr:'সব ডাটা মুছুন',sure:'নিশ্চিত? বিদ্যমান ডাটা প্রতিস্থাপিত/মুছে যাবে।',ver:'সংস্করণ 2.0.0 (ফেজ ২ — লোকাল-ফার্স্ট + ক্লাউড সিঙ্ক)',rem:'রিমাইন্ডার (ভবিষ্যতের জন্য সংরক্ষিত, এখনও কাজ করে না)',active:'চলমান টাইমার',recent:'সম্প্রতি সম্পন্ন',all:'সব',reopen:'আবার খুলুন',resched:'আজকে সরান',avg:'গড়/দিন',goaldays:'লক্ষ্য পূরণের দিন',custom:'কাস্টম',bad:'ভুল ইনপুট',activeErr:'আরেকটি টাইমার চলছে',search:'খুঁজুন',sort:'সাজান',trk:'ট্র্যাকড',streak:'স্ট্রিক',days:'দিন',vsY:'গতকালের তুলনায়',tasksN:'টাস্ক',p_high:'উচ্চ',p_medium:'মাঝারি',p_low:'নিম্ন',pr_t:'অগ্রাধিকার',d_today:'আজ',d7:'৭ দিন',d30:'৩০ দিন',min:'সর্বনিম্ন',max:'সর্বোচ্চ',run:'চলছে',paused:'বিরতিতে',estL:'আনুমানিক',noTimer:'কোনো টাইমার চলছে না',pickStart:'শুরু করতে একটি টাস্ক বাছুন',score:'লক্ষ্য পূরণ',byCat:'ক্যাটাগরি অনুযায়ী',byTask:'টাস্ক: আনুমানিক / প্রকৃত',noData:'এই সময়ে কোনো সেশন নেই',day:'দিনের সারাংশ',dueSoon:'আজকের টাস্ক',st_pending:'বাকি',st_in_progress:'চলমান',st_completed:'সম্পন্ন',rc_none:'—',rc_daily:'প্রতিদিন',rc_weekly:'প্রতি সপ্তাহ'},
en:{home:'Home',tasks:'Tasks',timer:'Timer',reports:'Reports',cal:'Calendar',set:'Settings',hi:'Hello',today:'Tracked today',goal:'Goal',done:'Done',pend:'Pending',none:'Nothing here',online:'Online',offline:'Offline',title:'Title',desc:'Description',cat:'Category',prio:'Priority',stat:'Status',est:'Estimated minutes',due:'Due date',rec:'Recurrence',save:'Save',cancel:'Cancel',del:'Delete?',start:'Start',pause:'Pause',resume:'Resume',finish:'Finish',notes:'Notes',hist:'Session history',theme:'Theme',lang:'Language',exp:'Export JSON',imp:'Import backup',csv:'Export CSV',clr:'Clear all data',sure:'Sure? Existing data will be replaced/erased.',ver:'Version 2.0.0 (Phase 2 — local-first + cloud sync)',rem:'Reminders (reserved for future; not active yet)',active:'Active timer',recent:'Recently completed',all:'All',reopen:'Reopen',resched:'Move to today',avg:'Avg/day',goaldays:'Goal days met',custom:'Custom',bad:'Invalid input',activeErr:'Another timer is running',search:'Search',sort:'Sort',trk:'Tracked',streak:'Streak',days:'days',vsY:'vs yesterday',tasksN:'tasks',p_high:'High',p_medium:'Medium',p_low:'Low',pr_t:'Priority',d_today:'Today',d7:'7D',d30:'30D',min:'Min',max:'Max',run:'Running',paused:'Paused',estL:'Estimated',noTimer:'No timer running',pickStart:'Pick a task to start',score:'Goal reached',byCat:'By category',byTask:'Tasks: estimated / actual',noData:'No sessions in this period',day:'Day summary',dueSoon:'Due today',st_pending:'Pending',st_in_progress:'In progress',st_completed:'Done',rc_none:'—',rc_daily:'Daily',rc_weekly:'Weekly'}};
const t=k=>I[SE.get().lang][k]||k;
const CATS=[['cat-work','কাজ','Work'],['cat-study','পড়াশোনা','Study'],['cat-personal','ব্যক্তিগত','Personal'],['cat-health','স্বাস্থ্য','Health']].map(([id,bn,en])=>({id,name:{bn,en},createdAt:0,deletedAt:null}));
const cname=(cs,id)=>cs.find(c=>c.id===id)?.name[SE.get().lang]||'—';
const S={tab:'home',f:{},day:RP.dk(Date.now()),month:new Date(),rng:'7',from:'',to:''};let tick;
const tabs=[['home','home','home'],['tasks','tasks','check'],['timer','timer','timer'],['reports','reports','chart'],['cal','cal','cal'],['set','set','sliders']];
const ask=m=>confirm(m);
const err=e=>alert(e.errors?t('bad')+': '+Object.keys(e.errors).join(', '):e.message==='timer_active'?t('activeErr'):e.message);
// ---- tiny SVG helpers (no innerHTML) ----
const NS='http://www.w3.org/2000/svg';
const sv=(tag,a,...kids)=>{const e=document.createElementNS(NS,tag);for(const k in a||{})e.setAttribute(k,a[k]);kids.flat().forEach(c=>c!=null&&e.append(c));return e};
const ICONS={home:'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z',check:'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
 timer:'M12 6v6l4 2M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18',chart:'M18 20V10M12 20V4M6 20v-6',cal:'M3 5h18v17H3zM16 2v4M8 2v4M3 11h18',
 sliders:'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',play:'M6 4l14 8-14 8z',edit:'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
 trash:'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6'};
const icon=(n,s=22)=>sv('svg',{viewBox:'0 0 24 24',width:s,height:s,fill:'none',stroke:'currentColor','stroke-width':2,'stroke-linecap':'round','stroke-linejoin':'round','aria-hidden':'true'},sv('path',{d:ICONS[n]}));
let rid=0;
// progress ring: returns {el,set(pct 0..100)}; inner = DOM nodes shown in the middle
function ring(pct,size,stroke,...inner){const id='rg'+(++rid),R=45,C=2*Math.PI*R;
 const p=sv('circle',{cx:50,cy:50,r:R,fill:'none',stroke:'url(#'+id+')','stroke-width':stroke,'stroke-linecap':'round',transform:'rotate(-90 50 50)','stroke-dasharray':C,class:'ring-p'});
 const set=v=>p.setAttribute('stroke-dashoffset',C*(1-Math.max(0,Math.min(100,v))/100));set(pct);
 const el=h('div',{class:'ringwrap',style:'width:'+size+'px;height:'+size+'px'},sv('svg',{viewBox:'0 0 100 100',width:size,height:size},
  sv('defs',{},sv('linearGradient',{id,x1:0,y1:0,x2:1,y2:1},sv('stop',{offset:'0%','stop-color':'#7c3aed'}),sv('stop',{offset:'100%','stop-color':'#c4b5fd'}))),
  sv('circle',{cx:50,cy:50,r:R,fill:'none','stroke-width':stroke,class:'ring-t'}),p),h('div',{class:'ringin'},...inner));return{el,set}}
const hm=ms=>{const m=Math.round(Math.max(0,ms)/6e4),H=Math.floor(m/60);return H?H+'h '+(m%60)+'m':m+'m'};
const PL=p=>t('p_'+p),PCOL={high:'var(--lime)',medium:'var(--cyan)',low:'var(--lav)'};
const CATCOL=['#8b5cf6','#3fd2ee','#c8f27d','#f5a524','#ef5b6b','#34d399'];
const catColor=(cs,id)=>{const i=cs.findIndex(c=>c.id===id);return i<0?'#6b6a7d':CATCOL[i%CATCOL.length]};
const seg=(opts,val,on)=>h('div',{class:'seg'},opts.map(([v,l])=>h('button',{class:v===val?'on':'',onclick:()=>on(v)},l)));
const go=async tab=>{S.tab=tab;clearInterval(tick);$('#nav').replaceChildren(...tabs.map(([k,l,ic])=>h('button',{class:k===tab?'on':'',onclick:()=>go(k)},icon(ic),h('span',{},t(l)))));
 $('#ttl').textContent='Task Time · '+t(tab);$('#fab').style.display=tab==='tasks'||tab==='home'?'':'none';
 const v=$('#view');v.replaceChildren();try{await V[tab](v)}catch(e){v.append(h('p',{class:'err'},String(e.message)))}};
const sel=(opts,val,on)=>{const s=h('select',{onchange:e=>on(e.target.value)},opts.map(([v,l])=>{const o=h('option',{value:v},l);if(v===val)o.selected=true;return o}));return s};
const toLocal=ts=>ts?RP.dk(ts):'';const fromLocal=s=>s?new Date(s+'T12:00:00').getTime():null;
const ib=(ic,fn,cls='')=>h('button',{class:'ib '+cls,onclick:fn},icon(ic,18));
function taskRow(x,cs,reload){const done=x.status==='completed';
 return h('div',{class:'card task '+x.priority},h('div',{class:'row'},h('b',{class:done?'done':''},x.title),h('span',{class:'badge '+x.priority},PL(x.priority))),
 h('div',{class:'m'},h('span',{class:'dot',style:'background:'+catColor(cs,x.categoryId)}),cname(cs,x.categoryId)+(x.dueAt?' · '+toLocal(x.dueAt):'')+(x.estimatedMinutes?' · '+x.estimatedMinutes+'m':'')),
 h('div',{},h('button',{class:'ib',title:done?t('reopen'):t('done'),onclick:async()=>{await TS.setDone(x.id,!done);reload()}},done?'↺':icon('check',18)),
  ib('edit',()=>form(x,cs,reload)),ib('play',async()=>{try{await TM.start(x.id);go('timer')}catch(e){err(e)}}),
  ib('trash',async()=>{if(ask(t('del'))){await TS.remove(x.id);reload()}},'d')))}
function form(x,cs,reload){const d=$('#dlg'),v=x||{priority:'medium',status:'pending',recurrence:'none'},er=h('div',{class:'err'});
 const f={title:h('input',{placeholder:t('title'),maxlength:200,value:v.title||''}),desc:h('textarea',{placeholder:t('desc')},v.description||''),
  cat:sel([['','—'],...cs.map(c=>[c.id,c.name[SE.get().lang]])],v.categoryId||'',()=>{}),pr:sel(TS.PR.map(p=>[p,PL(p)]),v.priority,()=>{}),
  st:sel(TS.ST.map(p=>[p,t('st_'+p)]),v.status,()=>{}),est:h('input',{type:'number',min:0,placeholder:t('est'),value:v.estimatedMinutes??''}),
  due:h('input',{type:'date',value:toLocal(v.dueAt)}),rec:sel([['none','—'],['daily',t('rc_daily')],['weekly',t('rc_weekly')]],v.recurrence||'none',()=>{})};
 d.replaceChildren(h('h3',{},x?'✎':'+'),f.title,f.desc,f.cat,f.pr,f.st,f.est,f.due,f.rec,er,h('button',{class:'btn',onclick:async()=>{
  const data={title:f.title.value,description:f.desc.value,categoryId:f.cat.value||null,priority:f.pr.value,status:f.st.value,
   estimatedMinutes:f.est.value===''?null:Number(f.est.value),dueAt:fromLocal(f.due.value),recurrence:f.rec.value};
  try{x?await TS.update(x.id,data):await TS.create(data);d.close();reload()}catch(e){er.textContent=e.errors?t('bad')+': '+Object.keys(e.errors).join(', '):e.message}}},t('save')),
  h('button',{class:'btn g',onclick:()=>d.close()},t('cancel')));d.showModal()}
// stacked bars: one bar per day, segments = categories; dashed line = daily goal
function stacked(R,cs,goalMs){const keys=Object.keys(R.days),W=300,H=120,top=6,bh=H-top,mx=Math.max(1,goalMs>0&&goalMs<Math.max(...Object.values(R.days))*3?goalMs:0,...Object.values(R.days)),w=W/keys.length,bw=Math.max(2,w*(keys.length>14?.8:.6));
 const s=sv('svg',{viewBox:'0 0 300 136',class:'chart',role:'img'});
 if(goalMs>0&&goalMs<=mx)s.append(sv('line',{x1:0,x2:W,y1:top+bh*(1-goalMs/mx),y2:top+bh*(1-goalMs/mx),stroke:'currentColor','stroke-dasharray':'3 3','stroke-opacity':.5}));
 const lang=SE.get().lang==='bn'?'bn-BD':'en-US';
 keys.forEach((k,i)=>{let y=top+bh;const x=i*w+(w-bw)/2;const parts=Object.entries(R.dayCat[k]||{}).sort((a,b)=>b[1]-a[1]);
  parts.forEach(([c,ms])=>{const hh=ms/mx*bh;y-=hh;const r=sv('rect',{x,y,width:bw,height:Math.max(.5,hh),rx:Math.min(3,bw/2),fill:catColor(cs,c)});r.append(sv('title',{},k+' '+hm(ms)));s.append(r)});
  if(!parts.length)s.append(sv('rect',{x,y:top+bh-1.5,width:bw,height:1.5,fill:'currentColor','fill-opacity':.25}));
  const dt=new Date(k+'T12:00:00'),lab=keys.length<=7?dt.toLocaleDateString(lang,{weekday:'short'}):(i===0||i===keys.length-1||i===Math.floor(keys.length/2))?(dt.getDate()+'/'+(dt.getMonth()+1)):'';
  if(lab)s.append(sv('text',{x:x+bw/2,y:131,'text-anchor':'middle',fill:'currentColor'},lab))});return s}
const todaySum=(ss,now=Date.now())=>ss.filter(s=>!s.deletedAt&&s.startedAt>=U.startOfDay(now)).reduce((a,s)=>a+s.durationMs,0);
const daySum=(ss,from,to)=>ss.filter(s=>!s.deletedAt&&s.startedAt>=from&&s.startedAt<to).reduce((a,s)=>a+s.durationMs,0);
const V={
async home(v){const [ts,ss,cs,tm]=await Promise.all([TS.list(),DB.all('sessions'),DB.all('categories'),TM.get()]),live=ts.filter(x=>!x.deletedAt),sd=U.startOfDay(Date.now());
 const run=tm?TM.elapsed(tm):0,tracked=todaySum(ss)+run,yest=daySum(ss,sd-864e5,sd),goal=SE.get().dailyGoalMin*6e4,pct=goal?Math.min(100,tracked/goal*100):0,diff=tracked-yest;
 const tt=live.filter(x=>x.status!=='completed'&&x.dueAt&&x.dueAt<sd+864e5);const dn=live.filter(x=>x.status==='completed').sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,3);
 const rg=ring(pct,118,9,h('div',{class:'num'},Math.round(pct)+'%'),h('div',{class:'m'},t('score')));
 v.append(h('div',{class:'card hero'},h('div',{class:'row',style:'flex-wrap:nowrap'},h('div',{},h('div',{class:'m'},new Date().toLocaleDateString(SE.get().lang==='bn'?'bn-BD':'en-US',{dateStyle:'full'})),h('h2',{},t('hi')),
   h('div',{},t('today')+': ',h('b',{},hm(tracked)),' / '+SE.get().dailyGoalMin+'m'),
   h('span',{class:'chip'+(diff<0?' neg':'')},(diff>=0?'+':'−')+hm(Math.abs(diff))+' '+t('vsY'))),rg.el)),
  h('div',{class:'tiles'},[[live.filter(x=>x.status==='completed').length,t('done')],[(tracked/36e5).toFixed(1)+'h',t('trk')],[RP.streak(ss),t('streak')+' ('+t('days')+')']].map(([n,l])=>h('div',{class:'tile'},h('span',{class:'num'},String(n)),h('span',{class:'m'},l)))));
 const open=live.filter(x=>x.status!=='completed'),cnt=p=>open.filter(x=>x.priority===p).length;
 v.append(h('h3',{},t('pr_t')),h('div',{class:'ptiles'},['high','medium','low'].map(p=>h('button',{class:'pt '+p,onclick:()=>{S.f={priority:p};go('tasks')}},h('span',{class:'num'},String(cnt(p))),h('small',{},PL(p)+' · '+t('tasksN'))))));
 if(tm){const tk=ts.find(x=>x.id===tm.taskId);v.append(h('div',{class:'card',onclick:()=>go('timer')},h('div',{class:'row'},h('div',{},h('div',{class:'m'},t('active')+' · '+t(tm.status==='running'?'run':'paused')),h('b',{},tk?.title||'—')),h('div',{class:'num'},U.fmt(TM.elapsed(tm))))))}
 const rl=()=>go('home');v.append(h('h3',{},t('dueSoon')),...(tt.length?tt.map(x=>taskRow(x,cs,rl)):[h('p',{class:'m'},t('none'))]),...(dn.length?[h('h3',{},t('recent')),...dn.map(x=>taskRow(x,cs,rl))]:[]))},
async tasks(v){const [ts,cs]=await Promise.all([TS.list(),DB.all('categories')]),F=S.f,rl=()=>go('tasks');
 const L=(a)=>[['',t('all')],...a];
 v.append(h('input',{placeholder:t('search'),value:F.q||'',oninput:e=>{F.q=e.target.value;clearTimeout(S.dt);S.dt=setTimeout(rl,250)}}),
  seg(L(TS.PR.map(p=>[p,PL(p)])),F.priority||'',x=>{F.priority=x;rl()}),
  h('div',{class:'row'},sel(L(TS.ST.map(s=>[s,t('st_'+s)])),F.status||'',x=>{F.status=x;rl()}),sel(L(cs.map(c=>[c.id,c.name[SE.get().lang]])),F.categoryId||'',x=>{F.categoryId=x;rl()})),
  h('div',{class:'row'},h('input',{type:'date',value:F.day||'',onchange:e=>{F.day=e.target.value;rl()}}),sel([['due',t('sort')+': '+t('due')],['created',t('sort')+': created']],F.sort||'due',x=>{F.sort=x;rl()})));
 const r=TS.filter(ts,F,RP.dk);v.append(...(r.length?r.map(x=>taskRow(x,cs,rl)):[h('p',{class:'m'},t('none'))]))},
async timer(v){const [ts,ss]=await Promise.all([TS.list(),DB.all('sessions')]);let tm=await TM.get();const tk=tm&&ts.find(x=>x.id===tm.taskId),rl=()=>go('timer');
 const est=tk&&tk.estimatedMinutes?tk.estimatedMinutes*6e4:0,prog=ms=>est?Math.min(100,ms/est*100):(ms%36e5)/36e5*100;
 const time=h('div',{class:'big'},U.fmt(TM.elapsed(tm))),sub=h('div',{class:'m'},tm?t(tm.status==='running'?'run':'paused')+(est?' · '+t('estL')+' '+hm(est):''):t('noTimer'));
 const rg=ring(tm?prog(TM.elapsed(tm)):0,250,6,time,sub),notes=h('textarea',{placeholder:t('notes')},tm?.notes||'');
 const c=h('div',{class:'card focus'},h('b',{},tk?tk.title:t('timer')),rg.el);
 if(tm){c.append(h('div',{class:'controls'},h('button',{class:'btn w',onclick:async()=>{if(ask(t('del'))){await TM.cancel();rl()}}},t('cancel')),
   tm.status==='running'?h('button',{class:'btn',onclick:async()=>{await TM.set(TM.pause);rl()}},t('pause')):h('button',{class:'btn',onclick:async()=>{await TM.set(TM.resume);rl()}},t('resume'))),
  notes,h('button',{class:'btn g',onclick:async()=>{await TM.finish(notes.value);rl()}},'✓ '+t('finish')));
  tick=setInterval(()=>{const e=TM.elapsed(tm);time.textContent=U.fmt(e);rg.set(prog(e))},500)} // display only; truth is the stored timestamps
 v.append(c);
 if(!tm){const pend=TS.filter(ts,{sort:'due'},RP.dk).filter(x=>x.status!=='completed').slice(0,5);
  if(pend.length)v.append(h('h3',{},t('pickStart')),...pend.map(x=>h('div',{class:'card task '+x.priority},h('div',{class:'row',style:'flex-wrap:nowrap'},h('b',{},x.title),ib('play',async()=>{try{await TM.start(x.id);rl()}catch(e){err(e)}})))))}
 const tot={};ss.filter(s=>!s.deletedAt).forEach(s=>tot[s.taskId]=(tot[s.taskId]||0)+s.durationMs);
 v.append(h('h3',{},t('hist')),...ss.filter(s=>!s.deletedAt).sort((a,b)=>b.startedAt-a.startedAt).slice(0,30).map(s=>{const k=ts.find(x=>x.id===s.taskId);
  return h('div',{class:'card'},h('div',{class:'row'},h('b',{},k?.title||'—'),h('span',{class:'num'},U.fmt(s.durationMs))),h('div',{class:'m'},new Date(s.startedAt).toLocaleString()+' · Σ '+U.fmt(tot[s.taskId]||0)),s.notes&&h('div',{},s.notes))}))},
async reports(v){const [ts,ss,cs]=await Promise.all([TS.list(),DB.all('sessions'),DB.all('categories')]);const rl=()=>go('reports'),goal=SE.get().dailyGoalMin*6e4;let R;
 try{R=RP.build(ss,ts,RP.range(S.rng,Date.now(),S.from?fromLocal(S.from):0,S.to?fromLocal(S.to):0),goal)}catch{R=null}
 v.append(seg([['today',t('d_today')],['7',t('d7')],['30',t('d30')],['custom',t('custom')]],S.rng,x=>{S.rng=x;rl()}));
 if(S.rng==='custom')v.append(h('div',{class:'row'},h('input',{type:'date',value:S.from,onchange:e=>{S.from=e.target.value;rl()}}),h('input',{type:'date',value:S.to,onchange:e=>{S.to=e.target.value;rl()}})));
 if(!R)return v.append(h('p',{class:'err'},t('bad')));
 const nm=id=>ts.find(x=>x.id===id)?.title||'—',vals=Object.values(R.days),pct=goal?Math.min(100,(S.rng==='today'?R.total:R.avg)/goal*100):0;
 const rg=ring(pct,168,8,h('div',{class:'num'},hm(R.total)),h('div',{class:'m'},Math.round(pct)+'% '+t('goal')));
 v.append(h('div',{class:'card ctr'},rg.el,h('div',{class:'stat3'},[[t('min'),Math.min(...vals)],[t('avg'),R.avg],[t('max'),Math.max(...vals)]].map(([l,ms])=>h('div',{},h('div',{class:'m'},l),h('b',{},hm(ms))))),
   h('div',{class:'m'},t('done')+': '+R.completed+' · '+t('goaldays')+': '+R.goalDays+'/'+R.nDays)));
 if(!R.total)return v.append(h('p',{class:'m ctr'},t('noData')));
 const ents=Object.entries(R.byCat).sort((a,b)=>b[1]-a[1]);
 v.append(h('div',{class:'card'},stacked(R,cs,goal),h('div',{class:'legend'},ents.map(([id])=>h('span',{class:'m'},h('span',{class:'dot',style:'background:'+catColor(cs,id)}),id==='none'?'—':cname(cs,id))))),
  h('div',{class:'card'},h('b',{},t('byCat')),...ents.map(([id,ms])=>h('div',{style:'margin-top:10px'},h('div',{class:'row'},h('span',{},h('span',{class:'dot',style:'background:'+catColor(cs,id)}),id==='none'?'—':cname(cs,id),h('span',{class:'m'},' '+Math.round(ms/R.total*100)+'%')),h('b',{},hm(ms))),
    h('div',{class:'bar'},h('i',{style:'width:'+(ms/R.total*100)+'%;background:'+catColor(cs,id)}))))),
  h('div',{class:'card'},h('b',{},t('byTask')),...Object.entries(R.byTask).sort((a,b)=>b[1]-a[1]).map(([id,ms])=>{const e=R.estVsActual.find(x=>x.id===id)?.est||0;return h('div',{style:'margin-top:10px'},h('div',{class:'row'},h('span',{},nm(id)),h('span',{class:'m'},hm(e)+' / '+hm(ms))),h('div',{class:'bar'},h('i',{style:'width:'+Math.min(100,e?ms/e*100:100)+'%'})))})))},
async cal(v){const [ts,ss,cs]=await Promise.all([TS.list(),DB.all('sessions'),DB.all('categories')]),m=S.month,y=m.getFullYear(),mo=m.getMonth(),rl=()=>go('cal');
 const live=ts.filter(x=>!x.deletedAt),g=h('div',{class:'cal'}),has=new Set(live.filter(x=>x.dueAt).map(x=>RP.dk(x.dueAt)));
 v.append(h('div',{class:'row'},h('button',{class:'ib',onclick:()=>{S.month=new Date(y,mo-1,1);rl()}},'‹'),h('b',{},m.toLocaleDateString(SE.get().lang==='bn'?'bn-BD':'en-US',{month:'long',year:'numeric'})),h('button',{class:'ib',onclick:()=>{S.month=new Date(y,mo+1,1);rl()}},'›')),g);
 for(let i=0;i<new Date(y,mo,1).getDay();i++)g.append(h('span'));
 for(let d=1;d<=new Date(y,mo+1,0).getDate();d++){const k=RP.dk(new Date(y,mo,d).getTime());g.append(h('button',{class:(k===S.day?'sel ':'')+(has.has(k)?'has':''),onclick:()=>{S.day=k;rl()}},String(d)))}
 const day=live.filter(x=>x.dueAt&&RP.dk(x.dueAt)===S.day),ms=ss.filter(s=>!s.deletedAt&&RP.dk(s.startedAt)===S.day).reduce((a,s)=>a+s.durationMs,0),inc=day.filter(x=>x.status!=='completed'),goalMs=SE.get().dailyGoalMin*6e4;
 v.append(h('div',{class:'card'},h('div',{class:'row'},h('b',{},S.day),h('span',{class:'num'},U.fmt(ms))),h('div',{class:'bar'},h('i',{style:'width:'+Math.min(100,goalMs?ms/goalMs*100:0)+'%'})),h('div',{class:'m'},t('goal')+' '+SE.get().dailyGoalMin+'m'),inc.length&&h('button',{class:'btn',onclick:async()=>{for(const x of inc)await TS.update(x.id,{dueAt:Date.now()});rl()}},t('resched'))),
  ...(day.length?day.map(x=>taskRow(x,cs,rl)):[h('p',{class:'m'},t('none'))]))},
async set(v){const s=SE.get(),file=h('input',{type:'file',accept:'application/json',style:'display:none',onchange:async e=>{const f=e.target.files[0];if(!f)return;
  try{const o=await BK.parse(await f.text());if(ask(t('sure')+TT.accountUI.importNote())){await DB.replaceAll(o.data);await SE.load();await TT.sync.afterImport();go('set')}}catch(x){alert('Import failed: '+x.message)}e.target.value=''}});
 v.append(TT.accountUI.card(()=>go('set')),h('div',{class:'card'},h('label',{},t('theme')),sel([['system','System'],['dark','Dark'],['light','Light']],s.theme,async x=>{await SE.set({theme:x})}),
  h('label',{},t('lang')),sel([['bn','বাংলা'],['en','English']],s.lang,async x=>{await SE.set({lang:x});go('set')}),
  h('label',{},t('goal')+' (min)'),h('input',{type:'number',min:1,max:1440,value:s.dailyGoalMin,onchange:async e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=1440)await SE.set({dailyGoalMin:n});else{alert(t('bad'));e.target.value=s.dailyGoalMin}}}),
  h('label',{},h('input',{type:'checkbox',style:'width:auto',...(s.remindersEnabled?{checked:''}:{}),onchange:e=>SE.set({remindersEnabled:e.target.checked})}),' '+t('rem'))),
  h('div',{class:'card'},h('button',{class:'btn',onclick:async()=>BK.download('task-time-backup.json',await BK.exportJSON(),'application/json')},t('exp')),
   h('button',{class:'btn',onclick:()=>file.click()},t('imp')),file,h('button',{class:'btn',onclick:async()=>BK.download('task-time.csv',await BK.csv(),'text/csv')},t('csv')),
   h('button',{class:'btn d',onclick:async()=>{if(ask(t('sure')+TT.accountUI.clearNote())){await DB.clearAll();await DB.seed(CATS);await SE.load();await TT.sync.afterClear();go('home')}}},t('clr'))),
  h('div',{class:'card m'},'Task Time · '+t('ver')+' · com.tasktime.app'))}};
async function boot(){try{await DB.open();await DB.seed(CATS);await SE.load()}catch(e){document.body.textContent='Database error: '+e.message;return}
 const net=()=>{$('#net').textContent=navigator.onLine?t('online'):t('offline')};addEventListener('online',()=>{net()});addEventListener('offline',net);
 $('#fab').onclick=async()=>form(null,await DB.all('categories'),()=>go(S.tab));
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&S.tab==='timer')go('timer')}); // resync display after backgrounding
 await go('home');net();
 const wipe=async()=>{await DB.seed(CATS);await SE.load()};TT.sync.onWipe=wipe;TT.accountUI.mountPill($('#syn'),()=>go('set'));
 addEventListener('tt:resume',()=>{if(S.tab==='timer')go('timer')});
 await TT.sync.start({onWipe:wipe,onApplied:async st=>{if(st.includes('settings'))await SE.load();if(S.tab!=='timer'&&!$('#dlg').open&&S.tab!=='set')go(S.tab)}})}
boot();
})();
