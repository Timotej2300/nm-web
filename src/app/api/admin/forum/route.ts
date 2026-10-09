import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { hasSameOrigin, readJson, RequestError } from "@/lib/security/requests";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(["new", "reviewing", "resolved", "dismissed"]),
  action: z.enum(["none", "hide", "restore", "lock", "unlock"]),
}).strict();

async function authorize() {
  const { user } = await getAuthenticatedUser();
  if (!user)
    return { response: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  const permission = await checkCurrentPermission("ninjamelonweb.forum");
  if (!permission.allowed)
    return {
      response: NextResponse.json(
        { error: permission.reason === "denied" ? "Forum permission denied" : "Permission check unavailable" },
        { status: permission.reason === "denied" ? 403 : 503 },
      ),
    };
  return { user };
}

export async function GET(request: NextRequest) {
  const access = await authorize();
  if ("response" in access) return access.response;
  const admin = createSupabaseAdminClient();
  if (!admin)
    return NextResponse.json({ error: "Forum moderation is not configured" }, { status: 503 });
  const reportId = request.nextUrl.searchParams.get("reportId");
  if (reportId) {
    if (!z.string().uuid().safeParse(reportId).success)
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    const { data: report, error } = await admin.from("content_reports")
      .select("id,reporter_user_id,target_type,target_id,reason,status,created_at,resolved_at,resolved_by")
      .eq("id", reportId).maybeSingle();
    if (error)
      return NextResponse.json({ error: "Report is temporarily unavailable" }, { status: 503 });
    if (!report) return NextResponse.json({ error: "Report not found" }, { status: 404 });

    let target: Record<string, unknown> | null = null;
    if (report.target_type === "forum_topic") {
      const result = await admin.from("forum_topics")
        .select("id,title,status,author_user_id,category_id,created_at")
        .eq("id", report.target_id).maybeSingle();
      if (result.error) return NextResponse.json({ error: "Reported content is unavailable" }, { status: 503 });
      target = result.data;
    } else if (report.target_type === "forum_post") {
      const result = await admin.from("forum_posts")
        .select("id,topic_id,body_markdown,visibility,author_user_id,created_at")
        .eq("id", report.target_id).maybeSingle();
      if (result.error) return NextResponse.json({ error: "Reported content is unavailable" }, { status: 503 });
      target = result.data;
    } else {
      const result = await admin.from("profiles")
        .select("user_id,minecraft_username,display_name,is_public")
        .eq("user_id", report.target_id).maybeSingle();
      if (result.error) return NextResponse.json({ error: "Reported profile is unavailable" }, { status: 503 });
      target = result.data;
    }
    return NextResponse.json({ report, target }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const { data, error } = await admin.from("content_reports")
    .select("id,reporter_user_id,target_type,target_id,reason,status,created_at,resolved_at,resolved_by")
    .order("created_at", { ascending: false }).limit(100);
  if (error)
    return NextResponse.json({ error: "Reports are temporarily unavailable" }, { status: 503 });
  return NextResponse.json({ reports: data ?? [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Origin check failed" }, { status: 403 });
  const access = await authorize();
  if ("response" in access) return access.response;
  const rate = await enforceRateLimit(request, "admin-forum", 60, 3600, access.user.id);
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many attempts or protection is unavailable" },
      { status: rate.reason === "exceeded" ? 429 : 503 },
    );
  try {
    const body = await readJson(request, reviewSchema);
    const admin = createSupabaseAdminClient();
    if (!admin)
      return NextResponse.json({ error: "Forum moderation is not configured" }, { status: 503 });
    const { data, error } = await admin.rpc("moderate_forum_report", {
      p_actor_user_id: access.user.id,
      p_report_id: body.reportId,
      p_report_status: body.status,
      p_content_action: body.action,
    });
    if (error || !data)
      return NextResponse.json({ error: "Moderation action could not be completed" }, { status: 409 });
    return NextResponse.json({ result: data });
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Moderation action could not be completed" }, { status: 503 });
  }
}