# Public deployment — 10 November 2026

## Status

**Partial: public test preview live; dedicated cloud hosting pending authorization.**

Game: https://brian-desired-theology-bath.trycloudflare.com/

This is the complete application (frontend plus authoritative Node/WebSocket server), not a static demo. Cloudflare Quick Tunnel supplies public HTTPS/WSS and forwards only `127.0.0.1:8086`. Node runs with `NODE_ENV=production` and its exact public HTTPS `PUBLIC_ORIGIN`. No credentials, dev tooling, server source or local directory listing is served. No account, card, paid plan, database, DNS purchase or firewall change was used.

The computer must remain awake and online. Node and cloudflared must remain running. There is no installed automatic restart service; starting a new quick tunnel changes the hostname. All rooms are volatile. Cloudflare can reconnect its transport while running, but this is **not permanent hosting or an uptime guarantee**. [Official limitations](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/).

## Dedicated host decision

Render Free is the preferred dedicated testing host: one persistent Node process, TLS and WebSocket support on a single origin. `render.yaml` explicitly selects Free, Frankfurt, the user's fork, `deploy/public-mvp`, Node 22, `/health`, and manual deployments. It does not provision any storage or extra services. Free instances sleep after 15 minutes without inbound traffic, can cold-start slowly, and may restart; rooms disappear after any restart. Check workspace quotas and no-overage billing behavior before provisioning. [Render free limits](https://render.com/docs/free), [WebSockets](https://render.com/docs/websocket).

Railway was evaluated as an alternative; its current Free plan includes a small monthly usage credit, which is less predictable for a continuously running game than an explicitly free testing instance. No Railway resource was created. Serverless-only/static hosting was rejected because authoritative room simulation needs a continuing process. [Railway plans](https://docs.railway.com/pricing/plans).

**Access blocker:** GitHub authentication works, but no Render/Railway hosting credentials or connected hosting integration were available. Render was offered for connection. Two attempts to open its dashboard through the browser-control tool timed out; no authenticated dashboard was reached. Connect Render so the agent can create the explicitly free service, inspect build logs, obtain its assigned URL and repeat verification. Do not send an API key in chat. If the account requires a paid workspace or card/billable overages, stop and report it before provisioning.

## Verification

Local deployment changes: 57 automated tests passed, zero failed/skipped. This includes a regression for encoded Windows separators exposing server JavaScript; those requests now return 404. Chrome local full browser suite: 130 assertions passed initially; the revised network-aware harness passed 128 assertions against an already running local server (the two internal-process cleanup assertions apply only when the harness owns the server). No application errors. The generated production package smoke and runtime dependency audit passed (zero reported vulnerabilities). MIT LICENSE remains byte-identical to the upstream attribution baseline.

Public HTTPS `/health` returns 200. A real public WSS connection with a foreign browser origin receives HTTP 403. Nickname entry, public/private discovery and invitations, lobby readiness, room lock, six-human capacity and unauthorized input checks have executed through the public endpoint. Full final public race/browser verification is in progress; do not treat this paragraph as a complete deployment sign-off.

Earlier public attempts are retained in ignored `work/`: localhost timing assumptions and stale-snapshot bot steering caused test failures, then the public stress run lost WebSocket transports (1006) in its 5/6-player rooms while 2/3/4-player rooms finished. That run combined 20 socket racers with browser tests through one home-computer tunnel. The precise transport-loss cause is unconfirmed. Local 20-human/five-room stress tests passed; they do not establish Internet-host capacity. Public checks are being repeated with bounded traffic and the actual client's prediction. Do not claim iPhone/Safari or separate physical-phone testing: neither was available.

## Source and operations

Baseline: `abbc449` (local MVP). Working/deployment branch: `deploy/public-mvp`, preserving all Phase 1–5 commits. No merge into main or write to upstream is authorized. Deployment commit/push verification is recorded in the final report.

See [deployment guide](DEPLOYMENT_GUIDE.md) for production configuration, exact commands, verification and restart/redeploy behavior. To restart the temporary preview, ask the agent to restart it; if the tunnel changes, share the new hostname and regenerate room invitations. To finish stable hosting, connect Render and ask the agent to resume this deployment. No manual code edits or cloud purchases are needed.
