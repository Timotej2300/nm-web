import { notFound } from "next/navigation";
import { AdminAccessState } from "@/components/admin-shell";
import { AdminTeamEditor } from "@/components/admin-team-editor";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { isLocale } from "@/lib/i18n";

export default async function AdminTeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const access = await checkCurrentPermission("ninjamelonweb.team");
  if (!access.allowed)
    return <AdminAccessState locale={locale} reason={access.reason} />;
  return <AdminTeamEditor locale={locale} />;
}
