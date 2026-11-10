# GenerateRacer — Café Multiplayer Racing

A locally playable, mobile-first racing MVP adapted from [GenerateRacer](https://github.com/commjoen/generatedracer) by Jeroen Willemsen. Vanilla JavaScript + Canvas 2D, with one authoritative Node/WebSocket server. No database, registration or app installation.

**Arabic is the default. English is fully supported.** Use **العربية | English** at the top of any screen, including during a race. The choice is saved in this browser; switching updates text/direction immediately without reloading, reconnecting or changing the race. Track/steering directions stay the same. Nicknames, room codes and links remain readable. See [localization guide](docs/LOCALIZATION.md).

Public testing: [open the temporary HTTPS game](https://brian-desired-theology-bath.trycloudflare.com/). This free Cloudflare Tunnel forwards to the production-mode Node server on the development computer. The computer must stay awake and both processes must remain running; the URL is not permanent cloud hosting. A dedicated Render free-service configuration is ready in `render.yaml`, pending hosting authorization. See [deployment status](docs/PUBLIC_DEPLOYMENT.md).

## Play

The engineering agent leaves the complete preview running at:

- This computer: http://127.0.0.1:8081/
- Current Wi-Fi address: http://192.168.100.206:8081/ (other devices must share the network; the address can change).

Enter a nickname, then choose **Solo Race** or **Multiplayer**. Solo Race starts the countdown in one tap against five AI; its private session is created automatically. Results offer **Race again** for immediate replay or **Main menu** to choose a mode. Multiplayer opens the existing public/private room browser; with 2–6 humans, everyone presses Ready. Invitation links still open the invited lobby after nickname entry. Multiplayer rooms with one waiting human retain their explicit Start Race button.

## Rules

- Exactly 3 valid laps. No race time limit.
- 1 human: 5 AI opponents. 2–6 humans: humans only; no AI fill.
- One non-accumulating Turbo use per lap, maximum 3. Default boost: 2.5 seconds at 1.6x forward speed cap. No timed recharge or pickups.
- No weapons. Normal collisions remain.
- First finisher wins; remaining connected humans continue. Finished/disconnected cars cannot collide. Departures are DNF and never block results.
- Final results are identical on every client. Multiplayer returns to the same lobby with everyone Waiting; solo offers one-tap Race again with fresh laps and Turbo. No automatic rematch.
- No new joining, waiting or spectating during countdown, racing or results. Joining reopens in the lobby.

## Run locally

Node 22 or newer and npm are sufficient. One process serves both frontend and racing connections.

```sh
npm ci --ignore-scripts
npm start
```

No required environment variables. `HOST` defaults to `0.0.0.0`, `PORT` to `8081`. Set `HOST=127.0.0.1` for loopback-only development. The launcher prints local-network URLs and reports occupied ports/invalid configuration. Stop an old Phase 1 static preview before starting the complete server. Users do not need to run commands when the agent has already started the preview.

## Controls

| Input | Driving | Turbo |
| --- | --- | --- |
| Phone | Hold steering, accelerator, brake/reverse buttons | Tap TURBO |
| Keyboard | WASD or arrow keys | E or L |
| Gamepad | Stick/D-pad, RT/LT | A |
| Optional local splitscreen | P1 WASD, P2 arrows | P1 E, P2 L |

Brake overrides gas. Online blur/backgrounding releases controls and never pauses the room. The in-race menu explicitly says that racing continues. Local keyboard splitscreen is retained as an optional shared-device mode under the entry screen; the café solo/multiplayer journey always uses the unified room lobby.

## Verify and package

```sh
npm test
npm run test:browser
npm run test:i18n
npm run build
node tools/verify-build.mjs
```

The browser suite uses installed Chrome by default. Set `BROWSER_CHANNEL=msedge` for Edge and `BROWSER_SUITE=smoke` to omit full-race driving scenarios. Full tests include actual physical racing and take a few minutes. Reports/screenshots go to ignored `work/browser/`; `EVIDENCE_DIR` overrides the path. Browser automation is a development dependency only.

`npm run build` produces a deployable `dist/` containing the server, frontend, shared modules and MIT notice; no bundler is needed. In that directory, `npm ci --omit=dev --ignore-scripts` and `npm start` run the production package. Docker/Compose definitions are also provided; container execution has not been verified without a running Docker engine.

## Architecture and limits

The server owns physics, lap gates, Turbo, collisions and results. Browsers send validated inputs bound to their anonymous participant, predict their own movement, reconcile snapshots and interpolate remote cars. Rooms/tokens are in memory. Socket closure means DNF; a verified live-connection handover can retain its original car. A closed race participant cannot rejoin an active race as a new racer. Reload restores the tab's short-lived session automatically.

Runtime dependency: pinned `ws`. Development-only browser automation: pinned `playwright`. No accounts, email/phone, storage, leaderboard, rewards, café administration, location access or presence enforcement. A shareable QR/link does not prove someone is physically in the café.

- [Project status](docs/PROJECT_STATUS.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Test results](docs/TEST_RESULTS.md)
- [Deployment and local-network guide](docs/DEPLOYMENT_GUIDE.md)
- [Known limitations](docs/KNOWN_ISSUES.md)

The older audit/Phase 1 documents describe historical milestones. Legacy upstream GitHub Pages/release workflows have not been run; Pages alone cannot host this authoritative server. Public testing and a deployment-branch push are now authorized; main/upstream changes and paid resources are not.

## License and attribution

Original project: [commjoen/generatedracer](https://github.com/commjoen/generatedracer). Copyright (c) 2026 Jeroen Willemsen. This adaptation preserves the [MIT license](LICENSE), upstream attribution and the bundled QR encoder's MIT header. Include the full notice in distributions.
