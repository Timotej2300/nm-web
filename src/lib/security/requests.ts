import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

export class RequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RequestError";
  }
}

export function hasSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin || !configured) return false;
  try {
    return new URL(origin).origin === new URL(configured).origin;
  } catch {
    return false;
  }
}

export async function readJson<T extends z.ZodType>(
  request: NextRequest,
  schema: T,
  maxBytes = 16_384,
): Promise<z.infer<T>> {
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxBytes)
    throw new RequestError(413, "Request body is too large");
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes)
    throw new RequestError(413, "Request body is too large");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new RequestError(400, "Invalid JSON body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new RequestError(400, "Invalid request fields");
  return parsed.data;
}

export function requestFingerprint(request: NextRequest): string {
  const forwarded =
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const address = forwarded.split(",")[0]?.trim().slice(0, 128) || "unknown";
  return createHash("sha256").update(address).digest("hex");
}