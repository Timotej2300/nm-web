package cz.ninjamelon.bridge;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class BridgeProtocol {
  public static final int MAX_BODY_BYTES = 64 * 1024;
  private static final long MAX_CLOCK_SKEW_MS = 30_000;

  private BridgeProtocol() {}

  public record SignedRequest(
      String method, String path, String timestamp, String nonce,
      String requestId, String body) {}

  public static SignedRequest verifyRequest(
      HttpExchange exchange, String secret, String expectedKeyId, ReplayGuard replayGuard)
      throws IOException {
    String method = exchange.getRequestMethod().toUpperCase();
    String path = exchange.getRequestURI().getRawPath();
    if (!("GET".equals(method) || "POST".equals(method))
        || path == null
        || path.length() > 160
        || exchange.getRequestURI().getRawQuery() != null) {
      throw new SecurityException("Invalid request target");
    }

    Headers headers = exchange.getRequestHeaders();
    String keyId = requiredHeader(headers, "X-NM-Key-Id");
    String timestamp = requiredHeader(headers, "X-NM-Timestamp");
    String nonce = requiredHeader(headers, "X-NM-Nonce");
    String requestId = requiredHeader(headers, "X-NM-Request-Id");
    String signature = requiredHeader(headers, "X-NM-Signature");
    if (!MessageDigest.isEqual(
            keyId.getBytes(StandardCharsets.UTF_8),
            expectedKeyId.getBytes(StandardCharsets.UTF_8))
        || !isUuid(nonce)
        || !isUuid(requestId)
        || !timestamp.matches("^[0-9]{13}$")) {
      throw new SecurityException("Invalid authentication headers");
    }
    long instant = Long.parseLong(timestamp);
    if (Math.abs(System.currentTimeMillis() - instant) > MAX_CLOCK_SKEW_MS) {
      throw new SecurityException("Stale request");
    }

    String body = readLimited(exchange);
    String expected = sign(
        secret,
        method,
        path,
        timestamp,
        nonce,
        requestId,
        body);
    if (!constantTimeEquals(expected, signature)) {
      throw new SecurityException("Invalid signature");
    }
    if (!replayGuard.accept(nonce, instant)) {
      throw new SecurityException("Duplicate request");
    }
    return new SignedRequest(method, path, timestamp, nonce, requestId, body);
  }

  public static void sendSignedJson(
      HttpExchange exchange,
      String secret,
      int status,
      SignedRequest request,
      String responseBody) throws IOException {
    byte[] bytes = responseBody.getBytes(StandardCharsets.UTF_8);
    if (bytes.length > MAX_BODY_BYTES) throw new IOException("Response is too large");
    String timestamp = Long.toString(System.currentTimeMillis());
    String nonce = UUID.randomUUID().toString();
    String signature = sign(
        secret,
        "RESPONSE_" + request.method(),
        request.path(),
        timestamp,
        nonce,
        request.requestId(),
        responseBody);
    Headers headers = exchange.getResponseHeaders();
    headers.set("Content-Type", "application/json; charset=utf-8");
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("X-NM-Timestamp", timestamp);
    headers.set("X-NM-Nonce", nonce);
    headers.set("X-NM-Request-Id", request.requestId());
    headers.set("X-NM-Signature", signature);
    exchange.sendResponseHeaders(status, bytes.length);
    try (var output = exchange.getResponseBody()) {
      output.write(bytes);
    }
  }

  public static String sign(
      String secret,
      String method,
      String path,
      String timestamp,
      String nonce,
      String requestId,
      String body) {
    try {
      String digest = HexFormat.of().formatHex(
          MessageDigest.getInstance("SHA-256").digest(body.getBytes(StandardCharsets.UTF_8)));
      String canonical = String.join(
          "\n", method.toUpperCase(), path, timestamp, nonce, requestId, digest);
      Mac mac = Mac.getInstance("HmacSHA256");
      mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
      return Base64.getUrlEncoder().withoutPadding()
          .encodeToString(mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception exception) {
      throw new IllegalStateException("Could not sign bridge message", exception);
    }
  }

  public static boolean verifyResponse(
      String secret,
      String method,
      String path,
      String requestId,
      String timestamp,
      String nonce,
      String body,
      String signature) {
    try {
      long instant = Long.parseLong(timestamp);
      if (Math.abs(System.currentTimeMillis() - instant) > MAX_CLOCK_SKEW_MS
          || !isUuid(nonce)
          || !isUuid(requestId)) {
        return false;
      }
      return constantTimeEquals(
          sign(secret, "RESPONSE_" + method, path, timestamp, nonce, requestId, body),
          signature);
    } catch (RuntimeException exception) {
      return false;
    }
  }

  private static String readLimited(HttpExchange exchange) throws IOException {
    String lengthHeader = exchange.getRequestHeaders().getFirst("Content-Length");
    if (lengthHeader != null) {
      try {
        if (Long.parseLong(lengthHeader) > MAX_BODY_BYTES)
          throw new IOException("Request body is too large");
      } catch (NumberFormatException exception) {
        throw new IOException("Invalid Content-Length", exception);
      }
    }
    try (var input = exchange.getRequestBody();
         var output = new ByteArrayOutputStream()) {
      byte[] buffer = new byte[8192];
      int total = 0;
      int count;
      while ((count = input.read(buffer)) != -1) {
        total += count;
        if (total > MAX_BODY_BYTES) throw new IOException("Request body is too large");
        output.write(buffer, 0, count);
      }
      return StandardCharsets.UTF_8.newDecoder()
          .decode(java.nio.ByteBuffer.wrap(output.toByteArray()))
          .toString();
    } catch (java.nio.charset.CharacterCodingException exception) {
      throw new IOException("Body is not valid UTF-8", exception);
    }
  }

  private static String requiredHeader(Headers headers, String name) {
    String value = headers.getFirst(name);
    if (value == null || value.length() > 160) throw new SecurityException("Missing header");
    return value;
  }

  private static boolean isUuid(String value) {
    try {
      return UUID.fromString(value).toString().equalsIgnoreCase(value);
    } catch (IllegalArgumentException exception) {
      return false;
    }
  }

  private static boolean constantTimeEquals(String left, String right) {
    return MessageDigest.isEqual(
        left.getBytes(StandardCharsets.US_ASCII),
        right.getBytes(StandardCharsets.US_ASCII));
  }
}