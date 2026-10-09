import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { ModeDirectory } from "@/components/mode-directory";
import { copy, isLocale } from "@/lib/i18n";

export default async function ModesPage({
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
      title={copy[locale].navModes}
      description={copy[locale].modesIntro}
      state="empty"
    >
      <ModeDirectory locale={locale} copy={copy[locale]} />
    </ContentPage>
  );
}
