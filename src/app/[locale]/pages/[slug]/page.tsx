import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { SafeMarkdown } from "@/components/safe-markdown";
import { copy, isLocale } from "@/lib/i18n";
import { getPublicPage } from "@/lib/public-content";

type PageParams = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: PageParams;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const result = await getPublicPage(locale, slug);
  if (result.state !== "ok") return {};
  const page = result.data[0];
  return {
    title: page.seo_title || page.title,
    description: page.seo_description || undefined,
    alternates: {
      canonical: page.canonical_url || `/${locale}/pages/${page.slug}`,
    },
  };
}

export default async function ManagedPage({ params }: { params: PageParams }) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const result = await getPublicPage(locale, slug);
  if (result.state !== "ok")
    return (
      <ContentPage
        locale={locale}
        copy={copy[locale]}
        title={locale === "sk" ? "Stránka nie je dostupná" : "Stránka není dostupná"}
        description={
          locale === "sk"
            ? "Zobrazujú sa iba stránky, ktoré boli skutočne publikované."
            : "Zobrazují se pouze stránky, které byly skutečně publikovány."
        }
        state={result.state}
      />
    );
  const page = result.data[0];
  return (
    <ContentPage
      locale={locale}
      copy={copy[locale]}
      title={page.title}
      description={page.seo_description ?? ""}
      state="ok"
    >
      <article className="article-body">
        <SafeMarkdown source={page.body_markdown} />
      </article>
    </ContentPage>
  );
}