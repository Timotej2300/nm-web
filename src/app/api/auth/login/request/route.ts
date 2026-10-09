import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasSameOrigin, readJson, RequestError } from "@/lib/security/requests";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({ email: z.string().trim().email().max(254) })
  .strict();

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Origin check failed" }, { status: 403 });
  try {
    const { email } = await readJson(request, bodySchema, 2048);
    const rate = await enforceRateLimit(request, "login-request", 5, 900, email);
    if (!rate.allowed)
      return NextResponse.json(
        { error: "Too many attempts or protection is unavailable" },
        {
          status: rate.reason === "exceeded" ? 429 : 503,
          headers: rate.retryAfterSeconds
            ? { "Retry-After": String(rate.retryAfterSeconds) }
            : undefined,
        },
      );

    const client = await createSupabaseServerClient();
    if (!client)
      return NextResponse.json(
        { error: "Sign-in is not configured" },
        { status: 503 },
      );
    await client.auth.signInWithOtp({
      email: email.toLowerCase(),
      options: { shouldCreateUser: false },
    });
    // Do not disclose whether an address belongs to a pre-provisioned account.
    return NextResponse.json({ accepted: true });
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json(
      { error: "Sign-in could not be started. Please try again later." },
      { status: 503 },
    );
  }
}