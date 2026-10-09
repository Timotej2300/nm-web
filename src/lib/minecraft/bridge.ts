import "server-only";
import { randomUUID } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  signBridgeMessage,
  verifyBridgeMessage,
  type BridgeSignatureInput,
} from "@/lib/minecraft/signature";

const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_CLOCK_SKEW_MS = 30_000;
const endpoints = {
  networkStatus: { method: "GET", path: "/v1/network/status" },
  integrationHealth: { method: "GET", path: "/v1/integrations/health" },
  permissionCheck: { method: "POST", path: "/v1/permissions/check" },
  linkVerify: { method: "POST", path: "/v1/identity/link/verify" },
  rankSnapshot: { method: "GET", path: "/v1/luckperms/snapshot" },
  rankStep: { method: "POST", path: "/v1/luckperms/track-step" },
} as const;

export type BridgeOperation = keyof typeof endpoints;
export class BridgeUnavailableError extends Error {
  constructor(message = "Minecraft bridge unavailable") {
    super(message);
    this.name = "BridgeUnavailableError";
  }
}

function bridgeConfig() {
  const base = process.env.NINJAMELON_BRIDGE_URL;
  const keyId = process.env.NINJAMELON_BRIDGE_KEY_ID;
  const secret = process.env.NINJAMELON_BRIDGE_SECRET;
  if (!base || !keyId || !secret) return null;
  let url: URL;
  try {
    url = new URL(base);
  } catch {
    return null;
  }
  const localHttp =
    process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !localHttp) return null;
  if (url.username || url.password || url.search || url.hash) return null;
  return { base: url, keyId, secret };
}

async function consumeResponseNonce(
  nonce: string,
  requestId: string,
): Promise<boolean> {
  const admin = createSupabaseAdminClient();
  if (!admin) return false;
  const { error } = await admin.from("bridge_nonces").insert({
    nonce,
    request_id: requestId,
    direction: "response",
    seen_at: new Date().toISOString(),
  });
  return !error;
}

async function readLimitedBody(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new BridgeUnavailableError(
      "Bridge response exceeds the permitted size",
    );
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new BridgeUnavailableError(
        "Bridge response exceeds the permitted size",
      );
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(merged);
}

export async function requestBridge<T>(
  operation: BridgeOperation,
  payload?: unknown,
): Promise<T> {
  const config = bridgeConfig();
  if (!config)
    throw new BridgeUnavailableError(
      "Bridge credentials or HTTPS endpoint are not configured",
    );
  const endpoint = endpoints[operation];
  const body = endpoint.method === "GET" ? "" : JSON.stringify(payload ?? {});
  const timestamp = String(Date.now());
  const nonce = randomUUID();
  const requestId = randomUUID();
  const signatureInput: BridgeSignatureInput = {
    method: endpoint.method,
    path: endpoint.path,
    timestamp,
    nonce,
    requestId,
    body,
  };
  const signature = signBridgeMessage(config.secret, signatureInput);
  const url = new URL(endpoint.path, config.base);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(url, {
      method: endpoint.method,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-NM-Key-Id": config.keyId,
        "X-NM-Timestamp": timestamp,
        "X-NM-Nonce": nonce,
        "X-NM-Request-Id": requestId,
        "X-NM-Signature": signature,
      },
      ...(body ? { body } : {}),
      cache: "no-store",
      signal: controller.signal,
    });
    const responseBody = await readLimitedBody(response);
    if (!response.ok)
      throw new BridgeUnavailableError(
        `Bridge returned HTTP ${response.status}`,
      );

    const responseTimestamp = response.headers.get("x-nm-timestamp") ?? "";
    const responseNonce = response.headers.get("x-nm-nonce") ?? "";
    const responseRequestId = response.headers.get("x-nm-request-id") ?? "";
    const responseSignature = response.headers.get("x-nm-signature") ?? "";
    const timestampNumber = Number(responseTimestamp);
    if (
      !Number.isSafeInteger(timestampNumber) ||
      Math.abs(Date.now() - timestampNumber) > MAX_CLOCK_SKEW_MS
    ) {
      throw new BridgeUnavailableError(
        "Bridge response timestamp is invalid or stale",
      );
    }
    if (
      !/^[0-9a-f-]{36}$/i.test(responseRequestId) ||
      responseRequestId !== requestId
    ) {
      throw new BridgeUnavailableError("Bridge request ID does not match");
    }
    if (!/^[0-9a-f-]{36}$/i.test(responseNonce)) {
      throw new BridgeUnavailableError("Bridge response nonce is invalid");
    }
    const responseInput: BridgeSignatureInput = {
      method: `RESPONSE_${endpoint.method}`,
      path: endpoint.path,
      timestamp: responseTimestamp,
      nonce: responseNonce,
      requestId,
      body: responseBody,
    };
    if (!verifyBridgeMessage(config.secret, responseInput, responseSignature)) {
      throw new BridgeUnavailableError("Bridge response signature is invalid");
    }
    if (!(await consumeResponseNonce(responseNonce, requestId))) {
      throw new BridgeUnavailableError("Bridge response replay check failed");
    }
    try {
      return JSON.parse(responseBody) as T;
    } catch {
      throw new BridgeUnavailableError("Bridge response is not valid JSON");
    }
  } catch (error) {
    if (error instanceof BridgeUnavailableError) throw error;
    throw new BridgeUnavailableError("Bridge request failed or timed out");
  } finally {
    clearTimeout(timeout);
  }
}
