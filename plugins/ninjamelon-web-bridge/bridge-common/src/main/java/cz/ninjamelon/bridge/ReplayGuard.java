package cz.ninjamelon.bridge;

import java.util.concurrent.ConcurrentHashMap;

public final class ReplayGuard {
  private static final long RETENTION_MS = 60_000;
  private static final int MAX_ENTRIES = 100_000;
  private final ConcurrentHashMap<String, Long> seen = new ConcurrentHashMap<>();

  public boolean accept(String nonce, long timestamp) {
    long cutoff = System.currentTimeMillis() - RETENTION_MS;
    seen.entrySet().removeIf(entry -> entry.getValue() < cutoff);
    if (seen.size() >= MAX_ENTRIES) return false;
    return seen.putIfAbsent(nonce, timestamp) == null;
  }
}