package cz.ninjamelon.bridge;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.UUID;
import org.junit.jupiter.api.Test;

final class BridgeProtocolTest {
  private static final String SECRET = "test-secret-that-is-long-enough-for-ci";

  @Test
  void hmacMatchesTheWebRuntimeVector() {
    assertEquals(
        "GpbAFTqIRUmCBgrWcxuZMbhiOjETbmlPR_JMSfLy76E",
        BridgeProtocol.sign(
            SECRET,
            "POST",
            "/v1/identity/link/verify",
            "1791576000000",
            "123e4567-e89b-12d3-a456-426614174000",
            "123e4567-e89b-12d3-a456-426614174001",
            "{\"code\":\"TESTCODE\"}"));
  }

  @Test
  void responseValidationChecksFreshnessAndRequestIdentity() {
    String timestamp = Long.toString(System.currentTimeMillis());
    String nonce = UUID.randomUUID().toString();
    String requestId = UUID.randomUUID().toString();
    String body = "{\"accepted\":true}";
    String signature = BridgeProtocol.sign(
        SECRET, "RESPONSE_POST", "/internal/v1/heartbeat/paper",
        timestamp, nonce, requestId, body);

    assertTrue(BridgeProtocol.verifyResponse(
        SECRET, "POST", "/internal/v1/heartbeat/paper", requestId,
        timestamp, nonce, body, signature));
    assertFalse(BridgeProtocol.verifyResponse(
        SECRET, "POST", "/internal/v1/heartbeat/paper", UUID.randomUUID().toString(),
        timestamp, nonce, body, signature));
  }

  @Test
  void replayGuardRejectsDuplicateNoncesAndEvictsExpiredEntries() {
    ReplayGuard guard = new ReplayGuard();
    long now = System.currentTimeMillis();
    String nonce = UUID.randomUUID().toString();
    assertTrue(guard.accept(nonce, now));
    assertFalse(guard.accept(nonce, now));

    String stale = UUID.randomUUID().toString();
    assertTrue(guard.accept(stale, now - 120_000));
    assertTrue(guard.accept(UUID.randomUUID().toString(), now));
  }
}