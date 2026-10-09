import { describe, expect, it } from "vitest";
import {
  isFreshNetworkStatus,
  unavailableNetworkStatus,
} from "@/lib/network-status";
import { maintenanceRouteDecision } from "@/lib/maintenance-route-policy";

const now = Date.parse("2026-10-09T17:00:00.000Z");

describe("Minecraft network status validation", () => {
  it("represents missing integration with null metrics", () => {
    const status = unavailableNetworkStatus("not_configured");
    expect(status.status).toBe("unavailable");
    expect(status.players).toBeNull();
    expect(status.maxPlayers).toBeNull();
  });

  it("accepts fresh verified counts only", () => {
    expect(
      isFreshNetworkStatus(
        {
          status: "online",
          players: 7,
          maxPlayers: 100,
          checkedAt: new Date(now - 1000).toISOString(),
          modes: [],
        },
        now,
      ),
    ).toBe(true);
  });

  it("rejects stale and fabricated or malformed status payloads", () => {
    expect(
      isFreshNetworkStatus(
        {
          status: "online",
          players: 7,
          maxPlayers: 100,
          checkedAt: new Date(now - 60_000).toISOString(),
          modes: [],
        },
        now,
      ),
    ).toBe(false);
    expect(
      isFreshNetworkStatus(
        {
          status: "online",
          players: "7",
          maxPlayers: 100,
          checkedAt: new Date(now).toISOString(),
          modes: [],
        },
        now,
      ),
    ).toBe(false);
    expect(
      isFreshNetworkStatus(
        { status: "online", players: 0, maxPlayers: 100 },
        now,
      ),
    ).toBe(false);
  });
});

describe("maintenance routing policy", () => {
  it("keeps content open when maintenance is inactive or unconfigured", () => {
    expect(maintenanceRouteDecision("/sk", "inactive")).toBe("allow");
    expect(maintenanceRouteDecision("/cs/news", "not_configured")).toBe("allow");
  });

  it("redirects public pages and blocks their API routes during maintenance", () => {
    expect(maintenanceRouteDecision("/sk/news", "active")).toBe("redirect");
    expect(maintenanceRouteDecision("/api/tickets", "active")).toBe("service_unavailable");
  });

  it("allows only maintenance/login and admin paths through the proxy gate", () => {
    expect(maintenanceRouteDecision("/sk/maintenance", "active")).toBe("allow");
    expect(maintenanceRouteDecision("/cs/login", "active")).toBe("allow");
    expect(maintenanceRouteDecision("/api/auth/login/verify", "active")).toBe("allow");
    expect(maintenanceRouteDecision("/sk/admin/tickets", "active")).toBe("allow");
    expect(maintenanceRouteDecision("/api/admin/tickets", "active")).toBe("allow");
  });

  it("fails closed if the saved maintenance state cannot be read", () => {
    expect(maintenanceRouteDecision("/sk", "unavailable")).toBe("redirect");
    expect(maintenanceRouteDecision("/api/search", "unavailable")).toBe("service_unavailable");
  });
});
