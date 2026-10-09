# NinjaMelonWebBridge

Velocity hosts the signed, allowlisted bridge and `/web link`. The Paper module
sends a signed heartbeat to the Velocity listener; it does not expose a Paper
API to Velocity. LuckPerms permission checks use its API and fail closed when
LuckPerms or a user cannot be loaded. No arbitrary console command is accepted.

## Build

Use JDK 25 and Gradle 9.1 or newer. Override the API versions in
`gradle.properties` to match the exact proxy, Paper and LuckPerms versions in
the target network before packaging:

```sh
gradle clean build
```

The Velocity and Paper jars each bundle only the small `bridge-common` module.
Copy `velocity-plugin/build/libs/velocity-plugin-0.1.0.jar` to the proxy
`plugins/` directory and `paper-plugin/build/libs/paper-plugin-0.1.0.jar` to
each Paper backend that should report its heartbeat.

## Configuration

Set these environment variables for the Velocity process:

- `NINJAMELON_BRIDGE_SECRET`: random secret of at least 32 bytes, identical to
  the web backend's `NINJAMELON_BRIDGE_SECRET`.
- `NINJAMELON_BRIDGE_KEY_ID`: same identifier as the web backend.
- `NINJAMELON_BRIDGE_BIND`: bind to `127.0.0.1` unless a trusted TLS reverse
  proxy requires another private interface.
- `NINJAMELON_BRIDGE_PORT`: listener port, default `8765`.
- `NINJAMELON_NETWORK_MAX_PLAYERS`: actual configured network capacity; if
  omitted, player totals and the aggregate online status are unavailable.
- `NINJAMELON_MODE_SERVERS`: comma-separated exact Velocity backend names.

Expose the Velocity listener only through a TLS reverse proxy and firewall it
to the web host and trusted Paper backends. Do not expose the raw listener to
the public internet. The reverse proxy must preserve the signed request body
and `X-NM-*` headers.

For Paper, set `NINJAMELON_BRIDGE_SECRET`, `NINJAMELON_BRIDGE_KEY_ID` and
`NINJAMELON_PAPER_HEARTBEAT_URL` to the trusted HTTPS endpoint. The Paper
plugin sends an authenticated heartbeat every 30 seconds. A missing endpoint
does not report a healthy integration.

## Implemented bridge operations

- `GET /v1/network/status`: aggregate Velocity player count, configured slot
  capacity, and ping status for explicitly configured backends.
- `POST /v1/permissions/check`: current LuckPerms permission state for one
  allowlisted `ninjamelonweb.*` node.
- `POST /v1/identity/link/verify`: consumes the short-lived `/web link` code
  once. Codes are in-memory and become invalid after restart or five minutes.
- `POST /internal/v1/heartbeat/paper`: signed Paper heartbeat.

Each request is bounded, timestamp checked, HMAC-SHA256 authenticated and
protected by a bounded in-memory nonce replay guard. Responses are signed too.
`rankSnapshot` and `rankStep` are intentionally not enabled until the real
LuckPerms track/group configuration has been inspected; the web must fail
closed rather than guess a track.

## Important deployment limits

This source has compiled against the configured API artifacts, but no actual
NinjaMelon Velocity/Paper/LuckPerms deployment was available to verify the
server versions, permission nodes, backend names, TLS routing, online counts or
restart behavior. Confirm every version and test in a staging network before
production. The web app also requires Supabase, Upstash Redis and its matching
bridge secrets; never commit secrets or production configuration.