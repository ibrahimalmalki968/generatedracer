# Project status — locally testable MVP complete

Current product update: **one player per device only**. Local shared-device mode, its entry/instructions, second HUD, extra input handlers, split-camera renderer and browser-local race/replay path have been removed. Solo remains one human + five AI; online Multiplayer remains 2–6 separate-device humans. Arabic defaults and live English/RTL/LTR remain intact. Shared authoritative simulation, physics, networking and room rules are preserved. See [removal report](ONE_PLAYER_PER_DEVICE.md). Verified: 75 automated tests, full Chrome/Edge gameplay regression 170 each, full public bilingual races 140 each, and UI/legacy/full-camera checks 155 in Chrome local and 155 in Edge public. Zero failures/skips/app errors. Production build/runtime and live asset equality passed. Detailed evidence is in ONE_PLAYER_PER_DEVICE.md and TEST_RESULTS.md.

The UI transformation/localization details below are historical milestones; their preservation of a former local mode is superseded by this product decision.

Current milestone (11 November): full UI/UX transformation implemented and browser-verified on `deploy/public-mvp`. Source commits: plan `ae89b51`, transformation `24ea4d9`, results/responsive refinement `7267e14`, bounded network burst tolerance `a8f1afa`, final mobile/accessibility sizing `b46faa0`, and replay HUD reset `bf151d1`. Arabic remains default; English/live switching, every approved race/room rule and original MIT attribution remain preserved. The source is running at the existing public URL; no Render, paid infrastructure, main merge or upstream change was made.

Verified release suites: **73 automated tests**, **134 new public UI checks each in Chrome and Edge**, **128 full public bilingual checks each**, **150 final public English regression checks in Chrome**. Initial local English regression passed **152 each in Chrome and Edge**. No final browser run captured app errors/missing keys. Build/runtime package smoke and runtime dependency audit pass. The final public socket suite passed **34 checks**, including full physical 2/3/4/5/6-human races and a DNF rematch. The display-only rematch-countdown HUD reset passed its dedicated Chrome/Edge UI reruns, including fresh laps, timer and Turbo availability.

Play: https://brian-desired-theology-bath.trycloudflare.com/ (same free temporary tunnel; this computer must stay awake). Local complete app http://127.0.0.1:8081/. Read [implementation report](UI_UX_IMPLEMENTATION_REPORT.md), [plan](UI_UX_TRANSFORMATION_PLAN.md) and [design system](DESIGN_SYSTEM.md); representative actual before/after screenshots are included in `docs/ui-ux/`. Remaining manual validation: physical phones/Safari, native share sheet, real keyboard/notch/accessibility and low-end thermal/performance behavior. An Internet-scale capacity guarantee is not established.

The older sections below record historical milestones and their test counts.

Previous milestone: complete Arabic/English localization, implemented and publicly verified. Arabic is the default; the always-visible switcher updates menus, rooms, lobby, countdown, HUD/Canvas, pause, results, notices and errors without reconnecting or resetting races. Preference persists in localStorage. Arabic/English players share the same authoritative race. Translation keys and Arabic pluralization are centralized; RTL never mirrors the track or controls. Verified: **67 automated tests**, **152 English full browser checks in Chrome and 152 in Edge**, **108 public full bilingual checks in each browser**, and **106 expanded public/mobile smoke checks in each browser after the final server restart**. All passed; zero captured app errors/missing keys. Branch remains `deploy/public-mvp`; no main merge or paid resource is involved. Exact implementation/test instructions are in LOCALIZATION.md.

11 November menu update: nickname entry now opens two mobile mode choices. Solo Race creates a hidden private session and starts in one tap; Race again reuses it with fresh race state, and Main menu leaves it. Multiplayer/invitations/Ready/rematches remain available. Verified: 61 automated tests, 152 local Chrome full assertions, 150 public Chrome full assertions and 129 public Edge smoke assertions, all passed with no captured app errors. The public preview has been restarted with this update at the same URL. See the deployment branch's Git history for the menu milestone commit.

Current branch: `deploy/public-mvp`, based on the verified Phase 1–5 commit `abbc449`. Main and upstream are unchanged. Public testing and a fork deployment-branch push are authorized. The complete game is now exposed through a temporary Cloudflare HTTPS/WSS tunnel; durable Render hosting is pending authorization. See [public deployment status](PUBLIC_DEPLOYMENT.md) for current verification and exact next action. The milestone table below records the original local MVP baseline.

| Milestone | Status | Commit |
| --- | --- | --- |
| Phase 1 — mobile/core | Preserved; original 21 tests still pass | `b710aad` |
| Phase 2 — authoritative multiplayer | Complete, real WebSocket 2–6-human races and isolation verified | `38f3b2e` |
| Phase 3 — nicknames, rooms, lobby | Complete, public/private/code/link and readiness/lock verified | `1fd5a03` |
| Phase 4 — results/rematches | Complete, finish/DNF consistency and repeated same-room races verified | `a22da4b` |
| Phase 5 — integration/pilot package | Complete for local testing; this document is included in its final verification commit | Local tag `mvp-local-verified` |

Verification: **53 automated tests passed, 0 failed/skipped; Chrome full browser suite 130 assertions passed; Edge smoke 110 assertions passed; no captured app errors.** Production folder build/runtime smoke, dependency audit, license identity and local/LAN HTTP/WebSocket checks passed.

Current flow: nickname -> mode selection -> one-tap Solo Race (automatic private session) or Multiplayer (public/private browser and lobby) -> countdown -> authoritative three-lap racing -> results -> solo Race again or multiplayer same-lobby rematch. Multiplayer still requires all humans Ready and lets one waiting human explicitly Start. Maximum six multiplayer humans; no multiplayer AI fill, weapons or race time limit. One Turbo grant per lap. Disconnects never block other racers.

Preview left running:

- http://127.0.0.1:8081/
- http://192.168.100.206:8081/ (current Wi-Fi IP)

Read README.md and docs/ARCHITECTURE.md, TEST_RESULTS.md, DEPLOYMENT_GUIDE.md, KNOWN_ISSUES.md for exact coverage and operation. Native Node startup is one command after dependency installation; no database, account or paid service is required.

Remaining MVP implementation tasks: **none known**. The 10 November security/deployment baseline is **`434f29b`** plus its documentation follow-up; the mode-menu update is described above. Baseline public WSS suite: **34 checks passed**, including full 2/3/4/5/6-human races, concurrent isolated rooms and a DNF rematch. Higher-concurrency temporary-tunnel stress had transport closures; do not claim that stress test passed. See PUBLIC_DEPLOYMENT.md and TEST_RESULTS.md for current menu verification and retained baseline details.

Resume/next action for this release: open the existing preview on actual phones and test Arabic/English, invitations, touch/safe areas and two/six-person races/rematches. The agent has handled commands/build/server setup. No account/leaderboard, Render action or paid service is needed for this check. The temporary preview depends on this computer; process restart discards in-memory rooms. See DEPLOYMENT_GUIDE.md for operation.
