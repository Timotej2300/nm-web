import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { hasSameOrigin, readJson, RequestError } from "@/lib/security/requests";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
const replySchema = z
  .object({ message: z.string().trim().min(1).max(12_000) })
  .strict();

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success)
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  const { client, user } = await getAuthenticatedUser();
  if (!client)
    return NextResponse.json(
      { error: "Account service is not configured" },
      { status: 503 },
    );
  if (!user)
    return NextResponse.json({ error: "Sign in to view this ticket" }, { status: 401 });
  const { data: ticket, error: ticketError } = await client
    .from("tickets")
    .select("id,category,subject,status,created_at,updated_at,closed_at")
    .eq("id", id)
    .maybeSingle();
  if (ticketError)
    return NextResponse.json(
      { error: "Ticket is temporarily unavailable" },
      { status: 503 },
    );
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  const { data: messages, error: messageError } = await client
    .from("ticket_messages")
    .select("id,ticket_id,body,created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true })
    .limit(100);
  if (messageError)
    return NextResponse.json(
      { error: "Ticket messages are temporarily unavailable" },
      { status: 503 },
    );
  return NextResponse.json(
    { ticket, messages: messages ?? [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Origin check failed" }, { status: 403 });
  const { id } = await context.params;
  if (!idSchema.safeParse(id).success)
    return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  const rate = await enforceRateLimit(request, "ticket-reply", 10, 3600);
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many attempts or protection is unavailable" },
      { status: rate.reason === "exceeded" ? 429 : 503 },
    );
  const { user } = await getAuthenticatedUser();
  if (!user)
    return NextResponse.json({ error: "Sign in to reply" }, { status: 401 });
  try {
    const { message } = await readJson(request, replySchema);
    const admin = createSupabaseAdminClient();
    if (!admin)
      return NextResponse.json(
        { error: "Ticket service is not configured" },
        { status: 503 },
      );
    const { error } = await admin.rpc("reply_to_player_ticket", {
      p_owner_user_id: user.id,
      p_ticket_id: id,
      p_body: message,
    });
    if (error)
      return NextResponse.json(
        { error: "Ticket is unavailable or does not accept replies" },
        { status: 404 },
      );
    return NextResponse.json({ sent: true }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Reply could not be sent" }, { status: 503 });
  }
}