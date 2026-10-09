import { notFound } from "next/navigation";
import { AdminAccessState } from "@/components/admin-shell";
import { AdminRecruitmentReview } from "@/components/admin-recruitment-review";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { isLocale } from "@/lib/i18n";

export default async function AdminRecruitmentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const access = await checkCurrentPermission("ninjamelonweb.recruitment");
  if (!access.allowed)
    return <AdminAccessState locale={locale} reason={access.reason} />;
  return <AdminRecruitmentReview locale={locale} />;
}
