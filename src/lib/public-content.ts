import "server-only";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/i18n";
import {
  RecruitmentFieldsSchema,
  type RecruitmentField,
} from "@/lib/recruitment/schema";

const NewsRow = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(180),
  excerpt: z.string().max(500).nullable(),
  publish_at: z.string().datetime({ offset: true }),
  cover_object_path: z.string().nullable(),
});
const NewsDetailRow = NewsRow.extend({
  body_markdown: z.string().max(100_000),
});
const TeamRow = z.object({
  user_id: z.string().uuid(),
  display_name: z.string().nullable(),
  minecraft_username: z.string().nullable(),
  role_sk: z.string(),
  role_cs: z.string(),
  bio_sk: z.string().nullable(),
  bio_cs: z.string().nullable(),
  display_order: z.number().int(),
});
const SitePageRow = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  language: z.enum(["sk", "cs"]),
  title: z.string(),
  body_markdown: z.string().max(100_000),
  publish_at: z.string().datetime({ offset: true }),
  seo_title: z.string().nullable(),
  seo_description: z.string().nullable(),
  canonical_url: z.string().nullable(),
});
const CategoryRow = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name_sk: z.string(),
  name_cs: z.string(),
  description_sk: z.string().nullable(),
  description_cs: z.string().nullable(),
});
const TopicRow = z.object({
  id: z.string().uuid(),
  category_id: z.string().uuid(),
  title: z.string(),
  status: z.enum(["open", "locked"]),
  is_pinned: z.boolean(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});
const ProfileRow = z.object({
  user_id: z.string().uuid(),
  minecraft_username: z.string().nullable(),
  display_name: z.string().nullable(),
  bio: z.string().nullable(),
  created_at: z.string().datetime({ offset: true }),
});
const ForumPostRow = z.object({
  id: z.string().uuid(),
  topic_id: z.string().uuid(),
  author_name: z.string().nullable(),
  body_markdown: z.string().max(12_000),
  created_at: z.string().datetime({ offset: true }),
});
const ForumTopicRow = z.object({
  id: z.string().uuid(),
  category_id: z.string().uuid(),
  title: z.string(),
  status: z.enum(["open", "locked"]),
  is_pinned: z.boolean(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }),
});

export type PublicNews = z.infer<typeof NewsRow>;
export type PublicNewsDetail = z.infer<typeof NewsDetailRow>;
export type PublicTeamMember = z.infer<typeof TeamRow>;
export type PublicSitePage = z.infer<typeof SitePageRow>;
export type PublicCategory = z.infer<typeof CategoryRow>;
export type PublicTopic = z.infer<typeof TopicRow>;
export type PublicProfile = z.infer<typeof ProfileRow>;
export type PublicForumThread = {
  topic: z.infer<typeof ForumTopicRow>;
  posts: Array<{
    id: string;
    authorName: string;
    body: string;
    created_at: string;
  }>;
};
export type PublicRecruitmentForm = {
  id: string;
  slug: string;
  title_sk: string;
  title_cs: string;
  fields: RecruitmentField[];
  closes_at: string | null;
};
export type QueryState<T> =
  | { state: "ok"; data: T }
  | { state: "empty" | "not_configured" | "unavailable"; data: [] };

async function getPublicQueryClient() {
  return createSupabaseServerClient();
}

export async function getPublicNews(
  locale: Locale,
): Promise<QueryState<PublicNews[]>> {
  const supabase = await getPublicQueryClient();
  if (!supabase) return { state: "not_configured", data: [] };
  const { data, error } = await supabase
    .from("news_articles")
    .select("id,slug,title,excerpt,publish_at,cover_object_path")
    .eq("language", locale)
    .eq("status", "published")
    .lte("publish_at", new Date().toISOString())
    .order("publish_at", { ascending: false })
    .limit(20);
  if (error || !data) return { state: "unavailable", data: [] };
  const parsed = z.array(NewsRow).safeParse(data);
  if (!parsed.success) return { state: "unavailable", data: [] };
  return parsed.data.length
    ? { state: "ok", data: parsed.data }
    : { state: "empty", data: [] };
}

export async function getPublicNewsDetail(
  locale: Locale,
  slug: string,
): Promise<QueryState<PublicNewsDetail[]>> {
  const supabase = await getPublicQueryClient();
  if (!supabase) return { state: "not_configured", data: [] };
  const { data, error } = await supabase
    .from("news_articles")
    .select("id,slug,title,excerpt,publish_at,cover_object_path,body_markdown")
    .eq("language", locale)
    .eq("slug", slug)
    .eq("status", "published")
    .lte("publish_at", new Date().toISOString())
    .limit(1);
  if (error || !data) return { state: "unavailable", data: [] };
  const parsed = z.array(NewsDetailRow).safeParse(data);
  if (!parsed.success) return { state: "unavailable", data: [] };
  return parsed.data.length
    ? { state: "ok", data: parsed.data }
    : { state: "empty", data: [] };
}

export async function getPublicTeam(): Promise<QueryState<PublicTeamMember[]>> {
  const supabase = await getPublicQueryClient();
  if (!supabase) return { state: "not_configured", data: [] };
  const { data, error } = await supabase
    .from("public_team_members")
    .select("user_id,display_name,minecraft_username,role_sk,role_cs,bio_sk,bio_cs,display_order")
    .order("display_order", { ascending: true })
    .limit(50);
  if (error || !data) return { state: "unavailable", data: [] };
  const parsed = z.array(TeamRow).safeParse(data);
  if (!parsed.success) return { state: "unavailable", data: [] };
  return parsed.data.length
    ? { state: "ok", data: parsed.data }
    : { state: "empty", data: [] };
}

export async function getPublicPage(
  locale: Locale,
  slug: string,
): Promise<QueryState<PublicSitePage[]>> {
  const supabase = await getPublicQueryClient();
  if (!supabase) return { state: "not_configured", data: [] };
  const { data, error } = await supabase
    .from("site_pages")
    .select(
      "id,slug,language,title,body_markdown,publish_at,seo_title,seo_description,canonical_url",
    )
    .eq("language", locale)
    .eq("slug", slug)
    .eq("status", "published")
    .lte("publish_at", new Date().toISOString())
    .limit(1);
  if (error || !data) return { state: "unavailable", data: [] };
  const parsed = z.array(SitePageRow).safeParse(data);
  if (!parsed.success) return { state: "unavailable", data: [] };
  return parsed.data.length
    ? { state: "ok", data: parsed.data }
    : { state: "empty", data: [] };
}

export async function getPublicForum(): Promise<
  QueryState<{ categories: PublicCategory[]; topics: PublicTopic[] }>
> {
  const supabase = await getPublicQueryClient();
  if (!supabase) return { state: "not_configured", data: [] };
  const [categoryResult, topicResult] = await Promise.all([
    supabase
      .from("forum_categories")
      .select("id,slug,name_sk,name_cs,description_sk,description_cs")
      .eq("is_visible", true)
      .order("display_order")
      .limit(50),
    supabase
      .from("forum_topics")
      .select("id,category_id,title,status,is_pinned,created_at,updated_at")
      .in("status", ["open", "locked"])
      .order("is_pinned", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);
  if (
    categoryResult.error ||
    topicResult.error ||
    !categoryResult.data ||
    !topicResult.data
  )
    return { state: "unavailable", data: [] };
  const categories = z.array(CategoryRow).safeParse(categoryResult.data);
  const topics = z.array(TopicRow).safeParse(topicResult.data);
  if (!categories.success || !topics.success)
    return { state: "unavailable", data: [] };
  if (!categories.data.length) return { state: "empty", data: [] };
  return {
    state: "ok",
    data: { categories: categories.data, topics: topics.data },
  };
}

export async function getPublicProfile(
  userId: string,
): Promise<QueryState<PublicProfile[]>> {
  const id = z.string().uuid().safeParse(userId);
  if (!id.success) return { state: "empty", data: [] };
  const supabase = await getPublicQueryClient();
  if (!supabase) return { state: "not_configured", data: [] };
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id,minecraft_username,display_name,bio,created_at")
    .eq("user_id", id.data)
    .eq("is_public", true)
    .limit(1);
  if (error || !data) return { state: "unavailable", data: [] };
  const parsed = z.array(ProfileRow).safeParse(data);
  if (!parsed.success) return { state: "unavailable", data: [] };
  return parsed.data.length
    ? { state: "ok", data: parsed.data }
    : { state: "empty", data: [] };
}

export async function getPublicForumTopic(
  id: string,
): Promise<QueryState<PublicForumThread[]>> {
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) return { state: "empty", data: [] };
  const supabase = await getPublicQueryClient();
  if (!supabase) return { state: "not_configured", data: [] };
  const [topicResult, postsResult] = await Promise.all([
    supabase
      .from("forum_topics")
      .select("id,category_id,title,status,is_pinned,created_at,updated_at")
      .eq("id", parsedId.data)
      .in("status", ["open", "locked"])
      .limit(1),
    supabase
      .from("public_forum_posts")
      .select("id,topic_id,author_name,body_markdown,created_at")
      .eq("topic_id", parsedId.data)
      .order("created_at")
      .limit(50),
  ]);
  if (
    topicResult.error ||
    postsResult.error ||
    !topicResult.data ||
    !postsResult.data
  )
    return { state: "unavailable", data: [] };
  const topic = z.array(ForumTopicRow).safeParse(topicResult.data);
  const posts = z.array(ForumPostRow).safeParse(postsResult.data);
  if (!topic.success || !posts.success)
    return { state: "unavailable", data: [] };
  if (!topic.data[0]) return { state: "empty", data: [] };
  const thread: PublicForumThread = {
    topic: topic.data[0],
    posts: posts.data.map((post) => ({
      id: post.id,
      authorName: post.author_name || "",
      body: post.body_markdown,
      created_at: post.created_at,
    })),
  };
  return { state: "ok", data: [thread] };
}

export async function getPublicRecruitmentForm(): Promise<
  QueryState<PublicRecruitmentForm[]>
> {
  const supabase = await getPublicQueryClient();
  if (!supabase) return { state: "not_configured", data: [] };
  const { data, error } = await supabase
    .from("recruitment_forms")
    .select("id,slug,title_sk,title_cs,fields,opens_at,closes_at,is_open")
    .eq("is_open", true)
    .order("slug", { ascending: true })
    .limit(10);
  if (error || !data) return { state: "unavailable", data: [] };
  const now = Date.now();
  const openForms: PublicRecruitmentForm[] = [];
  for (const row of data) {
    if (
      (row.opens_at && Date.parse(row.opens_at) > now) ||
      (row.closes_at && Date.parse(row.closes_at) <= now)
    )
      continue;
    const fields = RecruitmentFieldsSchema.safeParse(row.fields);
    const base = z
      .object({
        id: z.string().uuid(),
        slug: z.string().min(1).max(80),
        title_sk: z.string().min(1).max(180),
        title_cs: z.string().min(1).max(180),
        closes_at: z.string().datetime({ offset: true }).nullable(),
      })
      .safeParse(row);
    if (!base.success || !fields.success)
      return { state: "unavailable", data: [] };
    openForms.push({ ...base.data, fields: fields.data });
  }
  return openForms.length
    ? { state: "ok", data: openForms }
    : { state: "empty", data: [] };
}
