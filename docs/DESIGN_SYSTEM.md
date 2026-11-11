# Midnight Circuit UI system

Each device has one player, one input handler, one full-screen camera and one HUD; only Solo Race and online Multiplayer are offered. The GenerateRacer name, original racing Canvas and MIT attribution remain intact. Arabic is primary; English uses the same components. No framework, external font or runtime dependency was added.

## Tokens

`game.css :root` is the source of truth. Background #0b1018; surface #151e2b; raised #1c2838; text #f4f7fa; muted #aab8ca; separator #344358; primary lime #dcff64; connection cyan #83e3ee; warning #ffbd78; danger #ffb0a7; winner gold #f9d77e. Foreground/background combinations have automated WCAG AA normal-text contrast tests; disabled controls are visually subdued. This is not a claim of a complete accessibility certification.

Spacing follows 4/8/12/16/20/24/32px. Primary actions are ≥56px; other essential targets ≥44px. Control radii 10–12px, feature blocks 16px. Arabic-capable Segoe UI/Tahoma/Arial are local system fallbacks. Body 16px, important helper copy 13–15px, compact HUD captions 11–12px. Arabic has natural tracking and generous line height. Numbers use tabular forms and LTR isolation.

## Component ownership

| Family | Source | Contract |
| --- | --- | --- |
| Masthead/language control | index.html, game.css, i18n.js | Always visible, saved/live locale, fixed safe area |
| Screen shell and navigation | .overlay/.panel, Presentation.update | Full-screen phone surface, bounded scrollable content, focus only on actual screen transition |
| Buttons | .btn.primary/.secondary/.text-btn, setButtonLabel | One primary action; icons never overwrite dynamic labels |
| Task forms | .room-task, native details/forms | Visible action launchers, keyboard semantic disclosure, no extra page |
| Room list | LobbyUI.rooms, .room-row/.room-slots | Server availability, readable occupancy and disabled unavailable joining |
| Player rows/readiness | LobbyUI.lobby | Colored initials + isolated name, status text as well as color, meter from acknowledged roster |
| Invitations | shareInvitation, LobbyUI | Native share → clipboard → opened/selected manual link; cancelled sheet is quiet |
| Racing telemetry | Hud | Cached/diffed DOM, position emphasis, three progress segments, separate identity/menu rails |
| Driving buttons | InputHandler + .touch-btn | Existing captured-pointer behavior; physical order never follows RTL |
| Countdown/feedback | main.js + CSS | Authoritative deadline, event-driven pulse/lights; no new race timers |
| Standings | renderResults, .winner-block/.result-self/.results-actions | Server order, own-car mapping by participant/car ID, separate scrollable standings and action regions, no persistence |
| Error/recovery | LobbyUI.message/recoveryButton | Central localized codes, associated invalid input, explicit dismiss and relevant reconnect |

Native SVG icons in `js/ui.js` share a 24×24 coordinate system, consistent strokes and `aria-hidden` semantics. Directional steering icons are physical. Language changes only translate/reflow presentation; they do not send commands. Never use custom room names or nicknames as HTML.

Dialogs contain Tab navigation while retaining access to the language switch and visible recovery controls. Screen headings receive programmatic focus without opening the phone keyboard; text inputs retain 16px minimum size. Reduced-motion disables all UI animations/transitions. There are no hover-only actions, haptics, blur filters, particle systems or continuously animated menu backdrops. Screen-reader/physical-device testing remains a separate manual check.

## Art and references

`assets/menu-kart.webp` is 44,932 bytes, 1024×683, generated with the built-in image generation tool then converted to WebP using the already installed Chromium Canvas encoder. No image library or paid API dependency was installed. It is decorative welcome artwork, not a physics/sprite asset. CSS gives it a fixed region; text and buttons remain real HTML. The production static whitelist admits this exact image only.

Production-art prompt: a single lime small kart and anonymous helmeted driver, three-quarter front view, dark asphalt curve with restrained red/white kerb and checkered banner, navy distant city; stylized premium arcade rendering; palette #0b1018/#151e2b/#dcff64 and restrained cyan highlights; mobile-friendly crop, dark edges, no text, numbers, logos, UI, additional karts, watermark or heavy glow. Static menu art only.

Image-generated design reference boards live in workspace `../ui-ux-design/entry-modes-lobby-concept.png` and `discovery-hud-results-concept.png` (outside the repository). They establish tokens, typography hierarchy, icon families and screen anatomy. The documented implementation intentionally omits invented English “Midnight Circuit” subtitle, retains the real track/car artwork, and uses actual game/server copy, statuses and race times. See UI_UX_IMPLEMENTATION_REPORT.md for visual comparison and responsive evidence.
