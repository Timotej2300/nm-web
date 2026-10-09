# Security boundaries and database phase

## Database status

The repository contains thirteen ordered SQL migrations for 22 normalized public tables, RLS, public-only views and privileged workflow RPCs. The complete migration chain is applied in automated PGlite PostgreSQL tests with stand-in `auth.users`, `auth.uid()` and Supabase roles. This validates SQL execution and selected RLS invariants, but does **not** mean a Supabase project exists or that its extensions, storage schema, policies, edge settings or backups were verified.

Apply the migrations to a disposable Supabase staging project first. Confirm the actual Supabase schema version, Auth configuration, role grants and RLS behavior as `anon`, `authenticated` and `service_role` before production.

## Trust boundaries

- Browser code uses the public Supabase key only. Service-role credentials, bridge secrets, Discord hooks and database passwords are server-only.
- Every privileged route verifies the current authenticated user and the exact LuckPerms permission over the signed bridge; any unavailable permission check denies the request. `/admin` also requires the staff node.
- The account-link browser never receives the bridge secret. The Velocity plugin issues a random, five-minute, one-use code; the signed web request consumes it. The database stores a SHA-256 digest and atomically links UUID, username and audit event. Nick changes do not change the UUID identity.
- The Velocity listener binds to loopback by default. A trusted TLS reverse proxy and firewall must preserve signed request bytes and `X-NM-*` headers. The raw listener must not be exposed publicly.
- Signed bridge messages check HMAC-SHA256, timestamp, UUID nonce/request ID, response signature, response size and persistent response nonce in Supabase. Velocity keeps a bounded short-lived replay set for incoming calls.
- Online counts and Paper status are real bridge results. Missing slots/backend names, stale heartbeats and timeouts remain unavailable; they are not converted into made-up online/offline numbers.
- Ticket reads use owner-scoped RLS and a security-definer ownership helper so owner IDs need not be exposed. Internal messages are excluded from player reads. Ticket writes are atomic RPCs.
- Public forum reads use visibility-filtered views. Staff topic creation, report review, hide/restore and topic lock/unlock check `ninjamelonweb.forum` and use audited server-side RPCs. Reports about profiles require manual review.
- Recruitment forms are validated against their stored schema; responses and internal notes have no browser read grants. Public submission is rate-limited and only open forms accept writes. Staff review uses `ninjamelonweb.recruitment` and audited server-only mutations.
- Staff ticket status, assignment, replies and internal notes use `ninjamelonweb.tickets`, a live bridge permission check and audited server-only RPCs. Player reads remain owner-scoped.
- Team editorial changes use `ninjamelonweb.team`; listing a member does not change profile privacy or any LuckPerms rank.
- Public search queries only published news, listed public team data and visible forum topics. It has no path to tickets, recruitment responses, notifications or audit records.
- News and managed-page writes use permission-checked server routes and audited database functions. Audit viewing is limited to `ninjamelonweb.audit`. Markdown renders through a sanitizer; it is not trusted HTML.
- The maintenance flag is stored in `site_settings`, written only through an audited service-role RPC, and checked on page/API requests. Public pages redirect to the maintenance page and public APIs return `503`; admin APIs must still pass staff, section and active maintenance LuckPerms checks. The saved state is cached briefly (up to three seconds per instance).
- `service_role` bypasses RLS. It is a root credential: server-only, rotated, absent from logs and never returned to clients.

## Abuse protection and limits

- Sensitive write routes require a matching same-origin `Origin` header, bounded JSON bodies, schema validation and a configured shared Upstash Redis REST limiter. Missing or failed limiting returns `503`; exceeding an active limit returns `429`.
- Supabase OTP login only targets pre-provisioned accounts (`shouldCreateUser: false`). Disable public signups in Supabase Auth and configure the email template to send a short one-time token. A shared limiter is mandatory before public writes are enabled.
- No arbitrary console command is exposed. Rank snapshot/track-step operations remain intentionally disabled until the actual LuckPerms track and permissions have been inspected.
- Storage upload routes/buckets and server-side image decoding/re-encoding are not implemented. Do not grant browser writes to Storage objects.

## External operations still required

A real staging Supabase project is needed to validate column-level grants and all RLS policies. Configure Auth, the database, backups and a restore drill; provision Upstash; verify reverse-proxy HTTPS and secret rotation; test both plugin jars on the actual Velocity/Paper/LuckPerms versions; and record observed network/backend names and permission nodes. See [`deployment.md`](deployment.md) and [`permission-matrix.md`](permission-matrix.md).
