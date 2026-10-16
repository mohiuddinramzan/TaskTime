(function(){
const {DB,U,tasks:TS,timer:TM,reports:RP,settings:SE,backup:BK}=TT,h=U.h,$=s=>document.querySelector(s);
const I={bn:{home:'হোম',tasks:'টাস্ক',timer:'টাইমার',reports:'রিপোর্ট',cal:'ক্যালেন্ডার',set:'সেটিংস',hi:'শুভ দিন',today:'আজকের সময়',goal:'লক্ষ্য',done:'সম্পন্ন',pend:'বাকি',none:'কিছু নেই',online:'অনলাইন',offline:'অফলাইন',title:'শিরোনাম',desc:'বিবরণ',cat:'ক্যাটাগরি',prio:'অগ্রাধিকার',stat:'অবস্থা',est:'আনুমানিক মিনিট',due:'শেষ তারিখ',rec:'পুনরাবৃত্তি',save:'সংরক্ষণ',cancel:'বাতিল',del:'মুছবেন?',start:'শুরু',pause:'বিরতি',resume:'চালু',finish:'শেষ',notes:'নোট',hist:'সেশন ইতিহাস',theme:'থিম',lang:'ভাষা',exp:'JSON এক্সপোর্ট',imp:'ব্যাকআপ ইমপোর্ট',csv:'CSV এক্সপোর্ট',clr:'সব ডাটা মুছুন',sure:'নিশ্চিত? বিদ্যমান ডাটা প্রতিস্থাপিত/মুছে যাবে।',ver:'সংস্করণ 2.0.0 (ফেজ ২ — লোকাল-ফার্স্ট + ক্লাউড সিঙ্ক)',rem:'রিমাইন্ডার (ভবিষ্যতের জন্য সংরক্ষিত, এখনও কাজ করে না)',active:'চলমান টাইমার',recent:'সম্প্রতি সম্পন্ন',all:'সব',reopen:'আবার খুলুন',resched:'আজকে সরান',avg:'গড়/দিন',goaldays:'লক্ষ্য পূরণের দিন',custom:'কাস্টম',bad:'ভুল ইনপুট',activeErr:'আরেকটি টাইমার চলছে',search:'খুঁজুন',sort:'সাজান'},
en:{home:'Home',tasks:'Tasks',timer:'Timer',reports:'Reports',cal:'Calendar',set:'Settings',hi:'Hello',today:'Tracked today',goal:'Goal',done:'Done',pend:'Pending',none:'Nothing here',online:'Online',offline:'Offline',title:'Title',desc:'Description',cat:'Category',prio:'Priority',stat:'Status',est:'Estimated minutes',due:'Due date',rec:'Recurrence',save:'Save',cancel:'Cancel',del:'Delete?',start:'Start',pause:'Pause',resume:'Resume',finish:'Finish',notes:'Notes',hist:'Session history',theme:'Theme',lang:'Language',exp:'Export JSON',imp:'Import backup',csv:'Export CSV',clr:'Clear all data',sure:'Sure? Existing data will be replaced/erased.',ver:'Version 2.0.0 (Phase 2 — local-first + cloud sync)',rem:'Reminders (reserved for future; not active yet)',active:'Active timer',recent:'Recently completed',all:'All',reopen:'Reopen',resched:'Move to today',avg:'Avg/day',goaldays:'Goal days met',custom:'Custom',bad:'Invalid input',activeErr:'Another timer is running',search:'Search',sort:'Sort'}};
const t=k=>I[SE.get().lang][k]||k;
const CATS=[['cat-work','কাজ','Work'],['cat-study','পড়াশোনা','Study'],['cat-personal','ব্যক্তিগত','Personal'],['cat-health','স্বাস্থ্য','Health']].map(([id,bn,en])=>({id,name:{bn,en},createdAt:0,deletedAt:null}));
const cname=(cs,id)=>cs.find(c=>c.id===id)?.name[SE.get().lang]||'—';
const S={tab:'home',f:{},day:RP.dk(Date.now()),month:new Date(),rng:'7',from:'',to:''};let tick;
const tabs=[['home','home'],['tasks','tasks'],['timer','timer'],['reports','reports'],['cal','cal'],['set','set']];
const ask=m=>confirm(m);
const err=e=>alert(e.errors?t('bad')+': '+Object.keys(e.errors).join(', '):e.message==='timer_active'?t('activeErr'):e.message);
const go=async tab=>{S.tab=tab;clearInterval(tick);$('#nav').replaceChildren(...tabs.map(([k,l])=>h('button',{class:k===tab?'on':'',onclick:()=>go(k)},t(l))));
 $('#ttl').textContent='Task Time · '+t(tab);$('#fab').style.display=tab==='tasks'||tab==='home'?'':'none';
 const v=$('#view');v.replaceChildren();try{await V[tab](v)}catch(e){v.append(h('p',{class:'err'},String(e.message)))}};
const sel=(opts,val,on)=>{const s=h('select',{onchange:e=>on(e.target.value)},opts.map(([v,l])=>{const o=h('option',{value:v},l);if(v===val)o.selected=true;return o}));return s};
const toLocal=ts=>ts?RP.dk(ts):'';const fromLocal=s=>s?new Date(s+'T12:00:00').getTime():null;
function taskRow(x,cs,reload){return h('div',{class:'card'},h('div',{class:'row'},h('b',{class:x.status==='completed'?'done':''},x.title),h('span',{class:'pill'},x.priority)),
 h('div',{class:'m'},cname(cs,x.categoryId)+(x.dueAt?' · '+toLocal(x.dueAt):'')+(x.estimatedMinutes?' · '+x.estimatedMinutes+'m':'')),
 h('div',{},h('button',{class:'btn g',onclick:async()=>{await TS.setDone(x.id,x.status!=='completed');reload()}},x.status==='completed'?t('reopen'):'✓'),
  h('button',{class:'btn g',onclick:()=>form(x,cs,reload)},'✎'),
  h('button',{class:'btn g',onclick:async()=>{try{await TM.start(x.id);go('timer')}catch(e){err(e)}}},'▶'),
  h('button',{class:'btn d',onclick:async()=>{if(ask(t('del'))){await TS.remove(x.id);reload()}}},'🗑')))}
function form(x,cs,reload){const d=$('#dlg'),v=x||{priority:'medium',status:'pending',recurrence:'none'},er=h('div',{class:'err'});
 const f={title:h('input',{placeholder:t('title'),maxlength:200,value:v.title||''}),desc:h('textarea',{placeholder:t('desc')},v.description||''),
  cat:sel([['',cs.length?'—':'—'],...cs.map(c=>[c.id,c.name[SE.get().lang]])],v.categoryId||'',()=>{}),pr:sel(TS.PR.map(p=>[p,p]),v.priority,()=>{}),
  st:sel(TS.ST.map(p=>[p,p]),v.status,()=>{}),est:h('input',{type:'number',min:0,placeholder:t('est'),value:v.estimatedMinutes??''}),
  due:h('input',{type:'date',value:toLocal(v.dueAt)}),rec:sel([['none','—'],['daily','daily'],['weekly','weekly']],v.recurrence||'none',()=>{})};
 d.replaceChildren(h('h3',{},x?'✎':'+'),f.title,f.desc,f.cat,f.pr,f.st,f.est,f.due,f.rec,er,h('button',{class:'btn',onclick:async()=>{
  const data={title:f.title.value,description:f.desc.value,categoryId:f.cat.value||null,priority:f.pr.value,status:f.st.value,
   estimatedMinutes:f.est.value===''?null:Number(f.est.value),dueAt:fromLocal(f.due.value),recurrence:f.rec.value};
  try{x?await TS.update(x.id,data):await TS.create(data);d.close();reload()}catch(e){er.textContent=e.errors?t('bad')+': '+Object.keys(e.errors).join(', '):e.message}}},t('save')),
  h('button',{class:'btn g',onclick:()=>d.close()},t('cancel')));d.showModal()}
const bars=days=>{const k=Object.keys(days),mx=Math.max(1,...Object.values(days)),w=300/k.length;
 const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 300 110');
 k.forEach((d,i)=>{const hh=days[d]/mx*90,r=document.createElementNS(s.namespaceURI,'rect');r.setAttribute('x',i*w+1);r.setAttribute('y',100-hh);r.setAttribute('width',Math.max(1,w-2));r.setAttribute('height',hh);r.setAttribute('fill','#6d5dfc');
  const tt=document.createElementNS(s.namespaceURI,'title');tt.textContent=d+' '+U.mins(days[d])+'m';r.append(tt);s.append(r)});return s};
const todaySum=(ss,now=Date.now())=>ss.filter(s=>!s.deletedAt&&s.startedAt>=U.startOfDay(now)).reduce((a,s)=>a+s.durationMs,0);
const V={
async home(v){const [ts,ss,cs,tm]=await Promise.all([TS.list(),DB.all('sessions'),DB.all('categories'),TM.get()]),live=ts.filter(x=>!x.deletedAt),sd=U.startOfDay(Date.now());
 const tracked=todaySum(ss)+(tm?TM.elapsed(tm):0),goal=SE.get().dailyGoalMin*6e4,tt=live.filter(x=>x.status!=='completed'&&x.dueAt&&x.dueAt<sd+864e5);
 const dn=live.filter(x=>x.status==='completed').sort((a,b)=>b.updatedAt-a.updatedAt).slice(0,3);
 v.append(h('div',{class:'card'},h('div',{class:'m'},new Date().toLocaleDateString(SE.get().lang==='bn'?'bn-BD':'en-US',{dateStyle:'full'})),h('h2',{},t('hi')),
  h('div',{},t('today')+': '+U.fmt(tracked)+' / '+t('goal')+' '+SE.get().dailyGoalMin+'m'),h('div',{class:'bar'},h('i',{style:'width:'+Math.min(100,goal?tracked/goal*100:0)+'%'})),
  h('div',{class:'m'},t('done')+': '+live.filter(x=>x.status==='completed').length+' · '+t('pend')+': '+live.filter(x=>x.status!=='completed').length)));
 if(tm){const tk=ts.find(x=>x.id===tm.taskId);v.append(h('div',{class:'card',onclick:()=>go('timer')},h('b',{},t('active')),h('div',{},tk?.title||'—'),h('div',{class:'big'},U.fmt(TM.elapsed(tm)))))}
 const rl=()=>go('home');v.append(h('h3',{},t('tasks')),...(tt.length?tt.map(x=>taskRow(x,cs,rl)):[h('p',{class:'m'},t('none'))]),h('h3',{},t('recent')),...dn.map(x=>taskRow(x,cs,rl)))},
async tasks(v){const [ts,cs]=await Promise.all([TS.list(),DB.all('categories')]),F=S.f,rl=()=>go('tasks');
 const L=(a)=>[['',t('all')],...a];
 v.append(h('input',{placeholder:t('search'),value:F.q||'',oninput:e=>{F.q=e.target.value;clearTimeout(S.dt);S.dt=setTimeout(rl,250)}}),
  sel(L(TS.ST.map(s=>[s,s])),F.status||'',x=>{F.status=x;rl()}),sel(L(cs.map(c=>[c.id,c.name[SE.get().lang]])),F.categoryId||'',x=>{F.categoryId=x;rl()}),
  sel(L(TS.PR.map(s=>[s,s])),F.priority||'',x=>{F.priority=x;rl()}),h('input',{type:'date',value:F.day||'',onchange:e=>{F.day=e.target.value;rl()}}),
  sel([['due',t('sort')+': '+t('due')],['created',t('sort')+': created']],F.sort||'due',x=>{F.sort=x;rl()}));
 const r=TS.filter(ts,F,RP.dk);v.append(...(r.length?r.map(x=>taskRow(x,cs,rl)):[h('p',{class:'m'},t('none'))]))},
async timer(v){const [ts,ss]=await Promise.all([TS.list(),DB.all('sessions')]);let tm=await TM.get();const tk=tm&&ts.find(x=>x.id===tm.taskId);
 const big=h('div',{class:'big'},U.fmt(TM.elapsed(tm))),notes=h('textarea',{placeholder:t('notes')},tm?.notes||''),rl=()=>go('timer');
 const c=h('div',{class:'card'},h('b',{},tk?tk.title:t('none')),big);
 if(tm){c.append(notes,tm.status==='running'?h('button',{class:'btn',onclick:async()=>{await TM.set(TM.pause);rl()}},t('pause')):h('button',{class:'btn',onclick:async()=>{await TM.set(TM.resume);rl()}},t('resume')),
  h('button',{class:'btn',onclick:async()=>{await TM.finish(notes.value);rl()}},t('finish')),h('button',{class:'btn d',onclick:async()=>{if(ask(t('del'))){await TM.cancel();rl()}}},t('cancel')));
  tick=setInterval(()=>{big.textContent=U.fmt(TM.elapsed(tm))},500)} // display only; truth is the stored timestamps
 else c.append(h('p',{class:'m'},t('tasks')+' → ▶'));
 const tot={};ss.filter(s=>!s.deletedAt).forEach(s=>tot[s.taskId]=(tot[s.taskId]||0)+s.durationMs);
 v.append(c,h('h3',{},t('hist')),...ss.filter(s=>!s.deletedAt).sort((a,b)=>b.startedAt-a.startedAt).slice(0,30).map(s=>{const k=ts.find(x=>x.id===s.taskId);
  return h('div',{class:'card'},h('div',{class:'row'},h('b',{},k?.title||'—'),U.fmt(s.durationMs)),h('div',{class:'m'},new Date(s.startedAt).toLocaleString()+' · Σ '+U.fmt(tot[s.taskId]||0)),s.notes&&h('div',{},s.notes))}))},
async reports(v){const [ts,ss,cs]=await Promise.all([TS.list(),DB.all('sessions'),DB.all('categories')]);const rl=()=>go('reports');let R;
 try{R=RP.build(ss,ts,RP.range(S.rng,Date.now(),S.from?fromLocal(S.from):0,S.to?fromLocal(S.to):0),SE.get().dailyGoalMin*6e4)}catch{R=null}
 v.append(sel([['today',t('today')],['7','7'],['30','30'],['custom',t('custom')]],S.rng,x=>{S.rng=x;rl()}));
 if(S.rng==='custom')v.append(h('input',{type:'date',value:S.from,onchange:e=>{S.from=e.target.value;rl()}}),h('input',{type:'date',value:S.to,onchange:e=>{S.to=e.target.value;rl()}}));
 if(!R)return v.append(h('p',{class:'err'},t('bad')));
 const nm=id=>ts.find(x=>x.id===id)?.title||'—';
 v.append(h('div',{class:'card'},bars(R.days),h('div',{},'Σ '+U.fmt(R.total)+' · '+t('avg')+' '+U.fmt(R.avg)),h('div',{class:'m'},t('done')+': '+R.completed+' · '+t('goaldays')+': '+R.goalDays+'/'+R.nDays)),
  h('div',{class:'card'},h('b',{},t('cat')),...Object.entries(R.byCat).map(([id,ms])=>h('div',{class:'row'},cname(cs,id),U.fmt(ms)))),
  h('div',{class:'card'},h('b',{},t('tasks')+' ('+t('est')+' / actual)'),...Object.entries(R.byTask).map(([id,ms])=>h('div',{class:'row'},nm(id),U.mins(ms)+'m / '+U.mins(R.estVsActual.find(e=>e.id===id)?.est||0)+'m'))))},
async cal(v){const [ts,ss,cs]=await Promise.all([TS.list(),DB.all('sessions'),DB.all('categories')]),m=S.month,y=m.getFullYear(),mo=m.getMonth(),rl=()=>go('cal');
 const live=ts.filter(x=>!x.deletedAt),g=h('div',{class:'cal'});
 v.append(h('div',{class:'row'},h('button',{class:'btn g',onclick:()=>{S.month=new Date(y,mo-1,1);rl()}},'‹'),h('b',{},m.toLocaleDateString(SE.get().lang==='bn'?'bn-BD':'en-US',{month:'long',year:'numeric'})),h('button',{class:'btn g',onclick:()=>{S.month=new Date(y,mo+1,1);rl()}},'›')),g);
 for(let i=0;i<new Date(y,mo,1).getDay();i++)g.append(h('span'));
 for(let d=1;d<=new Date(y,mo+1,0).getDate();d++){const k=RP.dk(new Date(y,mo,d).getTime());g.append(h('button',{class:k===S.day?'sel':'',onclick:()=>{S.day=k;rl()}},String(d)))}
 const day=live.filter(x=>x.dueAt&&RP.dk(x.dueAt)===S.day),ms=ss.filter(s=>!s.deletedAt&&RP.dk(s.startedAt)===S.day).reduce((a,s)=>a+s.durationMs,0),inc=day.filter(x=>x.status!=='completed');
 v.append(h('div',{class:'card'},h('b',{},S.day),h('div',{},U.fmt(ms)+' / '+t('goal')+' '+SE.get().dailyGoalMin+'m'),inc.length&&h('button',{class:'btn',onclick:async()=>{for(const x of inc)await TS.update(x.id,{dueAt:Date.now()});rl()}},t('resched'))),
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
