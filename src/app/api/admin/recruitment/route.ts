import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { hasSameOrigin, readJson, RequestError } from "@/lib/security/requests";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const reviewSchema = z.object({
  submissionId: z.string().uuid(),
  status: z.enum(["new", "reviewing", "interview", "accepted", "rejected"]),
  internalNotes: z.string().max(12_000).nullable(),
}).strict();

async function authorize() {
  const { user } = await getAuthenticatedUser();
  if (!user)
    return { response: NextResponse.json({ error: "Sign in required" }, { status: 401 }) };
  const permission = await checkCurrentPermission("ninjamelonweb.recruitment");
  if (!permission.allowed)
    return {
      response: NextResponse.json(
        { error: permission.reason === "denied" ? "Recruitment permission denied" : "Permission check unavailable" },
        { status: permission.reason === "denied" ? 403 : 503 },
      ),
    };
  return { user };
}

export async function GET() {
  const access = await authorize();
  if ("response" in access) return access.response;
  const admin = createSupabaseAdminClient();
  if (!admin)
    return NextResponse.json({ error: "Recruitment service is not configured" }, { status: 503 });
  const { data, error } = await admin
    .from("recruitment_submissions")
    .select("id,form_id,applicant_email,answers,status,internal_notes,reviewed_by,created_at,updated_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error)
    return NextResponse.json({ error: "Applications are temporarily unavailable" }, { status: 503 });
  const formIds = [...new Set((data ?? []).map((row) => row.form_id))];
  const { data: forms, error: formsError } = formIds.length
    ? await admin.from("recruitment_forms").select("id,title_sk,title_cs").in("id", formIds)
    : { data: [], error: null };
  if (formsError)
    return NextResponse.json({ error: "Application forms are temporarily unavailable" }, { status: 503 });
  return NextResponse.json(
    { applications: data ?? [], forms: forms ?? [] },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Origin check failed" }, { status: 403 });
  const access = await authorize();
  if ("response" in access) return access.response;
  const rate = await enforceRateLimit(request, "admin-recruitment", 60, 3600, access.user.id);
  if (!rate.allowed)
    return NextResponse.json(
      { error: "Too many attempts or protection is unavailable" },
      { status: rate.reason === "exceeded" ? 429 : 503 },
    );
  try {
    const body = await readJson(request, reviewSchema, 16_384);
    const admin = createSupabaseAdminClient();
    if (!admin)
      return NextResponse.json({ error: "Recruitment service is not configured" }, { status: 503 });
    const { data, error } = await admin.rpc("review_recruitment_submission", {
      p_actor_user_id: access.user.id,
      p_submission_id: body.submissionId,
      p_status: body.status,
      p_internal_notes: body.internalNotes,
    });
    if (error || !data)
      return NextResponse.json({ error: "Application could not be updated" }, { status: 409 });
    return NextResponse.json({ result: data });
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Application could not be updated" }, { status: 503 });
  }
}