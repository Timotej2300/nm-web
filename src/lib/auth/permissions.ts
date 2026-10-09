import "server-only";
import { z } from "zod";
import { requestBridge, BridgeUnavailableError } from "@/lib/minecraft/bridge";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getMaintenanceState } from "@/lib/maintenance-state";
import { previewTestPermissionAllowed } from "@/lib/auth/preview-test-policy";

export const permissionNodes = [
  "ninjamelonweb.staff",
  "ninjamelonweb.dashboard",
  "ninjamelonweb.team",
  "ninjamelonweb.ranks",
  "ninjamelonweb.forum",
  "ninjamelonweb.tickets",
  "ninjamelonweb.recruitment",
  "ninjamelonweb.news",
  "ninjamelonweb.pages",
  "ninjamelonweb.settings",
  "ninjamelonweb.maintenance",
  "ninjamelonweb.permissions",
  "ninjamelonweb.audit",
] as const;
export type PermissionNode = (typeof permissionNodes)[number];
export type PermissionCheck = {
  allowed: boolean;
  reason:
    | "allowed"
    | "not_signed_in"
    | "not_linked"
    | "bridge_unavailable"
    | "denied";
};

const permissionReply = z.object({
  allowed: z.boolean(),
  uuid: z.string().uuid(),
  permission: z.enum(permissionNodes),
  checkedAt: z.string().datetime({ offset: true }),
});

export async function checkCurrentPermission(
  permission: PermissionNode,
): Promise<PermissionCheck> {
  const sessionClient = await createSupabaseServerClient();
  if (!sessionClient) return { allowed: false, reason: "bridge_unavailable" };
  const { data: userResult, error: authError } =
    await sessionClient.auth.getUser();
  if (authError || !userResult.user)
    return { allowed: false, reason: "not_signed_in" };
  const admin = createSupabaseAdminClient();
  if (!admin) return { allowed: false, reason: "bridge_unavailable" };
  if (
    previewTestPermissionAllowed(
      userResult.user.id,
      permission,
      {
        vercelEnv: process.env.VERCEL_ENV,
        enabled: process.env.NINJAMELON_PREVIEW_TEST_MODE,
        testUserId: process.env.NINJAMELON_PREVIEW_TEST_USER_ID,
      },
    )
  ) return { allowed: true, reason: "allowed" };
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("minecraft_uuid")
    .eq("user_id", userResult.user.id)
    .maybeSingle();
  if (profileError || !profile?.minecraft_uuid)
    return { allowed: false, reason: "not_linked" };
  if (permission !== "ninjamelonweb.staff") {
    const staff = await checkUuidPermission(
      profile.minecraft_uuid,
      "ninjamelonweb.staff",
    );
    if (!staff.allowed) return staff;
  }
  if (permission !== "ninjamelonweb.maintenance") {
    const maintenance = await getMaintenanceState();
    if (maintenance.status === "unavailable")
      return { allowed: false, reason: "bridge_unavailable" };
    if (maintenance.enabled) {
      const bypass = await checkUuidPermission(
        profile.minecraft_uuid,
        "ninjamelonweb.maintenance",
      );
      if (!bypass.allowed) return bypass;
    }
  }
  return checkUuidPermission(profile.minecraft_uuid, permission);
}

async function checkUuidPermission(
  uuid: string,
  permission: PermissionNode,
): Promise<PermissionCheck> {
  try {
    const reply = permissionReply.safeParse(
      await requestBridge("permissionCheck", {
        uuid,
        permission,
      }),
    );
    if (
      !reply.success ||
      reply.data.uuid !== uuid ||
      reply.data.permission !== permission
    ) {
      return { allowed: false, reason: "bridge_unavailable" };
    }
    const checkedAt = Date.parse(reply.data.checkedAt);
    if (
      !Number.isFinite(checkedAt) ||
      Date.now() - checkedAt < -10_000 ||
      Date.now() - checkedAt > 15_000
    ) {
      return { allowed: false, reason: "bridge_unavailable" };
    }
    return reply.data.allowed
      ? { allowed: true, reason: "allowed" }
      : { allowed: false, reason: "denied" };
  } catch (error) {
    if (error instanceof BridgeUnavailableError)
      return { allowed: false, reason: "bridge_unavailable" };
    return { allowed: false, reason: "bridge_unavailable" };
  }
}
