# Local operation and public testing

Current public testing URL and hosting authorization status: [PUBLIC_DEPLOYMENT.md](PUBLIC_DEPLOYMENT.md). The temporary tunnel is live while its computer/processes run; it is not a durable hosted service.

## Current preview

- Computer: http://127.0.0.1:8081/
- Wi-Fi interface observed during verification: http://192.168.100.206:8081/
- Health check: `/health`; racing connection: `/socket` on the same host/port.

The engineering agent starts and leaves the complete server running. Customers open the link, enter a nickname and use room creation/joining. Local-network users must use the computer's Wi-Fi address, not `127.0.0.1`. Invitation links created through the LAN URL retain that LAN origin; a link copied through localhost is only useful on the same computer.

Both HTTP health and a real WebSocket identity handshake were verified through the Wi-Fi address from this computer. That does not establish reachability from a second physical phone. Windows Firewall remains enabled and unchanged. Router client isolation, a captive portal or inbound firewall policy could still block another device. No external handset was available to test those paths. If access fails, investigate the actual network/port rule before requesting approval for a narrowly scoped inbound rule; do not disable firewall profiles.

## Start from a checkout

Prerequisite: Node 22+ and npm. No credentials or required environment variables.

```sh
npm ci --ignore-scripts
npm start
```

One process serves frontend and multiplayer. Defaults:

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `0.0.0.0` | Listen on local interfaces; use `127.0.0.1` for computer-only testing. |
| `PORT` | `8081` | HTTP and WebSocket port; validated as integer 1–65535. |
| `NODE_ENV` | unset | Can be `production`; no secret is required. |
| `PUBLIC_ORIGIN` | unset | Optional exact HTTP(S) origin; production requires HTTPS when set. Pins permitted browser WebSocket Origin. |
| `RENDER_EXTERNAL_URL` | unset | Render supplies its service HTTPS URL; used as origin fallback when `PUBLIC_ORIGIN` is absent. |

PowerShell example for a different port:

```powershell
$env:HOST = '0.0.0.0'
$env:PORT = '8085'
npm start
```

The launcher prints available LAN IPv4 addresses. Stop with Ctrl+C. An occupied port or invalid configuration produces a clear error. The old Phase 1 `tools/serve.mjs` is static-only and must not run alongside the complete server; it was stopped during this verification. Use `npm start` for the MVP.

## Package and smoke-test

```sh
npm test
npm run build
node tools/verify-build.mjs
```

There is no frontend compilation requirement. The build validates entry-point syntax and copies `index.html`, CSS, JS, shared/server modules, package lock and the unchanged MIT license to `dist/`. The build only replaces a generated directory bearing its own marker; it refuses an unrelated unmarked `dist/`.

To run the standalone folder:

```sh
cd dist
npm ci --omit=dev --ignore-scripts
npm start
```

Only `ws` is installed at runtime. Playwright is development-only. Production-package HTTP, attribution, WebSocket session, room creation and solo snapshot were smoke-tested. Public testing status is recorded separately in PUBLIC_DEPLOYMENT.md.

## Optional Docker

```sh
docker compose up --build
```

Compose exposes 8081, using Node 22 Alpine, a non-root runtime user, `ws`, frontend assets and LICENSE. The container health check calls `/health`. The Docker engine was unavailable during this work; image build/run remains unverified. This does not block the verified native Node preview.

## Dedicated hosting — Render Free

Use a long-running Node host with HTTPS/WSS, or an HTTPS reverse proxy forwarding WebSocket upgrades and preserving the original Host header. Keep assets and sockets on one origin. Do not deploy this app as a static-only GitHub Pages site. The original upstream publishing/release workflows remain historical infrastructure; they have not been run or approved for this server MVP. The added verification workflow runs tests/builds without publishing.

The committed `render.yaml` defines one **Free** Node web service in Frankfurt, using only the user's fork and `deploy/public-mvp` branch. Build: `npm ci --omit=dev --ignore-scripts`; start: `npm start`; health: `/health`; `NODE_ENV=production`, `HOST=0.0.0.0`, Node 22. Do not override Render's assigned `PORT`. TLS terminates at Render; it forwards HTTP and upgrades on the same port, preserving Host. The browser derives WSS and invitation URLs from its public origin. No localhost URL is shipped as a connection target.

Before creating the service, confirm authenticated workspace and zero-cost billing behavior. `plan: free` is explicit because omitting a plan can select paid compute. Do not attach a database, disk, paid add-on, paid workspace subscription or card, and do not enable paid overages. Hosting authorization is currently unavailable; the agent should complete creation after the user connects Render. No Render service has been provisioned yet.

Render Free sleeps after 15 minutes without inbound traffic and can take about a minute to wake. Its free instance-hour allowance is shared within the workspace. Restarts lose all rooms. This is suitable for testing, with no uptime guarantee. [Official free-service limits](https://render.com/docs/free), [WebSocket support](https://render.com/docs/websocket), [Blueprint fields](https://render.com/docs/blueprint-spec).

After deployment, use the actual assigned HTTPS URL, check `/health`, and run the black-box socket/browser commands below. Restart via the service's Manual Deploy menu (restart action); redeploy via **Deploy latest commit** from the deployment branch. Auto-deploy is explicitly off. Stop races before restarting/redeploying: in-memory rooms cannot migrate between processes. Rollback uses the previous verified deployment, never a force reset or merge into main. Keep a single instance; horizontal scaling needs shared room ownership/state that this MVP intentionally does not have.

## Verify any public deployment

```powershell
$env:BASE_URL = 'https://ACTUAL-SERVICE-HOST/'
node tools/verify-deployment.mjs
npm run test:browser
```

The socket tool runs simultaneous 2- and 3-human races, then separate 4-, 5- and 6-human races to bound public test bandwidth. It uses only real public protocol messages and checks standings/three laps, private discovery, capacity, unauthorized input, and a same-room rematch with a disconnected opponent. The browser suite additionally covers nickname entry, public/private invitation flows, actual controls, mobile layouts and solo AI. Run the public socket and browser suites sequentially to isolate failures from shared uplink contention. Set `EVIDENCE_DIR` to retain each report in a distinct folder. With `BASE_URL` set, the browser suite does not start a local server or claim internal remote-process cleanup measurements.

## Temporary public preview

Cloudflare Quick Tunnel provides HTTPS/WSS without a hosting account. The production Node process listens only on `127.0.0.1:8086`; the tunnel forwards that port. Its metrics server is loopback-only at `127.0.0.1:20242`; no development/admin interface is served. No inbound firewall rule or router port forwarding was added. The official `cloudflared` 2026.10.7 binary is kept in ignored `work/hosting/`, SHA-256 `2493dbc168923bb3e59e5e7716f71deced92992eea9acd6e9d74f84ac7751343`, checked against Cloudflare's GitHub release digest.

To resume after both processes stop, the agent starts `work/hosting/cloudflared.exe tunnel --no-autoupdate --url http://127.0.0.1:8086 --metrics 127.0.0.1:20242`, reads the **new** public hostname, then starts the game with `NODE_ENV=production`, `HOST=127.0.0.1`, `PORT=8086`, and `PUBLIC_ORIGIN` equal to that new HTTPS origin. Existing invitation links stop working when the tunnel hostname changes. If only Node restarts while the tunnel remains running, retain its current origin. Ask the agent to restart this preview; customers do not need to operate either process.

This fallback has no uptime guarantee, stops when the computer sleeps or either process exits, and has no installed automatic Windows service/restart policy. Cloudflared can reconnect transport interruptions while running. No power settings were changed. A stable hostname independent of this computer requires finishing the dedicated-host deployment. [Cloudflare Quick Tunnel limitations](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).
