import { describe, expect, it } from "vitest";
import {
  signBridgeMessage,
  verifyBridgeMessage,
  type BridgeSignatureInput,
} from "@/lib/minecraft/signature";

const secret = "test-only-secret-not-for-production";
const request: BridgeSignatureInput = {
  method: "POST",
  path: "/v1/permissions/check",
  timestamp: "1791565200000",
  nonce: "f3dbfd6e-081a-4c75-a6c2-252a0b2fd26c",
  requestId: "87689b68-93c6-40b5-b7eb-9ebea0ba9f0e",
  body: '{"uuid":"00000000-0000-0000-0000-000000000001","permission":"ninjamelonweb.staff"}',
};

describe("bridge HMAC signatures", () => {
  it("signs and verifies the canonical method/path/timestamp/nonce/body", () => {
    const signature = signBridgeMessage(secret, request);
    expect(verifyBridgeMessage(secret, request, signature)).toBe(true);
  });

  it("rejects altered bodies, wrong keys, and malformed signatures", () => {
    const signature = signBridgeMessage(secret, request);
    expect(
      verifyBridgeMessage(secret, { ...request, body: "{}" }, signature),
    ).toBe(false);
    expect(verifyBridgeMessage("different-secret", request, signature)).toBe(
      false,
    );
    expect(verifyBridgeMessage(secret, request, "not-a-signature")).toBe(false);
  });
});
