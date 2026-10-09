import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasSameOrigin, readJson, RequestError } from "@/lib/security/requests";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  RecruitmentFieldsSchema,
  validateRecruitmentAnswers,
} from "@/lib/recruitment/schema";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    formId: z.string().uuid(),
    email: z.string().trim().email().max(254),
    answers: z.record(z.string(), z.unknown()),
    website: z.string().max(300).optional(),
  })
  .strict();

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Origin check failed" }, { status: 403 });
  try {
    const body = await readJson(request, bodySchema, 24_576);
    if (body.website) return NextResponse.json({ accepted: true }, { status: 202 });
    const rate = await enforceRateLimit(
      request,
      "recruitment",
      2,
      3600,
      body.email,
    );
    if (!rate.allowed)
      return NextResponse.json(
        { error: "Too many attempts or protection is unavailable" },
        { status: rate.reason === "exceeded" ? 429 : 503 },
      );

    const admin = createSupabaseAdminClient();
    if (!admin)
      return NextResponse.json(
        { error: "Recruitment is not configured" },
        { status: 503 },
      );
    const { data: form, error: formError } = await admin
      .from("recruitment_forms")
      .select("id,fields,is_open,opens_at,closes_at")
      .eq("id", body.formId)
      .maybeSingle();
    if (formError || !form)
      return NextResponse.json(
        { error: "This application form is unavailable" },
        { status: 404 },
      );
    const now = Date.now();
    if (
      !form.is_open ||
      (form.opens_at && Date.parse(form.opens_at) > now) ||
      (form.closes_at && Date.parse(form.closes_at) <= now)
    )
      return NextResponse.json(
        { error: "This application form is closed" },
        { status: 409 },
      );
    const fields = RecruitmentFieldsSchema.safeParse(form.fields);
    if (!fields.success)
      return NextResponse.json(
        { error: "This form is not configured correctly" },
        { status: 503 },
      );
    const answers = validateRecruitmentAnswers(fields.data, body.answers);
    if (!answers)
      return NextResponse.json(
        { error: "Please check every required answer" },
        { status: 400 },
      );
    const { data, error } = await admin.rpc("submit_recruitment_application", {
      p_form_id: body.formId,
      p_applicant_email: body.email.toLowerCase(),
      p_answers: answers,
    });
    if (error || typeof data !== "string")
      return NextResponse.json(
        { error: "Application could not be saved" },
        { status: error?.code === "P0001" ? 409 : 503 },
      );
    return NextResponse.json({ accepted: true, submissionId: data }, { status: 201 });
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: "Application could not be submitted" },
      { status: 503 },
    );
  }
}