import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { hasSameOrigin, readJson, RequestError } from "@/lib/security/requests";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    email: z.string().trim().email().max(254),
    token: z.string().trim().regex(/^[0-9]{6,8}$/),
  })
  .strict();

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Origin check failed" }, { status: 403 });
  try {
    const { email, token } = await readJson(request, bodySchema, 2048);
    const rate = await enforceRateLimit(
      request,
      "login-verify",
      6,
      900,
      email,
    );
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
    const { error } = await client.auth.verifyOtp({
      email: email.toLowerCase(),
      token,
      type: "email",
    });
    if (error)
      return NextResponse.json(
        { error: "The sign-in code is invalid or expired" },
        { status: 400 },
      );
    return NextResponse.json({ signedIn: true });
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Sign-in could not be completed" }, { status: 503 });
  }
}