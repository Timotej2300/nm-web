import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { hasSameOrigin, readJson, RequestError } from "@/lib/security/requests";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    targetType: z.enum(["forum_topic", "forum_post", "profile"]),
    targetId: z.string().uuid(),
    reason: z.string().trim().min(3).max(1200),
  })
  .strict();

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Origin check failed" }, { status: 403 });
  const { user } = await getAuthenticatedUser();
  if (!user)
    return NextResponse.json({ error: "Sign in to report content" }, { status: 401 });
  const rate = await enforceRateLimit(request, "forum-report", 5, 3600, user.id);
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many attempts or protection is unavailable" },
      { status: rate.reason === "exceeded" ? 429 : 503 },
    );
  try {
    const body = await readJson(request, bodySchema, 4096);
    const admin = createSupabaseAdminClient();
    if (!admin)
      return NextResponse.json({ error: "Reports are not configured" }, { status: 503 });
    const { data, error } = await admin.rpc("report_forum_content", {
      p_reporter_user_id: user.id,
      p_target_type: body.targetType,
      p_target_id: body.targetId,
      p_reason: body.reason,
    });
    if (error)
      return NextResponse.json(
        { error: "Report could not be submitted" },
        { status: 422 },
      );
    return NextResponse.json({ reportId: data }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Report could not be submitted" }, { status: 503 });
  }
}