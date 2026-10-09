import { notFound } from "next/navigation";
import { AdminAccessState } from "@/components/admin-shell";
import { AdminForumModeration } from "@/components/admin-forum-moderation";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { isLocale } from "@/lib/i18n";

export default async function AdminForumPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const access = await checkCurrentPermission("ninjamelonweb.forum");
  if (!access.allowed)
    return <AdminAccessState locale={locale} reason={access.reason} />;
  return <AdminForumModeration locale={locale} />;
}
