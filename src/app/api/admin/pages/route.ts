import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { hasSameOrigin, readJson, RequestError } from "@/lib/security/requests";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const pageSchema = z
  .object({
    id: z.string().uuid().optional(),
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,119}$/),
    language: z.enum(["sk", "cs"]),
    title: z.string().trim().min(1).max(160),
    bodyMarkdown: z.string().max(100_000),
    status: z.enum(["draft", "scheduled", "published", "archived"]),
    publishAt: z.string().datetime({ offset: true }).nullable(),
    seoTitle: z.string().trim().max(160).nullable(),
    seoDescription: z.string().trim().max(320).nullable(),
    canonicalUrl: z.string().url().startsWith("https://").nullable(),
  })
  .strict()
  .superRefine((page, context) => {
    if (
      ["scheduled", "published"].includes(page.status) &&
      !page.publishAt
    )
      context.addIssue({
        code: "custom",
        path: ["publishAt"],
        message: "Publishing requires a publish time",
      });
    if (
      page.status === "published" &&
      page.publishAt &&
      Date.parse(page.publishAt) > Date.now()
    )
      context.addIssue({
        code: "custom",
        path: ["status"],
        message: "Use scheduled status for a future publication",
      });
  });

async function authorizePages() {
  const { user } = await getAuthenticatedUser();
  if (!user)
    return {
      response: NextResponse.json({ error: "Sign in required" }, { status: 401 }),
    };
  const permission = await checkCurrentPermission("ninjamelonweb.pages");
  if (!permission.allowed)
    return {
      response: NextResponse.json(
        {
          error:
            permission.reason === "denied"
              ? "Pages permission denied"
              : "Permission check unavailable",
        },
        { status: permission.reason === "denied" ? 403 : 503 },
      ),
    };
  return { user };
}

export async function GET() {
  const access = await authorizePages();
  if ("response" in access) return access.response;
  const admin = createSupabaseAdminClient();
  if (!admin)
    return NextResponse.json({ error: "CMS is not configured" }, { status: 503 });
  const { data, error } = await admin
    .from("site_pages")
    .select("id,slug,language,title,body_markdown,status,publish_at,seo_title,seo_description,canonical_url,updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error)
    return NextResponse.json({ error: "Pages are unavailable" }, { status: 503 });
  return NextResponse.json(
    { pages: data ?? [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Origin check failed" }, { status: 403 });
  const access = await authorizePages();
  if ("response" in access) return access.response;
  const rate = await enforceRateLimit(request, "admin-pages", 30, 3600, access.user.id);
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many attempts or protection is unavailable" },
      { status: rate.reason === "exceeded" ? 429 : 503 },
    );
  try {
    const page = await readJson(request, pageSchema, 110_000);
    const admin = createSupabaseAdminClient();
    if (!admin)
      return NextResponse.json({ error: "CMS is not configured" }, { status: 503 });
    const { data, error } = await admin.rpc("save_site_page", {
      p_actor_user_id: access.user.id,
      p_id: page.id ?? null,
      p_slug: page.slug,
      p_language: page.language,
      p_title: page.title,
      p_body_markdown: page.bodyMarkdown,
      p_status: page.status,
      p_publish_at: page.publishAt,
      p_seo_title: page.seoTitle,
      p_seo_description: page.seoDescription,
      p_canonical_url: page.canonicalUrl,
    });
    if (error)
      return NextResponse.json(
        {
          error:
            error.code === "23505"
              ? "This slug already exists for this language"
              : "Page could not be saved",
        },
        { status: error.code === "23505" ? 409 : error.code === "P0001" ? 404 : 503 },
      );
    return NextResponse.json({ id: data });
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Page could not be saved" }, { status: 503 });
  }
}