# GenerateRacer — Café Racing

A mobile-first adaptation of [GenerateRacer](https://github.com/commjoen/generatedracer) by Jeroen Willemsen. Native JavaScript modules and Canvas 2D, no build step and no runtime dependencies in Phase 1.

## Current milestone: Phase 1

- Solo racing with five AI opponents.
- Optional two-human local keyboard splitscreen, with no AI filling empty slots.
- Exactly three laps, ordered directional checkpoints, normal racing collisions.
- One Turbo use per lap, maximum three; no stacking, pickups or timed recharge.
- No weapons or weapon effects.
- Touch steering, gas/brake, Turbo, responsive HUD and bounded canvas resolution.
- Keyboard/gamepad support, local pause/resume and clean replay.
- Every connected human can finish; an AI finishing first does not stop solo play.
- No race time limit. In solo, results appear when the human finishes; AI not yet finished are labelled unfinished.

This is a local gameplay preview. Online racing is not offered yet. The old WebRTC module is retained for reference but is not loaded by the game. Its replacement, rooms, nickname entry and same-room rematches are subsequent milestones. No accounts, leaderboard, persistent storage, access enforcement or game server have been added.

## Preview and tests

Node 22+ is sufficient; no `npm install` is needed.

```sh
npm start
npm test
```

The static preview listens at http://127.0.0.1:8081 by default. `HOST` and `PORT` can override its bind address for deliberate local-network testing. It is a development server, not the future authoritative multiplayer server. It only serves the game's static files and license.

The engineering agent starts the preview when working on this project; users can open the supplied link directly without running commands.

## Controls

| Input | Drive | Turbo |
| --- | --- | --- |
| Touch | Hold left/right, accelerate, brake/reverse | Tap TURBO; one use per lap |
| Keyboard solo | Arrows or WASD | E or L |
| Local split P1 | WASD | E |
| Local split P2 | Arrows | L |
| Gamepad, solo/P1 | Stick or D-pad, RT/LT or D-pad gas/brake | A |

Brake overrides gas. Pointer capture keeps simultaneous controls independent and clears them on cancel/release. Local play pauses on app switch/blur; Resume continues the same local race. Escape also pauses/resumes. Online interruption behavior will be server-controlled in Phase 2, not a pause of the entire room.

## Source layout

- `js/main.js`: browser lifecycle, countdown, menus and Canvas rendering.
- `js/simulation.js`: local car roster and physics/AI/race orchestration, no DOM.
- `js/car.js`, `js/track.js`, `js/ai.js`: reused and adjusted physics, drawing, spline track and AI.
- `js/race.js`: ordered directional gates, simulation clock, laps, finish ordering and results.
- `js/input.js`, `js/hud.js`: controls and responsive feedback.
- `tests/`: Node built-in test suite; no test framework dependency.
- `tools/serve.mjs`: development static server only.
- `js/network.js`, `js/lib/qrcode.js`: legacy networking/QR reference, not loaded in this preview.

## Documentation

- [Fresh project audit](docs/PROJECT_AUDIT.md)
- [Confirmed MVP roadmap](docs/MVP_ROADMAP.md)
- [Phase 1 verification report](docs/PHASE_1_REPORT.md)
- [Phase 2 networking proposal](docs/NETWORK_ARCHITECTURE.md)

The confirmed MVP will have public/private rooms, anonymous nicknames, 1–6 humans, a unified lobby, explicit solo start, multiplayer readiness, locked active races and same-room rematches. Multiplayer races with 2–6 humans never receive AI. Future features such as accounts, statistics, rewards and leaderboards are outside MVP.

## Packaging and release

Existing nginx Docker/Compose and GitHub workflows are retained. Docker now copies the unchanged MIT license into the static distribution. Container build verification requires a running Docker engine. Public deployment, paid hosting and automatic pushes to main are not authorized. The old workflows can publish on main/tag pushes; review pilot release gates before using them.

## Attribution and license

Original project: [commjoen/generatedracer](https://github.com/commjoen/generatedracer).
Original copyright: **Copyright (c) 2026 Jeroen Willemsen**.
This adaptation remains under the [MIT license](LICENSE). Retain that full notice and the bundled QR code's MIT header in distributions.
