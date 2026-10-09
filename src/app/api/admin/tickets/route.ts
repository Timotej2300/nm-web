import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { hasSameOrigin, readJson, RequestError } from "@/lib/security/requests";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const idSchema = z.string().uuid();
const operationSchema = z.discriminatedUnion("operation", [
  z.object({
    operation: z.literal("status"),
    ticketId: idSchema,
    status: z.enum(["open", "waiting", "in_progress", "resolved", "closed"]),
  }).strict(),
  z.object({
    operation: z.literal("assign"),
    ticketId: idSchema,
    assignee: z.enum(["self", "none"]),
  }).strict(),
  z.object({
    operation: z.enum(["reply", "internal_note"]),
    ticketId: idSchema,
    body: z.string().trim().min(1).max(12_000),
  }).strict(),
]);

async function authorize() {
  const { user } = await getAuthenticatedUser();
  if (!user)
    return { response: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  const permission = await checkCurrentPermission("ninjamelonweb.tickets");
  if (!permission.allowed)
    return {
      response: NextResponse.json(
        { error: permission.reason === "denied" ? "Ticket permission denied" : "Permission check unavailable" },
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
    return NextResponse.json({ error: "Ticket service is not configured" }, { status: 503 });

  const ticketId = request.nextUrl.searchParams.get("ticketId");
  if (ticketId) {
    if (!idSchema.safeParse(ticketId).success)
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    const [{ data: ticket, error: ticketError }, { data: messages, error: messagesError }] =
      await Promise.all([
        admin.from("tickets")
          .select("id,owner_user_id,assigned_to,category,subject,status,created_at,updated_at,closed_at")
          .eq("id", ticketId).maybeSingle(),
        admin.from("ticket_messages")
          .select("id,author_user_id,body,is_internal,created_at")
          .eq("ticket_id", ticketId).order("created_at", { ascending: true }).limit(200),
      ]);
    if (ticketError || messagesError)
      return NextResponse.json({ error: "Ticket is temporarily unavailable" }, { status: 503 });
    if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    return NextResponse.json(
      { ticket, messages: messages ?? [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  const { data, error } = await admin.from("tickets")
    .select("id,owner_user_id,assigned_to,category,subject,status,created_at,updated_at,closed_at")
    .order("updated_at", { ascending: false }).limit(100);
  if (error)
    return NextResponse.json({ error: "Ticket queue is temporarily unavailable" }, { status: 503 });
  return NextResponse.json({ tickets: data ?? [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Origin check failed" }, { status: 403 });
  const access = await authorize();
  if ("response" in access) return access.response;
  const rate = await enforceRateLimit(request, "admin-ticket", 60, 3600, access.user.id);
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many attempts or protection is unavailable" },
      { status: rate.reason === "exceeded" ? 429 : 503 },
    );
  try {
    const body = await readJson(request, operationSchema);
    const admin = createSupabaseAdminClient();
    if (!admin)
      return NextResponse.json({ error: "Ticket service is not configured" }, { status: 503 });
    const { data, error } = await admin.rpc("manage_player_ticket", {
      p_actor_user_id: access.user.id,
      p_ticket_id: body.ticketId,
      p_operation: body.operation,
      p_status: body.operation === "status" ? body.status : null,
      p_assignee_user_id: body.operation === "assign"
        ? body.assignee === "self" ? access.user.id : null
        : null,
      p_body: "body" in body ? body.body : null,
    });
    if (error || !data)
      return NextResponse.json({ error: "Ticket action could not be completed" }, { status: 409 });
    return NextResponse.json({ result: data }, { status: 200 });
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Ticket action could not be completed" }, { status: 503 });
  }
}