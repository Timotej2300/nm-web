# Deployment and operations

## 1. Web prerequisites

- Node.js 20.9+ and a Vercel project for the Next.js App Router site.
- A Supabase project with Auth, PostgreSQL and Storage enabled. Run the ordered `supabase/migrations/*.sql` files against a disposable staging project first; the local PGlite suite is not a production migration rehearsal.
- An Upstash Redis REST database for shared abuse limits. Write APIs return `503` if either limiter variable is missing or Redis is unhealthy.
- A TLS reverse proxy from the web backend to the private Velocity listener.

Copy `.env.example` to `.env.local` for local work. Set production variables in Vercel project settings; never commit values:

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical HTTPS origin; used for same-origin checks. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public, RLS-constrained key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for RPCs/admin operations; never browser-exposed. |
| `NINJAMELON_BRIDGE_URL` | HTTPS reverse-proxy base URL for the Velocity signed API. |
| `NINJAMELON_BRIDGE_KEY_ID` | Bridge key identifier shared with Velocity/Paper. |
| `NINJAMELON_BRIDGE_SECRET` | Random secret of at least 32 bytes shared only by server-side participants. |
| `RATE_LIMIT_REDIS_URL`, `RATE_LIMIT_REDIS_TOKEN` | Upstash REST endpoint and token used by write routes. |
| `SESSION_SIGNING_SECRET` | Reserved for a separately configured signed session; do not set until that session layer is enabled. |
| `DISCORD_INVITE_URL` | Optional public invite link; blank means unavailable. |

The app uses Supabase Auth cookies. Pre-provision accounts and disable public signups in Auth settings. Configure the email template to send a numeric OTP token for the login verification endpoint. Confirm secure cookies, allowed redirect URLs and the site origin.

## 1.1 GitHub and Vercel

The repository has `vercel.json` for the Next.js framework and an Actions workflow at `.github/workflows/ci.yml`. The workflow runs the web checks/build/audit and the Velocity/Paper Gradle build on pushes and pull requests. It does not deploy or access production secrets.

To deploy, publish this source to a GitHub repository, import that repository into Vercel, keep the project root as the root directory, and set the listed production environment variables in Vercel Project Settings. Use separate Supabase/Upstash credentials for Preview and Production. No GitHub remote, Vercel project or automatic deployment is connected from this workspace.

## 1.2 Supabase

The application uses `@supabase/ssr` for cookie-based Auth and the server-only Supabase client for restricted RPC calls. Apply `supabase/migrations/*.sql` in filename order to a disposable staging project first. Do not treat the local PGlite tests as proof that Supabase Auth grants, Storage policies, backups or production data have been verified. Configure Auth with public signup disabled and verify the environment-variable mapping above before enabling production writes.

## 2. Database and staging checks

1. Back up the staging project.
2. Apply migrations in filename order.
3. Run `npm test` and `node --test test/migrations-live.test.mjs` locally.
4. In Supabase staging, verify the `anon`, `authenticated` and `service_role` column grants, ticket ownership, hidden internal notes, private recruitment responses, published-only news/pages, forum visibility and public team/profile filters.
5. Test creation/reuse of link codes, ticket replies, forum report flows, recruitment validation and CMS audit rows.
6. Restore a staging backup to a fresh project and rehearse rollback/restore. Configure the provider's automated backups/retention; the repository does not create daily backups for you.

No live Supabase credentials were available during development; no production or real staging migration has been run.

## 3. Velocity and Paper

See [`../plugins/ninjamelon-web-bridge/README.md`](../plugins/ninjamelon-web-bridge/README.md). Confirm the exact installed Velocity, Paper and LuckPerms versions before building; defaults in `gradle.properties` are configurable and are not evidence of server compatibility.

Build with JDK 25 / Gradle 9.1+:

```sh
cd plugins/ninjamelon-web-bridge
gradle clean build
```

Copy the Velocity jar to proxy `plugins/` and the Paper jar to each intended backend. Set `NINJAMELON_BRIDGE_SECRET`, `NINJAMELON_BRIDGE_KEY_ID`, `NINJAMELON_BRIDGE_BIND` and `NINJAMELON_BRIDGE_PORT` for Velocity. Configure actual `NINJAMELON_NETWORK_MAX_PLAYERS` and comma-separated `NINJAMELON_MODE_SERVERS`; absent values intentionally produce unavailable metrics.

Paper requires `NINJAMELON_PAPER_HEARTBEAT_URL` to the private HTTPS reverse-proxy route plus the matching key ID/secret. Ensure the proxy preserves request bytes and all `X-NM-*` headers; firewall the listener to Vercel and trusted backends. Rotate the secret together across all server-side participants.

Run `/web link` in-game, then sign into a pre-provisioned web account and enter the code at `/{locale}/link`. Codes expire after five minutes and are consumed once; a proxy restart invalidates in-memory codes.

## 4. Releases and production gate

- Run `npm ci`, `npm run check`, `npm run build`, and `npm audit --audit-level=high` for the web app.
- Run `gradle clean build` and inspect the generated Velocity/Paper jar contents.
- Test on staging with actual versions and a restricted staff test account before granting LuckPerms nodes.
- Verify `/api/network` shows correct counts and that timeout/invalid signature/nonce replay returns unavailable.
- Configure logging/alerting and backups in Vercel, Supabase, Upstash and server hosting.
- Do not call the product production-ready until staging tests pass and all unconfigured admin modules have been implemented or explicitly removed from navigation.
