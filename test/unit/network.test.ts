import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isFreshNetworkStatus,
  unavailableNetworkStatus,
} from "@/lib/network-status";
import { maintenanceRouteDecision } from "@/lib/maintenance-route-policy";
import {
  previewTestModeActive,
  previewTestPermissionAllowed,
} from "@/lib/auth/preview-test-policy";
import { hasSameOrigin } from "@/lib/security/requests";
import type { NextRequest } from "next/server";

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

describe("preview-only admin permission simulation", () => {
  const testUserId = "11111111-1111-4111-8111-111111111111";
  const previewConfig = {
    vercelEnv: "preview",
    enabled: "true",
    testUserId,
  };

  it("allows only the explicitly selected preview account and supported modules", () => {
    expect(previewTestModeActive(previewConfig)).toBe(true);
    expect(
      previewTestPermissionAllowed(
        testUserId,
        "ninjamelonweb.tickets",
        previewConfig,
      ),
    ).toBe(true);
    expect(
      previewTestPermissionAllowed(
        "22222222-2222-4222-8222-222222222222",
        "ninjamelonweb.staff",
        previewConfig,
      ),
    ).toBe(false);
    expect(
      previewTestPermissionAllowed(
        testUserId,
        "ninjamelonweb.ranks",
        previewConfig,
      ),
    ).toBe(false);
  });

  it("never enables the test permission path in production or without the flag", () => {
    expect(previewTestModeActive({ ...previewConfig, vercelEnv: "production" })).toBe(false);
    expect(previewTestModeActive({ ...previewConfig, enabled: "false" })).toBe(false);
    expect(previewTestModeActive({ ...previewConfig, testUserId: "not-a-uuid" })).toBe(false);
  });

  it("accepts only active Vercel preview origins for same-origin writes", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://ninjamelon.cz");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("VERCEL_URL", "ninjamelon-git-test.vercel.app");
    vi.stubEnv("VERCEL_BRANCH_URL", "ninjamelon-git-main.vercel.app");
    const request = (origin: string) =>
      ({ headers: new Headers({ origin }) }) as unknown as NextRequest;
    expect(hasSameOrigin(request("https://ninjamelon-git-test.vercel.app"))).toBe(true);
    expect(hasSameOrigin(request("https://ninjamelon-git-main.vercel.app"))).toBe(true);
    expect(hasSameOrigin(request("https://attacker.vercel.app"))).toBe(false);
    vi.stubEnv("VERCEL_ENV", "production");
    expect(hasSameOrigin(request("https://ninjamelon-git-test.vercel.app"))).toBe(false);
  });
});

afterEach(() => vi.unstubAllEnvs());
