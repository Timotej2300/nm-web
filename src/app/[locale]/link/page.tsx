import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { AccountLinkForm } from "@/components/auth-forms";
import { copy, isLocale } from "@/lib/i18n";

export default async function LinkMinecraftPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <ContentPage
      locale={locale}
      copy={copy[locale]}
      title={
        locale === "sk"
          ? "Prepojenie Minecraft účtu"
          : "Propojení Minecraft účtu"
      }
      description={
        locale === "sk"
          ? "Jednorazový kód musí overiť dôveryhodný serverový bridge."
          : "Jednorázový kód musí ověřit důvěryhodný serverový bridge."
      }
      state="not_configured"
    >
      <section className="auth-panel">
        <AccountLinkForm locale={locale} />
      </section>
    </ContentPage>
  );
}
