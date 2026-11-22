# GenerateRacer gameplay overhaul

[Play the temporary public build](https://consider-drawing-excerpt-mystery.trycloudflare.com/). On a phone, turn to landscape, enter a nickname and tap Solo Race. The kart accelerates after the countdown. Use the left thumb for steering. Use the right thumb to brake before a corner or spend the current lap’s Turbo on the exit.

## What changed

| Area | Implementation |
| --- | --- |
| Camera | Canvas 2D renders a heading-following, tilted orthographic ground plane. Damping, bounded rotation, steering anticipation and a speed-sensitive lower-screen anchor expose more road ahead. Labels are drawn upright after projection. Physics and inputs use world coordinates in both languages. |
| Circuit | One asymmetric circuit has a long starting straight, an eastern sweeper, linked bends, a tight return and a back straight. Six cars share a 232-unit road. Equal-distance samples drive the racing line, gate placement, curb paint and solid boundaries. Countdown stripes mark braking zones. |
| Handling | All cars drive automatically. A progressive engine curve, smoothed steering and speed-dependent turn radius control corner entry. Tire grip gradually aligns velocity with the nose. Braking removes speed down to zero. Releasing it resumes drive. Turbo boosts acceleration and raises the cap to 1.36× for 1.75 seconds. Each lap still grants one charge. |
| Controls | Four physical racing buttons. Captured independent pointers support simultaneous steering and braking or Turbo, plus release on cancellation, drag-off, blur and rotation. The two steering buttons stay on the left in Arabic and English. Keyboard and gamepad support remain. |
| Contact | Oriented boxes use normal impulses, equal mass and up to four separation passes. Rail contact removes outward velocity and scrubs speed. Low-speed nose-on impacts receive limited steering assistance. The authority timestamps impacts for a short flash, camera response and synthesized impact sound. Reduced motion disables camera shake and flash. |
| Opposition | Five solo drivers preview curvature, plan their braking, use different lines, check passing space, cover the inside when pursued and reserve Turbo for open straights. Timing variation depends on driver and track section. A completed solo result adjusts the anonymous session’s driving-quality estimate for the next race. No distance-to-leader speed modifier remains. |
| Networking | The server retains car ownership, 60 Hz simulation, contact, valid laps and finish order. Snapshots include velocity, steering state and impact events. Remote poses interpolate by server tick. The local client reconciles steering and velocity, blends small position corrections and limits speculative movement during stalls. |

## Playtesting and refinement

The Arabic baseline drive showed a centered camera, densely packed labels and an accelerator competing for thumb space. The first physical simulation pass exposed a different problem. A head-on car could continue creeping backward while the engine was trying to pull it out. Acceleration now contributes velocity in the direction of the nose. The wall recovery test checks forward travel and regained speed. Rail friction makes prolonged scraping costly. The refinement also added braking references and cut the cached circuit from 3000 × 2000 to 2250 × 1500 pixels, about 13.5 MB of raw pixel data.

An initial public run with additional packet jitter reached 120 unacknowledged inputs. A long queue could previously cause the client to simulate too far ahead of a contact. The final client replays up to eight recent ticks and predicts up to twelve ticks ahead while continuing to send current controls. The server decides collisions and standings throughout.

[Baseline landscape](gameplay/baseline-landscape.png) · [Arabic landscape](gameplay/landscape-ar.png) · [English portrait](gameplay/portrait-en.png) · [Short browser driving clip](gameplay/driving.webm). The 12-second clip is an excerpt from the recorded public Arabic solo race in mobile-sized Chrome. The scripted player finished fourth in 52.31 seconds and started a replay from the results.

## Verification

- All 88 Node tests passed with zero failures or skips. They include complete real-WebSocket races for 2, 3, 4, 5 and 6 humans in five concurrent rooms, consistent standings, rematches, DNF and room isolation.
- Physics checks cover progressive acceleration, stopping, release, steering response at different speeds, slip recovery, energy transfer in four contact geometries, six-car compression, wall impacts during Turbo, head-on recovery and identical simulation results when render updates are grouped at 30/60/120 Hz.
- Bot tests include a disturbed heading during a race, clean overtakes of a slower kart at three approach speeds, traffic lane selection, braking, Turbo and three valid laps for all five opponents. A separate replay test checks that the session’s difficulty changes after finishing and remains fixed while racing.
- On the revised handling build, the full bilingual Edge suite passed 140 checks. The public Edge UI suite passed 155 checks. Both included full mixed-language racing. On the final local client, two Chrome contexts registered the same contact at server tick 66 and identical results. They used real multitouch steering/braking and steering/Turbo with added ordered jitter on inputs and snapshots.
- The final full Chrome browser regression passed 160 checks, including complete solo races, replays and multiplayer rematches. The revised per-frame label check also passed in a 139-check local smoke run. The final public Edge smoke passed 137 checks, including six distinct browser racers and the rejection of a seventh. These browser runs captured zero application errors.
- On the public URL, Arabic and English Chrome clients agreed on a physical contact at tick 70, finished all three laps and displayed identical standings. The harness added 33–77 ms of ordered delay to controls and 20–48 ms to snapshots. Both clients reached the 120-input storage ceiling during stalls, while the new speculative pose limit held at 12 ticks.
- The production package passed its HTTP, license, WebSocket and six-car solo smoke test. All 21 public browser assets matched source byte-for-byte and the packaged server modules matched the checkout.

The audit and plan are in commit `fe0fd15`. The implementation and automated checks are in `9d1d243` on `deploy/public-mvp`.

## Performance and limitations

Five headless six-car races per configuration averaged 0.068 ms per solo simulation step and 0.070 ms per six-human step on this Windows host, including scripted test drivers. This measures simulation cost only. Both local delayed Chrome contexts recorded median/p95 animation-frame intervals of about 16.7/16.8 ms. The sample contained about 3,050 frames per client, with approximately 1.05 KB per two-car JSON snapshot before transport overhead.

During the final public delayed race, the median animation-frame interval was 16.7 ms and p95 was 33.0–33.1 ms, measured while other browser checks also ran on the host. Small-correction blend offsets reached about 51–55 world units at p95, around one kart length. This is a measurement of reconciliation under stress. It does not establish a 60 FPS phone guarantee or the worst-case position error.

Mobile viewports and Chromium touch dispatch do not measure physical thumb reach, speaker balance, thermal performance or motion comfort on an iPhone. A physical phone playtest should compare corner entry with and without braking, deliberate side contact and Turbo on a corner exit. Real iPhone/Safari testing and subjective difficulty ratings are outstanding. On a slow link, authoritative corrections remain visible and the view can hold during an extended stall.

The previous tunnel hostname had expired. The replacement forwards HTTPS and WSS to the packaged Node server on loopback port 8086. The host must remain awake and online, with Node and Cloudflare Tunnel running. Rooms and skill estimates live in memory. No paid resources were created.
