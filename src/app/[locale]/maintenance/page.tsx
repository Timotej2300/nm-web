import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { copy, isLocale } from "@/lib/i18n";
import { getMaintenanceState } from "@/lib/maintenance-state";

export const dynamic = "force-dynamic";

export default async function MaintenancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const maintenance = await getMaintenanceState();
  const message = locale === "sk" ? maintenance.messageSk : maintenance.messageCs;
  return (
    <ContentPage
      locale={locale}
      copy={copy[locale]}
      title={locale === "sk" ? "Údržba" : "Údržba"}
      description={message || (
        maintenance.status === "active"
          ? locale === "sk" ? "Web je momentálne v plánovanej údržbe." : "Web je momentálně v plánované údržbě."
          : maintenance.status === "inactive"
            ? locale === "sk" ? "Momentálne neprebieha žiadna údržba." : "Momentálně neprobíhá žádná údržba."
            : maintenance.status === "unavailable"
              ? locale === "sk" ? "Stav údržby sa nedá overiť. Skús to neskôr." : "Stav údržby nelze ověřit. Zkus to později."
              : locale === "sk" ? "Údržbový režim nie je nakonfigurovaný." : "Režim údržby není nakonfigurován."
      )}
      state={maintenance.status === "active" ? "ok" : maintenance.status === "inactive" ? "empty" : maintenance.status === "unavailable" ? "unavailable" : "not_configured"}
    />
  );
}
