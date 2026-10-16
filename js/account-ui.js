// Settings "Account & Sync" card + header sync pill. Pure DOM (no innerHTML). Bengali/English.
(function(g){
const T=g.TT,h=T.U.h;
const L={bn:{
 title:'অ্যাকাউন্ট ও সিঙ্ক',localOnly:'শুধু লোকাল মোড',localOnlyHint:'Firebase কনফিগার করা নেই, তাই সব ডাটা শুধু এই ডিভাইসে থাকবে। কনফিগার করতে README দেখুন (js/firebase-config.js)।',
 email:'ইমেইল',pass:'পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)',signIn:'লগইন',signUp:'নতুন অ্যাকাউন্ট',forgot:'পাসওয়ার্ড রিসেট',signOut:'লগআউট',busy:'অপেক্ষা করুন…',
 signedAs:'লগইন করা আছে',verified:'Firebase নিশ্চিত করেছে ✓',unverified:'সেশন সংরক্ষিত আছে, কিন্তু Firebase এখনও নিশ্চিত করেনি (অফলাইন?)',
 resetSent:'রিসেট ইমেইল পাঠানো হয়েছে (ইনবক্স/স্প্যাম দেখুন)।',expired:'সেশনের মেয়াদ শেষ — আবার লগইন করুন। লোকাল ডাটা অক্ষত আছে।',
 syncNow:'এখনই সিঙ্ক',retry:'ব্যর্থগুলো আবার চেষ্টা',pending:'অপেক্ষমাণ',failed:'ব্যর্থ',conflicts:'কনফ্লিক্ট',last:'শেষ সফল সিঙ্ক',never:'এখনও হয়নি',clearLog:'লগ মুছুন',
 st:{'local-only':'লোকাল','signed-out':'লগআউট','needs-decision':'সিদ্ধান্ত দরকার',mismatch:'ভিন্ন অ্যাকাউন্ট',idle:'সিঙ্ক ঠিক আছে',syncing:'সিঙ্ক হচ্ছে…',offline:'ক্লাউডে পৌঁছানো যাচ্ছে না','auth-required':'আবার লগইন দরকার',error:'সিঙ্ক ত্রুটি',init:'…'},
 decideT:'এই ডিভাইসে আগে থেকেই ডাটা আছে',decideB:'সিদ্ধান্ত না নেওয়া পর্যন্ত কিছুই আপলোড হবে না। বেছে নিন:',upload:'লোকাল ডাটা এই অ্যাকাউন্টে আপলোড করুন',replace:'লোকাল ডাটা মুছে ক্লাউডের ডাটা নিন',
 mismT:'এই ডিভাইসের ডাটা অন্য অ্যাকাউন্টের',mismB:'আপনার অ্যাকাউন্টে এই ডাটা পাঠানো হবে না। চাইলে আগে ব্যাকআপ নিন, তারপর বদলান (লোকাল ডাটা মুছে যাবে)।',backup:'ব্যাকআপ নামান (JSON)',switchAcc:'অ্যাকাউন্ট বদলান',
 confReplace:'এই ডিভাইসের সব লোকাল ডাটা ও চলমান টাইমার মুছে এই অ্যাকাউন্টের ক্লাউড ডাটা নামানো হবে। আগে ব্যাকআপ নিয়েছেন? এগোবেন?',confPending:' সতর্কতা: ক্লাউডে না যাওয়া পরিবর্তন আছে — সেগুলো হারাবে।',
 confOut:'লগআউট করবেন? (লোকাল ডাটা থাকবে)',confWipe:'এই ডিভাইস থেকে লোকাল ডাটাও মুছবেন? (ক্লাউডের ডাটা মুছবে না; আনডু নেই)',
 clearNote:' এই ডিভাইসের ডাটা মুছলেও ক্লাউডের ডাটা থাকবে এবং পরের সিঙ্কে আবার নেমে আসবে।',importNote:' ইমপোর্ট করা ডাটা লগইন করা অ্যাকাউন্টে আপলোড হবে।',
 conflictNote:'কনফ্লিক্ট নিয়ম: যে পরিবর্তন নতুন সেটি জেতে; হেরে যাওয়া সংস্করণ নিচে সংরক্ষিত থাকে।',winner:{local:'লোকাল জিতেছে',remote:'ক্লাউড জিতেছে'},
 err:{EMAIL_EXISTS:'এই ইমেইলে অ্যাকাউন্ট আগেই আছে।',INVALID_EMAIL:'ইমেইল সঠিক নয়।',WEAK_PASSWORD:'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।',MISSING_PASSWORD:'পাসওয়ার্ড দিন।',
  INVALID_LOGIN_CREDENTIALS:'ইমেইল বা পাসওয়ার্ড ভুল।',INVALID_PASSWORD:'ইমেইল বা পাসওয়ার্ড ভুল।',EMAIL_NOT_FOUND:'ইমেইল বা পাসওয়ার্ড ভুল।',USER_DISABLED:'অ্যাকাউন্টটি নিষ্ক্রিয়।',TOO_MANY_ATTEMPTS_TRY_LATER:'অনেকবার চেষ্টা হয়েছে, পরে চেষ্টা করুন।',
  OPERATION_NOT_ALLOWED:'Firebase-এ Email/Password সাইন-ইন চালু নেই।',NETWORK:'ইন্টারনেট/Firebase-এ পৌঁছানো যায়নি।',BAD_RESPONSE:'Firebase-এর উত্তর অবৈধ; লগইন হয়নি।',NOT_CONFIGURED:'Firebase কনফিগার করা নেই।',UNKNOWN:'অজানা ত্রুটি; লগইন হয়নি।',API_KEY_INVALID:'API key সঠিক নয়।'}},
en:{
 title:'Account & Sync',localOnly:'Local-only mode',localOnlyHint:'Firebase is not configured, so all data stays on this device. See the README (js/firebase-config.js) to enable cloud sync.',
 email:'Email',pass:'Password (min 6 chars)',signIn:'Sign in',signUp:'Create account',forgot:'Reset password',signOut:'Sign out',busy:'Please wait…',
 signedAs:'Signed in',verified:'Confirmed by Firebase ✓',unverified:'Session saved but not yet confirmed by Firebase (offline?)',
 resetSent:'Reset email sent (check inbox/spam).',expired:'Session expired — sign in again. Your local data is intact.',
 syncNow:'Sync now',retry:'Retry failed',pending:'Pending',failed:'Failed',conflicts:'Conflicts',last:'Last successful sync',never:'never',clearLog:'Clear log',
 st:{'local-only':'Local','signed-out':'Signed out','needs-decision':'Decision needed',mismatch:'Different account',idle:'Synced',syncing:'Syncing…',offline:'Cloud unreachable','auth-required':'Sign in again',error:'Sync error',init:'…'},
 decideT:'This device already has data',decideB:'Nothing is uploaded until you decide. Choose:',upload:'Upload local data to this account',replace:'Erase local data and use cloud data',
 mismT:"This device's data belongs to another account",mismB:'It will NOT be sent to your account. Optionally download a backup first, then switch (local data will be erased).',backup:'Download backup (JSON)',switchAcc:'Switch account',
 confReplace:'All local data and any running timer on this device will be erased and replaced with this account’s cloud data. Did you take a backup? Continue?',confPending:' Warning: there are changes not yet in the cloud — they will be lost.',
 confOut:'Sign out? (local data stays)',confWipe:'Also erase local data from this device? (cloud data is not deleted; cannot be undone)',
 clearNote:' Clearing this device does not delete cloud data; it will download again on the next sync.',importNote:' Imported data will be uploaded to the signed-in account.',
 conflictNote:'Conflict policy: the newer change wins; the losing version is kept below.',winner:{local:'local won',remote:'cloud won'},
 err:{EMAIL_EXISTS:'An account with this email already exists.',INVALID_EMAIL:'Invalid email.',WEAK_PASSWORD:'Password must be at least 6 characters.',MISSING_PASSWORD:'Enter a password.',
  INVALID_LOGIN_CREDENTIALS:'Wrong email or password.',INVALID_PASSWORD:'Wrong email or password.',EMAIL_NOT_FOUND:'Wrong email or password.',USER_DISABLED:'This account is disabled.',TOO_MANY_ATTEMPTS_TRY_LATER:'Too many attempts, try later.',
  OPERATION_NOT_ALLOWED:'Email/Password sign-in is not enabled in Firebase.',NETWORK:'Could not reach the internet/Firebase.',BAD_RESPONSE:'Invalid Firebase response; not signed in.',NOT_CONFIGURED:'Firebase is not configured.',UNKNOWN:'Unknown error; not signed in.',API_KEY_INVALID:'API key is invalid.'}}};
const lang=()=>(T.settings&&T.settings.get().lang)==='en'?'en':'bn',t=()=>L[lang()];
const when=ms=>ms?new Date(ms).toLocaleString():null;
const errText=c=>t().err[c]||t().err.UNKNOWN;
const isBound=()=>{const s=T.sync&&T.sync.last&&T.sync.last();return !!(s&&s.bound&&s.uid&&s.boundUid===s.uid)};

function card(rerender){
 const root=h('div',{class:'card'});let msg='',msgErr=false,email='',pass='',working=false;
 const set=(m,e)=>{msg=m;msgErr=!!e;draw()};
 const guarded=f=>async()=>{if(working)return;working=true;draw();try{await f()}catch(e){set(errText(e.code||'UNKNOWN'),true);working=false;draw();return}working=false;draw()};
 async function draw(){
  if(!root.isConnected&&root._mounted){if(root._un)root._un();return}root._mounted=true;
  const x=t(),a=T.sync.auth(),as=a?a.snapshot():{configured:false,status:'unconfigured'};
  let ss=null;try{ss=T.sync.last()||await T.sync.status()}catch(e){}
  const kids=[h('b',{},x.title)];
  if(!as.configured){root.replaceChildren(...kids,h('div',{},h('span',{class:'pill'},x.localOnly)),h('p',{class:'m'},x.localOnlyHint));return}
  if(!as.user){
   const em=h('input',{type:'email',autocomplete:'email',placeholder:x.email,value:email,oninput:e=>{email=e.target.value}}),pw=h('input',{type:'password',autocomplete:'current-password',placeholder:x.pass,value:pass,oninput:e=>{pass=e.target.value}});
   const cur=()=>{email=em.value;pass=pw.value}; // read the REAL field values at click time: autofill/IME can fill a field without an input event
    const dis=working||as.busy?{disabled:''}:{};
   kids.push(em,pw,h('div',{},
    h('button',{class:'btn',...dis,onclick:guarded(async()=>{cur();await a.signIn(email,pass);pass='';msg=''})},x.signIn),
    h('button',{class:'btn g',...dis,onclick:guarded(async()=>{cur();await a.signUp(email,pass);pass='';msg=''})},x.signUp),
    h('button',{class:'btn g',...dis,onclick:guarded(async()=>{cur();await a.resetPassword(email);msg=x.resetSent;msgErr=false})},x.forgot)));
   if(as.notice==='session_expired')kids.push(h('p',{class:'err'},x.expired));
   if(working||as.busy)kids.push(h('p',{class:'m'},x.busy));
   if(msg)kids.push(h('p',{class:msgErr?'err':'m'},msg));root.replaceChildren(...kids);return}
  kids.push(h('div',{class:'m'},x.signedAs+': '+as.user.email),h('div',{class:'m'},as.verified?x.verified:x.unverified));
  const state=ss?ss.state:'init';kids.push(h('div',{},h('span',{class:'pill'},x.st[state]||state)));
  if(state==='needs-decision')kids.push(h('b',{},x.decideT),h('p',{class:'m'},x.decideB),
   h('button',{class:'btn',onclick:guarded(async()=>{await T.sync.importLocal()})},x.upload),
   h('button',{class:'btn d',onclick:guarded(async()=>{if(confirm(x.confReplace+(ss&&ss.pending?x.confPending:'')))await T.sync.replaceLocalWithCloud()})},x.replace));
  else if(state==='mismatch')kids.push(h('b',{},x.mismT),h('p',{class:'m'},x.mismB),
   h('button',{class:'btn g',onclick:async()=>T.backup.download('task-time-backup.json',await T.backup.exportJSON(),'application/json')},x.backup),
   h('button',{class:'btn d',onclick:guarded(async()=>{if(confirm(x.confReplace+(ss&&ss.pending?x.confPending:'')))await T.sync.replaceLocalWithCloud()})},x.switchAcc));
  else if(ss){
   kids.push(h('div',{class:'m'},x.pending+': '+ss.pending+' · '+x.failed+': '+ss.failed+' · '+x.conflicts+': '+ss.conflicts),h('div',{class:'m'},x.last+': '+(when(ss.lastSyncAt)||x.never)));
   if(ss.error&&(state==='error'||state==='offline'||state==='auth-required'))kids.push(h('div',{class:'err'},String(ss.error)));
   kids.push(h('button',{class:'btn',...(state==='syncing'?{disabled:''}:{}),onclick:async()=>{await T.sync.syncNow({force:true})}},x.syncNow));
   if(ss.failed)kids.push(h('button',{class:'btn g',onclick:async()=>{await T.sync.retryFailed();await T.sync.syncNow({force:true})}},x.retry));
   if(ss.conflicts)kids.push(h('p',{class:'m'},x.conflictNote),...ss.conflictList.map(c=>h('div',{class:'m'},'• '+c.store+' · '+(c.title||c.id)+' — '+(x.winner[c.winner]||c.winner))),
    h('button',{class:'btn g',onclick:async()=>{await T.sync.clearConflicts()}},x.clearLog))}
  kids.push(h('button',{class:'btn g',onclick:async()=>{if(!confirm(x.confOut))return;const pend=ss&&ss.pending;a.signOut();
    if(confirm(x.confWipe+(pend?x.confPending:''))){await T.DB.clearAll();await T.sync.afterClear();if(T.sync.onWipe)await T.sync.onWipe()}rerender&&rerender()}},x.signOut));
  if(msg)kids.push(h('p',{class:msgErr?'err':'m'},msg));
  root.replaceChildren(...kids)}
 root._mounted=false;const un=T.sync.subscribe(()=>draw());root._un=un;draw();return root}

function mountPill(el,onclick){const draw=()=>{const s=T.sync.last(),a=T.sync.auth(),as=a?a.snapshot():null,x=t();
  if(!as){el.textContent='…';return}
  if(!as.configured){el.textContent=x.st['local-only'];el.title=x.localOnly;return}
  if(!as.user){el.textContent=x.st['signed-out'];return}
  const st=s?s.state:'init';el.textContent=(st==='idle'&&s.pending?x.st.syncing.replace('…','')+' '+s.pending:x.st[st]||st)};
 el.style.cursor='pointer';el.addEventListener('click',onclick);T.sync.subscribe(draw);draw()}
const api={card,mountPill,L,clearNote:()=>isBound()?t().clearNote:'',importNote:()=>isBound()?t().importNote:''};
g.TT.accountUI=api;
})(window);
