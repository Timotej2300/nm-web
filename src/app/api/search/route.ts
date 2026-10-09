import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizePublicSearchQuery } from "@/lib/search";

export const dynamic = "force-dynamic";

const localeSchema = z.enum(["sk", "cs"]);

export async function GET(request: NextRequest) {
  const locale = localeSchema.safeParse(request.nextUrl.searchParams.get("locale"));
  const query = normalizePublicSearchQuery(request.nextUrl.searchParams.get("q") ?? "");
  if (!locale.success || query.length < 2)
    return NextResponse.json(
      { error: "Search needs a locale and at least two characters" },
      { status: 400 },
    );
  const supabase = await createSupabaseServerClient();
  if (!supabase)
    return NextResponse.json(
      { error: "Search is not configured" },
      { status: 503 },
    );

  const pattern = `%${query}%`;
  const [news, names, usernames, topics] = await Promise.all([
    supabase
      .from("news_articles")
      .select("id,slug,title,excerpt,publish_at")
      .eq("language", locale.data)
      .eq("status", "published")
      .lte("publish_at", new Date().toISOString())
      .ilike("title", pattern)
      .order("publish_at", { ascending: false })
      .limit(6),
    supabase
      .from("public_team_members")
      .select("user_id,display_name,minecraft_username,role_sk,role_cs")
      .ilike("display_name", pattern)
      .limit(5),
    supabase
      .from("public_team_members")
      .select("user_id,display_name,minecraft_username,role_sk,role_cs")
      .ilike("minecraft_username", pattern)
      .limit(5),
    supabase
      .from("forum_topics")
      .select("id,title,updated_at")
      .in("status", ["open", "locked"])
      .ilike("title", pattern)
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);
  if (
    news.error ||
    names.error ||
    usernames.error ||
    topics.error ||
    !news.data ||
    !names.data ||
    !usernames.data ||
    !topics.data
  )
    return NextResponse.json(
      { error: "Search is temporarily unavailable" },
      { status: 503 },
    );

  const members = new Map(
    [...names.data, ...usernames.data].map((member) => [member.user_id, member]),
  );
  const results = [
    ...news.data.map((item) => ({
      type: "news" as const,
      title: item.title,
      excerpt: item.excerpt,
      href: `/${locale.data}/news/${item.slug}`,
      updatedAt: item.publish_at,
    })),
    ...[...members.values()].map((member) => ({
      type: "team" as const,
      title:
        member.display_name ||
        member.minecraft_username ||
        (locale.data === "sk" ? "Člen tímu" : "Člen týmu"),
      excerpt:
        locale.data === "sk" ? member.role_sk : member.role_cs,
      href: `/${locale.data}/players/${member.user_id}`,
      updatedAt: "",
    })),
    ...topics.data.map((item) => ({
      type: "forum" as const,
      title: item.title,
      excerpt: null,
      href: `/${locale.data}/forum/${item.id}`,
      updatedAt: item.updated_at,
    })),
  ].slice(0, 15);
  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } },
  );
}