# Local operation and production package

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

Only `ws` is installed at runtime. Playwright is development-only. Production-package HTTP, attribution, WebSocket session, room creation and solo snapshot were smoke-tested. No public deployment was performed.

## Optional Docker

```sh
docker compose up --build
```

Compose exposes 8081, using Node 22 Alpine, a non-root runtime user, `ws`, frontend assets and LICENSE. The container health check calls `/health`. The Docker engine was unavailable during this work; image build/run remains unverified. This does not block the verified native Node preview.

## Public pilot hosting, later approval required

Use a long-running Node host with HTTPS/WSS, or an HTTPS reverse proxy forwarding WebSocket upgrades and preserving the original Host header. Keep assets and sockets on one origin. Do not deploy this app as a static-only GitHub Pages site. The original upstream publishing/release workflows remain historical infrastructure; they have not been run or approved for this server MVP. The added verification workflow runs tests/builds without publishing.

No cloud resources, DNS, paid services or public endpoints were created. All sessions are in memory: process restart loses rooms and ongoing races. A future restart/upgrade must be communicated to active players rather than claiming persistence. To roll back code, use the prior locally verified milestone on a separate branch; never discard unrelated changes or reset the user's work automatically.
