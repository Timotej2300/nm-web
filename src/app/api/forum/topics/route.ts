import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { hasSameOrigin, readJson, RequestError } from "@/lib/security/requests";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    categoryId: z.string().uuid(),
    title: z.string().trim().min(4).max(180),
    body: z.string().trim().min(1).max(12_000),
  })
  .strict();

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Origin check failed" }, { status: 403 });
  const { user } = await getAuthenticatedUser();
  if (!user)
    return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });
  const permission = await checkCurrentPermission("ninjamelonweb.forum");
  if (!permission.allowed)
    return NextResponse.json(
      { error: permission.reason === "denied" ? "Forum permission denied" : "Permission check unavailable" },
      { status: permission.reason === "denied" ? 403 : 503 },
    );
  const rate = await enforceRateLimit(
    request,
    "forum-topic",
    5,
    3600,
    user.id,
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many attempts or protection is unavailable" },
      { status: rate.reason === "exceeded" ? 429 : 503 },
    );

  try {
    const body = await readJson(request, bodySchema);
    const admin = createSupabaseAdminClient();
    if (!admin)
      return NextResponse.json({ error: "Forum is not configured" }, { status: 503 });
    const { data, error } = await admin.rpc("create_staff_forum_topic", {
      p_author_user_id: user.id,
      p_category_id: body.categoryId,
      p_title: body.title,
      p_body: body.body,
    });
    if (error || typeof data !== "string")
      return NextResponse.json({ error: "Topic could not be created" }, { status: 503 });
    return NextResponse.json({ topicId: data }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Topic could not be created" }, { status: 503 });
  }
}