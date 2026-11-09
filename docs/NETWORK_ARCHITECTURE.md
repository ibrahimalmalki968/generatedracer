# Phase 2 architecture proposal — not implemented

## Decision

Use one lightweight authoritative Node process with browser WebSockets, retaining native JS modules and Canvas 2D. The server owns car simulation, collisions, lap gates, per-lap Turbo, start and final ordering. Browsers send bounded control intentions and display server snapshots. They cannot submit positions/laps/results or choose another player's car.

The original transport has one peer and one guest assignment, unreliable lifecycle messages, incomplete snapshots and no room authority. Expanding it into six-human host authority would keep host cheating, host phone backgrounding, relay/signaling complexity and host-disconnect failure. Central server authority addresses the actual requirement rather than retaining a faulty host model.

## Proposed boundaries

- `shared/protocol.js`: versioned message validators, sequence/tick/race identity and public snapshot shapes. No secrets or DOM.
- Shared simulation: reuse the current car movement, spline, AI, collisions and race manager. Rendering methods remain browser-only calls. Server clock and fixed simulation steps determine results; local pause does not pause an online room.
- Server transport: connection lifecycle, heartbeat, message/rate/size limits, authentication to a short-lived anonymous session and input neutralization when updates stop.
- Server race session: participant-to-car map, simulation/tick, active roster, results and disconnection state. No global mutable car arrays shared between rooms.
- Room manager, in Phase 3: public/private discovery, six-human capacity, roster revision, readiness, countdown and race lock. State transitions execute once per revision/race.
- Browser networking: send input at a bounded cadence; apply snapshots, interpolate display positions and reconcile local prediction only if measured latency requires it.

Use native browser `WebSocket`. A small maintained Node WebSocket implementation such as `ws` is justified for the server framing/upgrade handling; select/pin its actual version and inspect its dependency footprint when Phase 2 is approved. Nothing has been installed. Sources: [browser WebSocket API](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket), [ws implementation](https://github.com/websockets/ws).

## State and ownership

Separate opaque `sessionId`, room-scoped `participantId` and race-scoped `carId`; an optional future `accountId` is nullable and never used as the transport credential. Use a high-entropy reconnect token bound to the session, not a nickname or public room code. Nicknames are display-only and safely rendered as text. No account, database or permanent profile is required.

Each room gets its own roster revision and unique race ID. A committed race roster contains one human plus five AI for solo, or 2–6 humans with zero AI. Inputs are accepted only from a connection's assigned participant, for the current race, with increasing sequence and finite/clamped values. Turbo activation must be consumed at most once from that lap's grant. Include Turbo and finished/disconnected status in authoritative snapshots.

Proposed initial cadence: 60 Hz simulation, 20 Hz snapshots and at most 30 Hz input updates, with prompt action edges. These are balancing/engineering defaults to measure, not promises about untested latency. Critical start/final/rematch state is revisioned, acknowledged and recoverable by a full state sync. Even reliable delivery does not prevent stale application messages across reconnects.

## Disconnect/reconnect behavior

A disconnected racer is neutralized and marked disconnected/DNF; the race continues for other connected humans and finalization does not wait for the absent player. If a verified reconnect arrives while the same race is still active, allow reclaiming only the original car when doing so does not undo finalized standings; otherwise return the participant to the room's post-race state. Never admit a new participant to an active race under the guise of reconnecting. Socket liveness thresholds are connection detection, not a race time limit.

Preserve a finish already recorded before disconnect. If the last remaining connected human has finished or disconnected, finalize once. All remaining clients receive the identical final results. Server restart ends volatile sessions clearly; no silent recovery or persisted race promise in the MVP.

## Trade-offs and deployment

Benefits: consistent authority and results, no dependence on a customer phone hosting simulation, straightforward room isolation, ordinary outbound connections instead of peer NAT traversal, and reusable code. No signaling/TURN service is needed for this architecture.

Costs: an always-running server and HTTPS/WSS hosting, server CPU/bandwidth, connection latency and a single-process failure domain. WebSocket's ordered transport can delay newer state behind older data under loss; monitor queues, coalesce snapshots and bound buffering rather than sending unlimited traffic. Browser API backpressure limitations are noted in the [WebSocket documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket).

Start with in-memory rooms in one process for one café. No database, Redis, distributed fleet or administration UI. Choose hosting only after local load/latency tests and approval of any public deployment or paid service. GitHub Pages can serve static assets but cannot run this stateful authority; co-hosting assets and WSS under one origin simplifies pilot setup. A shared link does not prove café presence, and this design adds no access enforcement.

## Phase 2 validation gate

Automated clients for every human count 2–6, simultaneous sessions, authority/ownership attacks, malformed/oversize/stale inputs, packet delay, disconnect/rejoin, finish ties and shutdown. Compare full authoritative results between clients. Follow with real two-phone and six-device tests before claiming reliability. Phase 2 work is intentionally stopped pending the user's review of Phase 1 and this proposal.
