# Arabic and English

Arabic is the default, including when the browser itself uses English. The always-visible **العربية | English** buttons switch immediately in entry, menus, lobby, countdown, racing, pause and results. They never send a game command, restart simulation or reconnect a socket. `racer-language` in localStorage stores the preference; unavailable storage falls back to an in-memory choice. Preferences are per browser origin, so a new temporary tunnel hostname has its own preference.

## Copy and rendering

- `shared/translations.js` is the copy source: stable paired Arabic/English dictionaries, interpolation, cached `Intl.PluralRules`, fallback handling and structured message/error helpers. Arabic handles zero/one/two/few/many/other player counts. Missing keys display a localized generic message rather than a technical key, and are recorded in `missingTranslations` for tests.
- `js/i18n.js` manages preference, document `lang`/`dir`, static `data-i18n` text and translated accessibility/placeholder/meta attributes, and change notifications. The first pass happens before menus become visible; HTML does not duplicate the dictionaries.
- Lobby, HUD and browser composition render dynamic values again on a language event. Results can change language without changing the frozen standings. Canvas labels use the selected language and the system Arabic font fallback.
- Generated AI/local-player/room labels carry `nameKey`/`nameParams` metadata. Human nicknames and custom room names remain literal user text. Rendering never guesses a name's meaning from text such as `CPU 1`.

Numbers use the same Latin digits in both languages. Lap fractions and times are isolated left-to-right; room codes and URLs are LTR. Names use bidi isolation/automatic direction. RTL changes the interface, not track coordinates, cameras, keyboard bindings, steering, brake/gas order or local splitscreen placement. System fonts are used; no fonts, translation services or dependencies were added.

## Server messages

Validation throws `MessageError` with a stable key and values. WebSocket error envelopes carry `code` and `params`; an English `message` remains for compatibility with existing native clients/tests. The browser translates the structured message in its own current language and retains the descriptor so an already-visible error translates immediately. Close reasons are stable keys and reconnect/disconnect notices are localized. No locale is attached to a room, participant or race: Arabic and English players share identical authoritative state.

GenerateRacer, proper names, player text, technical keyboard keys/codes/URLs, the English language option and the original MIT license are intentional exceptions. The license link explains that its unchanged original text is in English. Browser/OS-owned permission UI is outside the application's copy; app clipboard success/fallback notices are translated.

## Editing and testing

Add a key with both values in `shared/translations.js`, then bind it through `data-i18n` or `t(key, values)`. Use `message(key, values)` for a retained notification and `fault(key, values)` for server/shared validation. Never put user text into HTML. A new language needs a dictionary, plural rule, supported-language entry, direction choice and switcher button; racing/network logic does not change.

```sh
npm test
npm run test:browser
npm run test:i18n
```

The established browser suite explicitly selects English in its test contexts. The bilingual suite uses fresh contexts to verify the Arabic default, persistence/new visits, both directions and six viewports, translated errors/notices/generated names, mixed-language rooms, countdown/live-switch continuity, steering/Turbo, results, DNF, rematch and full solo races in each language. Set `BROWSER_CHANNEL=msedge` for Edge, `BASE_URL` for the public preview and `EVIDENCE_DIR` for reports/screenshots outside the repository. `BILINGUAL_SUITE=smoke` skips full physical-race completion for a fast copy/layout check. It is a test timeout option, not an in-game time limit.

Chrome/Edge phone viewports are not physical iPhone/Safari verification. See TEST_RESULTS.md for executed results and PUBLIC_DEPLOYMENT.md for temporary-host limits.
