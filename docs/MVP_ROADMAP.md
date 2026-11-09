# Confirmed café MVP milestones

All five local-development milestones have now been implemented and verified. The original phase descriptions/approval boundary below are retained as planning history; use [PROJECT_STATUS.md](PROJECT_STATUS.md), [ARCHITECTURE.md](ARCHITECTURE.md) and [TEST_RESULTS.md](TEST_RESULTS.md) for the delivered state. Physical café/device validation remains separate from local software completion.

Updated 10 November 2026. This replaces the initial exploratory plan. The user approved setup, fresh audit and Phase 1 execution, and requested a stop before Phase 2.

## Rules that every milestone must preserve

- One café; anonymous nicknames and lightweight session IDs, no registration or permanent profiles.
- Rooms allow 1–6 humans, exactly six maximum. Solo has five AI opponents; 2–6 humans race without AI filling empty slots.
- Exactly three laps, with no owner setting and no race time limit.
- First valid three-lap finisher wins; remaining connected humans can finish. Disconnects never block completion. Results wait for all remaining connected humans.
- Exactly one non-accumulating Turbo use per lap, maximum three. Unused Turbo expires at a lap boundary. No pickups or elapsed-time recharge. Default balance: 2.5 seconds, 1.6x forward speed cap.
- No shooting, projectiles, weapon stun or other combat. Normal car collisions remain.
- Keep MIT notice and upstream attribution; no original-upstream writes or automatic main pushes/public deployment.

## Phase 1 — Core gameplay and mobile stability

Implemented locally: responsive captured-pointer controls and working Turbo; weapon removal; ordered directional gates; fixed laps; per-lap Turbo; waiting for connected humans; clean restart; local pause/leave; solo AI and two-human local split; shared local simulation module; built-in tests. Five AI drive the same physical track and must cross the same gates.

Files: `index.html`, `game.css`, `js/main.js`, `js/input.js`, `js/car.js`, `js/race.js`, `js/ai.js`, `js/hud.js`, `js/constants.js`, `js/track.js`, new `js/simulation.js`; remove `js/projectile.js`; add `tests/*.test.mjs`, `package.json`, `tools/serve.mjs`; update Docker license copying and documentation.

Gate: unit/simulation tests plus actual browser control/layout/results/replay checks. No real-phone or online claim without those tests. See `PHASE_1_REPORT.md` for exact results and limits. Stop here for review.

## Phase 2 — Authoritative multiplayer foundation

Proposed architecture is in `NETWORK_ARCHITECTURE.md`. Replace peer authority with a small Node game server and browser WebSockets. Reuse current DOM-independent car/track/AI/race rules. Validate connection-bound input, tick and race identifiers, authoritative transforms/progress/Turbo/results; interpolate remote rendering. Support six humans, room isolation in core sessions, disconnection/DNF and carefully scoped rejoin.

Likely files: replace `js/network.js`; adapt `js/main.js`, `js/simulation.js`, `js/car.js`, `js/race.js`; add `server/game-server.js`, `server/race-session.js`, `shared/protocol.js` and multiplayer tests. Final names may change to keep boundaries clear. No lobby/product flow or database needs to be built merely to test the transport foundation.

Gate: 2/3/4/5/6 distinct clients drive only their cars; same start/laps/Turbo/finish/results on every client; no human slot overwritten by AI; two simultaneous sessions isolated; loss, stale/invalid input, disconnect and server interruption cases defined and tested. Any new server dependency must have a clear purpose.

## Phase 3 — Nicknames, rooms and unified lobby

One entry flow for solo and multiplayer: nickname, public browser or create/join private room, same lobby. Public list shows capacity/availability; private rooms are omitted from discovery. Codes/links identify rooms. Server issues anonymous session/participant identities; later account IDs can attach without changing car ownership.

Solo waits for explicit Start Race. Two or more humans all press Ready. Readiness/membership changes cancel or recompute the pending countdown under a roster revision. Lock joining during countdown to commit the roster; active races always reject late entry, waiting and spectating. Recheck roster/readiness immediately before start. No room owner can change laps or add a duration limit.

Likely files: `server/room-manager.js`, protocol/network code, new `js/lobby.js` and `js/identity.js`, page/CSS/main wiring, room/lobby integration tests.

Gate: 1–6 human flow, public/private visibility, full/active room rejection, stale/countdown cancellation, duplicate Ready/start protection, invitation errors, two simultaneous rooms and anonymous-session handling. No café-presence enforcement.

## Phase 4 — Shared results and same-room rematch

Server finalizes ordering only after all remaining connected humans finish; disconnected/unfinished entries have explicit status. The winner never stops another connected racer. Everyone sees the same final result. Return players to the same room lobby with all Ready flags reset and joining available again. No new room required for rematch.

Likely files: room/race managers, protocol, `js/race.js`, new `js/results.js`, page/CSS/main, results/rematch integration tests.

Gate: first winner plus slow finisher, multiple disconnects, last connected player, same-tick finish ties, repeated rematches, stale previous-race packets, lobby reopening and preserved nickname/session identities. No grace-period timer or race cap may be introduced.

## Phase 5 — Full verification and one-café pilot preparation

Exercise complete journeys, real devices where available, portrait/landscape/browser lifecycle, 2–6 humans, simultaneous rooms, solo, public/private links, disconnect and rematches. Profile frame timing and server capacity with representative sessions before choosing limits. Use HTTP/WebSocket-compatible HTTPS hosting; static Pages alone cannot run the authoritative server.

Likely files: browser/integration tests, CI test workflow, deployment/container configuration and pilot/runbook docs. Add only needed infrastructure; deploying publicly, buying services or creating paid infrastructure requires approval.

Gate: documented device/network matrix and measured outcomes, clean automated checks, no silent result mismatch, bounded queues and session cleanup, known rollback, preserved license distribution and tested server restart behavior. No production-ready claim based solely on desktop emulation.

## Deferred

Accounts/login/OTP/phone/email, persistent profiles/history/statistics, rankings/leaderboards, rewards, multi-café administration and physical-presence enforcement. No database is needed for the approved in-memory room/race system. Unfinished connected players can race indefinitely by requirement; they can leave, and disconnect policy must remain explicit rather than inventing a race time cap.
