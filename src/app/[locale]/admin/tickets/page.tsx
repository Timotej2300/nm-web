import { notFound } from "next/navigation";
import { AdminAccessState } from "@/components/admin-shell";
import { AdminTicketQueue } from "@/components/admin-ticket-queue";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { isLocale } from "@/lib/i18n";

export default async function AdminTicketsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const access = await checkCurrentPermission("ninjamelonweb.tickets");
  if (!access.allowed)
    return <AdminAccessState locale={locale} reason={access.reason} />;
  return <AdminTicketQueue locale={locale} />;
}
