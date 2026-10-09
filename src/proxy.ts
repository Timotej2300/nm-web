import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getMaintenanceState } from "@/lib/maintenance-state";
import { maintenanceRouteDecision } from "@/lib/maintenance-route-policy";

function contentSecurityPolicy(nonce: string, secureTransport: boolean) {
  const supabaseOrigin = (() => {
    try {
      return process.env.NEXT_PUBLIC_SUPABASE_URL
        ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
        : "";
    } catch {
      return "";
    }
  })();
  const scriptSources = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (process.env.NODE_ENV === "development")
    scriptSources.push("'unsafe-eval'");
  const connectSources = [
    "'self'",
    ...(supabaseOrigin ? [supabaseOrigin] : []),
  ];
  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connectSources.join(" ")}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(secureTransport ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

function secureResponse(
  response: NextResponse,
  csp: string,
  secureTransport: boolean,
) {
  response.headers.set("Content-Security-Policy", csp);
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  response.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (secureTransport) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=63072000; includeSubDomains; preload",
    );
  }
  return response;
}

export async function proxy(request: NextRequest) {
  const nonce = Buffer.from(randomUUID()).toString("base64");
  const secureTransport =
    request.nextUrl.protocol === "https:" ||
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() === "https";
  const csp = contentSecurityPolicy(nonce, secureTransport);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);
  requestHeaders.set(
    "x-route-locale",
    request.nextUrl.pathname.split("/")[1] || "sk",
  );
  requestHeaders.set("x-route-path", request.nextUrl.pathname);
  const maintenance = await getMaintenanceState();
  requestHeaders.set("x-maintenance-state", maintenance.status);

  const decision = maintenanceRouteDecision(
    request.nextUrl.pathname,
    maintenance.status,
  );
  if (decision === "redirect") {
    const segment = request.nextUrl.pathname.split("/")[1];
    const locale = segment === "cs" ? "cs" : "sk";
    const destination = new URL(`/${locale}/maintenance`, request.url);
    const redirect = NextResponse.redirect(destination);
    redirect.headers.set("Cache-Control", "no-store");
    return secureResponse(redirect, csp, secureTransport);
  }
  if (decision === "service_unavailable") {
    return secureResponse(
      NextResponse.json(
        { error: maintenance.status === "active" ? "Website is in maintenance" : "Maintenance state is unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      ),
      csp,
      secureTransport,
    );
  }
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return secureResponse(response, csp, secureTransport);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
