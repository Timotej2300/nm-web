import { notFound } from "next/navigation";
import { AdminAccessState } from "@/components/admin-shell";
import { AdminDashboard } from "@/components/admin-dashboard";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { isLocale } from "@/lib/i18n";

export default async function AdminDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const access = await checkCurrentPermission("ninjamelonweb.dashboard");
  if (!access.allowed)
    return <AdminAccessState locale={locale} reason={access.reason} />;
  return (
    <>
      <section className="admin-section-state">
        <p className="section-kicker">STAFF / ninjamelonweb.dashboard</p>
        <h1>{locale === "sk" ? "Prehľad siete" : "Přehled sítě"}</h1>
        <p>
          {locale === "sk"
            ? "Stavy sú načítané zo serverového bridge. Neoverené hodnoty neoznačujeme ako online."
            : "Stavy se načítají ze serverového bridge. Neověřené hodnoty neoznačujeme jako online."}
        </p>
      </section>
      <AdminDashboard locale={locale} />
    </>
  );
}
