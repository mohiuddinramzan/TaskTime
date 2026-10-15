# Task Time — Phase 1 (offline-first)
Vanilla HTML/CSS/JS + IndexedDB (`task_time_db`). No CDN, no backend, no Firebase. Future package: `com.tasktime.app`.
## Run
Open `index.html` in a browser (classic scripts, works from file://). Or `python3 -m http.server` in this folder.
## Test
`node --test tests/core.test.js` (Node 18+). Covers timer math, pause/resume, session id stability, validation, report ranges, CSV escaping.
Not covered by automated tests: IndexedDB, UI, backup import, theme persistence (verify manually).
## Timer limitation
Time is derived from stored timestamps, so a running timer reflects real elapsed time after reload. JavaScript does NOT run when the page is closed or Android kills the process: no alerts/background execution in Phase 1.
## Phase 2 notes
Writes enqueue into `syncQueue`; implement an adapter and call `TT.sync.setAdapter()` (js/sync-engine.js). Deletes are tombstones (`deletedAt`). Add a service worker/WebView asset loading, Firebase, GitHub Actions APK.
## GitHub
`git init && git add . && git commit -m "Task Time phase 1" && git remote add origin <url> && git push -u origin main`
