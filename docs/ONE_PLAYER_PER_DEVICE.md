# One player per device

Product change after `ff71b5a`: local shared-device racing is completely removed. The only entry actions are Solo Race (one human + five AI) and online Multiplayer (2–6 humans, each on their own device). Every browser renders one full-viewport camera and one HUD.

## Removed

- Entry disclosure, local instructions and start button from `index.html`.
- Second HUD/Turbo component and second-player key hint.
- Split-view CSS, half-width HUD positioning and separator.
- Browser-local simulation/start/replay path, local countdown clock, multiple cameras and duplicate input handlers from `js/main.js`. Both existing product modes already use the server; neither requires this old path.
- Keyboard partition configuration and second-player gamepad exception in `js/input.js`. WASD/arrows and E/L remain alternatives for the same single device player, alongside touch/gamepad controls.
- Eleven obsolete paired translations: `local.title`, `local.description`, `local.start`, `hud.p2Position`, `control.turbo2`, `control.splitKeys`, `race.pause`, `race.pauseLabel`, `race.localWaiting`, `pause.title`, `pause.description`. There are now 183 paired keys.
- The local two-human assumption in the old composition test. The replacement verifies the actual shared room engine's 2–6-human/no-AI-fill invariant.

No whole engine module was deleted. `LocalSession` in `js/simulation.js` is the shared in-process **server** simulation used by `server/game.js` for all rooms; its multi-human support is required for online racing. Only misleading comments were updated there. Physics, AI, lap gates, collisions, Turbo, network authority, room membership and results logic remain unchanged.

## Regression protection

`tests/single-view.test.mjs` guards the one-HUD/input/camera architecture and removal of obsolete bindings/keys. `tests/input.test.mjs` verifies both keyboard layouts control the same player. The browser helper `tests/browser-single-view.mjs` observes actual Canvas transforms on real racing frames, so a full-size Canvas containing multiple views cannot pass merely by having a full-size DOM box.

The full browser regression checks one full-screen view on each of six separate connected browser clients. The bilingual suite checks Arabic/English multiplayer clients and physically driven solo races in both languages. UI tests include legacy `?mode=splitscreen&players=2#splitscreen` navigation: it opens normal nickname entry without starting a local race. No legacy start listener or browser-local race constructor remains. General driving help remains; there are no P1/P2 or shared-keyboard instructions.

## Verification and preview

| Suite | Actual result | Workspace outputs evidence |
| --- | --- | --- |
| Full automated tests | 75 passed; 0 failed/skipped | `single-view-tests.tap` |
| Full gameplay browser regression | Chrome 170, Edge 170; 0 app errors | `single-view-{chrome,edge}-regression/report.json` |
| Full public bilingual races | Chrome 140, Edge 140; 0 app errors/missing keys | `single-view-public-{chrome,edge}/report.json` |
| Extended UI/legacy/full-camera checks | Chrome local 155; Edge public 155; 0 app errors | `single-view-chrome-ui`, `single-view-public-edge-ui` |
| Production package | Build and runtime HTTP/WSS/solo-six-car/license smoke passed; removed components absent from packaged files | build verifier |

The gameplay regressions include solo AI/replay, private/public/code/invitation rooms, readiness, countdown, six independently connected browser customers, disconnect/DNF, results, rematches and input-delay cases. Native socket tests physically drive 2–6 humans in independent rooms. Bilingual tests physically complete solo in Arabic and English and mixed-language human races. Actual Canvas-frame audits confirm one full-viewport camera per device, including all six browser clients. UI tests cover 320px/narrow, portrait, landscape and desktop viewports, locale persistence, held controls and legacy URL/query/hash handling. Arabic/English welcome and racing screenshots were inspected with view_image; no removed option or second view remains. Chrome/Edge use the project's existing Playwright fallback because the Browser plugin/skill was unavailable.

No final test failed or was skipped. No server restart, dependency installation, paid service, main merge or upstream modification was required. Public HTML/CSS/main/input/HUD/translations match this checkout. An already-open browser tab must reload once to use the new module code.

Public preview stays at https://brian-desired-theology-bath.trycloudflare.com/. Frontend files are served without storage caching; reload an already-open page once to replace its previously loaded JavaScript. The server architecture/configuration is unchanged, so updating these frontend files does not require interrupting the running tunnel or active server. This remains a free temporary preview dependent on this computer staying awake.

Arabic remains the default with live English selection and correct RTL/LTR. Tests use installed Chrome/Edge via the existing Playwright workflow; no physical iPhone/Safari verification is claimed by the agent. Old audit/phase/design documents and **before** screenshots are historical evidence, not available product modes. Current README, status, localization notes and updated welcome screenshot describe the one-player-per-device product.

## File inventory

Modified runtime files: `index.html`, `game.css`, `js/main.js`, `js/input.js`, `js/hud.js`, `shared/translations.js`; `js/simulation.js` changes comments only. No complete source/engine file was deleted, since the removed components were embedded in shared files.

Modified verification: `tests/input.test.mjs`, `tests/racing.test.mjs`, `tools/browser-check.mjs`, `tools/localization-check.mjs`, `tools/ui-ux-check.mjs`. Added regression guards: `tests/single-view.test.mjs`, `tests/browser-single-view.mjs`. Current README, architecture, localization/design/status/test/deployment notes and welcome screenshot were updated; historical phase/audit/transformation documents now explicitly mark the former local mode as superseded.
