import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { SafeMarkdown } from "@/components/safe-markdown";
import { copy, isLocale } from "@/lib/i18n";
import { getPublicNewsDetail } from "@/lib/public-content";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) return {};
  const result = await getPublicNewsDetail(locale, slug);
  const item = result.state === "ok" ? result.data[0] : null;
  return item
    ? {
        title: item.title,
        description: item.excerpt || undefined,
        alternates: { canonical: `/${locale}/news/${item.slug}` },
      }
    : {};
}

export default async function NewsDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const result = await getPublicNewsDetail(locale, slug);
  const article = result.state === "ok" ? result.data[0] : null;
  return (
    <ContentPage
      locale={locale}
      copy={copy[locale]}
      title={article?.title || "Novinka"}
      description={article?.excerpt || ""}
      state={result.state}
    >
      {article ? (
        <article>
          <p className="field-label">
            <time dateTime={article.publish_at}>
              {new Date(article.publish_at).toLocaleDateString(
                locale === "sk" ? "sk-SK" : "cs-CZ",
              )}
            </time>
          </p>
          <SafeMarkdown source={article.body_markdown} />
        </article>
      ) : undefined}
    </ContentPage>
  );
}
