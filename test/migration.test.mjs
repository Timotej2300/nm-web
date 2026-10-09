import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20261009000000_initial_schema.sql",
    import.meta.url,
  ),
  "utf8",
);
const normalized = migration.toLowerCase();
const identityMigration = (
  await readFile(
    new URL(
      "../supabase/migrations/20261009010000_identity_link_rpc.sql",
      import.meta.url,
    ),
    "utf8",
  )
).toLowerCase();
const workflowMigration = (
  await readFile(
    new URL(
      "../supabase/migrations/20261009020000_ticket_workflow_rpc.sql",
      import.meta.url,
    ),
    "utf8",
  )
).toLowerCase();
const forumMigration = (
  await readFile(
    new URL(
      "../supabase/migrations/20261009030000_forum_workflow_rpc.sql",
      import.meta.url,
    ),
    "utf8",
  )
).toLowerCase();
const recruitmentMigration = (
  await readFile(
    new URL(
      "../supabase/migrations/20261009040000_recruitment_submission_rpc.sql",
      import.meta.url,
    ),
    "utf8",
  )
).toLowerCase();
const pageEditorMigration = (
  await readFile(
    new URL(
      "../supabase/migrations/20261009080000_page_editor_rpc.sql",
      import.meta.url,
    ),
    "utf8",
  )
).toLowerCase();
const staffTicketMigration = (
  await readFile(
    new URL(
      "../supabase/migrations/20261009090000_staff_ticket_workflow.sql",
      import.meta.url,
    ),
    "utf8",
  )
).toLowerCase();
const staffRecruitmentMigration = (
  await readFile(
    new URL(
      "../supabase/migrations/20261009100000_staff_recruitment_review.sql",
      import.meta.url,
    ),
    "utf8",
  )
).toLowerCase();
const forumModerationMigration = (
  await readFile(
    new URL(
      "../supabase/migrations/20261009110000_forum_moderation_rpc.sql",
      import.meta.url,
    ),
    "utf8",
  )
).toLowerCase();
const teamEditorMigration = (
  await readFile(
    new URL(
      "../supabase/migrations/20261009120000_team_editor_rpc.sql",
      import.meta.url,
    ),
    "utf8",
  )
).toLowerCase();
const maintenanceMigration = (
  await readFile(
    new URL(
      "../supabase/migrations/20261009130000_site_maintenance_rpc.sql",
      import.meta.url,
    ),
    "utf8",
  )
).toLowerCase();

const tables = [
  "profiles",
  "minecraft_link_challenges",
  "rank_metadata",
  "team_members",
  "game_modes",
  "site_pages",
  "news_articles",
  "forum_categories",
  "forum_topics",
  "forum_posts",
  "content_reports",
  "tickets",
  "ticket_messages",
  "recruitment_forms",
  "recruitment_submissions",
  "notifications",
  "notification_preferences",
  "web_bans",
  "site_settings",
  "bridge_heartbeats",
  "bridge_nonces",
  "admin_audit_logs",
];

test("migration creates every core table and enables row-level security", () => {
  for (const table of tables) {
    assert.match(
      normalized,
      new RegExp(`create table public\\.${table}\\s*\\(`),
      `${table} table missing`,
    );
    assert.match(
      normalized,
      new RegExp(`alter table public\\.${table} enable row level security`),
      `${table} missing RLS`,
    );
  }
});

test("link challenges persist a digest, expiry, attempt bound, and one-use marker", () => {
  assert.match(
    normalized,
    /code_hash text not null unique check \(code_hash ~ '\^\[0-9a-f\]\{64\}\$'\)/,
  );
  assert.match(normalized, /expires_at timestamptz not null/);
  assert.match(normalized, /consumed_at timestamptz/);
  assert.match(normalized, /attempts between 0 and 8/);
});

test("privileged and personal-data tables have no anon/authenticated grants", () => {
  for (const table of [
    "minecraft_link_challenges",
    "content_reports",
    "recruitment_submissions",
    "site_settings",
    "bridge_heartbeats",
    "bridge_nonces",
    "admin_audit_logs",
  ]) {
    const grantPattern = new RegExp(
      `grant [^;]* on public\\.${table}[^;]* to (?:anon|authenticated)`,
      "s",
    );
    assert.doesNotMatch(
      normalized,
      grantPattern,
      `${table} unexpectedly granted to browser role`,
    );
  }
  assert.match(
    normalized,
    /revoke all on public\.profiles,[\s\S]*?from anon, authenticated/,
  );
});

test("ticket owner policies scope messages and exclude internal notes", () => {
  assert.match(
    normalized,
    /create policy tickets_owner_read[\s\S]*?owner_user_id = \(select auth\.uid\(\)\)/,
  );
  assert.match(
    normalized,
    /create policy ticket_messages_owner_read_public[\s\S]*?not is_internal[\s\S]*?t\.owner_user_id = \(select auth\.uid\(\)\)/,
  );
  assert.match(
    normalized,
    /create policy ticket_messages_owner_reply[\s\S]*?and not is_internal/,
  );
});

test("profile identity and team membership are not browser-writable", () => {
  assert.match(
    normalized,
    /grant update \(display_name, bio, is_public\) on public\.profiles to authenticated/,
  );
  assert.doesNotMatch(
    normalized,
    /grant update \([^)]*minecraft_uuid[^)]*\) on public\.profiles to authenticated/,
  );
  assert.doesNotMatch(
    normalized,
    /grant (?:insert|update|delete)[^;]* on public\.team_members to authenticated/,
  );
});

test('public profile reads omit Minecraft UUID and public team data comes from a filtered view', () => {
  assert.match(normalized, /grant select \(user_id, minecraft_username, display_name, bio, is_public, created_at\)\s+on public\.profiles to anon, authenticated/);
  assert.doesNotMatch(normalized, /grant select on public\.profiles to anon, authenticated/);
  assert.match(normalized, /create view public\.public_team_members[\s\S]*?p\.is_public[\s\S]*?where tm\.is_listed/);
  assert.match(normalized, /grant select on public\.public_team_members, public\.public_forum_posts to anon, authenticated/);
});

test('public forum post view filters visibility and never returns author UUID', () => {
  assert.match(normalized, /create view public\.public_forum_posts[\s\S]*?as author_name[\s\S]*?where fp\.visibility = 'published'/);
  assert.match(normalized, /grant select on public\.public_team_members, public\.public_forum_posts to anon, authenticated/);
  assert.doesNotMatch(normalized, /grant select on public\.forum_posts to anon, authenticated/);
});

test("identity linking is atomic and callable only by the server role", () => {
  assert.match(identityMigration, /create or replace function public\.link_minecraft_identity/);
  assert.match(identityMigration, /security definer/);
  assert.match(identityMigration, /set search_path = pg_catalog, public/);
  assert.match(identityMigration, /insert into public\.minecraft_link_challenges/);
  assert.match(identityMigration, /insert into public\.profiles/);
  assert.match(identityMigration, /where public\.profiles\.minecraft_uuid is null/);
  assert.match(identityMigration, /revoke all on function[\s\S]*?from public, anon, authenticated/);
  assert.match(identityMigration, /grant execute on function[\s\S]*?to service_role/);
  assert.match(identityMigration, /begin;[\s\S]*?commit;/);
});

test("ticket RPCs create initial conversations atomically and enforce ownership", () => {
  assert.match(workflowMigration, /create or replace function public\.create_player_ticket/);
  assert.match(workflowMigration, /insert into public\.tickets/);
  assert.match(workflowMigration, /insert into public\.ticket_messages/);
  assert.match(workflowMigration, /create or replace function public\.reply_to_player_ticket/);
  assert.match(workflowMigration, /where id = p_ticket_id and owner_user_id = p_owner_user_id/);
  assert.match(workflowMigration, /current_status in \('resolved', 'closed'\)/);
  assert.match(workflowMigration, /revoke all on function[\s\S]*?from public, anon, authenticated/);
  assert.match(workflowMigration, /grant execute on function[\s\S]*?to service_role/);
});

test("staff ticket operations are server-only, audited, and limit assignment to self", () => {
  assert.match(staffTicketMigration, /create or replace function public\.manage_player_ticket/);
  assert.match(staffTicketMigration, /for update/);
  assert.match(staffTicketMigration, /p_assignee_user_id <> p_actor_user_id/);
  assert.match(staffTicketMigration, /p_operation = 'internal_note'/);
  assert.match(staffTicketMigration, /insert into public\.admin_audit_logs/);
  assert.match(staffTicketMigration, /revoke all on function[\s\S]*?from public, anon, authenticated/);
  assert.match(staffTicketMigration, /grant execute on function[\s\S]*?to service_role/);
});

test("recruitment review is private, audited, and callable only by the server role", () => {
  assert.match(staffRecruitmentMigration, /create or replace function public\.review_recruitment_submission/);
  assert.match(staffRecruitmentMigration, /for update/);
  assert.match(staffRecruitmentMigration, /internal_notes = p_internal_notes/);
  assert.match(staffRecruitmentMigration, /insert into public\.admin_audit_logs/);
  assert.match(staffRecruitmentMigration, /revoke all on function[\s\S]*?from public, anon, authenticated/);
  assert.match(staffRecruitmentMigration, /grant execute on function[\s\S]*?to service_role/);
  assert.doesNotMatch(staffRecruitmentMigration, /applicant_email|p_internal_notes'\s*,/);
});

test("forum report moderation validates target actions and is server-only", () => {
  assert.match(forumModerationMigration, /create or replace function public\.moderate_forum_report/);
  assert.match(forumModerationMigration, /profile reports require manual review/);
  assert.match(forumModerationMigration, /visibility = 'published'/);
  assert.match(forumModerationMigration, /status = 'hidden'/);
  assert.match(forumModerationMigration, /insert into public\.admin_audit_logs/);
  assert.match(forumModerationMigration, /revoke all on function[\s\S]*?from public, anon, authenticated/);
  assert.match(forumModerationMigration, /grant execute on function[\s\S]*?to service_role/);
});

test("team editor preserves private profiles and does not mutate rank metadata", () => {
  assert.match(teamEditorMigration, /create or replace function public\.save_team_member/);
  assert.match(teamEditorMigration, /minecraft_uuid is not null/);
  assert.match(teamEditorMigration, /if p_is_listed and not is_public_profile/);
  assert.match(teamEditorMigration, /on conflict \(user_id\) do update/);
  assert.doesNotMatch(teamEditorMigration, /rank_key\s*=\s*excluded\.rank_key/);
  assert.match(teamEditorMigration, /insert into public\.admin_audit_logs/);
  assert.match(teamEditorMigration, /revoke all on function[\s\S]*?from public, anon, authenticated/);
  assert.match(teamEditorMigration, /grant execute on function[\s\S]*?to service_role/);
});

test("maintenance settings are atomic, audited, and only writable by service role", () => {
  assert.match(maintenanceMigration, /create or replace function public\.set_site_maintenance/);
  assert.match(maintenanceMigration, /insert into public\.site_settings/);
  assert.match(maintenanceMigration, /'maintenance'/);
  assert.match(maintenanceMigration, /insert into public\.admin_audit_logs/);
  assert.match(maintenanceMigration, /revoke all on function[\s\S]*?from public, anon, authenticated/);
  assert.match(maintenanceMigration, /grant execute on function[\s\S]*?to service_role/);
  assert.doesNotMatch(maintenanceMigration, /p_message_sk'\s*,|p_message_cs'\s*,/);
});

test("forum mutations validate visibility and lock state in server RPCs", () => {
  assert.match(forumMigration, /create or replace function public\.create_staff_forum_topic/);
  assert.match(forumMigration, /t\.status = 'open' and c\.is_visible/);
  assert.match(forumMigration, /create or replace function public\.reply_to_forum_topic/);
  assert.match(forumMigration, /create or replace function public\.report_forum_content/);
  assert.match(forumMigration, /p\.visibility = 'published'[\s\S]*?t\.status in \('open', 'locked'\)/);
  assert.match(forumMigration, /revoke all on function[\s\S]*?from public, anon, authenticated/);
  assert.match(forumMigration, /grant execute on function[\s\S]*?to service_role/);
});

test("recruitment writes only through the closed-by-default server RPC", () => {
  assert.match(recruitmentMigration, /create or replace function public\.submit_recruitment_application/);
  assert.match(recruitmentMigration, /and is_open/);
  assert.match(recruitmentMigration, /opens_at is null or opens_at <= now\(\)/);
  assert.match(recruitmentMigration, /closes_at is null or closes_at > now\(\)/);
  assert.match(recruitmentMigration, /insert into public\.recruitment_submissions/);
  assert.match(recruitmentMigration, /revoke all on function[\s\S]*?from public, anon, authenticated/);
  assert.match(recruitmentMigration, /grant execute on function[\s\S]*?to service_role/);
});

test("page CMS mutations are audited and restricted to the service role", () => {
  assert.match(pageEditorMigration, /create or replace function public\.save_site_page/);
  assert.match(pageEditorMigration, /insert into public\.admin_audit_logs/);
  assert.match(pageEditorMigration, /canonical_url is not null and p_canonical_url !~ '\^https:\/\/'/);
  assert.match(pageEditorMigration, /revoke all on function[\s\S]*?from public, anon, authenticated/);
  assert.match(pageEditorMigration, /grant execute on function[\s\S]*?to service_role/);
});
