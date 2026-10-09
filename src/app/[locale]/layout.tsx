import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { copy } from "@/lib/i18n";
import { isLocale } from "@/lib/i18n";

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const requestHeaders = await headers();
  const requestPath = requestHeaders.get("x-route-path") ?? "";
  const maintenanceStatus = requestHeaders.get("x-maintenance-state");
  if (
    /^\/(?:sk|cs)\/admin(?:\/|$)/.test(requestPath) &&
    maintenanceStatus === "unavailable"
  ) {
    return (
      <ContentPage
        locale={locale}
        copy={copy[locale]}
        title={locale === "sk" ? "Údržba" : "Údržba"}
        description={locale === "sk" ? "Stav údržby sa nedá bezpečne overiť. Admin funkcie zostávajú zamknuté." : "Stav údržby nelze bezpečně ověřit. Admin funkce zůstávají uzamčené."}
        state="unavailable"
      />
    );
  }
  if (
    /^\/(?:sk|cs)\/admin(?:\/|$)/.test(requestPath) &&
    maintenanceStatus === "active"
  ) {
    const bypass = await checkCurrentPermission("ninjamelonweb.maintenance");
    if (!bypass.allowed)
      return (
        <ContentPage
          locale={locale}
          copy={copy[locale]}
          title={locale === "sk" ? "Údržba" : "Údržba"}
          description={locale === "sk" ? "Web je v údržbe. Admin prístup vyžaduje aktuálne LuckPerms oprávnenie." : "Web je v údržbě. Admin přístup vyžaduje aktuální oprávnění LuckPerms."}
          state="empty"
        />
      );
  }
  return children;
}
