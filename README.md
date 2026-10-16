# Task Time — Phase 2 (লোকাল-ফার্স্ট + Firebase সিঙ্ক + Android APK)

Phase 1 (HTML/CSS/Vanilla JS + IndexedDB) অপরিবর্তিত থেকে তার ওপর Phase 2 যোগ হয়েছে। অ্যাপ **Firebase ছাড়াও পুরো কাজ করে** (শুধু-লোকাল মোড)।

## Phase 2-এ কী যোগ হয়েছে
| বিষয় | ফাইল |
|---|---|
| Firebase Auth (Email/Password, REST) | `js/cloud-auth.js` |
| Cloud Firestore (REST) | `js/cloud-store.js` |
| সিঙ্ক ইঞ্জিন (queue, retry, conflict, account binding) | `js/sync-engine.js` |
| Settings-এ "অ্যাকাউন্ট ও সিঙ্ক" কার্ড, হেডারে সিঙ্ক-পিল | `js/account-ui.js` |
| Firebase কনফিগ (ডিফল্ট ফাঁকা = লোকাল মোড) | `js/firebase-config.js` |
| Security Rules | `firebase/firestore.rules`, `firebase/firestore.indexes.json`, `firebase/firebase.json` |
| Android (Kotlin WebView) | `android/` |
| GitHub Actions | `.github/workflows/android-build.yml`, `android-release.yml` (ঐচ্ছিক) |

**কেন Firebase JS SDK নয়, REST?** SDK ES-module নির্ভর; অফলাইনে বান্ডেল/টেস্ট করা যায়নি এবং WebView-র লোকাল অরিজিনে ঝুঁকি থাকে। তাই Firebase-এর সরকারি REST API সরাসরি `fetch` দিয়ে ব্যবহার হয়েছে — কোনো CDN/বান্ডলার লাগে না।

**Phase 1 ডাটা মাইগ্রেশন:** IndexedDB `v1 → v2` (শুধু নতুন `syncMeta` স্টোর যোগ; কোনো রেকর্ড বদলায় না)। আসল Chromium-এ Phase 1 ডাটা (টাস্ক, সেশন, সেটিংস, চলমান টাইমার) দিয়ে পরীক্ষা করা হয়েছে। `syncMeta` ব্যাকআপ/এক্সপোর্টে যায় না; লগইন টোকেন `localStorage`-এ থাকে, ব্যাকআপে যায় না।

---
## ১. Firebase সেটআপ (একবারের কাজ)
1. https://console.firebase.google.com → **Add project**।
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable**।
3. **Build → Firestore Database → Create database** (Production mode)।
4. **Rules প্রকাশ:** Firestore → **Rules** ট্যাবে `firebase/firestore.rules`-এর পুরো লেখা পেস্ট করে **Publish**। (অথবা CLI: `cd firebase && firebase deploy --only firestore --project <আপনার-প্রজেক্ট-id>`)
5. **Project settings (⚙) → Your apps → Web (`</>`)** → অ্যাপ রেজিস্টার করুন → `apiKey` ও `projectId` কপি করুন।
6. `js/firebase-config.js` খুলে ফাঁকা স্ট্রিং দুটি বসান:
   ```js
   window.TT_FIREBASE_CONFIG={apiKey:'AIza...',projectId:'my-project-id'};
   ```
   (নমুনা: `firebase/firebase-config.sample.js`)
7. কমিট ও পুশ করুন।

> **এই কনফিগ গোপন কিছু নয়।** Web API key পাবলিক ক্লায়েন্ট আইডেন্টিফায়ার। নিরাপত্তা আসে **Authentication + Security Rules** থেকে। কখনো Admin SDK key / service-account JSON অ্যাপে বা রিপোতে রাখবেন না (`.gitignore` ও একটি টেস্ট এটা ঠেকায়)।
> ঐচ্ছিক: Google Cloud Console → Credentials → API key → *API restrictions* দিয়ে শুধু Identity Toolkit, Token Service ও Cloud Firestore API রাখুন। (Android-package restriction কাজ করবে না, কারণ কল WebView থেকে যায়।)

## ২. GitHub রিপো ও APK বিল্ড
**আবশ্যক:** রিপোর **মূল ফোল্ডারে** `index.html`, `js/`, `css/` এবং `android/`, `.github/workflows/` থাকতে হবে।

1. `git add . && git commit -m "Phase 2" && git push origin main`
2. রিপোর **Actions** ট্যাব → **Android Build** (push/PR-এ নিজে চলে; হাতে চালাতে *Run workflow*)।
3. সফল রান খুলে নিচে **Artifacts → `task-time-debug-apk`** ডাউনলোড (zip-এর ভেতরে `app-debug.apk`)।
4. ডেবিগ APK-র জন্য **কোনো secret লাগে না।**

### ফোনে টেস্ট
1. APK ফোনে নিন → ফাইল খুলুন → "অজানা উৎস থেকে ইনস্টল" অনুমতি দিন → Install।
2. Firebase ছাড়া: টাস্ক/টাইমার চালান; হেডারে পিল **"লোকাল"** দেখাবে।
3. Firebase সহ: Settings → ইমেইল/পাসওয়ার্ডে **নতুন অ্যাকাউন্ট** → সিদ্ধান্ত-কার্ড (নিচে ৫) → **এখনই সিঙ্ক**।
4. ফ্লাইট-মোডে টাস্ক বদলান → পিলে অপেক্ষমাণ সংখ্যা → নেট ফিরলে নিজে সিঙ্ক হবে।

> APK ডেবিগ-সাইনড; Play Store-এর জন্য নয়। Phase 1 ব্রাউজারের ডাটা APK-তে আপনাআপনি আসে না — ব্রাউজারে **JSON এক্সপোর্ট**, APK-তে **ব্যাকআপ ইমপোর্ট** করুন। APK-তে ফাইল পিকার/সেভ-ডায়ালগ আমি ডিভাইসে পরীক্ষা করিনি — ফোনে নিজে যাচাই করুন।

---
## ৩. অফলাইন আচরণ
* সব লেখা **আগে IndexedDB-তে** সেভ হয়; নেটওয়ার্ক লাগে না।
* `navigator.onLine` ক্লাউডে পৌঁছানোর প্রমাণ নয় — পিলে আসল সিঙ্ক-অবস্থা দেখানো হয়।
* **টাইমার:** সময় সংরক্ষিত টাইমস্ট্যাম্প থেকে হিসাব হয়; অ্যাপ বন্ধ/কিল হলেও খুললে সঠিক সময় দেখায়। **কিন্তু** WebView-র JS ব্যাকগ্রাউন্ডে চলে না, তাই অ্যালার্ট/নোটিফিকেশন নেই। Foreground service বানানো হয়নি।
* **চলমান টাইমার সিঙ্ক হয় না** (ডিভাইস-লোকাল); শেষ করলে *সেশন* সিঙ্ক হয়।

## ৪. সিঙ্ক আচরণ
* প্রতিটি রেকর্ড-পরিবর্তন একটি **persistent queue** এন্ট্রি (প্রতি রেকর্ডে একটি, ডুপ্লিকেট হয় না)।
* সিঙ্ক চলে: অ্যাপ খুললে, ফোরগ্রাউন্ডে ফিরলে, নেট ফিরলে, লোকাল পরিবর্তনের ~১.৫ সেকেন্ড পরে, ফোরগ্রাউন্ডে প্রতি ২ মিনিটে, এবং **এখনই সিঙ্ক** বাটনে। **অ্যাপ বন্ধ/সাসপেন্ড থাকলে সিঙ্ক হয় না** (গ্যারান্টি নেই)।
* ব্যর্থ হলে **exponential backoff** (২s, ৪s, ৮s … সর্বোচ্চ ৫ মিনিট)। স্থায়ী ত্রুটি (যেমন Rules-এ অনুমতি নেই) = "ব্যর্থ", ডাটা অক্ষত; **ব্যর্থগুলো আবার চেষ্টা** বাটন আছে।
* "সিঙ্কড" চিহ্ন বসে **শুধু ক্লাউড সফল হওয়ার পরে**। ক্লাউড ফাঁকা/অনুপলব্ধ হলে লোকাল ডাটা কখনো মোছে না।
* ডিলিট = **tombstone** (`deletedAt`); কোথাও স্থায়ীভাবে মোছা হয় না (Phase 2-তে tombstone পরিষ্কারের ব্যবস্থা নেই)।
* সিঙ্ক হয়: টাস্ক, সেশন, ক্যাটাগরি, সেটিংস। অপরিবর্তিত বিল্ট-ইন ক্যাটাগরি আপলোড হয় না।
* Firestore পাথ: `users/{uid}/profile/main`, `settings`, `categories`, `tasks`, `sessions`। সময় = epoch-ms পূর্ণসংখ্যা; সার্ভার `syncedAt` পুল-কার্সর।
* **কনফ্লিক্ট নীতি:** একই রেকর্ড দুই ডিভাইসে বদলালে **`updatedAt` নতুন যেটার সেটি জেতে**; সমান হলে বড় deviceId জেতে (সব ডিভাইসে একই ফল)। হেরে যাওয়া সংস্করণ Settings-এ লগ থাকে (শেষ ২০টি)। পুশে precondition + Rules (`updatedAt` পিছনে যাবে না) পুরনো লেখা দিয়ে নতুনকে মুছতে দেয় না। ডিলিটের পর আরও নতুন সম্পাদনা হলে রেকর্ড ফিরে আসে। *সীমাবদ্ধতা:* `updatedAt` ডিভাইস-ঘড়ির ওপর নির্ভর করে; ঘড়ি ভুল থাকলে "নতুন" ভুল হতে পারে।
* কনসোলে হাতে বানানো ডকুমেন্ট (যেগুলোতে `syncedAt` নেই) পুল হয় না।

## ৫. ডাটা মাইগ্রেশন ও অ্যাকাউন্ট বদল
* প্রথম সাইন-ইনে ডিভাইসে আগের ডাটা থাকলে **কিছুই আপলোড হয় না**; আপনাকে বেছে নিতে হয়:
  * **লোকাল ডাটা এই অ্যাকাউন্টে আপলোড করুন** (ক্লাউডের সাথে মার্জ, কনফ্লিক্ট নিয়মে)।
  * **লোকাল ডাটা মুছে ক্লাউডের ডাটা নিন** (নিশ্চিতকরণ সহ)।
* ডিভাইসের লোকাল ডাটা **অন্য অ্যাকাউন্টের** হলে নতুন ইউজারের কাছে তা পাঠানো হয় না ("ভিন্ন অ্যাকাউন্ট")। ব্যাকআপ নিয়ে **অ্যাকাউন্ট বদলান** দিলে লোকাল ডাটা ও চলমান টাইমার মুছে নতুন অ্যাকাউন্টের ডাটা নামে; আগের অ্যাকাউন্টের ক্লাউড ডাটা অক্ষত থাকে।
* **লগআউট:** দুই ধাপ — লগআউট, তারপর "লোকাল ডাটাও মুছবেন?" (না দিলে ডাটা থাকে)। ডিভাইস অন্য কেউ ব্যবহার করলে "হ্যাঁ" দিন।
* "সব ডাটা মুছুন" শুধু এই ডিভাইস মোছে; লগইন থাকলে পরের সিঙ্কে ক্লাউড থেকে আবার নামবে (বার্তায় বলা হয়)। ব্যাকআপ **ইমপোর্ট** লগইন-অ্যাকাউন্টে আপলোড হয় (বার্তায় বলা হয়)।

## ৬. Android অ্যাপ
* প্যাকেজ `com.tasktime.app`, নাম **Task Time**, `versionName 2.0.0`, `versionCode` = CI রান-নম্বর (ডিফল্ট ২), minSdk 26, target 34।
* ওয়েব ফাইল (`index.html`, `css/`, `js/`, `manifest.json`) বিল্ডের সময় APK-র `assets/www/`-এ কপি হয়; রিমোট সাইট নির্ভরতা নেই। লোড হয় `https://appassets.androidplatform.net/assets/www/index.html` (WebViewAssetLoader) — IndexedDB স্থায়ী। *এই হোস্টনাম বদলালে লোকাল ডাটা হারাবে।*
* নিরাপত্তা: `file://` অ্যাক্সেস বন্ধ, নেভিগেশন শুধু নিজস্ব পেজ (বাইরের https লিংক সিস্টেম ব্রাউজারে), cleartext বন্ধ, `allowBackup=false`, প্রতি রেসপন্সে **CSP** (স্ক্রিপ্ট শুধু অ্যাপের; নেটওয়ার্ক শুধু Firebase-এর ৩টি হোস্ট), ডিবাগিং শুধু debug বিল্ডে।
* পারমিশন: শুধু `INTERNET`, `ACCESS_NETWORK_STATE`।
* **একটিমাত্র নেটিভ ব্রিজ** (`TTNative`, `addWebMessageListener`, শুধু অ্যাপ-অরিজিনের মূল ফ্রেম): `saveFile` — JSON/CSV সেভ। কারণ WebView `blob:` ডাউনলোড করতে পারে না। যাচাই: নাম regex (পাথ-ট্রাভার্সাল নয়), শুধু `.json/.csv` + মিলে যাওয়া MIME, সর্বোচ্চ ১০MB; গন্তব্য ব্যবহারকারী সিস্টেম ডায়ালগে বাছেন।
* Back বাটন: খোলা ডায়ালগ বন্ধ করে, নইলে অ্যাপ থেকে বের হয়। নেটওয়ার্ক ফিরলে/অ্যাপ resume-এ নেটিভ কোড একটি স্থির ইভেন্ট JS-কে পাঠায় (ব্রিজ নয়)।
* লঞ্চার আইকন: adaptive vector (API 26+)।

## ৭. Gradle ত্রুটির সমাধান
* **`gradle-wrapper.jar` নেই:** ইচ্ছাকৃত — এটি বাইনারি, অফলাইন পরিবেশে বানানো যায়নি; নকল ফাইল দিইনি। CI সরাসরি Gradle 8.9 (`gradle/actions/setup-gradle`) চালায়, wrapper লাগে না। লোকালি: `cd android && gradle wrapper --gradle-version 8.9` (তারপর `./gradlew assembleDebug`)।
* AGP 8.5.x ↔ Gradle ≥ 8.7 ও **JDK 17** লাগে (`java -version` দেখুন)।
* `SDK location not found`: `ANDROID_HOME` সেট করুন বা `android/local.properties`-এ `sdk.dir=...`।
* `License not accepted`: `yes | sdkmanager --licenses`। CI-তে `android-actions/setup-android` এটা করে।
* `Could not resolve ...`: নেটওয়ার্ক/প্রক্সি দেখুন; `google()` ও `mavenCentral()` পৌঁছানো চাই।
* অ্যাপে ওয়েব ফাইল না থাকলে: `gradle :app:syncWebAssets` চালিয়ে `android/app/build/generated/webAssets/www` দেখুন; CI-তে "Verify APK contains the web assets" ধাপ APK খুলে যাচাই করে।
* রান ফেল করলে **Artifacts → `android-test-reports`** দেখুন।

## ৮. ঐচ্ছিক: সাইনড রিলিজ APK
1. `keytool -genkeypair -v -keystore release.jks -alias tasktime -keyalg RSA -keysize 2048 -validity 10000`
2. `base64 -w0 release.jks` (macOS: `base64 -i release.jks`) — আউটপুট `ANDROID_KEYSTORE_BASE64` secret-এ।
3. রিপো → Settings → Secrets and variables → Actions-এ চারটি secret: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`।
4. Actions → **Android Release (optional)** → Run workflow। secret না থাকলে স্পষ্ট ত্রুটি দিয়ে থামে। **কী/পাসওয়ার্ড কখনো কমিট করবেন না** (`.gitignore`-এ `*.jks`)।

## ৯. টেস্ট
```bash
node --test tests/*.test.js        # Node 18+; ৫৫টি (Phase 1-এর ৮টি সহ)
```
| ফাইল | কী যাচাই করে |
|---|---|
| `tests/core.test.js` | Phase 1 (অপরিবর্তিত) |
| `tests/sync.test.js` | queue, retry/backoff, ডুপ্লিকেট রোধ, কনফ্লিক্ট, tombstone, অ্যাকাউন্ট বদল, আপলোড-অনুমোদন, লোকাল ডাটা সুরক্ষা |
| `tests/cloud.test.js` | কনফিগ fallback, Auth অবস্থা/ত্রুটি, সেশন পুনরুদ্ধার, Firestore REST কোডেক/অনুরোধ/ত্রুটি-শ্রেণি |
| `tests/timer-recovery.test.js` | প্রসেস-কিলের পর টাইমার পুনরুদ্ধার |
| `tests/android-config.test.js` | Gradle/Manifest/Workflow পথ ও নিরাপত্তা (স্ট্যাটিক) |
| `android/app/src/test/...` | Kotlin ইউনিট টেস্ট (URL নীতি, saveFile যাচাই) — CI-তে চলে |
| `firebase/tests/firestore.rules.test.js` | Rules টেস্ট — emulator লাগে (ফাইলের ভেতরে কমান্ড) |
| `tests/e2e/*.py` | ঐচ্ছিক আসল-ব্রাউজার টেস্ট (`tests/e2e/README.txt`) |

## ১০. যা যাচাই **হয়নি** (সততার তালিকা)
* **Android Gradle বিল্ড ও Kotlin কম্পাইল চালানো হয়নি** (এখানে Android SDK/Gradle/Kotlin নেই, নেটওয়ার্ক বন্ধ)। কোড রিভিউ করে কয়েকটি সম্ভাব্য কম্পাইল-ত্রুটি আগেই ঠিক করেছি, তবু **প্রথম GitHub Actions রান ব্যর্থ হতে পারে**; সেক্ষেত্রে লগ দেখে ঠিক করতে হবে।
* APK আসলে বিল্ড হয়নি, ফোনে চালানো হয়নি; কোনো APK লিংক নেই।
* Kotlin ইউনিট টেস্ট ও `firestore.rules` (emulator) টেস্ট চালানো হয়নি।
* **আসল Firebase**-এর সাথে পরীক্ষা হয়নি। `tests/e2e`-এর ক্লাউড টেস্ট আমারই লেখা REST-অনুকরণ; Firestore-এর কিছু ত্রুটি-কোড (যেমন precondition ব্যর্থতার status) আসল সার্ভারে ভিন্ন হতে পারে। প্রথম আসল পরীক্ষায় সাইন-ইন, আপলোড ও দুই-ডিভাইস কনফ্লিক্ট নিজে একবার দেখে নিন।
* **চালানো হয়েছে:** Node টেস্ট ৫৫/৫৫ পাস; আসল Chromium-এ Phase 1 `v1→v2` মাইগ্রেশন, লোকাল মোড, সাইন-ইন গেট, আপলোড-অনুমোদন, অফলাইন সম্পাদনা, পুল, সেশন পুনরুদ্ধার, লগআউট/অ্যাকাউন্ট বদল, এবং Android-এর CSP হেডারের নিচে পুরো অ্যাপ।
