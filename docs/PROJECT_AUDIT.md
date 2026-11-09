# Fresh fork audit — 10 November 2026

This audit and the confirmed requirements below supersede the earlier exploratory roadmap. In particular, there is no race time limit, no finish grace expiration, no timed Turbo recharge and no weapons.

## Repository and environment

- Authenticated account: `ibrahimalmalki968`; fork verified through the GitHub API as a child of `commjoen/generatedracer`.
- Fork: https://github.com/ibrahimalmalki968/generatedracer
- Inspection baseline: `0a0cb3cb388b9f0583494727f398b7f355375972`, original version 1.0.7. The fork matches the earlier source snapshot, but the actual files were inspected again.
- Clean clone, with `main` retained at the baseline and development on `feat/phase-1-mobile-racing`. Only the user's fork is configured as origin. No upstream writes, remote pushes or deployments.
- Git 2.51.0, Node 22.14.0, npm 10.9.2, Python 3.12.10 and authenticated GitHub CLI are available. Existing Playwright CLI/Chrome used for browser checks; no dependencies installed.
- Docker CLI exists, but its engine is not running. Container builds remain unverified; no environment changes are necessary for the local browser preview.
- No AGENTS.md, package manifest or test suite existed in the baseline. A zero-dependency package manifest now supplies local preview and Node built-in tests.

## Architecture inspected

| Area | Baseline files | Finding |
| --- | --- | --- |
| Page/rendering | `index.html`, `game.css`, `js/main.js`, `js/track.js` | Static ES modules and Canvas 2D. One fixed spline track, 16 control points and 384 samples. Preserve renderer, track and lightweight architecture. Main mixes gameplay, UI and networking. |
| Physics | `js/car.js`, `js/constants.js` | Arcade movement, grass penalty, circle car collisions; suitable to reuse. Brake loses to gas; Turbo recharges after eight seconds. |
| AI | `js/ai.js` | Proportional waypoint following and rubber-banding. No explicit human-ownership guard. Human/AI assignment error in online mode overwrites guest input. |
| Race | `js/race.js` | Unordered checkpoint proximity, nearest-track progress and local wall clock. First finisher ends everyone’s race. Finish ordering can follow array iteration in a same-frame tie. |
| Controls/HUD | `js/input.js`, `js/hud.js` | Basic multi-touch listeners exist. Turbo inherits `pointer-events: none`; baseline browser reproduced it. Portrait HUD is too wide. No global input reset. Gamepad D-pad steering is discarded with a neutral stick. Split P1 action button is wired to the wrong input handler. |
| Weapons | `js/projectile.js`, car/main/input/HUD/constants | Shell firing, stun timers, weapon keys and buttons contradict confirmed racing-only scope; removed in Phase 1. |
| Online | `js/network.js`, main callbacks | One peer and one data channel: two humans maximum, not six. Unordered/no-retry controls; manual full-SDP exchange and STUN only. No room directory, reliable shared results, versioned protocol, identity binding or reconnection. |
| QR | `js/lib/qrcode.js` | Bundled MIT QR encoder. Useful for later invitation links; baseline produces raw connection-text codes, not a room system. Kept but not loaded in the Phase 1 preview. |
| Packaging/docs | `Dockerfile`, `docker-compose.yml`, `LICENSE`, `README.md`, ignore files | MIT copyright is Jeroen Willemsen, 2026. Docker excluded and did not copy LICENSE; Phase 1 corrects the packaging instructions while preserving the exact notice. |
| Automation | Four `.github/workflows/*.yml`, `.github/dependabot.yml`, `renovate.json` | Static Pages publishing, container previews/releases, version bumps and dependency updates. No gameplay test gate. Existing workflows are retained; none was dispatched. Release hardening belongs to pilot preparation. |

## Confirmed baseline online defects

Fresh source inspection established:

1. Both online paths call `initRace(4)` with the default one-human setting: five cars, including an AI controller for the guest's assigned car 1.
2. AI updates run after guest input assignment and overwrite the guest's controls on host.
3. Guest skips physics and also excludes its own car from host snapshots: its car cannot move correctly.
4. Input decoding drops Turbo/shoot, while snapshots omit Turbo, timers, rankings, checkpoint state, projectiles and complete finish results.
5. Each browser runs its own race manager; the finish tag has no sender or application result callback.
6. Start is sent once on an unordered, non-retransmitted channel, without a ready/roster/version handshake or sequence/tick identity.
7. Destroy leaves host/guest roles set. Race Again becomes solo with stale role flags; Back does not cancel pending connections.

The baseline was served and opened freshly from the fork; menu and solo launch worked, and action hit testing failed. The previous audit included a two-browser reproduction at this identical commit. This fresh audit did not repeat a full online race. Do not interpret it as a network reliability sign-off.

## Phase 1 disposition

Retain car drawing/physics, track geometry, normal collisions, keyboard/gamepad input and local splitscreen. Replace the broken checkpoint logic and browser control lifecycle. Extract a small DOM-independent local session module so physics/race rules can later be reused by an authoritative server.

Legacy `js/network.js` remains in source history/current tree for reference but is not imported or offered in the Phase 1 interface. This intentionally avoids advertising broken online racing as functional. Its replacement is Phase 2, which has not started. Local split now has two humans only, consistent with the no-AI-fill rule for races with multiple humans.

Solo ends when its connected human finishes; any AI still racing are explicitly shown as unfinished. An AI may win before the human finishes. Local two-human play waits for both. No elapsed-time cutoff exists. The core supports marking an unfinished human disconnected, but real socket disconnect/reconnection is unimplemented until Phase 2.

## Risks remaining

Real phone handling, iOS Safari, physical controllers, thermal performance and café network behavior need device/venue testing. Browser emulation does not prove these. The local simulation clock freezes during an explicit pause or background interruption and is not a trusted competitive clock. Phase 2 must use server-controlled simulation and lifecycle.

There is no shared leaderboard, storage, account, phone/email collection, location verification, rewards or multi-café infrastructure. A static QR link will not prove physical presence. Public deployment requires approval and an appropriate host for the later stateful server.
