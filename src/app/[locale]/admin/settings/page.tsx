import { notFound } from "next/navigation";
import { AdminAccessState } from "@/components/admin-shell";
import { AdminMaintenanceSettings } from "@/components/admin-maintenance-settings";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { isLocale } from "@/lib/i18n";

export default async function AdminSettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const access = await checkCurrentPermission("ninjamelonweb.maintenance");
  if (!access.allowed)
    return <AdminAccessState locale={locale} reason={access.reason} />;
  return <AdminMaintenanceSettings locale={locale} />;
}
