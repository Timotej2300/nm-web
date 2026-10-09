import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { copy, isLocale } from "@/lib/i18n";
import { getPublicNews } from "@/lib/public-content";

export default async function NewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const result = await getPublicNews(locale);
  return (
    <ContentPage
      locale={locale}
      copy={copy[locale]}
      title="Novinky"
      description={
        locale === "sk"
          ? "Aktuálne správy publikované tímom NinjaMelon."
          : "Aktuální zprávy publikované týmem NinjaMelon."
      }
      state={result.state}
    >
      {result.state === "ok" ? (
        <div className="news-grid">
          {result.data.map((item) => (
            <article className="news-card" key={item.id}>
              <p className="section-kicker">
                <time dateTime={item.publish_at}>
                  {new Date(item.publish_at).toLocaleDateString(
                    locale === "sk" ? "sk-SK" : "cs-CZ",
                  )}
                </time>
              </p>
              <h2>{item.title}</h2>
              {item.excerpt ? <p>{item.excerpt}</p> : null}
              <Link className="text-link" href={`/${locale}/news/${item.slug}`}>
                <span>
                  {locale === "sk" ? "Čítať novinku" : "Číst novinku"}
                </span>
                <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      ) : undefined}
    </ContentPage>
  );
}
