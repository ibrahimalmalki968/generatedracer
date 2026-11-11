# UI/UX transformation — implementation and verification

11 November 2026 · `deploy/public-mvp` · baseline `c23cdaf`

## Delivery

The complete player journey has been redesigned in the existing application. Arabic remains the default, English remains supported, and the always-visible language control retains live switching and local preference. The planned work was documented and committed before implementation; no design approval pause was introduced.

The visual system is **Midnight Circuit**: graphite surfaces, retained lime racing accent, cyan connection state, consistent SVG icons, readable Arabic typography, clear hierarchy and restrained event-driven motion. Full-screen phone surfaces replace the repeated floating form panel. See [plan](UI_UX_TRANSFORMATION_PLAN.md) and [reusable design system](DESIGN_SYSTEM.md).

| Journey/surface | Implemented improvement |
| --- | --- |
| Loading/welcome | Branded loading fallback/reload link, optimized kart artwork, clear premise and nickname task, associated validation, readable input/Continue, quieter help/splitscreen/attribution |
| Main menu | Distinct Solo/Multiplayer blocks, clear mode descriptions and racing icons, concise rules rail, change-name navigation; both modes remain above fold on supported sizes |
| Solo | Existing one-tap automatic private session, five AI, countdown, results and direct replay retained; no manual room screens introduced |
| Discovery | Prominent Create/code task launchers, purposeful empty state, room occupancy indicators, real server availability, disabled unavailable Join, public/private forms and immediate error semantics |
| Lobby | Colored avatar initials, safe mixed-script names, Ready badges/pressed state, ready-count meter, actual next player to wait for, explicit Cancel ready action, visible invitation sharing |
| Invitations | Web Share API with exact existing invitation URL; cancellation is quiet; unsupported/denied share falls back to copy; denied clipboard opens/selects the manual link |
| HUD | Position dominates; compact lap/timer/speed, three lap segments, own-driver identity, separated menu rail, legible Turbo availability/use/active states |
| Controls | Consistent SVG steering/pedal icons, accelerator/brake labels, stable physical order, larger deliberate thumb targets and pressed feedback; pointer capture and input behavior unchanged |
| Countdown/feedback | Three start lights and numeral pulse driven by the existing server deadline; semantic lap/finish announcements and a brief Turbo/lap pulse |
| Pause | Strong Resume/Leave hierarchy; online text explicitly says the race continues; contained keyboard navigation with language/recovery access, Escape resumes |
| Results | Winner name/trophy hierarchy, personal finish position, highlighted own row, clear DNF/time/best-lap text; standings scroll separately from actions, two-column short-landscape presentation |
| Recovery | Localized persistent explanation, Dismiss, invalid-field association and relevant reconnect action; reconnect disappears after actual recovery and never appears merely for an empty nickname |

## Engineering boundaries

`js/ui.js` owns reusable icons, button-label updates, native sharing, screen focus and dialog navigation. `js/lobby.js` remains the server-confirmed entry/lobby controller. `js/hud.js` caches/diffs telemetry and only triggers feedback on semantic changes. `js/main.js` composes presentation without altering simulation. `game.css` owns tokens/component/responsive/motion rules. Paired dictionaries now contain **194 keys**.

There are no new dependencies/frameworks/fonts, accounts, backend service, persistence, rewards or gameplay systems. Decorative artwork is a 44,932-byte WebP; the build includes it, and the HTTP whitelist permits only this named asset. No development directory/source exposure was added. CSP/origin checks remain enforced. MIT LICENSE and original attribution are preserved.

Car physics, track geometry/rendering, AI, input capture, lap gates, Turbo grants, prediction/reconciliation, room ownership/validation, authoritative simulation and results order remain the existing implementation. Solo has five AI; multiplayer has 2–6 humans without AI fill, three laps, one Turbo per lap, no weapons or race time limit. New UI never supplies client-reported laps or standings.

One narrowly scoped reliability adjustment was justified by public QA: a regular client sending at a measured peak of 61 input messages/second was closed by the old 120-message burst allowance after transport delivery. Burst allowance is now 240; sustained rate remains 75/sec, expensive lobby commands remain 12-burst/4-per-second, max payload remains 4096 bytes, and all identity/race/sequence/room checks stay in place. The plausible cause is delayed/coalesced delivery through the temporary proxy; the exact transport cause is not established. A new actual-WebSocket test accepts a bounded 180-input delivery burst, retains own-car input and consumes Turbo only once. Existing malformed/flood/unauthorized-input tests still apply. This is not a claim that arbitrary stalls or unlimited traffic are supported.

## Visual QA and refinement ledger

Browser plugin/skill was unavailable. The repository's installed Playwright drove real Chrome and Edge. Screenshots were saved outside the repository and opened with `view_image`; generated concept boards and actual browser images were directly compared. References are `../ui-ux-design/entry-modes-lobby-concept.png` and `discovery-hud-results-concept.png`. Before images are `../ui-ux-before/`. Final evidence directories are listed below. Phone screenshots are captured at CSS native 390×844; additional 320×568, 844×390 and 1280×800 views verify responsive equivalents of the concept board. The reference board itself is a three-screen composition, not an application viewport.

| Comparison | Evidence/finding | Repair or intentional decision |
| --- | --- | --- |
| Hierarchy/layout | Baseline tiny text and uniform floating panel; reference distinct welcome/modes/lobby | Full-screen shell, 28–38px headings, generous but bounded spacing, strong mode blocks |
| Palette | Reference dark graphite + lime/cyan | Shared exact CSS tokens; no arbitrary gradient/glass layer; contrast pairs tested |
| Typography | Arabic needs more line height; Latin and mixed names differ in direction | Arabic-capable system fonts, natural Arabic tracking, BDI/auto names and LTR identifiers |
| Controls/icons | Reference consistent motorsport line icons, baseline generic triangles | Shared SVG family, fixed physical control direction, labels and held feedback |
| Artwork | Reference menu kart/track, existing game has simpler Canvas art | Generated matching menu art only; original track/car art and geometry intentionally retained |
| Motion | Initial screenshot during fade showed dim content | Removed opacity fade from arrival; short transform-only transition retains clear first paint |
| Focus | Programmatically focused headings had an unwanted native rectangle | Heading-only outline reset; high-contrast rings retained on actual controls |
| HUD geometry | Player identity initially overlapped Menu | Separate absolute rails; hit-tested portrait/landscape sizes in both languages |
| Small-screen modes | Decorative skew added 3px scroll width | Inset motif; narrowed/shortened mode composition, both actions stay visible |
| Results | Sticky actions covered standings at short heights although generic layout checks passed | Separate scrollable standings/action regions; two-column short landscape; added explicit region non-overlap assertion |
| Replay countdown | A new countdown could retain Finished/time/Turbo values until its first car snapshot | Explicit presentation-only HUD prepare/reset, with direct rematch-countdown browser assertions |
| State/feedback | Reconnect could appear on initial validation or remain after success | Relevant error-code gating and current connection state drive recovery availability |

Above-the-fold copy is drawn from the existing localization keys and the documented new welcome/readiness/share/recovery/finish labels. No unimplemented product claims, metrics, accounts, currency, rewards or persistent rankings were added. Generated reference mistakes/inventions were intentionally omitted: English “Midnight Circuit” subtitle, incorrect ready counts, fake race times, extra kart markings and any suggestion that the real track became an oval. Native Arabic/English functional copy, actual names and server state take priority. Welcome retains optional local splitscreen/help and original credit even where the concept simplified those details. The implemented visual direction was checked against the references for composition, hierarchy, palette, typography, spacing, artwork and icon consistency; intentional differences are described here rather than claiming pixel identity to generated mockups.

## Screenshot delivery

Representative evidence is included in `docs/ui-ux/` (about 268 KB total, excluded from runtime serving/build). These are actual browser captures, not mockups. The before images are baseline Chrome; final after images are public Edge at 390×844. User-entered test nicknames remain literal.

| Surface | Before | After |
| --- | --- | --- |
| Welcome | [Arabic baseline](ui-ux/before-welcome-ar.png) | [Arabic redesign](ui-ux/after-welcome-ar.png) |
| Main menu | [Arabic baseline](ui-ux/before-menu-ar.png) | [Arabic redesign](ui-ux/after-menu-ar.png) |
| Lobby | Full baseline set retained in workspace | [Arabic redesign](ui-ux/after-lobby-ar.png) |
| Racing | Full baseline set retained in workspace | [Arabic HUD](ui-ux/after-hud-ar.png) |
| Results | Full baseline set retained in workspace | [English standings](ui-ux/after-results-en.png) |

The larger raw evidence sets include both languages and narrow/landscape captures for each major screen. Screenshots and `report.json` are in workspace outputs `ui-ux-before`, `ui-ux-responsive-chrome`, `ui-ux-public-rematch-chrome`, `ui-ux-public-rematch-edge` and `ui-ux-public-bilingual-{chrome,edge}-release`. Reports are generated development evidence, not a public admin interface.

## Verification

Final completed release verification: **73 automated tests**, **134 redesigned public UI checks each in Chrome/Edge**, **128 full public bilingual checks each**, and **150 full public English regression checks in Chrome**; all passed. Initial local full English regression passed **152 each in Chrome and Edge**. Build/runtime package smoke passed (HTTP, WSS, named artwork and unchanged license), and the runtime dependency audit reports zero vulnerabilities. The final public black-box socket suite also passed **34 checks**, including full physical 2/3/4/5/6-human races, isolated concurrent rooms, capacity/unauthorized controls and a DNF rematch. No final completed suite had failures/skips or captured app errors/missing keys. The public English suite omits the two assertions that inspect an owned local server; those are not skipped remote test cases. See TEST_RESULTS.md for raw paths and scope. Intermediate evidence is retained; failed attempts are not counted as passes. The test harness uses real socket messages and physical three-lap simulation driven by controller inputs, not fabricated lap/result state. Native share/clipboard outcomes are stubbed for deterministic success/cancel/denial coverage; this does not establish that an iPhone's native share sheet was tested.

Coverage includes Arabic default/saved English, live switching in menu/lobby/countdown/held driving/pause/results, all new translation bindings, private invitations/public discovery, same-room rematch/Ready reset, physical solo and multiplayer racing, disconnect/DNF and recovery. UI checks cover loading artwork, nickname/code validation, no horizontal overflow/clipped labels, ≥44px controls, focus/dialog navigation, reduced motion, five touch-HUD viewport sizes and separate results/action geometry. Both languages have welcome, modes, discovery, creation, lobby, countdown, racing, pause, results and error screenshots. The first refinement pass and subsequent responsive review identified and repaired real issues, not merely assertion failures.

Intermediate failures: a test checked server validation/Ready reset before the relevant client had received the state; it now waits for that client's acknowledged state. A share test's mock property was accidentally non-writable and could not be changed between success/cancel scenarios; the mock was fixed, without altering real native-share semantics. A fractional subpixel target measurement now allows a 0.1px geometry tolerance. After viewport/other-page checks, the held-key test explicitly brings the driving page to the foreground and clears text-field focus: the application intentionally releases input on blur. The substantive visual results-overlap issue and public burst-limit closure are described above. None of those failed runs should be presented as successful verification.

## Changed-file inventory

| Area | Files |
| --- | --- |
| Shell/design | `index.html`, `game.css`, `assets/menu-kart.webp` |
| Presentation/controllers | `js/ui.js`, `js/lobby.js`, `js/hud.js`, `js/main.js` |
| Bilingual copy | `shared/translations.js` (194 paired keys) |
| Production | `server/static.js` named artwork/MIME, `server/server.js` bounded burst allowance, `tools/build.mjs` asset packaging, `tools/verify-build.mjs` image budget/HTTP check |
| Verification | `tests/ui.test.mjs`, `tests/localization.test.mjs`, `tools/ui-ux-check.mjs`, `tools/localization-check.mjs`, `package.json` test:ui command |
| Documentation/evidence | README, this report, transformation plan, DESIGN_SYSTEM, ARCHITECTURE, DEPLOYMENT_GUIDE, PROJECT_STATUS, PUBLIC_DEPLOYMENT, TEST_RESULTS, KNOWN_ISSUES and seven actual screenshots in `docs/ui-ux/` |

## Git and operation

- `ae89b51`: audit/plan committed before implementation.
- `24ea4d9`: complete design system, screen/HUD/mobile transformation, sharing/focus/recovery, tests and menu asset.
- `7267e14`: short-screen results refinement, expanded visual regression and design-system documentation.
- `a8f1afa`: bounded delivery-burst tolerance and foreground keyboard-driving verification.
- `b46faa0`: final 16px invitation text, attribution targets and inactive race-status accessibility.
- `bf151d1`: countdown presentation clears previous finish/lap/timer/Turbo values, verified in both public browsers.
- Final verification/documentation commit is recorded in Git history and the handoff report.

Existing public preview: **https://brian-desired-theology-bath.trycloudflare.com/**. The production-mode Node process was restarted in a controlled way and the same cloudflared process/URL was retained. Local full app: http://127.0.0.1:8081/; current Wi-Fi URL http://192.168.100.206:8081/ (different-device reachability unverified). `npm start` runs the complete local app; `npm run test:ui` runs the new UI flow checks; `npm run build` packages the frontend/asset/authoritative server together. No Render service, paid resource, main merge, upstream modification or firewall change was made.

## Remaining limits and recommendations

No physical iPhone/Android/Safari, actual native mobile share sheet, screen reader, virtual keyboard, notch/home-indicator, battery/thermal or older-phone performance testing was performed. Emulated viewport, touch, reduced-motion and keyboard checks are evidence only for those automated environments. Desktop system Arabic font rendering can differ on phones. Local storage belongs to the current origin. Narrow/short menus and full standings intentionally scroll; the track and driving controls never mirror or scroll.

The temporary tunnel still requires this computer and both processes to stay running; it is not durable hosting or an Internet capacity guarantee. Delays/stalls beyond bounded burst tolerance and the earlier high-concurrency transport closures remain deployment risks. Closed race connections become DNF and cannot reclaim that car after reconnection; the existing integrity rule is preserved. Before a café pilot, open this exact game on actual phones, test touch/font/safe areas/native invitations and two/six-person races with rematches. No account, leaderboard or future business feature is needed for that validation.
