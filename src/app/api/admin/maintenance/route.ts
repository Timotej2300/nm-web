import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { clearMaintenanceStateCache, getMaintenanceState } from "@/lib/maintenance-state";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { hasSameOrigin, readJson, RequestError } from "@/lib/security/requests";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  enabled: z.boolean(),
  messageSk: z.string().trim().max(500),
  messageCs: z.string().trim().max(500),
}).strict();

async function authorize() {
  const { user } = await getAuthenticatedUser();
  if (!user)
    return { response: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  const permission = await checkCurrentPermission("ninjamelonweb.maintenance");
  if (!permission.allowed)
    return {
      response: NextResponse.json(
        { error: permission.reason === "denied" ? "Maintenance permission denied" : "Permission check unavailable" },
        { status: permission.reason === "denied" ? 403 : 503 },
      ),
    };
  return { user };
}

export async function GET() {
  const access = await authorize();
  if ("response" in access) return access.response;
  const setting = await getMaintenanceState();
  if (setting.status === "not_configured" || setting.status === "unavailable")
    return NextResponse.json({ error: "Maintenance storage is not available" }, { status: 503 });
  return NextResponse.json(
    { enabled: setting.enabled, messageSk: setting.messageSk ?? "", messageCs: setting.messageCs ?? "" },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Origin check failed" }, { status: 403 });
  const access = await authorize();
  if ("response" in access) return access.response;
  const rate = await enforceRateLimit(request, "admin-maintenance", 12, 3600, access.user.id);
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many attempts or protection is unavailable" },
      { status: rate.reason === "exceeded" ? 429 : 503 },
    );
  try {
    const body = await readJson(request, updateSchema, 2048);
    const admin = createSupabaseAdminClient();
    if (!admin)
      return NextResponse.json({ error: "Maintenance storage is not configured" }, { status: 503 });
    const { data, error } = await admin.rpc("set_site_maintenance", {
      p_actor_user_id: access.user.id,
      p_enabled: body.enabled,
      p_message_sk: body.messageSk || null,
      p_message_cs: body.messageCs || null,
    });
    if (error || !data)
      return NextResponse.json({ error: "Maintenance settings could not be saved" }, { status: 409 });
    clearMaintenanceStateCache();
    return NextResponse.json({ enabled: body.enabled });
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Maintenance settings could not be saved" }, { status: 503 });
  }
}