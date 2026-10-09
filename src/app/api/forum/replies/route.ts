import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { hasSameOrigin, readJson, RequestError } from "@/lib/security/requests";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    topicId: z.string().uuid(),
    body: z.string().trim().min(1).max(12_000),
  })
  .strict();

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Origin check failed" }, { status: 403 });
  const { user } = await getAuthenticatedUser();
  if (!user)
    return NextResponse.json({ error: "Sign in to reply" }, { status: 401 });
  const rate = await enforceRateLimit(request, "forum-reply", 20, 3600, user.id);
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
    const { data, error } = await admin.rpc("reply_to_forum_topic", {
      p_author_user_id: user.id,
      p_topic_id: body.topicId,
      p_body: body.body,
    });
    if (error)
      return NextResponse.json(
        { error: "This topic is unavailable or locked" },
        { status: 409 },
      );
    return NextResponse.json({ postId: data }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Reply could not be sent" }, { status: 503 });
  }
}