import "server-only";
import { createHash } from "node:crypto";
import { requestFingerprint } from "@/lib/security/requests";
import type { NextRequest } from "next/server";

export type LimitResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: "exceeded" | "unavailable";
      retryAfterSeconds?: number;
    };

export async function enforceRateLimit(
  request: NextRequest,
  scope: string,
  limit: number,
  windowSeconds: number,
  identity = "",
): Promise<LimitResult> {
  const endpoint = process.env.RATE_LIMIT_REDIS_URL;
  const token = process.env.RATE_LIMIT_REDIS_TOKEN;
  if (!endpoint || !token) return { allowed: false, reason: "unavailable" };

  let base: URL;
  try {
    base = new URL(endpoint);
  } catch {
    return { allowed: false, reason: "unavailable" };
  }
  if (base.protocol !== "https:" || base.username || base.password)
    return { allowed: false, reason: "unavailable" };

  const fingerprint = requestFingerprint(request);
  const identityHash = createHash("sha256")
    .update(identity.trim().toLowerCase())
    .digest("hex")
    .slice(0, 24);
  const key = `nm:rl:${scope}:${fingerprint}:${identityHash}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1_500);
  try {
    const response = await fetch(new URL("/pipeline", base), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(windowSeconds), "NX"],
      ]),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return { allowed: false, reason: "unavailable" };
    const result: unknown = await response.json();
    if (
      !Array.isArray(result) ||
      typeof result[0] !== "object" ||
      result[0] === null ||
      !("result" in result[0])
    )
      return { allowed: false, reason: "unavailable" };
    if (
      result.some(
        (entry) =>
          typeof entry === "object" &&
          entry !== null &&
          "error" in entry,
      )
    )
      return { allowed: false, reason: "unavailable" };
    const count = Number(result[0].result);
    if (!Number.isSafeInteger(count) || count < 1)
      return { allowed: false, reason: "unavailable" };
    return count <= limit
      ? { allowed: true }
      : {
          allowed: false,
          reason: "exceeded",
          retryAfterSeconds: windowSeconds,
        };
  } catch {
    return { allowed: false, reason: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}