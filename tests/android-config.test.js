// Static consistency checks for the Android project, workflow and security posture (no Android SDK needed).
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..'),rd=p=>fs.readFileSync(path.join(root,p),'utf8');
const gradle=rd('android/app/build.gradle.kts'),manifest=rd('android/app/src/main/AndroidManifest.xml'),wf=rd('.github/workflows/android-build.yml'),main=rd('android/app/src/main/kotlin/com/tasktime/app/MainActivity.kt');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);

test('package/app identity',()=>{assert.match(gradle,/applicationId = "com\.tasktime\.app"/);assert.match(gradle,/namespace = "com\.tasktime\.app"/);assert.match(rd('android/app/src/main/res/values/strings.xml'),/<string name="app_name">Task Time<\/string>/);
 assert.match(gradle,/versionName = .*"2\.0\.0"/);assert.match(gradle,/versionCode = .*\?: 2/)});
test('Gradle files exist and versions are compatible (AGP 8.5.x needs Gradle>=8.7, JDK17)',()=>{
 for(const f of['settings.gradle.kts','build.gradle.kts','gradle.properties','app/build.gradle.kts','app/src/main/AndroidManifest.xml'])assert.ok(fs.existsSync(path.join(root,'android',f)),f);
 assert.match(rd('android/build.gradle.kts'),/com\.android\.application"\) version "8\.5\.\d+"/);assert.match(wf,/gradle-version: '8\.9'/);assert.match(wf,/java-version: '17'/);
 assert.match(gradle,/VERSION_17/);assert.match(gradle,/jvmTarget = "17"/);assert.match(gradle,/compileSdk = 34/)});
test('manifest requests only INTERNET and ACCESS_NETWORK_STATE; backup & cleartext off',()=>{
 const perms=[...manifest.matchAll(/uses-permission android:name="([^"]+)"/g)].map(m=>m[1]).sort();assert.deepEqual(perms,['android.permission.ACCESS_NETWORK_STATE','android.permission.INTERNET']);
 assert.match(manifest,/allowBackup="false"/);assert.match(manifest,/usesCleartextTraffic="false"/)});
test('WebView hardening: no file access, no unrestricted JS bridge, https asset loader, origin-restricted message listener',()=>{
 assert.match(main,/allowFileAccess = false/);assert.match(main,/allowContentAccess = false/);assert.doesNotMatch(main,/allowFileAccess = true/);
 assert.doesNotMatch(main,/addJavascriptInterface/);assert.match(main,/addWebMessageListener\(webView, "TTNative", setOf\(UrlPolicy\.ORIGIN\)\)/);
 assert.match(main,/WebViewAssetLoader/);assert.match(main,/MIXED_CONTENT_NEVER_ALLOW/);assert.match(main,/setWebContentsDebuggingEnabled\(BuildConfig\.DEBUG\)/);assert.doesNotMatch(main,/loadUrl\("https?:\/\/(?!appassets)/)});
test('web assets copied from repo root into assets/www and the files exist',()=>{
 assert.match(gradle,/rootProject\.projectDir\.parentFile/);assert.match(gradle,/include\("index\.html", "manifest\.json", "css\/\*\*", "js\/\*\*"\)/);assert.match(gradle,/generated\/webAssets\/www/);
 assert.match(rd('android/app/src/main/kotlin/com/tasktime/app/UrlPolicy.kt'),/\/assets\/www\/index\.html/);
 const html=rd('index.html');for(const m of html.matchAll(/src="(js\/[^"]+)"/g))assert.ok(fs.existsSync(path.join(root,m[1])),m[1]);assert.ok(fs.existsSync(path.join(root,'css/style.css')))});
test('debug build needs no signing secrets; release signing is env-driven only',()=>{
 assert.match(gradle,/System\.getenv\("TT_KEYSTORE_PATH"\)/);const dbg=gradle.slice(gradle.indexOf('debug {'),gradle.indexOf('release {'));assert.doesNotMatch(dbg,/signingConfig/);
 assert.doesNotMatch(wf,/secrets\./);assert.doesNotMatch(wf,/ANDROID_KEYSTORE/)});
test('workflow: triggers, least privilege, correct paths and gradle tasks',()=>{
 assert.match(wf,/push:\s*\n\s*branches: \[main\]/);assert.match(wf,/pull_request:/);assert.match(wf,/workflow_dispatch:/);assert.match(wf,/permissions:\s*\n\s*contents: read/);
 assert.equal((wf.match(/working-directory: android/g)||[]).length,2);assert.match(wf,/:app:testDebugUnitTest/);assert.match(wf,/:app:assembleDebug/);
 assert.match(wf,/path: android\/app\/build\/outputs\/apk\/debug\/app-debug\.apk/);assert.match(wf,/if: failure\(\)/);assert.match(wf,/node --test tests\/\*\.test\.js/)});
// ---- Security / Firebase posture -------------------------------------------------------------------------------------------
// A Firebase *Web* API key ("AIza...") is a public client identifier, NOT a secret (security = Auth + Security Rules).
// It has the same shape as any other Google API key, so it is allowed in EXACTLY ONE place: the apiKey of js/firebase-config.js.
// Everything that is a genuine secret (private keys, service-account/Admin SDK JSON, OAuth client secrets, tokens) stays banned everywhere.
const vm=require('vm'),auth=require('../js/cloud-auth.js'),cloud=require('../js/cloud-store.js');
const FB_CFG='js/firebase-config.js',scan=f=>!/node_modules|\.git[\\/]|_v1seed/.test(f)&&/\.(js|kts?|xml|json|yml|yaml|md|html|rules|txt|properties|py)$/.test(f);
const loadCfg=src=>{const w={};vm.runInNewContext(src,{window:w});return w.TT_FIREBASE_CONFIG};
const PUBLIC_KEYS=['apiKey','authDomain','databaseURL','projectId','storageBucket','messagingSenderId','appId','measurementId'];
const REAL_SECRETS=[/-----BEGIN [A-Z ]*PRIVATE KEY-----/,/"type"\s*:\s*"service_account"/,/"private_key(_id)?"\s*:/,/[a-z0-9-]+@[a-z0-9-]+\.iam\.gserviceaccount\.com/,/GOCSPX-[A-Za-z0-9_-]{20,}/,/\bya29\.[0-9A-Za-z_-]{20,}/,/\b1\/\/0[0-9A-Za-z_-]{30,}/];
const KEY_SHAPE=/AIza[0-9A-Za-z_-]{35}/g;

test('no secrets or admin credentials anywhere in the repo (a public Web API key is allowed only in js/firebase-config.js)',()=>{
 const files=walk(root).filter(scan);
 for(const f of files){const txt=fs.readFileSync(f,'utf8');
  for(const re of REAL_SECRETS)assert.doesNotMatch(txt,re,'real secret pattern in '+f);
  const keys=txt.match(KEY_SHAPE)||[],rel=path.relative(root,f).split(path.sep).join('/');
  if(rel===FB_CFG){assert.ok(keys.length<=1,'at most one API key in the config');
   if(keys.length)assert.match(txt,new RegExp('apiKey:\\s*["\']'+keys[0]+'["\']'),'the key may only appear as the apiKey value')}
  else assert.equal(keys.length,0,'Google API key found outside '+FB_CFG+': '+rel)}
 // Admin/service-account files must not exist and must be git-ignored.
 const names=walk(root).filter(f=>!/node_modules|\.git[\\/]/.test(f)).map(f=>path.basename(f));
 assert.deepEqual(names.filter(n=>/-adminsdk-.*\.json$|^serviceAccount.*\.json$|\.(jks|keystore)$|^keystore\.properties$/.test(n)),[]);
 const gi=rd('.gitignore');for(const g of['*-adminsdk-*.json','serviceAccount*.json','*.jks','*.keystore','keystore.properties'])assert.ok(gi.includes(g),g+' must stay in .gitignore');
 // The web config may contain ONLY public client identifiers (no private_key / client_secret / token style fields).
 const cfg=loadCfg(rd(FB_CFG));for(const k of Object.keys(cfg))assert.ok(PUBLIC_KEYS.includes(k),'non-public field in web config: '+k);
 for(const[k,v]of Object.entries(cfg))assert.equal(typeof v,'string',k)});

test('secret detection really works: a service-account key, PEM key and a stray API key are caught',()=>{
 // Fixtures are assembled at runtime so this test file never contains a literal secret (and is still scanned like every other file).
 const sa='{"type": "service'+'_account", "private'+'_key_id": "abc", "client_email": "x@proj.iam.'+'gserviceaccount.com"}',pem='-----BEGIN '+'PRIVATE KEY-----\nMIIE\n-----END '+'PRIVATE KEY-----',stray='const k="AI'+'zaSyANlALQrIzJGdPbpUjgpsCOBC3FgxRfFaE";';
 assert.ok(REAL_SECRETS.some(re=>re.test(sa)));assert.ok(REAL_SECRETS.some(re=>re.test(pem)));assert.equal((stray.match(KEY_SHAPE)||[]).length,1);
 assert.ok(!REAL_SECRETS.some(re=>re.test(rd(FB_CFG))),'a normal Web config must not be flagged as a secret')});

test('Firebase config is either clean EMPTY (local-only) or a complete, self-consistent Web config (cloud); rules are user-scoped',()=>{
 const cfg=loadCfg(rd(FB_CFG));
 if(!auth.isConfigured(cfg)){ // LOCAL-ONLY mode: must be the deliberate empty state, never a half-filled/typo'd config that silently disables sync
  assert.equal(cfg.apiKey,'');assert.equal(cfg.projectId,'');}
 else{ // FIREBASE-ENABLED mode: every identifier must belong to the same project
  const p=cfg.projectId;assert.match(p,/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/);
  assert.equal(cfg.authDomain,p+'.firebaseapp.com');assert.match(cfg.storageBucket||p+'.firebasestorage.app',new RegExp('^'+p+'\\.(firebasestorage\\.app|appspot\\.com)$'));
  if(cfg.databaseURL)assert.match(cfg.databaseURL,new RegExp('^https://'+p+'(-default-rtdb)?\\.[a-z0-9-]*\\.?firebase(io\\.com|database\\.app)$'));
  const m=/^1:(\d+):web:[0-9a-f]+$/.exec(cfg.appId||'');assert.ok(m,'appId must be a Web app id');assert.equal(m[1],cfg.messagingSenderId,'appId and messagingSenderId must match');
  // The cloud store built from it must talk to exactly this project, user-scoped.
  const seen=[];const st=cloud.createStore({config:cfg,auth:{getIdToken:async()=>'t',snapshot:()=>({user:{uid:'u1'}})},fetchFn:async u=>{seen.push(u);return{ok:true,status:200,json:async()=>({writeResults:[{updateTime:'2026-01-01T00:00:00Z'}]})}}});
  return st.upsert('u1','tasks',{id:'a',updatedAt:1},{deviceId:'d'}).then(()=>assert.ok(seen[0].includes('projects/'+p+'/databases/(default)/documents:commit')))}});

test('both modes behave: empty/malformed/contradictory config => local-only; valid config => Firebase-enabled',()=>{
 const GOOD={apiKey:'AI'+'za'+'A'.repeat(35),projectId:'tasktime-73fc7',authDomain:'tasktime-73fc7.firebaseapp.com'};
 assert.equal(auth.isConfigured(GOOD),true);assert.equal(auth.isConfigured({apiKey:'AIzaTEST',projectId:'demo-proj'}),true);
 for(const bad of[undefined,null,'x',42,{},{apiKey:'',projectId:''},{apiKey:GOOD.apiKey},{projectId:GOOD.projectId},{apiKey:'YOUR_WEB_API_KEY',projectId:'YOUR_PROJECT_ID'},
  {...GOOD,projectId:'Tasktime 73fc7'},{...GOOD,projectId:'x'},{...GOOD,apiKey:'AIza bad key'},{...GOOD,apiKey:'a/b?c=d'},{...GOOD,apiKey:123},
  {...GOOD,authDomain:'other-project.firebaseapp.com'},{...GOOD,authDomain:123}])assert.equal(auth.isConfigured(bad),false,JSON.stringify(bad));
 assert.equal(auth.isConfigured({...GOOD,authDomain:'login.my-own-domain.com'}),true,'custom auth domains stay allowed');
 // A broken/missing config file must still leave the app usable: the file itself evaluates cleanly and the sync layer only builds a cloud store when configured.
 assert.doesNotThrow(()=>loadCfg(rd(FB_CFG)));const se=rd('js/sync-engine.js');assert.match(se,/auth\.isConfigured\(\)\?T\.cloud\.createStore\([^)]*\):null/);
 assert.match(se,/isEnabled:\(\)=>!!engine&&!!auth&&auth\.isConfigured\(\)/)});

test('Security Rules are user-scoped and match what the app writes (Firestore) ; Realtime Database is locked (app does not use it)',()=>{
 const r=rd('firebase/firestore.rules');
 assert.match(r,/match \/users\/\{uid\}/);assert.match(r,/request\.auth\.uid == uid/);assert.doesNotMatch(r,/allow (read|write)[^;]*if true/);assert.match(r,/hasOnly/);
 assert.equal((r.match(/allow delete: if false/g)||[]).length,5);
 // Collections in the rules == collections the adapter writes (+ profile); every adapter field is allowed by hasOnly.
 const ruleColls=[...r.matchAll(/match \/(\w+)\/\{docId\}/g)].map(m=>m[1]).sort();assert.deepEqual(ruleColls,[...Object.keys(cloud.FIELDS),'profile'].sort());
 const only={tasks:'validTask',sessions:'validSession',categories:'validCategory',settings:'validSetting'};
 for(const[coll,fn]of Object.entries(only)){const body=r.slice(r.indexOf('function '+fn));const list=/hasOnly\(\[([^\]]*)\]\)/.exec(body)[1].match(/'([^']+)'/g).map(x=>x.slice(1,-1));
  for(const f of[...cloud.FIELDS[coll],'schemaVersion','deviceId','syncedAt'])assert.ok(list.includes(f),coll+' rules must allow '+f)}
 assert.match(rd('js/cloud-store.js'),/users\/\$\{uid\}\/\$\{store\}/,'adapter writes under users/{uid}/...');
 // Realtime Database: the app never touches it, so the shipped rules deny everything and firebase.json deploys them.
 const db=JSON.parse(rd('firebase/database.rules.json'));assert.deepEqual(db,{rules:{'.read':false,'.write':false}});
 assert.equal(JSON.parse(rd('firebase/firebase.json')).database.rules,'database.rules.json');
 for(const f of walk(path.join(root,'js')))if(!f.endsWith('firebase-config.js'))assert.doesNotMatch(fs.readFileSync(f,'utf8'),/firebaseio\.com|firebasedatabase\.app/,'app code must not use Realtime Database: '+f)});
test('every CSP-relevant host used by the web app is allowed by the native CSP',()=>{
 const csp=rd('android/app/src/main/kotlin/com/tasktime/app/UrlPolicy.kt');for(const h of['identitytoolkit','securetoken','firestore'])assert.match(csp,new RegExp(h+'\\.googleapis\\.com'));
 for(const f of['js/cloud-auth.js','js/cloud-store.js'])for(const m of rd(f).matchAll(/https:\/\/([a-z.]+googleapis\.com)/g))assert.ok(csp.includes(m[1]),m[1])});
