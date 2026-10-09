import { describe, expect, it } from "vitest";
import { normalizePublicSearchQuery } from "@/lib/search";

describe("public search input", () => {
  it("normalizes spacing and removes query-filter metacharacters", () => {
    expect(normalizePublicSearchQuery("  Ninja%_Melon   PvP  ")).toBe(
      "Ninja Melon PvP",
    );
  });

  it("preserves localized letters and caps the query length", () => {
    expect(normalizePublicSearchQuery("Česko Slovensko")).toBe(
      "Česko Slovensko",
    );
    expect(normalizePublicSearchQuery("x".repeat(100))).toHaveLength(80);
  });
});