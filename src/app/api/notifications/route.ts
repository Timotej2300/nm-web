import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { hasSameOrigin, readJson, RequestError } from "@/lib/security/requests";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const markSchema = z.union([
  z.object({ id: z.string().uuid() }).strict(),
  z.object({ all: z.literal(true) }).strict(),
]);

export async function GET() {
  const { client, user } = await getAuthenticatedUser();
  if (!client)
    return NextResponse.json(
      { error: "Notification service is not configured" },
      { status: 503 },
    );
  if (!user)
    return NextResponse.json(
      { error: "Sign in to view notifications" },
      { status: 401 },
    );
  const { data, error } = await client
    .from("notifications")
    .select("id,user_id,kind,title,body,target_path,is_read,created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error)
    return NextResponse.json(
      { error: "Notifications are temporarily unavailable" },
      { status: 503 },
    );
  return NextResponse.json(
    { notifications: data ?? [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PATCH(request: NextRequest) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Origin check failed" }, { status: 403 });
  const { client, user } = await getAuthenticatedUser();
  if (!client)
    return NextResponse.json(
      { error: "Notification service is not configured" },
      { status: 503 },
    );
  if (!user)
    return NextResponse.json(
      { error: "Sign in to update notifications" },
      { status: 401 },
    );
  const rate = await enforceRateLimit(
    request,
    "notification-read",
    60,
    3600,
    user.id,
  );
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many attempts or protection is unavailable" },
      { status: rate.reason === "exceeded" ? 429 : 503 },
    );
  try {
    const body = await readJson(request, markSchema, 2048);
    let query = client
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id);
    if ("id" in body) query = query.eq("id", body.id);
    else query = query.eq("is_read", false);
    const { data, error } = await query.select("id");
    if (error)
      return NextResponse.json(
        { error: "Notification state could not be updated" },
        { status: 503 },
      );
    return NextResponse.json({ updated: data?.length ?? 0 });
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: "Notification state could not be updated" },
      { status: 503 },
    );
  }
}