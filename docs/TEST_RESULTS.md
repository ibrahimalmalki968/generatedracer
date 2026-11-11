# Verification results — 10 November 2026

## Current product change — one player per device

All local shared-device UI, split views, extra input/HUD paths and 11 obsolete paired translations are removed. The browser only renders server-backed Solo or online Multiplayer. **75 automated tests passed, zero failed/skipped**. Full local gameplay browser regression: **170 each in Chrome and Edge**. Full public bilingual race journeys: **140 each in Chrome and Edge**. Expanded UI/removal/legacy-route checks: **155 in Chrome local and 155 in Edge public**. Zero captured app errors/missing translation keys. Production build/runtime smoke and direct HTTP asset equality passed. No server restart or new dependencies were needed.

The new Canvas-frame helper asserts one full-viewport camera per racing frame on each of six separate browser clients; a full-size Canvas containing multiple subviews cannot pass this assertion. Public bilingual checks repeat this for Arabic/English human clients and solo AI races. Native socket tests preserve full 2–6-human races, independent inputs/rooms and exact lap/Turbo/results rules. Old local composition coverage was replaced with the shared server engine's 2–6-human no-AI-fill check; keyboard tests prove WASD/arrows operate the same device player. Legacy query/hash navigation cannot start a local race. See [one-player report](ONE_PLAYER_PER_DEVICE.md) for files, screenshots and raw evidence paths.

The following UI transformation entries describe earlier milestones. Physical iPhone/Safari verification of this change was not performed by the agent.

## 11 November — complete Midnight Circuit UI/UX transformation

| Actual suite | Result | Evidence directory (workspace outputs) |
| --- | --- | --- |
| Automated Node tests | 73 passed; 0 failed/skipped | `ui-ux-final-all-tests.tap` |
| Initial full English browser regression | Chrome 152, Edge 152; 0 app errors | `ui-ux-regression-chrome`, `ui-ux-regression-edge` |
| Final public redesigned UI journey | Chrome 134, Edge 134; 0 app errors/missing keys | `ui-ux-public-rematch-chrome`, `ui-ux-public-rematch-edge` |
| Final full public bilingual journey | Chrome 128, Edge 128; 0 app errors/missing keys | `ui-ux-public-bilingual-chrome-release`, `ui-ux-public-bilingual-edge-release` |
| Final full public English regression | Chrome 150; 0 app errors | `ui-ux-public-english-chrome-release` |
| Final public WSS socket suite | 34 passed; 0 errors; full 2/3/4/5/6-human races | `ui-ux-public-sockets-release/sockets.json` |
| Production package and audit | Build/runtime HTTP/WSS/artwork/license smoke passed; 0 runtime vulnerabilities | Build verifier / npm audit |

The local-owned-server English suite has two extra internal socket/room cleanup assertions that cannot run against an external origin; the 150 public count is not a skipped/failing test. Counts overlap between suites; do not add them as unique player sessions. Chrome version 146.0.7680.80, Edge 157.0.4341.46; installed browsers driven through existing Playwright because the Browser plugin/skill was unavailable.

UI coverage: real welcome → mode → creation/public/private/invitation lobby → acknowledged Ready/countdown → physical three-lap human race → localized standings → same-room reset → socket recovery; copy/native-share cancellation/denial/manual fallback, input validation, controlled focus/Tab/Escape, reduced motion, separate results/action geometry and clear controls. Both-language screenshots cover welcome, modes, browser, create, lobby, countdown, HUD, pause, results and errors. Narrow 320×568, standard 390×844 and 844×390 landscape check every major screen; mode/HUD regressions additionally check 360×640, 412×915 and desktop 1280×800 where relevant. Target/geometry checks include no horizontal overflow, no clipped labels and ≥44px controls. Contrast pairs are automated; this is not full accessibility certification.

Gameplay regression includes five-AI solo and direct replay, 2–6 humans without AI fill, fixed laps, lap-based Turbo, identity/room isolation, Ready/locking, disconnect/DNF and repeated rematches. The local native socket suite physically drives five simultaneous 2–6-human races (20 racers). A bounded 180-input burst test preserves own-car control and single Turbo use; malformed/flood/origin/unauthorized controls remain tested. Actual HTTP/WSS preview assets match the checkout and MIT LICENSE remains byte-identical.

Intermediate failures and refinements are retained rather than counted as passes: generic geometry missed sticky results/action overlap, fixed with separate regions and a new assertion; a mock share property was non-writable, fixed in the fixture; validation/Ready tests needed to wait for the relevant client's state; held-key tests now acquire page focus after viewport/other-page checks because blur intentionally releases controls. Earlier public runs also recorded 1008 rate-limit closes with a regular measured ~60Hz input stream. Burst tolerance is now bounded at 240 with 75/sec sustained and independent command limits; the exact proxy delivery cause is not proved. Final fresh bilingual/public regression runs passed afterward. No arbitrary transport-stall or high-concurrency guarantee is claimed.

Physical iPhone/Android/Safari, actual native mobile share sheet, real keyboard/notches/home indicators, screen readers and thermal/battery/low-end hardware remain unverified. Representative actual screenshots are in `docs/ui-ux/`; see UI_UX_IMPLEMENTATION_REPORT.md for the visual refinement ledger and intentional deviations from generated references.

The following sections retain historical verification counts.

## 11 November — Arabic/English localization

Final automated verification: **67 tests passed, 0 failed/skipped**, including dictionary/key/placeholder parity, six Arabic plural categories, safe fallback/corrupted preference handling, bidi name/number isolation, HTML bindings, structured server errors and generated-name metadata. All previous input/physics/2–6-human synchronization/rooms/results/security tests still pass. Runtime dependency audit reports zero vulnerabilities; final production folder build/runtime smoke passes. No dependencies were added.

English full regression: **152 checks passed in Chrome and 152 in Edge**. Public full bilingual suites: **108 checks passed in Chrome and 108 in Edge**. After the final restart, the expanded public smoke suite passed **106 checks in each browser**, adding Arabic racing-HUD/control-target checks at 320x568, 360x640, 390x844, 412x915 and 844x390. Arabic/English menu checks also include 1280x800. Zero captured app errors or missing keys. Earlier local bilingual full verification passed 105 checks before the additional persistence/numeric assertions were added.

Bilingual coverage includes Arabic default even with an English browser locale, live switching and saved preference/new visits, RTL/LTR labels, localized validation/clipboard/server errors, unchanged held acceleration/left steering and connection/car/race identity, mixed-language public/private/invitation rooms, readiness/countdown, identical results, DNF/rematch and physically completed solo races in both languages. These are assertion counts with overlapping checks across suites, not unique gameplay-session counts. Final full public results are in workspace `outputs/i18n-qa-public-{chrome,edge}-verified/report.json`; expanded smoke results are in `outputs/i18n-qa-public-{chrome,edge}-smoke/report.json`. English regression reports are `outputs/i18n-qa-english-full/report.json` and `outputs/i18n-qa-english-edge-final/report.json`. Native TAP evidence is `outputs/localization-regression-verified.tap`.

An initial public run completed its races but exposed a Join tap being ignored while public-list refresh was pending. Command buttons now reflect the pending state; translated public-room tests identify the intended room by code rather than assuming an empty browser. Visual review also led to explicit LTR isolation for lap fractions, times, list/result numbers and codes. Earlier failed evidence is retained outside the repo in workspace `outputs/i18n-qa-*`; it is not counted as a pass. Browser plugin unavailable; existing Playwright/installed Chrome and Edge were used. No physical iPhone/Safari verification was performed.

## 11 November — mode menu and one-tap solo

`npm test`: **61 passed, 0 failed/skipped**. Four additional real-WebSocket tests cover private atomic solo start, exclusion of other humans, duplicate/stale replay rejection, lap/Turbo/input reset, cancel/leave cleanup and prevention of multiplayer-to-solo conversion. The existing 2–6-human racing and security regressions remain green. Production build and runtime-package smoke passed; MIT LICENSE is unchanged.

Updated local Chrome full browser suite: **152 assertions passed**. Public Chrome full: **150 passed**; public Edge smoke: **129 passed**. No captured app errors. The two local-only assertions inspect the owned server's room/socket cleanup. New coverage includes both mode choices fitting six viewports (320x568 through 1280x800, including 844x390 landscape), one-tap solo countdown/cancellation, five AI, in-race exit, nickname editing and multiplayer navigation. The full suite physically drives two complete three-lap solo races with a one-tap replay, verifies fresh Turbo/laps in the same private session, and exits results to mode selection. Existing public/private/code/invitation/Ready/countdown/six-client/touch/reload and multiplayer-rematch journeys were retained. Browser plugin unavailable; existing Playwright with installed Chrome/Edge was used. Screenshots/reports are outside the repository in workspace `outputs/menu-qa-*`. Physical iPhone/Safari verification of this update has not been performed by the agent.

The remaining sections describe the original deployment/MVP baseline.

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
