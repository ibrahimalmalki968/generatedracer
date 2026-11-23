# iPhone driving hotfix

## Diagnosis and correction plan

Baseline was the clean deployment branch at `1bf2bdb`. A 16-second scripted Chrome drive on the production tunnel at 60 Hz and a local drive at 30 Hz used the actual Canvas transform, vehicle poses, acknowledgement timestamps and authoritative snapshots. Both runs added variable ordered delay. The baselines reproduced backward steps during forward travel, outside a 300 ms impact window, while the corresponding server trajectories had zero backward steps. The public run had four rendered reversals exceeding 0.75 world units, the local run seven. Public p95 camera rotation was 130°/s. These are browser reproductions. They cannot identify the exact packet history on the reported iPhone.

1. The camera rotates toward heading plus steering and moves its vertical anchor with speed. A separate translation injects impact shake. Lock orientation and anchor, use a stable tilted projection, and follow a continuous playout trajectory. Keep the same target while waiting for other finishers.
2. A binary touch reaches 75% steering in 100 ms. At 500 units/s the first quarter-second turns 23.2°. Drifting across the edge of a captured button drops the hold. Ramp turn-in progressively, center faster on release, increase lateral grip, and keep the thumb capture until lift, cancel or loss of capture.
3. The client draws a fixed-step speculative position plus a decaying offset. New snapshots rewind the predictor and replay a variable number of unacknowledged inputs. The authority samples the latest control per tick, so input count is not an authoritative clock. The public p95 before/after prediction reset measured 23.5 world units. Positions and unblended heading on this path also drive the camera. Move all rendered positions onto one continuous server-tick timeline. Keep local steering feedback immediate and bounded. Cap catch-up, invalidate history at race boundaries and handle stalls explicitly.
4. Repeat the trajectories, inspect the recorded footage, tune the first pass, run the Node and browser suites, verify rooms and collisions on the public build, and preserve the previous deployment for rollback.

## Shipped behavior

The oblique camera keeps a fixed angle, zoom and vertical anchor throughout a drive. It translates along the kart’s displayed path. A held steering button turns in progressively and unwinds sooner when released. Holding Brake slows the kart and allows a tighter turn. The larger landscape steering targets retain the same left/right positions in both languages.

The client now draws the whole field between successive server positions on a single clock. Authoritative velocities shape the curve between positions. A small local heading cue of up to 5.7° gives early visual steering feedback. The position buffer targets 5–11 simulation ticks (83–183 ms). This trades some delay before visible travel for continuity during uneven delivery. A long interruption can still visibly stall the field. A gap over 24 server ticks discards obsolete samples and resumes at a confirmed position. Both input prediction and the 60 Hz authoritative race simulation remain in place.

## Measurements

Each drive used a mobile-sized Chrome window, a recorded solo race against five AI and scripted controls, with varying delays added independently in both network directions. The measurements sample the world-to-screen transform when the local kart is actually drawn. Backward steps count rendered displacements exceeding 0.75 world units opposite the prior heading, at speeds above 80 and more than 300 ms after contact. Screen jolt is the magnitude of the change in the kart’s screen displacement between consecutive frames. P95 is the 95th percentile. These short runs used the same test scenario. Network timing varied between runs.

| Drive | Backward steps / eligible frames | Camera rotation, p95 | Screen jolt, p95 | Input acknowledgment, p95 |
| --- | ---: | ---: | ---: | ---: |
| Previous local, 30 FPS | 7 / 434 | 130.2°/s | 4.358 px | 213 ms |
| Hotfix local, 30 FPS | 0 / 444 | 0°/s | 0.145 px | 226 ms |
| Previous public, 60 FPS | 4 / 874 | 130.0°/s | 3.475 px | 268 ms |
| Hotfix public, 60 FPS | 0 / 882 | 0°/s | 0.040 px | 239 ms |
| Hotfix public, 30 FPS | 0 / 454 | 0°/s | 0.144 px | 363 ms |

No corresponding backward steps appeared in the authority measurements in any of these drives. Final local 60 FPS also recorded zero in 883 eligible frames and 0.048 px screen jolt. On the public hotfix, median render intervals were 16.6 ms and 33.2 ms for the 60/30 FPS runs. Snapshot arrival intervals reached 87 and 115 ms at p95. Server time advanced by a median 17 ms per tick in both public runs. Predictor resets still measured 15.9 and 22.4 world units at p95. Keeping those resets out of displayed positions removed the recurring reversal in these traces.

A full steering press starting at 500 world units/s previously turned the kart 6.5° in 100 ms and 23.2° in 250 ms. With the hotfix it turns 1.7° and 10.9°. At 160 units/s the new values are 2.3° and 14.4°, giving braking a practical role on tight corners.

## Visual review and tuning

The first revision held the camera angle and eliminated the measured reversals, but p95 screen jolt was still 4.92 px at 30 FPS and 3.33 px at 60 FPS. The refinement aligned the camera and kart to the same animation timestamp, reduced relative camera lag and used a variable buffer with velocity-aware interpolation. The final recordings show the road holding its orientation through bends while the kart turns. These are ten-second excerpts from desktop Chrome with a landscape mobile viewport. [Previous public drive](gameplay/comfort-before.webm) · [Hotfix public drive](gameplay/comfort-after.webm)

## Verification and reproduction

- All 95 Node tests passed, with zero skips. Coverage includes steering response and release, braking while steering, 30/60/120 Hz continuity, camera invariance, stale and exceptional positions, collision recovery, lap/Turbo rules and room isolation.
- Local Chrome passed 160 gameplay checks. Local Edge passed 140 bilingual checks including Arabic and English solo races and a mixed-language private race. Public Edge passed 155 interface and recovery checks. These runs recorded zero application errors.
- Two Chrome clients drove three laps locally and publicly with simulated delay. The public clients recorded the same contact on tick 71 and agreed on both finishing times and positions. Browser-generated simultaneous touch contacts exercised steering with Brake and Turbo, dragging across the button edge, release and cancellation.
- All 34 public WebSocket checks passed. Simulated human clients drove complete races with 2, 3, 4, 5 and 6 humans. The suites compared standings on all clients, ran two rooms concurrently, verified Turbo limits, and finished a same-room rematch after one racer disconnected.
- The public health endpoint returned HTTP 200. All 22 public assets matched the release source byte for byte.

Run `npm test` for the automated suite. Run `node tools/motion-check.mjs` for a browser trajectory and `node tools/driving-check.mjs` for the two-player touch/contact journey. The motion check accepts `FRAME_RATE=30` or `60`, `CHECK_COMFORT=1`, `VIDEO=1`, `EVIDENCE_DIR` and an optional `BASE_URL`. Use a separate output directory per run.

## Release and phone check

The gameplay commit is `1569f43` on `deploy/public-mvp`. The pre-hotfix rollback point is `1bf2bdb`. To restore gameplay on the same branch while preserving history, revert the gameplay commit, rebuild with the project’s production build command and restart the packaged server behind the tunnel. Restarting the game server clears active rooms.

[Open the temporary public preview](https://converter-regulation-text-vendor.trycloudflare.com/). The host computer, server and tunnel must remain running. On a physical iPhone, reload once and try a short steering tap, a held turn with Brake, Turbo on a straight and a corner near another kart. Thumb comfort, motion sickness and frame pacing on iOS Safari still require real-device playtesting.
