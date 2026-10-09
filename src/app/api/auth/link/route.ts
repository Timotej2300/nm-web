import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getAuthenticatedUser } from "@/lib/auth/session";
import { BridgeUnavailableError, requestBridge } from "@/lib/minecraft/bridge";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  hasSameOrigin,
  readJson,
  RequestError,
} from "@/lib/security/requests";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    code: z.string().trim().regex(/^[A-Za-z0-9-]{6,24}$/),
  })
  .strict();

const bridgeReplySchema = z
  .object({
    success: z.literal(true),
    codeConsumed: z.literal(true),
    uuid: z.string().uuid(),
    username: z.string().regex(/^[A-Za-z0-9_]{3,16}$/),
    verifiedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export async function POST(request: NextRequest) {
  if (!hasSameOrigin(request))
    return NextResponse.json({ error: "Origin check failed" }, { status: 403 });
  const rate = await enforceRateLimit(request, "identity-link", 5, 600);
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
  const { user } = await getAuthenticatedUser();
  if (!user)
    return NextResponse.json({ error: "Sign in to continue" }, { status: 401 });

  try {
    const { code } = await readJson(request, bodySchema, 1024);
    const admin = createSupabaseAdminClient();
    if (!admin)
      return NextResponse.json(
        { error: "Account linking is not configured" },
        { status: 503 },
      );
    const bridgeReply = bridgeReplySchema.safeParse(
      await requestBridge("linkVerify", {
        code: code.toUpperCase(),
        userId: user.id,
      }),
    );
    if (!bridgeReply.success)
      return NextResponse.json(
        { error: "The code could not be verified by the game network" },
        { status: 422 },
      );
    const verifiedAt = Date.parse(bridgeReply.data.verifiedAt);
    if (
      !Number.isFinite(verifiedAt) ||
      Math.abs(Date.now() - verifiedAt) > 30_000
    )
      return NextResponse.json(
        { error: "The verification response is stale" },
        { status: 503 },
      );

    const codeHash = createHash("sha256")
      .update(code.toUpperCase())
      .digest("hex");
    const { error } = await admin.rpc("link_minecraft_identity", {
      p_user_id: user.id,
      p_uuid: bridgeReply.data.uuid,
      p_username: bridgeReply.data.username,
      p_code_hash: codeHash,
    });
    if (error) {
      const conflict = error.code === "23505" || error.code === "P0001";
      return NextResponse.json(
        {
          error: conflict
            ? "This account or Minecraft identity is already linked"
            : "Could not save the verified account link",
        },
        { status: conflict ? 409 : 503 },
      );
    }

    return NextResponse.json({ linked: true }, { status: 200 });
  } catch (error) {
    if (error instanceof RequestError)
      return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof BridgeUnavailableError)
      return NextResponse.json(
        { error: "The Minecraft network is unavailable" },
        { status: 503 },
      );
    return NextResponse.json({ error: "Account linking failed" }, { status: 503 });
  }
}