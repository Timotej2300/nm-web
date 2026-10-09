import { notFound } from "next/navigation";
import { AdminSection } from "@/components/admin-shell";
import { isLocale } from "@/lib/i18n";
export default async function AdminRanksPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <AdminSection
      locale={locale}
      permission="ninjamelonweb.ranks"
      title={locale === "sk" ? "Ranky a oprávnenia" : "Ranky a oprávnění"}
    />
  );
}
