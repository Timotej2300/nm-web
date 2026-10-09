import "server-only";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type MaintenanceState = {
  status: "not_configured" | "inactive" | "active" | "unavailable";
  enabled: boolean;
  messageSk: string | null;
  messageCs: string | null;
};

const inactive: MaintenanceState = {
  status: "inactive",
  enabled: false,
  messageSk: null,
  messageCs: null,
};
const notConfigured: MaintenanceState = {
  ...inactive,
  status: "not_configured",
};
const unavailable: MaintenanceState = {
  ...inactive,
  status: "unavailable",
};
const settingSchema = z.object({
  enabled: z.boolean(),
  message_sk: z.string().max(500).nullable(),
  message_cs: z.string().max(500).nullable(),
}).strict();

let cache: { value: MaintenanceState; expiresAt: number } | null = null;
const cacheTimeMs = 3_000;

export function clearMaintenanceStateCache() {
  cache = null;
}

export async function getMaintenanceState(): Promise<MaintenanceState> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  let admin: ReturnType<typeof createSupabaseAdminClient>;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    cache = { value: unavailable, expiresAt: Date.now() + 500 };
    return unavailable;
  }
  if (!admin) {
    cache = { value: notConfigured, expiresAt: Date.now() + cacheTimeMs };
    return notConfigured;
  }
  let data: { value: unknown } | null;
  let error: unknown;
  try {
    const result = await admin
      .from("site_settings")
      .select("value")
      .eq("setting_key", "maintenance")
      .maybeSingle();
    data = result.data;
    error = result.error;
  } catch {
    cache = { value: unavailable, expiresAt: Date.now() + 500 };
    return unavailable;
  }
  if (error) {
    cache = { value: unavailable, expiresAt: Date.now() + 500 };
    return unavailable;
  }
  if (!data) {
    cache = { value: inactive, expiresAt: Date.now() + cacheTimeMs };
    return inactive;
  }
  const parsed = settingSchema.safeParse(data.value);
  if (!parsed.success) {
    cache = { value: unavailable, expiresAt: Date.now() + 500 };
    return unavailable;
  }
  const value: MaintenanceState = {
    status: parsed.data.enabled ? "active" : "inactive",
    enabled: parsed.data.enabled,
    messageSk: parsed.data.message_sk,
    messageCs: parsed.data.message_cs,
  };
  cache = { value, expiresAt: Date.now() + cacheTimeMs };
  return value;
}