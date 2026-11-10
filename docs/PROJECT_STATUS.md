# Project status — locally testable MVP complete

Current branch: `deploy/public-mvp`, based on the verified Phase 1–5 commit `abbc449`. Main and upstream are unchanged. Public testing and a fork deployment-branch push are authorized. The complete game is now exposed through a temporary Cloudflare HTTPS/WSS tunnel; durable Render hosting is pending authorization. See [public deployment status](PUBLIC_DEPLOYMENT.md) for current verification and exact next action. The milestone table below records the original local MVP baseline.

| Milestone | Status | Commit |
| --- | --- | --- |
| Phase 1 — mobile/core | Preserved; original 21 tests still pass | `b710aad` |
| Phase 2 — authoritative multiplayer | Complete, real WebSocket 2–6-human races and isolation verified | `38f3b2e` |
| Phase 3 — nicknames, rooms, lobby | Complete, public/private/code/link and readiness/lock verified | `1fd5a03` |
| Phase 4 — results/rematches | Complete, finish/DNF consistency and repeated same-room races verified | `a22da4b` |
| Phase 5 — integration/pilot package | Complete for local testing; this document is included in its final verification commit | Local tag `mvp-local-verified` |

Verification: **53 automated tests passed, 0 failed/skipped; Chrome full browser suite 130 assertions passed; Edge smoke 110 assertions passed; no captured app errors.** Production folder build/runtime smoke, dependency audit, license identity and local/LAN HTTP/WebSocket checks passed.

Complete flow: nickname -> room browser -> create/join public/private -> unified lobby -> explicit solo Start or all-human Ready -> committed countdown -> authoritative three-lap racing -> matching results -> same room lobby, readiness reset -> rematch. Maximum six humans; no multiplayer AI fill, weapons or race time limit. One Turbo grant per lap. Disconnects never block other racers.

Preview left running:

- http://127.0.0.1:8081/
- http://192.168.100.206:8081/ (current Wi-Fi IP)

Read README.md and docs/ARCHITECTURE.md, TEST_RESULTS.md, DEPLOYMENT_GUIDE.md, KNOWN_ISSUES.md for exact coverage and operation. Native Node startup is one command after dependency installation; no database, account or paid service is required.

Remaining MVP implementation tasks: **none known**. Current production/security commit: **`434f29b`**, pushed to the fork's deployment branch. Latest local suite: **57 passed, 0 failed/skipped**. Public WSS suite: **34 checks passed**, including full 2/3/4/5/6-human races, simultaneous isolated 2- and 3-human rooms, Turbo, matching standings, capacity, Ready resets and a DNF rematch. Public Chrome full: **128 assertions passed**; public Edge smoke: **108 passed**; no captured app errors. Higher-concurrency temporary-tunnel stress had transport closures; do not claim that test passed. See PUBLIC_DEPLOYMENT.md for final results and retained failed-attempt details.

Resume/next action: authorize the Render integration. The agent should verify the authenticated workspace permits the explicit Free plan without billable overages, deploy `render.yaml` from `deploy/public-mvp`, inspect logs, obtain the actual service HTTPS URL and rerun the public socket/browser suites there. Do not create paid resources or merge main. Until then, use the temporary public link in PUBLIC_DEPLOYMENT.md while this computer stays awake; restart instructions are in DEPLOYMENT_GUIDE.md. Physical iPhone/Android/Safari, thermal/battery behavior and Docker execution remain unverified. The game does not enforce physical café presence. No future account or leaderboard work is needed.
