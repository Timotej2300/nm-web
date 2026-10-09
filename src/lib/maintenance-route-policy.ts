export type MaintenanceRouteDecision =
  | "allow"
  | "redirect"
  | "service_unavailable";

export function maintenanceRouteDecision(
  pathname: string,
  state: "not_configured" | "inactive" | "active" | "unavailable",
): MaintenanceRouteDecision {
  if (state === "not_configured" || state === "inactive") return "allow";
  if (
    /^\/(?:sk|cs)\/(?:maintenance|login)(?:\/|$)/.test(pathname) ||
    /^\/(?:sk|cs)\/admin(?:\/|$)/.test(pathname) ||
    /^\/api\/auth\/login\/(?:request|verify)$/.test(pathname) ||
    /^\/api\/admin(?:\/|$)/.test(pathname)
  ) return "allow";
  if (pathname.startsWith("/api/")) return "service_unavailable";
  return "redirect";
}