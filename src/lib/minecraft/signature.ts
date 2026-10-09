import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export type BridgeSignatureInput = {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  requestId: string;
  body: string;
};

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function canonicalBridgeMessage(input: BridgeSignatureInput): string {
  return [
    input.method.toUpperCase(),
    input.path,
    input.timestamp,
    input.nonce,
    input.requestId,
    sha256Hex(input.body),
  ].join("\n");
}

export function signBridgeMessage(
  secret: string,
  input: BridgeSignatureInput,
): string {
  return createHmac("sha256", secret)
    .update(canonicalBridgeMessage(input), "utf8")
    .digest("base64url");
}

export function verifyBridgeMessage(
  secret: string,
  input: BridgeSignatureInput,
  signature: string,
): boolean {
  if (!/^[A-Za-z0-9_-]{43}$/.test(signature)) return false;
  const expected = Buffer.from(signBridgeMessage(secret, input), "base64url");
  const received = Buffer.from(signature, "base64url");
  return (
    expected.length === received.length && timingSafeEqual(expected, received)
  );
}
