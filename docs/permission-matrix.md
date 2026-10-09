# LuckPerms permission matrix

Permission checks are server-side, live, and fail-closed. Web/database roles are never treated as staff authority. The plugin accepts only the nodes listed below; add a node to both `src/lib/auth/permissions.ts` and the Velocity allowlist before using it. Actual LuckPerms group assignments and tracks were not accessible and must be configured by the server owner.

| Node | Current protected surface | Status |
|---|---|---|
| `ninjamelonweb.staff` | `/[locale]/admin` layout | Implemented; required before any admin page. |
| `ninjamelonweb.dashboard` | Admin health endpoint/dashboard | Implemented; live Velocity, Paper-heartbeat and LuckPerms check. |
| `ninjamelonweb.news` | News editor read/write routes | Implemented; service-role RPC and transactional audit. |
| `ninjamelonweb.pages` | Managed-page editor read/write routes | Implemented; configure this proposed node in LuckPerms. |
| `ninjamelonweb.forum` | Staff topic creation and report moderation | Implemented; public players cannot create topics, and report/content moderation runs through an audited RPC. |
| `ninjamelonweb.team` | Public-team editor | Implemented; profile identity and visibility are preserved, and web listing changes do not affect Minecraft rank. |
| `ninjamelonweb.ranks` | Rank metadata and LuckPerms track changes | Not implemented; no groups/tracks are guessed or changed. |
| `ninjamelonweb.tickets` | Staff queue, status changes, self-assignment, player replies and internal notes | Implemented; every API request rechecks live LuckPerms and writes are atomic, service-role-only RPCs with audit metadata. |
| `ninjamelonweb.recruitment` | Review, internal notes and applicant workflow | Implemented; private API rechecks the live permission and an atomic service-role RPC audits each review. |
| `ninjamelonweb.settings` | Navigation/footer, SEO and global settings | Not implemented; the separate maintenance control is available through its own node. |
| `ninjamelonweb.maintenance` | Enable/disable maintenance and restrict page/API access | Implemented; page/API requests are gated by the saved setting, and admin access requires both staff and maintenance permissions while active. |
| `ninjamelonweb.permissions` | Permission mapping editor | Not implemented; permission map is code-configured. |
| `ninjamelonweb.audit` | Read-only audit viewer | Implemented; server rechecks the live node and returns the latest 100 safe audit events. |

Every protected write route must call the appropriate node again; a visible link or frontend role is not authorization. On bridge timeout, stale timestamp, invalid signature, replay, missing UUID or unknown node, the operation is denied. Dashboard/news/pages/team/forum/tickets/recruitment/audit and maintenance are wired; rank changes and general global settings remain disabled rather than simulated.

For UI testing only, an opt-in Vercel Preview permission simulation is available for one explicitly configured Supabase Auth UUID. It never runs when `VERCEL_ENV` is `production`, does not simulate network health, and is not evidence that a production LuckPerms assignment is correct. See [`deployment.md`](deployment.md).
