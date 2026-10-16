const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../js/cloud-auth.js'),C=require('../js/cloud-store.js');
const mem=()=>{const m={};return{getItem:k=>k in m?m[k]:null,setItem:(k,v)=>{m[k]=String(v)},removeItem:k=>{delete m[k]},_m:m}};
const resp=(status,body)=>({ok:status>=200&&status<300,status,json:async()=>body});
const CFG={apiKey:'AIzaTEST',projectId:'demo-proj'};
const okSession={localId:'uid1',email:'a@b.co',idToken:'ID1',refreshToken:'RT1',expiresIn:'3600'};

test('missing/placeholder Firebase config => unconfigured (local-only), never a cloud connection',async()=>{
 for(const cfg of[undefined,{},{apiKey:'',projectId:''},{apiKey:'YOUR_WEB_API_KEY',projectId:'YOUR_PROJECT_ID'},{apiKey:'k',projectId:' '}]){
  let called=0;const a=A.create({config:cfg,fetchFn:async()=>{called++},storage:mem()});await a.init();
  assert.equal(a.snapshot().status,'unconfigured');assert.equal(a.snapshot().configured,false);assert.equal(a.snapshot().user,null);
  await assert.rejects(()=>a.signIn('a@b.co','secret1'),e=>e.code==='NOT_CONFIGURED');assert.equal(called,0,'no network when unconfigured');}});
test('signIn succeeds only when Firebase confirms; session persisted',async()=>{
 const st=mem();let url,body;const a=A.create({config:CFG,storage:st,fetchFn:async(u,o)=>{url=u;body=JSON.parse(o.body);return resp(200,okSession)}});
 const s=await a.signIn('a@b.co','secret1');assert.equal(s.status,'signed-in');assert.equal(s.verified,true);assert.equal(s.user.uid,'uid1');
 assert.match(url,/accounts:signInWithPassword\?key=AIzaTEST$/);assert.equal(body.returnSecureToken,true);assert.ok(st._m['tt.auth.v1']);});
test('wrong password / existing email / weak password / network are errors, never signed in',async()=>{
 const cases=[[400,{error:{message:'INVALID_LOGIN_CREDENTIALS'}},'INVALID_LOGIN_CREDENTIALS'],[400,{error:{message:'EMAIL_EXISTS'}},'EMAIL_EXISTS'],[400,{error:{message:'WEAK_PASSWORD : Password should be at least 6 characters'}},'WEAK_PASSWORD'],[400,{error:{message:'OPERATION_NOT_ALLOWED'}},'OPERATION_NOT_ALLOWED']];
 for(const[st,b,code]of cases){const a=A.create({config:CFG,storage:mem(),fetchFn:async()=>resp(st,b)});await assert.rejects(()=>a.signIn('a@b.co','secret1'),e=>e.code===code);assert.equal(a.snapshot().status,'signed-out');assert.equal(a.snapshot().user,null)}
 const n=A.create({config:CFG,storage:mem(),fetchFn:async()=>{throw new TypeError('Failed to fetch')}});await assert.rejects(()=>n.signIn('a@b.co','secret1'),e=>e.code==='NETWORK'&&e.network);assert.equal(n.snapshot().user,null);
 const bad=A.create({config:CFG,storage:mem(),fetchFn:async()=>resp(200,{})});await assert.rejects(()=>bad.signIn('a@b.co','secret1'),e=>e.code==='BAD_RESPONSE');assert.equal(bad.snapshot().status,'signed-out')});
test('client-side validation: bad email, empty password, short signup password => no request',async()=>{
 let n=0;const a=A.create({config:CFG,storage:mem(),fetchFn:async()=>{n++;return resp(200,okSession)}});
 await assert.rejects(()=>a.signIn('nope','x'),e=>e.code==='INVALID_EMAIL');await assert.rejects(()=>a.signIn('a@b.co',''),e=>e.code==='MISSING_PASSWORD');
 await assert.rejects(()=>a.signUp('a@b.co','123'),e=>e.code==='WEAK_PASSWORD');assert.equal(n,0)});
test('signUp and password reset use the right endpoints',async()=>{
 const urls=[];const a=A.create({config:CFG,storage:mem(),fetchFn:async(u,o)=>{urls.push([u,o.body]);return resp(200,okSession)}});
 await a.signUp('a@b.co','secret1');await a.resetPassword('a@b.co');assert.match(urls[0][0],/accounts:signUp\?/);assert.match(urls[1][0],/accounts:sendOobCode\?/);assert.match(urls[1][1],/PASSWORD_RESET/)});
test('state restoration: confirmed online; offline stays UNVERIFIED; expired token signs out',async()=>{
 const seed=()=>{const s=mem();s.setItem('tt.auth.v1',JSON.stringify({uid:'uid1',email:'a@b.co',refreshToken:'RT1'}));return s};
 const on=A.create({config:CFG,storage:seed(),fetchFn:async()=>resp(200,{id_token:'I2',refresh_token:'RT2',expires_in:'3600',user_id:'uid1'})});await on.init();assert.equal(on.snapshot().verified,true);assert.equal(await on.getIdToken(),'I2');
 const off=A.create({config:CFG,storage:seed(),fetchFn:async()=>{throw new TypeError('x')}});await off.init();assert.equal(off.snapshot().status,'signed-in');assert.equal(off.snapshot().verified,false,'offline restore is not "confirmed"');
 await assert.rejects(()=>off.getIdToken(),e=>e.network);
 const st=seed();const exp=A.create({config:CFG,storage:st,fetchFn:async()=>resp(400,{error:{message:'TOKEN_EXPIRED'}})});await exp.init();assert.equal(exp.snapshot().status,'signed-out');assert.equal(exp.snapshot().notice,'session_expired');assert.equal(st.getItem('tt.auth.v1'),null);
 const other=A.create({config:CFG,storage:seed(),fetchFn:async()=>resp(200,{id_token:'I',refresh_token:'R',expires_in:'3600',user_id:'someone-else'})});await other.init();assert.equal(other.snapshot().status,'signed-out')});
test('signOut clears the session',async()=>{const st=mem();const a=A.create({config:CFG,storage:st,fetchFn:async()=>resp(200,okSession)});await a.signIn('a@b.co','secret1');a.signOut();assert.equal(a.snapshot().user,null);assert.equal(st.getItem('tt.auth.v1'),null)});
test('id token refreshes lazily when near expiry (single flight)',async()=>{let t=0,calls=0;const a=A.create({config:CFG,storage:mem(),now:()=>t,fetchFn:async u=>{if(u.includes('securetoken')){calls++;return resp(200,{id_token:'NEW'+calls,refresh_token:'R2',expires_in:'3600',user_id:'uid1'})}return resp(200,okSession)}});
 await a.signIn('a@b.co','secret1');assert.equal(await a.getIdToken(),'ID1');t=3600*1000-30000;const[x,y]=await Promise.all([a.getIdToken(),a.getIdToken()]);assert.equal(calls,1);assert.equal(x,y)});

// ---------- Firestore REST ----------
const authStub=(uid='uid1')=>({getIdToken:async()=>'TOKEN',snapshot:()=>({user:{uid}})});
test('codec round-trips ints, strings, null, bool, maps; Phase 1 ms timestamps stay exact',()=>{
 const o={a:1760000000123,b:'x',c:null,d:true,e:{bn:'কাজ',en:'Work'},f:2.5,g:[1,'a']};assert.deepEqual(C.decFields(C.encFields(o)),o);assert.deepEqual(C.enc(5),{integerValue:'5'})});
test('toCloud whitelists fields, strips local sync metadata, adds schema/device, normalises timestamps',()=>{
 const c=C.toCloud('tasks',{id:'t',title:'x',syncStatus:'pending',remoteVersion:'v',evil:'drop',createdAt:5},'devA');
 assert.equal(c.evil,undefined);assert.equal(c.syncStatus,undefined);assert.equal(c.remoteVersion,undefined);assert.equal(c.schemaVersion,2);assert.equal(c.deviceId,'devA');assert.equal(c.updatedAt,5);assert.equal(c.deletedAt,null)});
test('upsert: commit request has user-scoped path, server timestamp transform and correct preconditions',async()=>{
 const reqs=[];const s=C.createStore({config:CFG,auth:authStub(),fetchFn:async(u,o)=>{reqs.push({u,o,b:JSON.parse(o.body)});return resp(200,{writeResults:[{updateTime:'2026-01-01T00:00:01.500000Z'}]})}});
 const r1=await s.upsert('uid1','tasks',{id:'t1',title:'x',createdAt:1,updatedAt:1},{remoteVersion:null,deviceId:'d'});
 assert.equal(r1.version,'2026-01-01T00:00:01.5Z');assert.match(reqs[0].u,/documents:commit$/);assert.equal(reqs[0].o.headers.Authorization,'Bearer TOKEN');
 const w=reqs[0].b.writes[0];assert.equal(w.update.name,'projects/demo-proj/databases/(default)/documents/users/uid1/tasks/t1');assert.deepEqual(w.currentDocument,{exists:false});assert.deepEqual(w.updateTransforms,[{fieldPath:'syncedAt',setToServerValue:'REQUEST_TIME'}]);
 await s.upsert('uid1','tasks',{id:'t1',title:'y',createdAt:1,updatedAt:2},{remoteVersion:'2026-01-01T00:00:01.5Z'});assert.deepEqual(reqs[1].b.writes[0].currentDocument,{updateTime:'2026-01-01T00:00:01.5Z'})});
test('upsert refuses another uid than the signed-in user and malformed ids (no path injection)',async()=>{
 let n=0;const s=C.createStore({config:CFG,auth:authStub('uid1'),fetchFn:async()=>{n++;return resp(200,{})}});
 await assert.rejects(()=>s.upsert('uid2','tasks',{id:'t1'},{}),e=>e.kind==='auth');
 await assert.rejects(()=>s.upsert('uid1','tasks',{id:'../../users/uid2/tasks/x'},{}),e=>e.kind==='permanent');
 await assert.rejects(()=>s.upsert('uid1','secrets',{id:'a'},{}),e=>e.kind==='permanent');assert.equal(n,0)});
test('error classification maps Firestore failures to retry/conflict/permanent/auth',async()=>{
 const mk=(status,st)=>C.createStore({config:CFG,auth:authStub(),fetchFn:async()=>resp(status,{error:{status:st,message:st}})});
 const kind=async(status,st)=>mk(status,st).upsert('uid1','tasks',{id:'a',updatedAt:1},{remoteVersion:'v'}).then(()=>null,e=>e.kind);
 assert.equal(await kind(409,'ALREADY_EXISTS'),'precondition');assert.equal(await kind(400,'FAILED_PRECONDITION'),'precondition');assert.equal(await kind(404,'NOT_FOUND'),'precondition');
 assert.equal(await kind(403,'PERMISSION_DENIED'),'permanent');assert.equal(await kind(401,'UNAUTHENTICATED'),'auth');assert.equal(await kind(503,'UNAVAILABLE'),'transient');assert.equal(await kind(429,'RESOURCE_EXHAUSTED'),'transient');assert.equal(await kind(400,'INVALID_ARGUMENT'),'permanent');
 const n=C.createStore({config:CFG,auth:authStub(),fetchFn:async()=>{throw new TypeError('offline')}});await assert.rejects(()=>n.upsert('uid1','tasks',{id:'a'},{}),e=>e.kind==='network')});
test('pull builds a syncedAt cursor query and decodes documents; fetch returns null on 404',async()=>{
 let body,url;const doc={name:'projects/p/databases/(default)/documents/users/uid1/tasks/t1',fields:C.encFields({id:'t1',title:'T',updatedAt:9,deviceId:'devZ',schemaVersion:2,syncedAt:'2026-01-01T00:00:05Z'}),updateTime:'2026-01-01T00:00:05.000000Z'};
 const s=C.createStore({config:CFG,auth:authStub(),fetchFn:async(u,o)=>{url=u;body=o.body?JSON.parse(o.body):null;if(u.includes('runQuery'))return resp(200,[{document:doc},{readTime:'x'}]);return resp(404,{error:{status:'NOT_FOUND'}})}});
 const r=await s.pull('uid1','tasks','2026-01-01T00:00:00Z',200);assert.match(url,/users\/uid1:runQuery$/);
 assert.equal(body.structuredQuery.where.fieldFilter.op,'GREATER_THAN_OR_EQUAL');assert.equal(body.structuredQuery.orderBy[0].field.fieldPath,'syncedAt');
 assert.equal(r.docs.length,1);assert.equal(r.docs[0].rec.title,'T');assert.equal(r.docs[0].deviceId,'devZ');assert.equal(r.docs[0].rec.syncedAt,undefined);assert.equal(r.docs[0].version,'2026-01-01T00:00:05Z');assert.equal(r.hasMore,false);
 assert.equal(await s.fetch('uid1','tasks','missing'),null)});

test('account form reads the real field values at click time (autofill/IME safe), not only the input-event copy',()=>{
 const src=require('fs').readFileSync(require('path').join(__dirname,'../js/account-ui.js'),'utf8');
 assert.match(src,/const cur=\(\)=>\{email=em\.value;pass=pw\.value\}/);
 for(const c of['signIn(email,pass)','signUp(email,pass)','resetPassword(email)'])assert.ok(src.includes('cur();await a.'+c),c+' must be preceded by cur()')});
