# Project status — locally testable MVP complete

Current milestone: complete Arabic/English localization, implemented and publicly verified. Arabic is the default; the always-visible switcher updates menus, rooms, lobby, countdown, HUD/Canvas, pause, results, notices and errors without reconnecting or resetting races. Preference persists in localStorage. Arabic/English players share the same authoritative race. Translation keys and Arabic pluralization are centralized; RTL never mirrors the track or controls. Verified: **67 automated tests**, **152 English full browser checks in Chrome and 152 in Edge**, **108 public full bilingual checks in each browser**, and **106 expanded public/mobile smoke checks in each browser after the final server restart**. All passed; zero captured app errors/missing keys. Branch remains `deploy/public-mvp`; no main merge or paid resource is involved. Exact implementation/test instructions are in LOCALIZATION.md.

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

Resume/next action: authorize the Render integration. The agent should verify the authenticated workspace permits the explicit Free plan without billable overages, deploy `render.yaml` from `deploy/public-mvp`, inspect logs, obtain the actual service HTTPS URL and rerun the public socket/browser suites there. Do not create paid resources or merge main. Until then, use the temporary public link in PUBLIC_DEPLOYMENT.md while this computer stays awake; restart instructions are in DEPLOYMENT_GUIDE.md. Physical iPhone/Android/Safari, thermal/battery behavior and Docker execution remain unverified. The game does not enforce physical café presence. No future account or leaderboard work is needed.
