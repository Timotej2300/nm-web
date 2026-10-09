import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { AdminAccessState, AdminShell } from "@/components/admin-shell";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { previewTestModeActive } from "@/lib/auth/preview-test-policy";
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
  const previewTestMode = previewTestModeActive({
    vercelEnv: process.env.VERCEL_ENV,
    enabled: process.env.NINJAMELON_PREVIEW_TEST_MODE,
    testUserId: process.env.NINJAMELON_PREVIEW_TEST_USER_ID,
  });
  return (
    <AdminShell locale={locale} previewTestMode={previewTestMode}>
      {children}
    </AdminShell>
  );
}
