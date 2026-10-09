import { notFound } from "next/navigation";
import { AdminAccessState } from "@/components/admin-shell";
import { AdminNewsEditor } from "@/components/admin-news-editor";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { isLocale } from "@/lib/i18n";
export default async function AdminNewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const access = await checkCurrentPermission("ninjamelonweb.news");
  if (!access.allowed)
    return <AdminAccessState locale={locale} reason={access.reason} />;
  return (
    <>
      <section className="admin-section-state">
        <p className="section-kicker">STAFF / ninjamelonweb.news</p>
        <h1>{locale === "sk" ? "Správa noviniek" : "Správa novinek"}</h1>
        <p>
          {locale === "sk"
            ? "Koncepty, publikovanie a náhľad sa ukladajú do databázy."
            : "Koncepty, publikování a náhled se ukládají do databáze."}
        </p>
      </section>
      <AdminNewsEditor locale={locale} />
    </>
  );
}
