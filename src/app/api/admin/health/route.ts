import { NextResponse } from "next/server";
import { z } from "zod";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { BridgeUnavailableError, requestBridge } from "@/lib/minecraft/bridge";

export const dynamic = "force-dynamic";

const healthSchema = z
  .object({
    checkedAt: z.string().datetime({ offset: true }),
    velocity: z.enum(["healthy", "unavailable"]),
    paper: z.enum(["healthy", "unavailable"]),
    luckperms: z.enum(["healthy", "unavailable"]),
    paperLastHeartbeatAt: z.string().datetime({ offset: true }).nullable(),
    paperVersion: z.string().max(80).nullable(),
  })
  .strict();

export async function GET() {
  const permission = await checkCurrentPermission("ninjamelonweb.dashboard");
  if (!permission.allowed)
    return NextResponse.json({ error: "Dashboard access denied" }, { status: 403 });
  try {
    const parsed = healthSchema.safeParse(
      await requestBridge("integrationHealth"),
    );
    if (!parsed.success)
      return NextResponse.json(
        { error: "Integration health response is invalid" },
        { status: 503 },
      );
    const age = Date.now() - Date.parse(parsed.data.checkedAt);
    if (!Number.isFinite(age) || age < -10_000 || age > 15_000)
      return NextResponse.json(
        { error: "Integration health response is stale" },
        { status: 503 },
      );
    return NextResponse.json(parsed.data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof BridgeUnavailableError
            ? "Minecraft bridge unavailable"
            : "Integration health unavailable",
      },
      { status: 503 },
    );
  }
}