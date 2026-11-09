# Known limitations and remaining verification

No known blocking defect remains in the verified local MVP journey. Validation gaps below are not claims of production readiness.

- **Physical devices:** no real iPhone/Android handset, Safari, physical gamepad, battery/thermal session or café Wi-Fi test was available. Chrome/Edge automation and phone viewports do not replace those tests.
- **Connection recovery:** an overlapping valid-token live-socket handover can retain its assigned car. After a closed socket has already been marked DNF, the identity can reconnect but the car cannot re-enter that active race. Join again after the room returns to its lobby. This deliberately avoids undoing finalized standings or admitting late racers.
- **LAN access:** HTTP and WebSocket succeeded through `192.168.100.206` from the same computer. Cross-device reachability, firewall inbound permission and router client isolation remain unverified. Firewall protections were not disabled or changed. The DHCP address can change.
- **Volatile state:** rooms, tokens and results are memory-only and disappear on server restart. This is the approved no-database MVP behavior.
- **Connected nonfinishers:** an idle but still-connected player can keep a race open indefinitely. This follows the explicit no-race-time-limit requirement; that player can leave. Dead socket detection still applies.
- **Performance scope:** actual socket tests cover five concurrent 2–6-human races (20 human sockets total), 40 cleanup cycles, input delay and bounded buffers. This is not a long-duration load certification or proof of performance on low-end phones. Server simulation time can lag real time under a long process stall; informational times remain consistent between clients.
- **Containers/public hosting:** native Node and the generated runtime folder are tested; Docker image execution is unverified because the Docker engine is unavailable. No public hosting has been deployed. Legacy static Pages publishing cannot run this server and should not be used for the MVP.
- **Access scope:** no physical-presence enforcement, account, persistent history, leaderboard or rewards exist. Private room links are shareable invitations, not café-location proof.

Before a physical café pilot, test the already implemented game on the actual phones/router, including two and six humans, network changes, interrupted browsers and repeated rematches. Keep any access/firewall changes narrow and approved. No future account or leaderboard work is needed to perform this validation.
