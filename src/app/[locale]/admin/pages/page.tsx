import { notFound } from "next/navigation";
import { AdminAccessState } from "@/components/admin-shell";
import { AdminPageEditor } from "@/components/admin-page-editor";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { isLocale } from "@/lib/i18n";
export default async function AdminPagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const access = await checkCurrentPermission("ninjamelonweb.pages");
  if (!access.allowed)
    return <AdminAccessState locale={locale} reason={access.reason} />;
  return (
    <>
      <section className="admin-section-state">
        <p className="section-kicker">STAFF / ninjamelonweb.pages</p>
        <h1>{locale === "sk" ? "Editor stránok" : "Editor stránek"}</h1>
        <p>
          {locale === "sk"
            ? "Koncepty, plánovanie, SEO a publikovanie sa ukladajú do databázy."
            : "Koncepty, plánování, SEO a publikování se ukládají do databáze."}
        </p>
      </section>
      <AdminPageEditor locale={locale} />
    </>
  );
}
