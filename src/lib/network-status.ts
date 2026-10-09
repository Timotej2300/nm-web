export type NetworkStatus = {
  status: "online" | "offline" | "unavailable";
  reason?: "not_configured" | "stale" | "request_failed";
  players: number | null;
  maxPlayers: number | null;
  checkedAt: string;
  modes: Array<{
    id: string;
    status: "online" | "offline" | "unavailable";
    players: number | null;
  }>;
};

export function unavailableNetworkStatus(
  reason: NetworkStatus["reason"] = "not_configured",
): NetworkStatus {
  return {
    status: "unavailable",
    reason,
    players: null,
    maxPlayers: null,
    checkedAt: new Date().toISOString(),
    modes: [],
  };
}

export function isFreshNetworkStatus(
  value: unknown,
  now = Date.now(),
): value is NetworkStatus {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<NetworkStatus>;
  if (!["online", "offline", "unavailable"].includes(candidate.status ?? ""))
    return false;
  if (candidate.status === "online") {
    if (
      !Number.isInteger(candidate.players) ||
      !Number.isInteger(candidate.maxPlayers)
    )
      return false;
    if ((candidate.players ?? -1) < 0 || (candidate.maxPlayers ?? -1) < 0)
      return false;
  } else if (candidate.players !== null || candidate.maxPlayers !== null) {
    return false;
  }
  if (
    !Array.isArray(candidate.modes) ||
    typeof candidate.checkedAt !== "string"
  )
    return false;
  const checkedAt = Date.parse(candidate.checkedAt);
  if (
    !Number.isFinite(checkedAt) ||
    now - checkedAt < -10_000 ||
    now - checkedAt > 45_000
  )
    return false;
  return candidate.modes.every(
    (mode) =>
      mode &&
      typeof mode.id === "string" &&
      ["online", "offline", "unavailable"].includes(mode.status) &&
      (mode.players === null ||
        (Number.isInteger(mode.players) && mode.players >= 0)),
  );
}
