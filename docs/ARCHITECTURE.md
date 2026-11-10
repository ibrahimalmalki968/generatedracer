# Implemented MVP architecture

## Process and boundaries

One Node 22+ process serves the frontend over HTTP and accepts WebSockets at `/socket`. `server/server.js` owns transport, size/rate limits, liveness and the simulation scheduler; `server/static.js` exposes only client assets, LICENSE and `/health`. There is no database or separate frontend development service.

- `server/game.js`: in-memory room/session maps, discovery, membership, readiness, countdown, authoritative race orchestration, disconnects, immutable results and rematch transition.
- `shared/protocol.js`: protocol version, nickname normalization and control validation.
- `js/simulation.js`: reused car roster, AI/physics/collision/race orchestration, now supporting 1–6 human slots. Solo adds five AI; multiplayer adds none.
- `js/car.js`, `js/track.js`, `js/ai.js`, `js/race.js`: original arcade physics/drawing, spline track, revised path following and ordered directional lap gates. The server calls simulation only; drawing methods are called in browsers.
- `js/network.js`: same-origin WebSocket client, reconnect lifecycle, command responses, own-car prediction/reconciliation and remote transform interpolation.
- `js/lobby.js`: nickname entry, public/private room browsing/creation/join, safe text rendering and lobby UI.
- `js/main.js`: browser state, controls, camera, Canvas renderer, HUD and results presentation. `js/input.js` retains pointer/keyboard/gamepad support; `js/hud.js` displays authoritative race status.

The original WebRTC implementation was replaced. The unused bundled QR encoder remains with its MIT header; invitation links are ordinary URLs and can later be printed as QR codes without changing room authority.

## Identity and authority

Every anonymous session has a 256-bit random secret token and a separate public UUID. A WebSocket is bound to that identity. A committed race maps public participant IDs to car slots; clients never select a target car in input messages. Nicknames are display text, not credentials. Browser `sessionStorage` retains only the tab's short-lived token/nickname; there is no permanent profile. Later accounts could attach to a participant identity without changing car assignment.

The server accepts bounded finite gas/brake/steer values, monotonic input sequence and boost counters, and the current race ID. It ignores stale race packets, rejects client position/lap/result messages, and enforces one grant per lap through the shared car/race code. Boost requests are consumed once; packet duplication does not recharge Turbo.

## Timing and rendering

The server simulates at 60 fixed steps/second and broadcasts full state at 20 Hz. Browsers send at most 60 control updates/second while their car is active. Acknowledged inputs are removed from a bounded prediction history and the rest replayed over the authoritative car state. Other cars interpolate between snapshots. Informational lap/race time comes from server simulation, not a phone clock. Countdown uses a shared server deadline and server-time offset.

Long process stalls are bounded rather than triggering unlimited catch-up; simulation time can lag wall time during such stalls, consistently for all players. There is no race-expiration clock or grace cutoff. Client buffers and history are bounded; slow outbound server connections are closed instead of accumulating unlimited snapshots.

## Room lifecycle

The normal entry path is nickname -> Solo Race / Multiplayer. The `solo` command creates a server-owned private room and commits its normal countdown atomically; it reuses `create`, `start`, `LocalSession`, existing physics/laps/Turbo and results. Solo rooms are omitted from discovery and reject any other participant even if their room code is known. The client cannot set the trusted solo flag through ordinary room creation. A `solo` replay requires the current completed race ID, resets via `back` and starts another countdown in the same private session. Duplicate/stale replay requests are rejected. Cancel/leave deletes that session and returns to mode selection. No second game engine or persistence service was added.

Multiplayer keeps its room browser, public/private invitations, lobby, Ready system and same-room rematches. Direct invitations bypass mode selection. Main menu controls leave a current room before changing mode; leaving a multiplayer room can still return to its room browser. Mode buttons are disabled during a pending transition. Nickname changes reconnect the existing short-lived identity while outside a room.

`lobby -> countdown -> racing -> results -> lobby`

Room codes are random 10-character hexadecimal identifiers. Private codes are omitted from public listings; invitation URLs contain only the room code, never a session token. Capacity is six humans. Joining is allowed only in lobby and below capacity. The lock applies during committed countdown, racing and results, including requests to wait or spectate.

One human explicitly starts against AI. For 2–6 humans everyone readies. Membership changes reset readiness. Each lobby generation has an opaque ID, so delayed Ready/Start/Cancel requests from a prior roster/rematch are rejected. Duplicate Ready is idempotent. Changing readiness or leaving before start cancels safely; countdown commitment checks the roster revision again before constructing cars.

The winner is first across all ordered gates for three laps. Finished/disconnected cars stop participating in collisions. Every connected human may finish; first place never stops other cars. Final results are frozen once and contain names, finish order/status and informational times. Any connected member can explicitly return the entire group to its same lobby; all transient race/input/Turbo state and Ready statuses reset. No rematch starts automatically.

## Disconnects and bounded state

Input silence neutralizes controls after 750 ms but does not by itself disqualify a connected player. Protocol heartbeat detects dead sockets on a 10-second cadence; a missed pong leads to closure on the next check. This is connection-liveness detection, not a race time limit.

Socket closure/voluntary departure marks the unfinished car DNF immediately and removes lobby membership; other racers keep driving. Finished results retain their position if that racer later leaves. A holder of a valid token can replace their own still-live socket, retaining the same participant/car and disabling the previous socket. After a closed socket has already recorded DNF, reconnect restores identity only: no new active-race entry or revival of finalized results is permitted. The client automatically reconnects or restores the session after reload, returning to discovery when the seat is gone.

Empty rooms are deleted immediately. Disconnected session tokens expire after ten minutes, checked periodically. Limits: 32 rooms, 128 live sockets, 256 retained anonymous sessions. Messages are capped at 4 KiB; message and command token buckets bound flooding. Same-origin browser upgrades are required. All race state is scoped to one room; no global car array is shared across rooms.

Public deployment hardening adds an aggregate connection token bucket (40 initial upgrades, 10/second refill), bounded HTTP header/request timeouts, explicit origin pinning with `PUBLIC_ORIGIN` or Render's `RENDER_EXTERNAL_URL`, and HTTPS-only browser origins in production. Forwarded-IP/Host headers never grant authority; café NAT does not share a per-IP seat cap. Native clients may omit Origin, but still require server-issued sessions and pass the same ownership/state/input validation. Origin filtering is browser protection, not an authentication scheme or complete DDoS defense. Static responses add CSP, frame blocking, nosniff and disabled camera/microphone/geolocation permissions. Only allowlisted client files and health are public; encoded backslashes are rejected before Windows path resolution.

## Deployment trade-offs

Central authority avoids host-phone backgrounding, peer NAT/TURN requirements and divergent browser decisions. It introduces a single process/host dependency, hosting cost if published and network latency. WebSocket's reliable ordered delivery may stall behind loss; the code bounds queues instead of assuming TCP eliminates latency. The tested pilot is local, not an Internet SLA or prize anti-cheat certification.

All state is volatile; restarting the process ends rooms. No physical café-presence enforcement is implemented. A temporary public HTTPS/WSS tunnel now forwards to a production-mode Node process; durable Render hosting is pending account authorization. GitHub Pages alone cannot run this server. See [deployment guide](DEPLOYMENT_GUIDE.md), [public deployment status](PUBLIC_DEPLOYMENT.md) and [known limitations](KNOWN_ISSUES.md).
