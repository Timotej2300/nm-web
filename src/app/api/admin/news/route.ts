import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { hasSameOrigin, readJson, RequestError } from "@/lib/security/requests";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const articleSchema = z
  .object({
    id: z.string().uuid().optional(),
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/),
    language: z.enum(["sk", "cs"]),
    title: z.string().trim().min(1).max(180),
    excerpt: z.string().trim().max(500).nullable(),
    bodyMarkdown: z.string().max(100_000),
    status: z.enum(["draft", "scheduled", "published", "archived"]),
    publishAt: z.string().datetime({ offset: true }).nullable(),
    seoTitle: z.string().trim().max(160).nullable(),
    seoDescription: z.string().trim().max(320).nullable(),
  })
  .strict()
  .superRefine((article, context) => {
    if (
      ["scheduled", "published"].includes(article.status) &&
      !article.publishAt
    )
      context.addIssue({
        code: "custom",
        path: ["publishAt"],
        message: "Publishing requires a publish time",
      });
    if (
      article.status === "published" &&
      article.publishAt &&
      Date.parse(article.publishAt) > Date.now()
    )
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "Use scheduled status for a future publication",
      });
    if (
      article.status === "scheduled" &&
      article.publishAt &&
      Date.parse(article.publishAt) <= Date.now()
    )
      context.addIssue({
        code: "custom",
        path: ["publishAt"],
        message: "Scheduled publication must be in the future",
      });
  });

async function authorizeNews() {
  const { user } = await getAuthenticatedUser();
  if (!user)
    return { response: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  const permission = await checkCurrentPermission("ninjamelonweb.news");
  if (!permission.allowed)
    return {
      response: NextResponse.json(
        { error: permission.reason === "denied" ? "News permission denied" : "Permission check unavailable" },
        { status: permission.reason === "denied" ? 403 : 503 },
      ),
    };
  return { user };
}

export async function GET() {
  const access = await authorizeNews();
  if ("response" in access) return access.response;
  const admin = createSupabaseAdminClient();
  if (!admin)
    return NextResponse.json({ error: "CMS is not configured" }, { status: 503 });
  const { data, error } = await admin
    .from("news_articles")
    .select("id,slug,language,title,excerpt,body_markdown,status,publish_at,seo_title,seo_description,updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error)
    return NextResponse.json({ error: "News are unavailable" }, { status: 503 });
  return NextResponse.json(
    { articles: data ?? [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Origin check failed" }, { status: 403 });
  const access = await authorizeNews();
  if ("response" in access) return access.response;
  const rate = await enforceRateLimit(request, "admin-news", 30, 3600, access.user.id);
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many attempts or protection is unavailable" },
      { status: rate.reason === "exceeded" ? 429 : 503 },
    );
  try {
    const article = await readJson(request, articleSchema, 110_000);
    const admin = createSupabaseAdminClient();
    if (!admin)
      return NextResponse.json({ error: "CMS is not configured" }, { status: 503 });
    const { data, error } = await admin.rpc("save_news_article", {
      p_actor_user_id: access.user.id,
      p_id: article.id ?? null,
      p_slug: article.slug,
      p_language: article.language,
      p_title: article.title,
      p_excerpt: article.excerpt,
      p_body_markdown: article.bodyMarkdown,
      p_status: article.status,
      p_publish_at: article.publishAt,
      p_seo_title: article.seoTitle,
      p_seo_description: article.seoDescription,
    });
    if (error)
      return NextResponse.json(
        { error: error.code === "23505" ? "This slug already exists for this language" : "Article could not be saved" },
        { status: error.code === "23505" ? 409 : error.code === "P0001" ? 404 : 503 },
      );
    return NextResponse.json({ id: data }, { status: 200 });
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Article could not be saved" }, { status: 503 });
  }
}