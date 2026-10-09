import { notFound } from "next/navigation";
import { AdminAccessState } from "@/components/admin-shell";
import { AdminAuditLog } from "@/components/admin-audit-log";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { isLocale } from "@/lib/i18n";

export default async function AdminAuditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const access = await checkCurrentPermission("ninjamelonweb.audit");
  if (!access.allowed)
    return <AdminAccessState locale={locale} reason={access.reason} />;
  return <AdminAuditLog locale={locale} />;
}
