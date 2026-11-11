# Phase 1 delivery and verification

> Product update: local shared-device racing was subsequently removed completely. References below describe the historical implementation/plan. Current policy and verification: [one player per device](ONE_PLAYER_PER_DEVICE.md).

Date: 10 November 2026. Branch: `feat/phase-1-mobile-racing`. Baseline: `0a0cb3cb388b9f0583494727f398b7f355375972`. Status: implemented and tested locally; stopped before Phase 2. No remote push, public deployment, paid service, database or dependencies installed.

## Completed behavior

- Reused existing Canvas car drawing, physics constants, normal collisions and Catmull–Rom track. Updated browser wiring and extracted a small DOM-independent `LocalSession` rather than replacing the game engine.
- Reliable captured-pointer driving buttons and Turbo; independent multi-touch ownership, quick-tap retention, cancellation, focus handling, keyboard and gamepad D-pad fixes. Brake overrides gas. Local app-switch/blur pauses and clears input; rotation clears input.
- Responsive safe-area-aware layouts, touch instructions, bounded 1.5x canvas backing resolution, orientation resize handling and no desktop hint over mobile controls. Static menus/paused/results views are not repainted every animation frame.
- Removed projectile implementation, shooting controls/shortcuts and weapon stun. There is no weapon code in the loaded application.
- Exactly three laps; ordered directional swept checkpoint gates, finish-time interpolation, no race expiration or race-duration setting.
- One Turbo grant per lap, unused grant discarded at the boundary, maximum three uses. No timed recharge/pickups. A held button cannot automatically consume the fresh lap grant. Default strength 1.6x forward speed cap, duration 2.5 seconds; the boost does not teleport or instantly set speed.
- Solo: one human plus five AI. The AI now follows nearby spline samples, crosses the same gates and has a guard against controlling human slots. An AI may finish first; the human can continue. Solo results appear when the human finishes, with remaining AI explicitly unfinished.
- Local splitscreen: two humans, no AI fill; independent cameras, keyboard and Turbo routing. Both humans can finish before results. This remains a shared-keyboard local mode, not six-device multiplayer.
- Core disconnected/DNF handling does not block the remaining human; already recorded finishes retain their place. Real socket disconnects/reconnection await Phase 2.
- Clean Race Again/menu/leave paths with fresh cars, laps, time and Turbo. Local pause is explicit and has no time-based expiry.
- Preserved exact MIT notice and upstream attribution. Docker context/COPY now include LICENSE.

## Environment and flow

Node 22.14.0, npm 10.9.2, Python 3.12.10 and existing Playwright CLI 0.1.19/Chrome on Windows. Browser plugin not available; existing regular Playwright used without installing packages. Baseline initially served by Python; final verification uses the project's new Node static preview at `http://127.0.0.1:8081/`.

Flow tested: menu -> explicit solo start -> countdown -> actual touch driving/Turbo -> pause/resume/leave -> restart; scripted physical driver -> three valid laps -> results -> Race Again; local split -> both keyboard drivers accelerate and boost. Browser instrumentation was in-memory only, not exposed in production code.

## Results

| Verification | Actual outcome |
| --- | --- |
| `npm test` / Node built-in runner | **21 passed, 0 failed, 0 skipped.** Input ownership/reset/focus/gamepad fixtures; ordered/invalid/reverse/teleport crossings; three laps; wait for another human; core disconnect; sub-step finish ordering; per-lap grant and max-three Turbo; no timed recharge; no race expiry; brake precedence; roster/AI exclusion; fresh sessions; full physical AI and scripted-human races. |
| Browser flow/layout suite | **140 assertions passed** on the final code and Node preview server. This is an assertion count, not 140 independent user sessions. |
| Page identity, blank/overlay check | Correct GenerateRacer Café Racing title and meaningful menu/HUD/results. No framework overlay in the inspected rendered states. |
| Console/exception health | No captured application console errors or exceptions in the browser suite. The unmodified baseline had a missing favicon 404; current page uses an inline favicon. |
| Phone viewport matrix | 320x568, 360x640, 390x844, 412x915 and 844x390 CSS px, touch emulation at DPR 3. Required HUD/control bounding boxes fit; all six interactive controls were hittable; canvas backing matched viewport at capped DPR 1.5. |
| Touch interactions | Three simultaneous touches gas+left+Turbo reached the input boundary and spent one Turbo. Release cleared gas; rotation cleared held input; no Turbo recharge after ten simulated seconds. |
| Pause/replay | Pause froze local simulation time; resume/blur/leave responded. New session reset Turbo; browser Race Again reset laps. |
| Actual rendered complete race | Scripted driver supplied steering/gas/Turbo through the real session input boundary, using real movement/collisions/gates. Three laps produced a six-row results screen and working replay. Not a human playtest or measured novice race duration. |
| Local split regression | 1280x800 browser: two human cars, no AI; both keyboard controls independently accelerated and spent Turbo. Full two-human finish/wait logic tested in core tests; not a real two-person device test. |
| Static server | Six HTTP checks passed: page, JS MIME and LICENSE accessible; `.git`, docs and missing JS rejected with 404. |
| Syntax/diff | Main/preview server syntax checks and `git diff --check` passed. MIT license Git blob matches baseline exactly. |
| Docker | CLI available; engine unavailable. Build/run not verified. License COPY/context changes inspected, not claimed as a passed container build. |

Screenshots and compact browser results are saved beside the source project in the workspace outputs: `phase1-390.png`, `phase1-844.png`, `phase1-results.png`, `phase1-splitscreen.png`, `phase1-browser-results.json`. Temporary browser orchestration is outside the repository under workspace `work/`; committed automated tests live in `tests/`.

## Files changed

- Gameplay: `js/car.js`, `js/constants.js`, `js/race.js`, `js/track.js`, `js/ai.js`, new `js/simulation.js`; removed `js/projectile.js`.
- Browser/UI: `js/main.js`, `js/input.js`, `js/hud.js`, `index.html`, `game.css`.
- Tooling/packaging: dependency-free `package.json`, `tools/serve.mjs`, `.gitattributes`, `Dockerfile`, `.dockerignore`.
- Automated tests: `tests/input.test.mjs`, `tests/racing.test.mjs`.
- Documentation: refreshed `README.md`, `docs/PROJECT_AUDIT.md`, `docs/MVP_ROADMAP.md`, this report and `docs/NETWORK_ARCHITECTURE.md`.

Legacy WebRTC and QR files remain for reference but are not loaded. No Phase 2 server, transport replacement or room/lobby flow has been implemented.

## Preview

The agent starts the static preview and leaves it available at **http://127.0.0.1:8081/**. Open the link and press Start solo race. No command or tool setup is required from the user. Keyboard uses arrows/WASD and E/L Turbo. On touch, hold the on-screen arrows and tap Turbo. The preview is local to this computer, not a public or phone-accessible deployment. Phone access can be prepared for an approved local-network/device session later.

## Outstanding verification and Phase 2 review

Real iPhones/Android devices, Safari, physical gamepads, battery/thermal performance and novice handling need testing. No actual café connectivity, multi-device online race, room isolation, nickname flow or same-room online rematch has been claimed. Those belong to the following milestones. Current local simulation time excludes paused time and can fall behind wall time under long stalls; Phase 2 authority must use a server-owned clock and interruption policy.

Proposed next architecture: a small Node authoritative race server over WebSockets, with in-memory isolated room sessions and no database. It reuses the simulation, binds every input connection to its own participant/car, and owns laps/Turbo/results. This replaces dependence on a customer's phone hosting the race; it introduces server hosting/latency/operating responsibilities. See `NETWORK_ARCHITECTURE.md` for exact trade-offs and planned tests. No paid service or deployment selection has been made, and Phase 2 has not begun.
