import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { hasSameOrigin, readJson, RequestError } from "@/lib/security/requests";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    category: z.string().trim().min(1).max(60),
    subject: z.string().trim().min(4).max(180),
    message: z.string().trim().min(1).max(12_000),
  })
  .strict();

export async function GET() {
  const { client, user } = await getAuthenticatedUser();
  if (!client)
    return NextResponse.json(
      { error: "Account service is not configured" },
      { status: 503 },
    );
  if (!user)
    return NextResponse.json({ error: "Sign in to view tickets" }, { status: 401 });
  const { data, error } = await client
    .from("tickets")
    .select("id,category,subject,status,created_at,updated_at,closed_at")
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error)
    return NextResponse.json(
      { error: "Tickets are temporarily unavailable" },
      { status: 503 },
    );
  return NextResponse.json({ tickets: data ?? [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Origin check failed" }, { status: 403 });
  const rate = await enforceRateLimit(request, "ticket-create", 3, 3600);
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many attempts or protection is unavailable" },
      { status: rate.reason === "exceeded" ? 429 : 503 },
    );
  const { user } = await getAuthenticatedUser();
  if (!user)
    return NextResponse.json({ error: "Sign in to create a ticket" }, { status: 401 });
  try {
    const body = await readJson(request, createSchema);
    const admin = createSupabaseAdminClient();
    if (!admin)
      return NextResponse.json(
        { error: "Ticket service is not configured" },
        { status: 503 },
      );
    const { data, error } = await admin.rpc("create_player_ticket", {
      p_owner_user_id: user.id,
      p_category: body.category,
      p_subject: body.subject,
      p_body: body.message,
    });
    if (error || typeof data !== "string")
      return NextResponse.json(
        { error: "Ticket could not be created" },
        { status: 503 },
      );
    return NextResponse.json({ ticketId: data }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Ticket could not be created" }, { status: 503 });
  }
}