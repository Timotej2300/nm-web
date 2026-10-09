import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { hasSameOrigin, readJson, RequestError } from "@/lib/security/requests";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const saveSchema = z.object({
  userId: z.string().uuid(),
  roleSk: z.string().trim().min(1).max(80),
  roleCs: z.string().trim().min(1).max(80),
  bioSk: z.string().max(1000).nullable(),
  bioCs: z.string().max(1000).nullable(),
  displayOrder: z.number().int().min(-10_000).max(10_000),
  isListed: z.boolean(),
}).strict();

async function authorize() {
  const { user } = await getAuthenticatedUser();
  if (!user)
    return { response: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  const permission = await checkCurrentPermission("ninjamelonweb.team");
  if (!permission.allowed)
    return {
      response: NextResponse.json(
        { error: permission.reason === "denied" ? "Team permission denied" : "Permission check unavailable" },
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
    return NextResponse.json({ error: "Team service is not configured" }, { status: 503 });
  const query = request.nextUrl.searchParams.get("q")?.trim();
  if (query) {
    const parsed = z.string().regex(/^[a-zA-Z0-9_]{3,16}$/).safeParse(query);
    if (!parsed.success) return NextResponse.json({ players: [] });
    const { data, error } = await admin.from("profiles")
      .select("user_id,minecraft_username,display_name,is_public")
      .not("minecraft_uuid", "is", null)
      .ilike("minecraft_username", `${parsed.data}%`)
      .order("minecraft_username", { ascending: true })
      .limit(10);
    if (error)
      return NextResponse.json({ error: "Player lookup is temporarily unavailable" }, { status: 503 });
    return NextResponse.json({ players: data ?? [] }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const { data: members, error } = await admin.from("team_members")
    .select("user_id,role_sk,role_cs,bio_sk,bio_cs,display_order,is_listed,rank_key")
    .order("display_order", { ascending: true }).limit(200);
  if (error)
    return NextResponse.json({ error: "Team list is temporarily unavailable" }, { status: 503 });
  const userIds = (members ?? []).map((member) => member.user_id);
  const { data: profiles, error: profileError } = userIds.length
    ? await admin.from("profiles")
      .select("user_id,minecraft_username,display_name,is_public")
      .in("user_id", userIds)
    : { data: [], error: null };
  if (profileError)
    return NextResponse.json({ error: "Team profiles are temporarily unavailable" }, { status: 503 });
  const profileById = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]));
  return NextResponse.json(
    { members: (members ?? []).map((member) => ({ ...member, profile: profileById.get(member.user_id) ?? null })) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Origin check failed" }, { status: 403 });
  const access = await authorize();
  if ("response" in access) return access.response;
  const rate = await enforceRateLimit(request, "admin-team", 30, 3600, access.user.id);
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many attempts or protection is unavailable" },
      { status: rate.reason === "exceeded" ? 429 : 503 },
    );
  try {
    const member = await readJson(request, saveSchema);
    const admin = createSupabaseAdminClient();
    if (!admin)
      return NextResponse.json({ error: "Team service is not configured" }, { status: 503 });
    const { data, error } = await admin.rpc("save_team_member", {
      p_actor_user_id: access.user.id,
      p_user_id: member.userId,
      p_role_sk: member.roleSk,
      p_role_cs: member.roleCs,
      p_bio_sk: member.bioSk,
      p_bio_cs: member.bioCs,
      p_display_order: member.displayOrder,
      p_is_listed: member.isListed,
    });
    if (error || !data)
      return NextResponse.json({ error: "Team member could not be saved" }, { status: 409 });
    return NextResponse.json({ userId: data });
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Team member could not be saved" }, { status: 503 });
  }
}