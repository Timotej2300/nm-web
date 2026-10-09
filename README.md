# NinjaMelon.cz

A Slovak/Czech Next.js application and Minecraft bridge project for NinjaMelon.cz. The initial workspace contained no source repository, deployment configuration, live Supabase project, Velocity proxy, Paper server or LuckPerms setup; no live system has been overwritten or claimed as tested.

## Implemented now

- Next.js App Router, React, TypeScript strict mode, Tailwind CSS 4 and custom responsive pixel-art/voxel home design. The homepage uses real bridge data or an explicit unavailable state, and the IP-copy control is functional.
- Public SK/CZ routes for modes, team, public player profiles, news, forum, managed pages, recruitment, support/tickets, notifications, rules, privacy, maintenance, account linking and public search.
- Existing-user Supabase email OTP login (`shouldCreateUser: false`), Minecraft account-link form and signed Velocity verification. No public registration or Minecraft password collection.
- Server-side API authorization and validation for account linking, tickets, forum replies/reports/staff topics, recruitment submissions, personal notifications, public search, news/pages CMS, network status and staff integration health. Shared Upstash Redis REST rate limiting fails closed when absent or unavailable.
- Thirteen ordered SQL migrations with RLS, restricted service-role RPCs, privacy-safe public views and transactional audit workflows. The complete chain applies in an isolated PGlite PostgreSQL runtime test; this is not a substitute for Supabase staging validation.
- Staff tools for support tickets, recruitment review, forum reports/moderation, public team content, news/pages CMS, a read-only audit view and a request-wide maintenance gate. Rank operations and general site settings remain disabled pending verified LuckPerms configuration.
- An explicitly opt-in Vercel Preview test mode for one Supabase Auth UUID to inspect implemented admin screens without Velocity. It shows a TEST MODE banner, does not fake integration health, and is guarded from Production.
- Velocity and Paper Java modules. Velocity provides signed network status, LuckPerms permission checks and `/web link`; Paper sends a signed heartbeat. Both plugin jars compile against the configurable API defaults, and HMAC/replay tests pass. Actual NinjaMelon server versions and permissions remain unknown.
- Nonce-based CSP and security headers; reduced-motion support; sanitized Markdown; responsive controls; public search excludes private records.

## Local web run

Requires Node.js 20.9+.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`. Without Supabase, Upstash and bridge configuration, private writes fail closed and server metrics show unavailable rather than sample values.

## Checks

```sh
npm run check
npm run build
npm audit --audit-level=high
node --test test/migrations-live.test.mjs
```

Minecraft modules (JDK 25 and Gradle 9.1+):

```sh
cd plugins/ninjamelon-web-bridge
gradle clean build
```

Setup, secrets, routing and staging steps are in [`docs/deployment.md`](docs/deployment.md); permission mappings and deliberately disabled modules are in [`docs/permission-matrix.md`](docs/permission-matrix.md). The 141-file scope is tracked in [`docs/file-inventory.md`](docs/file-inventory.md).

The project includes Vercel build configuration and a GitHub Actions CI workflow. This workspace is not linked to a GitHub remote or a Vercel/Supabase account; connect those accounts and set deployment secrets before publishing.

## Not production-ready yet

No Supabase project has been provisioned and no migration has been applied to a real Supabase database. Storage buckets and verified upload handling, LuckPerms rank snapshot/track-step operations, general settings such as navigation/footer and SEO, web-ban management, Discord notifications, backup/restore drills, deployment observability and actual reverse-proxy/TLS routing remain unconfigured or incomplete. The rank admin section stays disabled rather than presenting pretend controls. LuckPerms tracks are never guessed or modified.

Before production, connect GitHub to Vercel, configure Supabase Auth/Database/Storage and Upstash, provide server-side secrets, and verify TLS routing plus the actual Velocity/Paper/LuckPerms versions, backend names and permissions in staging. Never commit `.env.local`, service-role keys, bridge secrets or webhook URLs.
