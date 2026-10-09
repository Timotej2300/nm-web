# File-count contract

The current whole-project target is **141 project files**. Progress uses `HOTOVYCH SUBOROV [X/141]`. The previous 105-file estimate was superseded when real API, notification, search, recruitment, CMS, staff-ticket, review, audit, team-editor, forum-moderation, maintenance and deployment CI workflows were added; target counts are not increased with build artefacts.

Included: source, configuration, dependency lockfile, ordered migrations, tests and documentation. Excluded: `node_modules/`, `.next/`, `.tools/`, any `.gradle/` or `build/` directory, compiled jars, screenshots, coverage reports and archives.

## Target allocation

| Area | Target files |
|---|---:|
| Root config, Vercel/GitHub config, lockfile and project/deployment/security docs | 16 |
| Supabase schema and workflow migrations (Storage not yet configured) | 14 |
| Public/admin app pages and layouts | 32 |
| Server API handlers | 21 |
| Reusable UI/design-system components | 21 |
| Backend, identity, database, bridge and security libraries | 16 |
| Velocity, Paper and shared plugin sources/configuration/tests | 14 |
| Automated web/database tests | 6 |
| Next.js security proxy | 1 |
| **Total** | **141** |

## Progress semantics

A file counts as complete when its behavior is implemented, included in the project, and passes the available checks. An unimplemented admin route, unconfigured integration, empty control, untested SQL or generated artefact does not count. Missing external services must be described as unconfigured and are never reported as tested. The current source tree is recounted with `find`, excluding the generated directories listed above; completion counts must be checked against the relevant tests and explicitly disabled modules.
