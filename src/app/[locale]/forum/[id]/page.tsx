import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { SafeMarkdown } from "@/components/safe-markdown";
import { copy, isLocale } from "@/lib/i18n";
import { getPublicForumTopic } from "@/lib/public-content";
import { ContentReportForm, ForumReplyForm } from "@/components/forum-forms";

export default async function ForumTopicPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const result = await getPublicForumTopic(id);
  const thread = result.state === "ok" ? result.data[0] : null;
  return (
    <ContentPage
      locale={locale}
      copy={copy[locale]}
      title={thread?.topic.title || "Fórum"}
      description={
        locale === "sk"
          ? "Verejná téma; interné a skryté príspevky sa nezobrazujú."
          : "Veřejné téma; interní a skryté příspěvky se nezobrazují."
      }
      state={result.state}
    >
      {thread ? (
        <>
          <section className="forum-posts">
            <div className="forum-topic-tools">
              <ContentReportForm
                locale={locale}
                targetId={thread.topic.id}
                targetType="forum_topic"
              />
            </div>
            {thread.posts.map((post) => (
              <article className="forum-post" key={post.id}>
                <p className="section-kicker">
                  {post.authorName ||
                    (locale === "sk"
                      ? "Hráč s neverejným profilom"
                      : "Hráč s neveřejným profilem")}
                </p>
                <SafeMarkdown source={post.body} />
                <time dateTime={post.created_at}>
                  {new Date(post.created_at).toLocaleString(
                    locale === "sk" ? "sk-SK" : "cs-CZ",
                  )}
                </time>
                <ContentReportForm
                  locale={locale}
                  targetId={post.id}
                  targetType="forum_post"
                />
              </article>
            ))}
          </section>
          {thread.topic.status === "open" ? (
            <ForumReplyForm locale={locale} topicId={thread.topic.id} />
          ) : (
            <p className="ticket-state">
              {locale === "sk"
                ? "Táto téma je uzamknutá."
                : "Toto téma je uzamčené."}
            </p>
          )}
        </>
      ) : undefined}
    </ContentPage>
  );
}
