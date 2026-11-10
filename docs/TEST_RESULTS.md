# Verification results — 10 November 2026

Status: final local verification. Raw reports are generated in ignored `work/`; the counts below describe real executions, not promised coverage.

Deployment follow-up: **57 automated tests passed, 0 failed/skipped** after production origin pinning, connection/HTTP limits, headers and the encoded Windows traversal fix. Four additional tests cover traversal rejection, configured HTTPS origins/forged forwarded headers, actual 429 connection admission, and assigned-port production startup/asset protection/shutdown. Local Chrome full regression passed 130 assertions initially; the revised network-aware harness passed 128 against a separately running server (two owned-server cleanup assertions are intentionally inapplicable in external mode). Public endpoint execution and failures are documented in [PUBLIC_DEPLOYMENT.md](PUBLIC_DEPLOYMENT.md); the remaining sections retain the original Phase 5 local baseline.

Final public endpoint results: **34 WebSocket checks**, **128 Chrome full assertions**, **108 Edge smoke assertions**, all passed, no captured app errors. Actual WSS 2–6-human full races, two concurrent isolated rooms, DNF completion and rematch were verified. Public browser coverage includes full multiplayer and solo races, private invitations, Ready/countdown, six customers, touch controls, responsive screens and recovery. Earlier 20-socket concurrent tunnel stress had transport closures and is not certified; no real iPhone/Safari testing was performed.

## Automated tests

`npm test`: **53 passed, 0 failed, 0 skipped** (about 52 seconds).

| Area | Tests | Coverage |
| --- | ---: | --- |
| Input/physics/race foundation | 21 | Pointer ownership/cancel, keyboard/gamepad fixtures, three ordered directional laps, invalid crossings, timing, Turbo grants/max uses, brake precedence, AI exclusion, physical AI and scripted-human completion. |
| Real WebSocket multiplayer | 12 | 2/3/4/5/6 humans, independent controls/Turbo, cross-room/stale-input rejection, malformed/flood input, disconnect/neutral timeout, live token handover and closed-token restrictions; full physical races in five simultaneous rooms, 20 human sockets total. |
| Rooms and lobby | 10 | Names, public/private visibility, capacity, explicit solo start, all-player Ready, membership resets, cancellation, lock, expired codes, cleanup and stale lobby-generation rejection. |
| Results/rematch | 5 | Winner waits, identical standings, finish order, DNF before/after finish, last departure, three clean rematches, reopened joining and no stale race state. |
| Stability/security/launch | 5 | 40 create/leave/socket cycles; zero remaining rooms/sockets; expiry removes retained tokens; HTTP path restrictions; origin/unauthenticated/payload limits; occupied port/invalid configuration errors. |

The full socket races send actual control messages through WebSockets and drive the real physics/checkpoints. Short lifecycle tests also use trusted server-side gate fixtures to isolate specific finish/departure transitions; those fixtures are not exposed to clients. Artificial delayed input is tested, not claimed as a comprehensive packet-loss emulator.

## Browser verification

System Chrome 146.0.7680.80 and Edge 157.0.4341.42 on Windows, using pinned development Playwright 1.65.0. Browser plugin absent; regular Playwright used. These are real browser contexts on one computer, not physical smartphones.

Final Chrome full suite: **130 assertions passed**, 0 captured application errors (about 168 seconds). Final Edge smoke suite: **110 assertions passed**, 0 captured application errors (about 30 seconds). Raw counts are recorded in `work/browser-chrome/report.json` and `work/browser-edge/report.json`. Each assertion count includes layout/property checks and is not a count of independent user sessions.

- Chrome full journey: room discovery/create/join, private links, Arabic names, readiness/cancellation/lock, two complete physical multiplayer browser races (two then three humans), matching rendered results and same-room rematches; six browser customers moving together, seventh rejected; solo browser completion and return to the same lobby.
- Edge smoke: room journey, six browser customers, the full viewport/control/recovery matrix. Full three-lap Edge races were not run.
- Phone viewports: 320x568, 360x640, 390x844, 412x915, 844x390; capped DPR rendering; touch gas/steer/Turbo; orientation; bounds/hit targets; six nonoverlapping grid name labels; delayed input; reload recovery; closed browser DNF; invalid invitation and safe nickname text.
- No captured application console errors or page exceptions in the passing suites. Screenshots inspected for lobby, race, grid labels and results. Server rooms and sockets cleaned up after each suite.

Additional milestone browser checks also passed: Phase 2 transport/prediction in two isolated contexts; 13 Phase 3 room-flow assertions; 16 Phase 4 full-race/rematch assertions. These overlap the final reproducible suite and are not added to its count.

## Packaging and local access

- `npm run build`: passed. Native ES modules and the authoritative server packaged with LICENSE.
- `node tools/verify-build.mjs`: passed for production-folder HTTP, attribution, WebSocket identity, room creation, explicit solo start and six-car state.
- A production-only dependency installation was verified; only `ws` is needed at runtime. `npm audit --omit=dev` reported zero known vulnerabilities at verification time.
- HTTP `/health` and a real WebSocket identity handshake passed at `192.168.100.206:8081`, from this computer. Localhost also passed after stopping the obsolete static preview.
- License Git blob matches the preserved Phase 1/upstream notice exactly. Syntax and `git diff --check` passed.
- Docker CLI exists but its engine is not running: container build/run is **unverified**. GitHub CI definitions were prepared but not remotely executed, pushed or deployed.

## Fixes found during final verification

Reload originally returned to nickname entry without reconnecting automatically. It now restores the tab's short-lived session; only a valid still-live token takeover can retain a car, while an already closed seat stays DNF. Tests distinguish these outcomes. Added stale lobby-generation protection, a Windows-specific old-static-listener detection check, and collision-aware grid name placement. Initial failing checks were corrected and rerun; do not treat the historical failed runs as passing evidence.

## Limits

No real iPhone/Android, Safari, physical gamepad, long thermal/battery session, actual café router or separate-phone inbound-firewall test was available. No claim of Internet reliability, public deployment, location enforcement, prize integrity or low-end-device FPS certification. See KNOWN_ISSUES.md and DEPLOYMENT_GUIDE.md.
