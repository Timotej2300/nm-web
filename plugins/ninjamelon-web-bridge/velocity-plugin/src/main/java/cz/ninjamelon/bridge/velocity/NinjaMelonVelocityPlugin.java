package cz.ninjamelon.bridge.velocity;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;
import com.google.gson.JsonPrimitive;
import com.google.inject.Inject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import com.velocitypowered.api.command.CommandManager;
import com.velocitypowered.api.plugin.Plugin;
import com.velocitypowered.api.plugin.annotation.DataDirectory;
import com.velocitypowered.api.proxy.ProxyServer;
import java.io.IOException;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.logging.Logger;
import net.luckperms.api.LuckPerms;
import net.luckperms.api.LuckPermsProvider;
import cz.ninjamelon.bridge.BridgeProtocol;
import cz.ninjamelon.bridge.ReplayGuard;

@Plugin(
    id = "ninjamelonwebbridge",
    name = "NinjaMelonWebBridge",
    version = "0.1.0",
    description = "Signed web integration for NinjaMelon Velocity",
    authors = {"NinjaMelon"})
public final class NinjaMelonVelocityPlugin {
  private static final List<String> PERMISSIONS = List.of(
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
      "ninjamelonweb.audit");
  private final ProxyServer proxy;
  private final Logger logger;
  private final String secret;
  private final String keyId;
  private final String bindAddress;
  private final int port;
  private final int configuredMaxPlayers;
  private final List<String> configuredModes;
  private final Map<String, LinkCode> linkCodes = new ConcurrentHashMap<>();
  private final Map<UUID, Long> linkCooldowns = new ConcurrentHashMap<>();
  private final ReplayGuard replayGuard = new ReplayGuard();
  private volatile LuckPerms luckPerms;
  private volatile long paperHeartbeatAt;
  private volatile String paperVersion;
  private HttpServer server;

  @Inject
  public NinjaMelonVelocityPlugin(
      ProxyServer proxy,
      Logger logger,
      @DataDirectory java.nio.file.Path dataDirectory) {
    this.proxy = proxy;
    this.logger = logger;
    this.secret = env("NINJAMELON_BRIDGE_SECRET");
    this.keyId = env("NINJAMELON_BRIDGE_KEY_ID");
    this.bindAddress = envOr("NINJAMELON_BRIDGE_BIND", "127.0.0.1");
    this.port = parseInt(envOr("NINJAMELON_BRIDGE_PORT", "8765"), 8765);
    this.configuredMaxPlayers = parseInt(envOr("NINJAMELON_NETWORK_MAX_PLAYERS", ""), -1);
    this.configuredModes = List.of(envOr("NINJAMELON_MODE_SERVERS", "").split(","))
        .stream().map(String::trim).filter(value -> !value.isBlank()).distinct().toList();
    try {
      this.luckPerms = LuckPermsProvider.get();
    } catch (IllegalStateException exception) {
      logger.warning("LuckPerms API is not available; permission checks will fail closed.");
    }
    proxy.getCommandManager().register(
        proxy.getCommandManager().metaBuilder("web").plugin(this).build(),
        new WebLinkCommand(this));
    startBridge();
  }

  private void startBridge() {
    if (secret.length() < 32 || keyId.isBlank()) {
      logger.warning("Web bridge is not configured; signed API is disabled.");
      return;
    }
    try {
      InetAddress address = InetAddress.getByName(bindAddress);
      server = HttpServer.create(new InetSocketAddress(address, port), 32);
      server.createContext("/", this::handle);
      server.setExecutor(Executors.newVirtualThreadPerTaskExecutor());
      server.start();
      logger.info("Signed web bridge bound to " + address.getHostAddress() + ":" + port);
    } catch (IOException | RuntimeException exception) {
      logger.severe("Could not start the web bridge: " + exception.getMessage());
    }
  }

  private void handle(HttpExchange exchange) throws IOException {
    BridgeProtocol.SignedRequest request;
    try {
      request = BridgeProtocol.verifyRequest(exchange, secret, keyId, replayGuard);
    } catch (IOException | SecurityException exception) {
      exchange.getResponseHeaders().set("Cache-Control", "no-store");
      exchange.sendResponseHeaders(401, -1);
      exchange.close();
      return;
    }

    try {
      String path = request.path();
      if ("GET".equals(request.method()) && "/v1/network/status".equals(path)) {
        respond(exchange, request, 200, networkStatus());
      } else if ("GET".equals(request.method())
          && "/v1/integrations/health".equals(path)) {
        respond(exchange, request, 200, integrationHealth());
      } else if ("POST".equals(request.method())
          && "/v1/permissions/check".equals(path)) {
        permissionCheck(exchange, request);
      } else if ("POST".equals(request.method())
          && "/v1/identity/link/verify".equals(path)) {
        verifyLinkCode(exchange, request);
      } else if ("POST".equals(request.method())
          && "/internal/v1/heartbeat/paper".equals(path)) {
        receivePaperHeartbeat(exchange, request);
      } else {
        respond(exchange, request, 404, error("Unknown bridge operation"));
      }
    } catch (RuntimeException exception) {
      logger.warning("Signed bridge operation failed: " + exception.getClass().getSimpleName());
      respond(exchange, request, 503, error("Integration unavailable"));
    }
  }

  private JsonObject networkStatus() {
    JsonObject result = new JsonObject();
    result.addProperty("checkedAt", Instant.now().toString());
    if (configuredMaxPlayers < 1) {
      result.addProperty("status", "unavailable");
      result.add("players", null);
      result.add("maxPlayers", null);
      result.add("modes", new com.google.gson.JsonArray());
      return result;
    }

    int onlineModes = 0;
    int registeredModes = 0;
    com.google.gson.JsonArray modes = new com.google.gson.JsonArray();
    for (String serverName : configuredModes) {
      JsonObject mode = new JsonObject();
      mode.addProperty("id", serverName);
      var registered = proxy.getServer(serverName);
      if (registered.isEmpty()) {
        mode.addProperty("status", "unavailable");
        mode.add("players", null);
      } else {
        registeredModes++;
        try {
          registered.get().ping().get(1500, TimeUnit.MILLISECONDS);
          mode.addProperty("status", "online");
          mode.addProperty("players", registered.get().getPlayersConnected().size());
          onlineModes++;
        } catch (Exception exception) {
          mode.addProperty("status", "unavailable");
          mode.add("players", null);
        }
      }
      modes.add(mode);
    }

    int players = proxy.getPlayerCount();
    if (configuredModes.isEmpty() || registeredModes == 0) {
      result.addProperty("status", "unavailable");
      result.add("players", null);
      result.add("maxPlayers", null);
    } else if (onlineModes == 0) {
      result.addProperty("status", "unavailable");
      result.add("players", null);
      result.add("maxPlayers", null);
    } else {
      result.addProperty("status", "online");
      result.addProperty("players", players);
      result.addProperty("maxPlayers", configuredMaxPlayers);
    }
    result.add("modes", modes);
    return result;
  }

  private JsonObject integrationHealth() {
    long now = System.currentTimeMillis();
    JsonObject result = new JsonObject();
    result.addProperty("checkedAt", Instant.ofEpochMilli(now).toString());
    result.addProperty("velocity", "healthy");
    result.addProperty("luckperms", luckPerms == null ? "unavailable" : "healthy");
    boolean paperFresh = paperHeartbeatAt > 0 && now - paperHeartbeatAt <= 90_000;
    result.addProperty("paper", paperFresh ? "healthy" : "unavailable");
    if (paperFresh) {
      result.addProperty(
          "paperLastHeartbeatAt", Instant.ofEpochMilli(paperHeartbeatAt).toString());
    } else {
      result.add("paperLastHeartbeatAt", null);
    }
    if (paperVersion == null) result.add("paperVersion", null);
    else result.addProperty("paperVersion", paperVersion);
    return result;
  }

  private void permissionCheck(
      HttpExchange exchange, BridgeProtocol.SignedRequest request) throws IOException {
    JsonObject body = parseObject(request.body());
    String rawUuid = string(body, "uuid");
    String node = string(body, "permission");
    UUID uuid = UUID.fromString(rawUuid);
    if (!PERMISSIONS.contains(node) || luckPerms == null) {
      respond(exchange, request, 503, error("Permission check unavailable"));
      return;
    }
    boolean allowed;
    try {
      var user = luckPerms.getUserManager().loadUser(uuid).get(4, TimeUnit.SECONDS);
      allowed = user.getCachedData().getPermissionData().checkPermission(node).asBoolean();
    } catch (Exception exception) {
      respond(exchange, request, 503, error("Permission check unavailable"));
      return;
    }
    JsonObject result = new JsonObject();
    result.addProperty("allowed", allowed);
    result.addProperty("uuid", uuid.toString());
    result.addProperty("permission", node);
    result.addProperty("checkedAt", Instant.now().toString());
    respond(exchange, request, 200, result);
  }

  private void verifyLinkCode(
      HttpExchange exchange, BridgeProtocol.SignedRequest request) throws IOException {
    JsonObject body = parseObject(request.body());
    String userId = string(body, "userId");
    UUID.fromString(userId);
    String code = string(body, "code").toUpperCase(java.util.Locale.ROOT);
    if (!code.matches("^[A-HJ-NP-Z2-9]{8}$")) {
      respond(exchange, request, 200, invalidLink());
      return;
    }
    LinkCode item = linkCodes.remove(code);
    if (item == null || item.expiresAt() < System.currentTimeMillis()) {
      respond(exchange, request, 200, invalidLink());
      return;
    }
    JsonObject result = new JsonObject();
    result.addProperty("success", true);
    result.addProperty("codeConsumed", true);
    result.addProperty("uuid", item.playerUuid().toString());
    result.addProperty("username", item.username());
    result.addProperty("verifiedAt", Instant.now().toString());
    respond(exchange, request, 200, result);
  }

  private void receivePaperHeartbeat(
      HttpExchange exchange, BridgeProtocol.SignedRequest request) throws IOException {
    JsonObject body = parseObject(request.body());
    if (!"paper".equals(string(body, "component"))) {
      respond(exchange, request, 400, error("Invalid component"));
      return;
    }
    paperHeartbeatAt = System.currentTimeMillis();
    paperVersion = body.has("version") ? body.get("version").getAsString() : null;
    JsonObject result = new JsonObject();
    result.addProperty("accepted", true);
    result.addProperty("receivedAt", Instant.now().toString());
    respond(exchange, request, 200, result);
  }

  private void respond(
      HttpExchange exchange,
      BridgeProtocol.SignedRequest request,
      int status,
      JsonObject response) throws IOException {
    BridgeProtocol.sendSignedJson(
        exchange, secret, status, request, response.toString());
  }

  void createLinkCode(
      com.velocitypowered.api.proxy.Player player,
      com.velocitypowered.api.command.CommandSource source) {
    long now = System.currentTimeMillis();
    Long last = linkCooldowns.put(player.getUniqueId(), now);
    if (last != null && now - last < 30_000) {
      source.sendMessage(net.kyori.adventure.text.Component.text(
          "Počkaj chvíľu pred vytvorením ďalšieho kódu."));
      return;
    }
    linkCodes.entrySet().removeIf(entry -> entry.getValue().expiresAt() < now);
    String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    java.security.SecureRandom random = new java.security.SecureRandom();
    String code;
    do {
      StringBuilder value = new StringBuilder(8);
      for (int index = 0; index < 8; index++)
        value.append(alphabet.charAt(random.nextInt(alphabet.length())));
      code = value.toString();
    } while (linkCodes.putIfAbsent(
        code,
        new LinkCode(player.getUniqueId(), player.getUsername(), now + 300_000)) != null);
    source.sendMessage(net.kyori.adventure.text.Component.text(
        "Jednorazový kód: " + code + " · platí 5 minút."));
    source.sendMessage(net.kyori.adventure.text.Component.text(
        "Na webe sa prihlás a zadaj ho v časti Prepojenie účtu."));
  }

  public void shutdown() {
    if (server != null) server.stop(1);
    linkCodes.clear();
    linkCooldowns.clear();
    logger.info("NinjaMelon web bridge stopped.");
  }

  private static JsonObject parseObject(String body) {
    try {
      var element = JsonParser.parseString(body);
      if (!element.isJsonObject()) throw new IllegalArgumentException("Expected JSON object");
      return element.getAsJsonObject();
    } catch (JsonSyntaxException exception) {
      throw new IllegalArgumentException("Invalid JSON", exception);
    }
  }

  private static String string(JsonObject body, String key) {
    if (!body.has(key) || !body.get(key).isJsonPrimitive()
        || !body.get(key).getAsJsonPrimitive().isString())
      throw new IllegalArgumentException("Missing field " + key);
    return body.get(key).getAsString();
  }

  private static JsonObject invalidLink() {
    JsonObject result = new JsonObject();
    result.addProperty("success", false);
    result.addProperty("codeConsumed", false);
    return result;
  }

  private static JsonObject error(String message) {
    JsonObject result = new JsonObject();
    result.addProperty("error", message);
    return result;
  }

  private static String env(String name) {
    return envOr(name, "");
  }

  private static String envOr(String name, String fallback) {
    String value = System.getenv(name);
    return value == null ? fallback : value.trim();
  }

  private static int parseInt(String value, int fallback) {
    try {
      return Integer.parseInt(value);
    } catch (NumberFormatException exception) {
      return fallback;
    }
  }

  private record LinkCode(UUID playerUuid, String username, long expiresAt) {}
}