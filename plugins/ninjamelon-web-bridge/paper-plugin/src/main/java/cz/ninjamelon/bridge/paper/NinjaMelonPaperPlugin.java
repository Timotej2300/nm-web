package cz.ninjamelon.bridge.paper;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import org.bukkit.plugin.java.JavaPlugin;
import cz.ninjamelon.bridge.BridgeProtocol;

public final class NinjaMelonPaperPlugin extends JavaPlugin {
  private static final String HEARTBEAT_PATH = "/internal/v1/heartbeat/paper";
  private final HttpClient client = HttpClient.newBuilder()
      .connectTimeout(Duration.ofSeconds(2))
      .build();
  private ScheduledExecutorService heartbeatExecutor;
  private String secret;
  private String keyId;
  private URI heartbeatUri;

  @Override
  public void onEnable() {
    secret = env("NINJAMELON_BRIDGE_SECRET");
    keyId = env("NINJAMELON_BRIDGE_KEY_ID");
    String baseUrl = env("NINJAMELON_PAPER_HEARTBEAT_URL");
    if (secret.length() < 32 || keyId.isBlank() || baseUrl.isBlank()) {
      getLogger().warning(
          "Signed heartbeat is not configured; Paper integration will show unavailable.");
      return;
    }
    try {
      URI base = URI.create(baseUrl);
      boolean localEndpoint =
          "localhost".equalsIgnoreCase(base.getHost())
              || "127.0.0.1".equals(base.getHost());
      if ((!"https".equalsIgnoreCase(base.getScheme()) && !localEndpoint)
          || base.getUserInfo() != null
          || base.getQuery() != null
          || base.getFragment() != null) {
        throw new IllegalArgumentException("Bridge endpoint must use HTTPS");
      }
      heartbeatUri = base.resolve(HEARTBEAT_PATH);
    } catch (RuntimeException exception) {
      getLogger().severe("Invalid heartbeat endpoint; integration disabled.");
      return;
    }

    heartbeatExecutor = Executors.newSingleThreadScheduledExecutor(task -> {
      Thread thread = new Thread(task, "ninjamelon-paper-heartbeat");
      thread.setDaemon(true);
      return thread;
    });
    heartbeatExecutor.scheduleAtFixedRate(this::sendHeartbeat, 0, 30, TimeUnit.SECONDS);
    getLogger().info("NinjaMelon Paper heartbeat enabled.");
  }

  private void sendHeartbeat() {
    try {
      JsonObject payload = new JsonObject();
      payload.addProperty("component", "paper");
      payload.addProperty("version", getServer().getMinecraftVersion());
      payload.addProperty("status", "healthy");
      String body = payload.toString();
      String timestamp = Long.toString(System.currentTimeMillis());
      String nonce = UUID.randomUUID().toString();
      String requestId = UUID.randomUUID().toString();
      String signature = BridgeProtocol.sign(
          secret, "POST", HEARTBEAT_PATH, timestamp, nonce, requestId, body);
      HttpRequest request = HttpRequest.newBuilder(heartbeatUri)
          .timeout(Duration.ofSeconds(3))
          .header("Content-Type", "application/json")
          .header("Accept", "application/json")
          .header("X-NM-Key-Id", keyId)
          .header("X-NM-Timestamp", timestamp)
          .header("X-NM-Nonce", nonce)
          .header("X-NM-Request-Id", requestId)
          .header("X-NM-Signature", signature)
          .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
          .build();
      HttpResponse<String> response =
          client.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
      String responseTimestamp = response.headers().firstValue("X-NM-Timestamp").orElse("");
      String responseNonce = response.headers().firstValue("X-NM-Nonce").orElse("");
      String responseRequestId = response.headers().firstValue("X-NM-Request-Id").orElse("");
      String responseSignature = response.headers().firstValue("X-NM-Signature").orElse("");
      if (response.statusCode() != 200
          || !requestId.equals(responseRequestId)
          || !BridgeProtocol.verifyResponse(
              secret, "POST", HEARTBEAT_PATH, requestId,
              responseTimestamp, responseNonce, response.body(), responseSignature)) {
        getLogger().warning("Signed heartbeat was rejected or could not be verified.");
        return;
      }
      JsonObject reply = JsonParser.parseString(response.body()).getAsJsonObject();
      if (!reply.has("accepted") || !reply.get("accepted").getAsBoolean())
        getLogger().warning("Heartbeat endpoint did not confirm acceptance.");
    } catch (Exception exception) {
      getLogger().fine("Heartbeat unavailable: " + exception.getClass().getSimpleName());
    }
  }

  @Override
  public void onDisable() {
    if (heartbeatExecutor != null) {
      heartbeatExecutor.shutdownNow();
      heartbeatExecutor = null;
    }
  }

  private static String env(String name) {
    String value = System.getenv(name);
    return value == null ? "" : value.trim();
  }
}