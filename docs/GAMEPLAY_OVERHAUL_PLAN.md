# Gameplay overhaul

## Baseline
Inspected deployment branch at d684d90. Drove the Arabic solo build in landscape Chrome at 844 × 390 using the real server and captured the grid (work/before-drive.png). A short right input turned the car while the camera continued to show a largely horizontal strip of track. AI pushing from behind moved the untouched player. Name labels crowded each other on the grid. The separate accelerator and stacked Turbo occupied the right thumb area. The brand bar and HUD used much of the shallow landscape view.

Canvas 2D renders a flat, north-up view with per-frame spline strokes and a centered, lagged target. The original symmetrical control polygon offers few distinct corner sequences. Curbs are painted outside the road, grass is a speed cap, and there is no barrier solver. Scalar speed follows body heading instantly. Holding the brake can reverse. The circular collision solver exchanges speed even when cars are separating and skips coincident centers. Bots converge on one waypoint, apply a gap-based speed target and have no traffic plan. Node runs fixed 60 Hz steps, assigns slots and validates ordered gates. The local client replays unacknowledged inputs and interpolates the last pair of 20 Hz snapshots. Shared physics and this ownership boundary are suitable.

## Implementation sequence
1. Introduce a damped heading-follow Canvas ground projection, vertical foreshortening and speed-sensitive forward framing. Project labels into screen space. Respect reduced motion. Cache static circuit drawing.
2. Shape one circuit with a start straight, sweeper, linked bends, braking hairpin and passing straight. Use a common distance-sampled centerline for gates, markings, barriers and AI. Preserve valid grid and world coordinates.
3. Integrate forward auto-drive, smooth steering rack, speed-sensitive yaw, braking to rest, slip/grip and progressive Turbo. Retain fixed step and use the same dynamics for prediction.
4. Remove the accelerator, update the four bilingual controls and instructions. Check independent pointers, release/cancel, orientation and desktop controls.
5. Use oriented contact shapes and equal-mass normal impulses with bounded separation, wall sliding and recovery. Report impact feedback from authority. Bound camera and audio responses.
6. Give each AI a distinct line, preview curvature, braking target, traffic lanes, straight-line Turbo and recovery. Keep vehicle limits identical. Update an anonymous session driving-quality estimate only after completed solo races.
7. Reconcile all dynamic state, smooth small pose corrections and keep standings authoritative. Check 2–6 clients and delayed contacts.
8. Run physical races, unit/integration and mobile browser suites. Inspect frames, measure frame intervals and simulation cost, refine handling or framing based on observations. Build and smoke-test the release and verify the free public tunnel.

## Release checks and risks
- Auto-drive from rest, monotonic braking to zero, finite slip, useful low-speed steering, bounded Turbo and wall recovery. Compare fixed-step runs under 30/60/120 Hz rendering.
- Contacts separate even coincident cars and do not add kinetic energy. Check rear, side, angled, pack and boosted impacts. Ensure corrected positions remain inside the circuit.
- All five bots can drive three ordered laps. Observe different lines, traffic decisions, braking and Turbo with the same car dynamics. Session adaptation must remain fixed during a race.
- Exercise actual WebSockets for each allowed count, delayed inputs, standings agreement, isolation, DNF and rematch. Watch for missing prediction fields and stale collision feedback.
- On mobile-sized browsers, verify four independent controls, camera direction, labels, landscape and portrait in Arabic/English. Capture driving evidence. Measure desktop emulation separately from phone hardware.
- Preserve existing menus and room flow. Do not count automated driving as a human assessment of comfort, fun or difficulty. A temporary tunnel depends on the local machine and network.
