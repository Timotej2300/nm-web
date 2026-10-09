import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const migrationDirectory = new URL("../supabase/migrations/", import.meta.url);
const firstUser = "11111111-1111-4111-8111-111111111111";
const secondUser = "22222222-2222-4222-8222-222222222222";

test("all Supabase SQL migrations apply and critical functions enforce invariants", async () => {
  const database = new PGlite();
  try {
    await database.exec(`
      create role anon nologin;
      create role authenticated nologin;
      create role service_role nologin bypassrls;
      create schema auth;
      grant usage on schema public, auth to anon, authenticated, service_role;
      create table auth.users (id uuid primary key);
      create function auth.uid()
      returns uuid
      language sql
      stable
      as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      insert into auth.users (id) values
        ('${firstUser}'), ('${secondUser}');
    `);
    const files = (await readdir(migrationDirectory))
      .filter((name) => name.endsWith(".sql"))
      .sort();
    assert.ok(files.length >= 4);
    for (const file of files) {
      await database.exec(
        await readFile(new URL(file, migrationDirectory), "utf8"),
      );
    }

    const tableCheck = await database.query(`
      select count(*)::int as table_count
      from pg_tables
      where schemaname = 'public'
    `);
    assert.equal(tableCheck.rows[0].table_count, 22);

    await database.exec("set role service_role");
    const linked = await database.query(
      `select public.link_minecraft_identity($1, $2, $3, $4)`,
      [
        firstUser,
        "33333333-3333-4333-8333-333333333333",
        "NinjaPlayer",
        "a".repeat(64),
      ],
    );
    assert.equal(linked.rows.length, 1);
    await assert.rejects(
      database.query(
        `select public.link_minecraft_identity($1, $2, $3, $4)`,
        [
          firstUser,
          "33333333-3333-4333-8333-333333333333",
          "NinjaPlayer",
          "a".repeat(64),
        ],
      ),
    );
    await database.query(
      `select public.save_team_member($1, $2, $3, $4, $5, $6, $7, $8)`,
      [firstUser, firstUser, "Správca", "Správce", null, null, 10, false],
    );
    const hiddenTeamMember = await database.query(
      `select is_listed, role_sk from public.team_members where user_id = $1`,
      [firstUser],
    );
    assert.equal(hiddenTeamMember.rows[0].is_listed, false);
    assert.equal(hiddenTeamMember.rows[0].role_sk, "Správca");
    await assert.rejects(
      database.query(
        `select public.save_team_member($1, $2, $3, $4, $5, $6, $7, $8)`,
        [firstUser, firstUser, "Správca", "Správce", null, null, 10, true],
      ),
    );
    const maintenance = await database.query(
      `select public.set_site_maintenance($1, $2, $3, $4) as result`,
      [firstUser, true, "Údržba prebieha.", "Probíhá údržba."],
    );
    assert.equal(maintenance.rows[0].result.enabled, true);
    const savedMaintenance = await database.query(
      `select value from public.site_settings where setting_key = 'maintenance'`,
    );
    assert.equal(savedMaintenance.rows[0].value.enabled, true);

    const ticket = await database.query(
      `select public.create_player_ticket($1, $2, $3, $4) as id`,
      [firstUser, "Support", "Lost items", "I lost items after a restart."],
    );
    const ticketId = ticket.rows[0].id;
    await database.query(
      `insert into public.ticket_messages (ticket_id, author_user_id, body, is_internal)
       values ($1, $2, $3, true)`,
      [ticketId, firstUser, "Staff-only note"],
    );
    await database.query(
      `select public.manage_player_ticket($1, $2, $3, $4, $5, $6)`,
      [firstUser, ticketId, "assign", null, firstUser, null],
    );
    await database.query(
      `select public.manage_player_ticket($1, $2, $3, $4, $5, $6)`,
      [firstUser, ticketId, "internal_note", null, null, "Reviewed server logs."],
    );
    await database.query(
      `select public.manage_player_ticket($1, $2, $3, $4, $5, $6)`,
      [firstUser, ticketId, "reply", null, null, "We are investigating."],
    );
    await database.query(
      `select public.manage_player_ticket($1, $2, $3, $4, $5, $6)`,
      [firstUser, ticketId, "status", "in_progress", null, null],
    );
    const closed = await database.query(
      `select public.manage_player_ticket($1, $2, $3, $4, $5, $6) as result`,
      [firstUser, ticketId, "status", "closed", null, null],
    );
    assert.equal(closed.rows[0].result.status, "closed");
    await assert.rejects(
      database.query(
        `select public.manage_player_ticket($1, $2, $3, $4, $5, $6)`,
        [firstUser, ticketId, "assign", null, secondUser, null],
      ),
    );

    const category = await database.query(
      `insert into public.forum_categories (slug, name_sk, name_cs, is_visible)
       values ('community', 'Komunita', 'Komunita', true)
       returning id`,
    );
    const topic = await database.query(
      `select public.create_staff_forum_topic($1, $2, $3, $4) as id`,
      [firstUser, category.rows[0].id, "Welcome everyone", "First post."],
    );
    const post = await database.query(
      `select public.reply_to_forum_topic($1, $2, $3) as id`,
      [secondUser, topic.rows[0].id, "Second post."],
    );
    const report = await database.query(
      `select public.report_forum_content($1, $2, $3, $4) as id`,
      [firstUser, "forum_post", post.rows[0].id, "Please review this post."],
    );
    await database.query(
      `select public.moderate_forum_report($1, $2, $3, $4)`,
      [firstUser, report.rows[0].id, "resolved", "hide"],
    );
    const hiddenPosts = await database.query(
      `select id from public.forum_posts where id = $1 and visibility = 'published'`,
      [post.rows[0].id],
    );
    assert.equal(hiddenPosts.rows.length, 0);
    await database.query(
      `update public.forum_topics set status = 'locked' where id = $1`,
      [topic.rows[0].id],
    );
    await assert.rejects(
      database.query(
        `select public.reply_to_forum_topic($1, $2, $3)`,
        [secondUser, topic.rows[0].id, "This should not be accepted."],
      ),
    );

    const form = await database.query(
      `insert into public.recruitment_forms (slug, title_sk, title_cs, is_open, fields)
       values ('helper', 'Pomocník', 'Pomocník', true, '[]'::jsonb)
       returning id`,
    );
    const submission = await database.query(
      `select public.submit_recruitment_application($1, $2, $3::jsonb) as id`,
      [form.rows[0].id, "player@example.invalid", "{}"],
    );
    assert.ok(submission.rows[0].id);
    const reviewed = await database.query(
      `select public.review_recruitment_submission($1, $2, $3, $4) as result`,
      [firstUser, submission.rows[0].id, "reviewing", "Follow up next week."],
    );
    assert.equal(reviewed.rows[0].result.status, "reviewing");
    await assert.rejects(
      database.query(
        `select public.review_recruitment_submission($1, $2, $3, $4)`,
        [firstUser, submission.rows[0].id, "not-a-status", "No."],
      ),
    );

    const article = await database.query(
      `select public.save_news_article(
         $1, null, $2, $3, $4, $5, $6, $7, $8, $9, $10
       ) as id`,
      [
        firstUser,
        "launch-notes",
        "sk",
        "Launch notes",
        "A short update",
        "## Hello\n\nBody text.",
        "draft",
        null,
        null,
        null,
      ],
    );
    assert.ok(article.rows[0].id);
    const sitePage = await database.query(
      `select public.save_site_page(
         $1, null, $2, $3, $4, $5, $6, $7, $8, $9, $10
       ) as id`,
      [
        firstUser,
        "rules",
        "sk",
        "Pravidlá",
        "## Pravidlá\n\nText.",
        "draft",
        null,
        null,
        null,
        "https://ninjamelon.cz/sk/rules",
      ],
    );
    assert.ok(sitePage.rows[0].id);
    await assert.rejects(
      database.query(
        `select public.save_news_article(
           $1, null, $2, $3, $4, $5, $6, $7, $8, $9, $10
         )`,
        [
          firstUser,
          "launch-notes",
          "sk",
          "Duplicate",
          null,
          "",
          "draft",
          null,
          null,
          null,
        ],
      ),
    );
    const audit = await database.query(
      `select action from public.admin_audit_logs
       where actor_user_id = $1 order by action`,
      [firstUser],
    );
    assert.deepEqual(
      audit.rows.map((row) => row.action),
      [
        "forum.report.moderate",
        "forum.topic.create",
        "identity.link",
        "news.create",
        "page.create",
        "recruitment.review",
        "site.maintenance.update",
        "team.member.save",
        "ticket.assign",
        "ticket.create",
        "ticket.internal_note",
        "ticket.staff_reply",
        "ticket.status",
        "ticket.status",
      ],
    );
    await database.exec("reset role");

    await database.exec(
      `set role authenticated;
       select set_config('request.jwt.claim.sub', '${firstUser}', false);`,
    );
    const ownMessages = await database.query(
      `select body from public.ticket_messages where ticket_id = $1`,
      [ticketId],
    );
    assert.deepEqual(
      ownMessages.rows.map((row) => row.body),
      ["I lost items after a restart.", "We are investigating."],
    );
    await database.exec(
      `select set_config('request.jwt.claim.sub', '${secondUser}', false);`,
    );
    const otherTickets = await database.query(
      `select id from public.tickets`,
    );
    assert.equal(otherTickets.rows.length, 0);
    await assert.rejects(
      database.query(`select id from public.recruitment_submissions`),
    );
    await assert.rejects(
      database.query(
        `select public.manage_player_ticket($1, $2, $3, $4, $5, $6)`,
        [firstUser, ticketId, "status", "open", null, null],
      ),
    );
    await assert.rejects(
      database.query(
        `select public.review_recruitment_submission($1, $2, $3, $4)`,
        [firstUser, submission.rows[0].id, "accepted", null],
      ),
    );
    await assert.rejects(
      database.query(
        `select public.moderate_forum_report($1, $2, $3, $4)`,
        [firstUser, report.rows[0].id, "dismissed", "none"],
      ),
    );
    await assert.rejects(
      database.query(
        `select public.save_team_member($1, $2, $3, $4, $5, $6, $7, $8)`,
        [firstUser, firstUser, "Staff", "Staff", null, null, 0, false],
      ),
    );
    await assert.rejects(
      database.query(
        `select public.set_site_maintenance($1, $2, $3, $4)`,
        [firstUser, false, null, null],
      ),
    );
    await database.exec("reset role");

    await database.exec("set role anon");
    await assert.rejects(
      database.query(
        `select public.submit_recruitment_application($1, $2, $3::jsonb)`,
        [form.rows[0].id, "attacker@example.invalid", "{}"],
      ),
    );
    await database.exec("reset role");
  } finally {
    await database.close();
  }
});