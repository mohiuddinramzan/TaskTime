Optional browser tests (real Chromium + real IndexedDB). They are NOT run by GitHub Actions.
Requires: pip install playwright && playwright install chromium
  1. From the repo root:  python3 -m http.server 8765 &
  2. python3 tests/e2e/e2e_local.py    # Phase 1 v1 DB upgrades to v2, local-only mode, UI still works
  3. python3 tests/e2e/e2e_cloud.py    # sign-in gate, approval before upload, offline edit, pull, session restore
  4. python3 tests/e2e/e2e_switch.py   # logout keep/wipe, other-account mismatch, switch account
The cloud tests use an in-script EMULATION of the Firebase REST API (not Google's real servers).
e2e_csp_check.py needs the simulated-APK server described inside it (assets copied to /tmp/apk/assets/www with the CSP header).
