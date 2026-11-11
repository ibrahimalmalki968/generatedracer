# GenerateRacer UI/UX transformation plan

11 November 2026 · baseline `c23cdaf` · branch `deploy/public-mvp`

## 1. Assessment and evidence

The checkout is clean and matches the reported bilingual MVP. One HTML document, Canvas renderer, native JavaScript controllers, shared translations and authoritative Node/WebSocket server remain the right architecture. Physics, track, input capture, prediction, server validation and room lifecycle are outside the visual redesign. MIT attribution stays intact. No framework, database, paid service or Render deployment is needed.

Baseline Chrome screenshots were captured at 390×844 in `../ui-ux-before/`: welcome, modes, browser, creation, lobby, countdown, race, pause and results. Existing full bilingual browser regression is rerun before changes. Browser plugin/skill is absent; use the project's installed Playwright with actual Chrome and Edge. Screenshots and raw reports stay outside committed source.

Observed problems: an almost empty green backdrop and one identical floating rounded panel for every task; captions as small as 10–11px; weak distinction between primary actions and secondary navigation; room creation/code joining buried in low-emphasis disclosures; player lists lack identity and readiness hierarchy; invitation action hidden; redundant leave/menu controls; long explanatory paragraphs instead of concise state/progress; a tiny connection label detached from the current task; HUD spends substantial top space on the language picker and three equally weighted boxes; buttons use inconsistent physical symbols; no state-change feedback; no managed focus or dialog focus containment. Arabic is functional but reads like translated form panels rather than an intentionally Arabic game.

## 2. Journey and information architecture

Welcome/nickname → mode choice → one-tap Solo countdown OR Multiplayer room browser → create/join → shared lobby → all-Ready countdown → race → standings → replay/same-room lobby or main menu. Invitation links retain their direct welcome → invited lobby path. Optional local keyboard splitscreen remains in a quiet entry disclosure. No extra onboarding, account, reward or administration screens.

Each screen communicates its current task with one large heading, one primary action, and an obvious secondary way back. Public discovery stays live. Room forms remain disclosures but are promoted to large, visible task launchers and automatically scroll into view when opened. No navigation may mutate server state until the existing server acknowledges it.

## 3. Visual direction and reusable design system

**Midnight Circuit:** motorsport precision with a graphite full-screen shell, retained electric lime racing accent, crisp warm-white type, cyan connection state and restrained gold winner treatment. No glassmorphism, random gradients, fabricated metrics or decorative dashboard widgets. Brand remains GenerateRacer.

Tokens: background `#0b1018`, surface `#151e2b`, raised `#1c2838`, text `#f4f7fa`, muted `#aab8ca`, line `#344358`, accent `#dcff64`, cyan `#83e3ee`, warning `#ffbd78`, danger `#ffb0a7`. Spacing 4/8/12/16/20/24/32; radius 10 controls, 16 surfaces, pill status; minimum 44px targets, principal actions 56px. System Arabic-capable Segoe UI/Tahoma/Arial; Latin brand/large numbers use Bahnschrift/Arial Black where installed. Body 16px, helper minimum 13px, secondary HUD 11–12px, Arabic generous line height, no Arabic tracking. Bold headings 28–38px with deliberate mobile wrapping.

Reusable families: app masthead/language segment, screen header/back action, primary/secondary/quiet buttons, input fields, task disclosures, room rows, avatar/player rows, semantic status badges, readiness meter, invitation strip, HUD telemetry, progress segments, winner block, result rows, toast/recovery bar. SVG icons share 24×24 viewBox, 1.8–2px rounded strokes, currentColor and hidden semantics. Directional navigation icons mirror with UI direction; racing icons/controls never mirror.

Built-in Image Gen supplies a coordinated welcome/mode/lobby reference and a small kart/track menu artwork. UI text and controls remain native code. Intentional scope exception: existing Canvas track/car artwork is retained, preserving geometry, performance and the current racing identity; no art-driven collision/physics changes. Generated artwork is decorative menu-only, with fixed dimensions and a matching dark background, no text baked into it. If generating an image fails, proceed with code-native racing motif and record the limitation; do not add a paid API.

## 4. Screen specifications

| Screen/state | Redesign and behavior |
| --- | --- |
| Initial loading | Dark brand shell, localized loading status, immediate HTML fallback if modules fail; no blocking artificial delay. |
| Welcome | Brand masthead, compact kart artwork, clear game premise, large nickname field/Continue, inline invalid state, entry guidance, quieter help/splitscreen/attribution. Keyboard does not obscure the submit action: scrollable screen with focus scroll margin. |
| Main menu | Brand continuity, greeting, large lime Solo action with racing icon, substantial dark Multiplayer action; concise 3-lap/Turbo rule rail; change-name quiet. Both modes visible at 320×568 and short landscape. |
| Room browser | Clear back navigation, heading, public list with availability and six-slot occupancy indicators; intentional empty state; large Create/code launchers with clear selected/open state; live refresh feedback. |
| Create/join | Large labels and controls, clear public/private explanations, code input LTR/uppercase, pending feedback and field-local error semantics; disclosures prevent unnecessary screens. |
| Lobby | Room name/privacy/count; colored avatar initials and isolated nickname, Ready badges; ready-count meter and explicit reason to wait; prominent Ready/Start; visible invitation/share strip plus code/link detail/copy fallback. Leave and main-menu remain available but subdued. |
| Countdown | Large numeral, three start lights, localized starting text, concise mode/rule hint; cancellation clearly distinct; only existing authoritative deadline drives timing. |
| Race HUD | Position visually dominant, compact lap and elapsed timer, quieter speed, three lap-progress segments, player identification. Safe-area masthead/language picker separate from telemetry. Turbo charge/use state with an activation pulse, meaningful once-per-lap caption. |
| Mobile controls | Physical left/right preserved, 56–72px steering, clear brake/accelerator icons and labels, stable thumb zones, Turbo above accelerator clear of controls; held/pressed appearance, pointer capture unchanged. |
| Pause | Strong pause/resume hierarchy; online explicitly says race continues and leaving is DNF. Dialog keyboard focus contained, Escape resumes, inactive/background input neutralization preserved. |
| Finish/wait | Existing authoritative finish notice; lap/finish announcements and restrained HUD pulse. Finished racer does not collide; remaining racers continue without time limit. |
| Results | Winner/cup treatment with isolated nickname, emphasized human/self rows and ordinal hierarchy, clear time/best/DNF, replay or same-room return primary, menu secondary; no fake prize or persistent ranking. |
| Offline/errors | Localized plain explanation, visible recovery action when helpful, persistent until resolved/dismissed; error field focus/aria-invalid; retained server codes/security. Connection state never covers driving controls. |

## 5. Mobile, RTL/LTR and accessibility

Arabic-first logical margins/alignment; root dir follows locale, nickname `bdi`/auto, room codes/URLs/timers LTR isolate. No hardcoded new player copy: expand shared paired dictionaries and test every binding. Language switches in every state without commands, disconnect, race reset or cleared inputs. English same component structure, proper LTR and mirrored navigation only.

Phone layouts 320/360/390/412px, short 844×390 landscape and 1280×800 desktop. Full-bleed phone screens with bounded content width, not giant floating outer card. Wide screens use more deliberate horizontal menu composition where helpful. Scroll only menus/panels; never racing. Safe-area top/left/right/bottom, `dvh`, readable 16px inputs to avoid iOS focus zoom. No forced orientation. Maintain original splitscreen.

Focus-visible high contrast rings; semantic headings/lists/forms; field errors `aria-invalid`/describedby; polite status updates and assertive genuine errors; dialog focus containment and focused entry on navigation; no 60Hz live region announcements. Use readiness/status text as well as color. Decorative icons hidden. Reduced-motion removes transitions/pulses. Optional haptics are omitted unless real-device validation is available; the UI must not depend on vibration.

## 6. Motion, feedback and performance

120–200ms button/screen transitions, transform/opacity only; 240ms countdown pulse only on changed numeral, no per-frame animation restart; short lap and Turbo emphasis only on semantic state changes; ready status transitions; single restrained result reveal. No continuous particles, blur/backdrop-filter or extra full-screen Canvas effects. Zero new runtime dependencies; decorative image optimized and only requested by menu. HUD text writes are diffed; race logic, snapshot rates and render loop unchanged. Menus must remain static when idle.

## 7. Implementation sequence and ownership

1. Commit this audit/plan before product implementation; concept reference, then design tokens/native SVG primitives and app shell.
2. Welcome/modes, discovery/forms, lobby readiness/invitation sharing; central localized copy.
3. HUD/controls/countdown/pause/results; presentation-only UI state/focus/feedback module separated from networking and simulation.
4. Recovery/accessibility/responsive refinement; rerun UI tests and dedicated visual review against concept.
5. Full automated/bilingual/English browser suites Chrome+Edge, build and security asset checks; controlled production restart only if needed, test existing public URL, push verified branch. Commit meaningful milestones; no main/upstream merge.

## 8. Before → after improvement matrix

| Priority | Before | After | Evidence/acceptance |
| --- | --- | --- | --- |
| P0 | Small, undifferentiated game telemetry | Glanceable position/lap, clear Turbo and thumb controls | Screenshots, control hit testing/held inputs at 5 phone sizes |
| P0 | Readiness is a name and tiny status | Identity rows, ready count/meter and explicit next action | 2–6-human suite, mixed-language lobby/countdown |
| P0 | Invite buried and copy-only | Visible Share action; native share with copy/manual fallback | Stub success/cancel/failure paths, real clipboard where permitted |
| P0 | Form-like mode choice | Two unmistakable mode actions, one-tap Solo retained | Existing mode journey and viewport geometry |
| P1 | Tiny helper copy and empty margins | Arabic-first readable scale, consistent rhythm and full-screen shell | Arabic+English screenshot review, no clipped text |
| P1 | Errors detached from affected input | Field association + persistent localized recovery | Invalid nickname/code, offline and language-switch tests |
| P1 | No managed keyboard/dialog focus | Focus on screen change, contained dialogs, Escape/resume | Keyboard tests and screenshot focus review |
| P1 | Plain results list | Winner hierarchy, self status and clear replay/rematch | Full physical three-lap races and repeated rematch tests |
| P2 | Abrupt status changes | Restrained event-driven feedback, reduced-motion support | Transition/state tests, reduced-motion emulation |
| P2 | Generic menu background | Shared motorsport identity and lightweight menu art | Concept/render comparison and asset/build checks |

## 9. Acceptance and verification

All baseline rules remain: solo five AI, multiplayer humans-only 2–6, exactly three laps/no time limit, once-per-lap Turbo, no weapons, room locking/authority/disconnect/results/rematches and independent rooms. No server security weakening or client-authoritative claims. Existing tests must pass; add targeted UI tests for sharing, focus, live state feedback, mobile geometry and localized bindings.

Capture before/after welcome, modes, browser, creation, lobby, countdown, HUD, pause, results, errors in both languages. Inspect actual images, not only DOM. Review hierarchy, palette, typography, spacing, artwork, icon consistency, contrast, thumb targets, RTL/LTR, safe areas. Dedicated second refinement pass records mismatch → repair in implementation report. Automated viewport hit testing, no horizontal overflow, controls ≥44px, both mode buttons above fold at supported sizes. Check reduced-motion and keyboard focus. Test real WebSocket journeys via existing browser automation (physical AI-driven test inputs, not fabricated race results). Run `npm test`, both full regression browser suites, both full bilingual suites, production build verifier and public UI smoke. If full reruns are limited, state exact scope and unverified items.

Public preview remains the existing Cloudflare tunnel, no Render work. Verify HTTPS health/assets and actual WSS/browser journeys after update. Temporary hosting depends on this computer; actual iPhone/Safari and physical multi-phone testing are not available and must never be claimed. Document measured tests, commits, screenshot evidence, intentional differences from reference, remaining risks and exact preview URL in UI_UX_IMPLEMENTATION_REPORT.md.
