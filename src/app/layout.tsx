import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://ninjamelon.cz",
  ),
  title: {
    default: "NinjaMelon.cz — Hraj po svojom",
    template: "%s | NinjaMelon.cz",
  },
  description: "Minecraft PvP komunita vytvorená férovo a pre hráčov.",
  openGraph: {
    title: "NinjaMelon.cz — Hraj po svojom",
    description: "Minecraft PvP komunita vytvorená férovo a pre hráčov.",
    siteName: "NinjaMelon.cz",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const requestHeaders = await headers();
  const requestedLocale = requestHeaders.get("x-route-locale");
  const locale = requestedLocale === "cs" ? "cs" : "sk";
  return (
    <html lang={locale}>
      <body>{children}</body>
    </html>
  );
}
