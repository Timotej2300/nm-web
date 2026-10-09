import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { PublicSearch } from "@/components/public-search";
import { copy, isLocale } from "@/lib/i18n";

export default async function SearchPage({
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
      title={locale === "sk" ? "Vyhľadávanie" : "Vyhledávání"}
      description={
        locale === "sk"
          ? "Hľadaj iba vo verejných novinkách, profile tímu a témach fóra."
          : "Hledej pouze ve veřejných novinkách, profilech týmu a tématech fóra."
      }
      state="not_configured"
    >
      <PublicSearch locale={locale} />
    </ContentPage>
  );
}