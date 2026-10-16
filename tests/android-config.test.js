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
test('no secrets or admin credentials anywhere in the repo',()=>{
 const bad=[/-----BEGIN [A-Z ]*PRIVATE KEY-----/,/"type":\s*"service_account"/,/AIza[0-9A-Za-z_-]{35}/];
 for(const f of walk(root).filter(f=>!/node_modules|\.git[\\/]|_v1seed/.test(f)&&/\.(js|kts?|xml|json|yml|md|html|rules)$/.test(f)))for(const re of bad)assert.doesNotMatch(fs.readFileSync(f,'utf8'),re,f)});
test('Firebase config ships EMPTY (local-only until the user fills it) and rules are user-scoped',()=>{
 assert.match(rd('js/firebase-config.js'),/apiKey:'',projectId:''/);const r=rd('firebase/firestore.rules');
 assert.match(r,/match \/users\/\{uid\}/);assert.match(r,/request\.auth\.uid == uid/);assert.equal((r.match(/allow delete: if false/g)||[]).length,5);assert.doesNotMatch(r,/allow (read|write)[^;]*if true/);assert.match(r,/hasOnly/)});
test('every CSP-relevant host used by the web app is allowed by the native CSP',()=>{
 const csp=rd('android/app/src/main/kotlin/com/tasktime/app/UrlPolicy.kt');for(const h of['identitytoolkit','securetoken','firestore'])assert.match(csp,new RegExp(h+'\\.googleapis\\.com'));
 for(const f of['js/cloud-auth.js','js/cloud-store.js'])for(const m of rd(f).matchAll(/https:\/\/([a-z.]+googleapis\.com)/g))assert.ok(csp.includes(m[1]),m[1])});
