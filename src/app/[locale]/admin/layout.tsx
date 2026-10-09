import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AdminAccessState, AdminShell } from "@/components/admin-shell";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { isLocale } from "@/lib/i18n";

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const access = await checkCurrentPermission("ninjamelonweb.staff");
  if (!access.allowed)
    return <AdminAccessState locale={locale} reason={access.reason} />;
  return <AdminShell locale={locale}>{children}</AdminShell>;
}
