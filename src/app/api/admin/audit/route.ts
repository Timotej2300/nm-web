import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user } = await getAuthenticatedUser();
  if (!user)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const permission = await checkCurrentPermission("ninjamelonweb.audit");
  if (!permission.allowed)
    return NextResponse.json(
      { error: permission.reason === "denied" ? "Audit permission denied" : "Permission check unavailable" },
      { status: permission.reason === "denied" ? 403 : 503 },
    );
  const admin = createSupabaseAdminClient();
  if (!admin)
    return NextResponse.json({ error: "Audit service is not configured" }, { status: 503 });
  const { data, error } = await admin
    .from("admin_audit_logs")
    .select("id,actor_user_id,action,target_type,target_id,result,metadata,created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error)
    return NextResponse.json({ error: "Audit log is temporarily unavailable" }, { status: 503 });
  return NextResponse.json({ events: data ?? [] }, {
    headers: { "Cache-Control": "private, no-store" },
  });
}