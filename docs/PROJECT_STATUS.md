# Project status — locally testable MVP complete

Branch: `feat/phase-1-mobile-racing`. All work remains local; main and the upstream repository are unchanged. Nothing has been pushed, merged or publicly deployed.

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

Remaining MVP implementation tasks: **none known**. Known failing final tests: **none**. Remaining verification: actual phones/Safari/physical controllers, thermal/battery behavior, second-device/router/firewall access, and Docker image execution (engine unavailable). The game does not enforce physical café presence.

Resume/next action: open the preview and perform the physical-phone café pilot checks. If the preview process has ended, the agent should run `npm start` from this checkout; do not start the obsolete static-only Phase 1 server. Use the LAN URL on phones. No future account, leaderboard or business features are needed before this validation.
