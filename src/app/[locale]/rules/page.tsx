import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { SafeMarkdown } from "@/components/safe-markdown";
import { copy, isLocale } from "@/lib/i18n";
import { getPublicPage } from "@/lib/public-content";

export default async function RulesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const result = await getPublicPage(locale, "rules");
  const page = result.state === "ok" ? result.data[0] : null;
  return (
    <ContentPage
      locale={locale}
      copy={copy[locale]}
      title={page?.title || (locale === "sk" ? "Pravidlá" : "Pravidla")}
      description={
        locale === "sk"
          ? "Publikované pravidlá spravované webovým editorom."
          : "Publikovaná pravidla spravovaná webovým editorem."
      }
      state={result.state}
    >
      {page ? <SafeMarkdown source={page.body_markdown} /> : undefined}
    </ContentPage>
  );
}
