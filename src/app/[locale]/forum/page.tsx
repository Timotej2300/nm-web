import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { copy, isLocale } from "@/lib/i18n";
import { getPublicForum } from "@/lib/public-content";
import { checkCurrentPermission } from "@/lib/auth/permissions";
import { NewForumTopicForm } from "@/components/forum-forms";

export default async function ForumPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const result = await getPublicForum();
  const forumAccess = await checkCurrentPermission("ninjamelonweb.forum");
  return (
    <ContentPage
      locale={locale}
      copy={copy[locale]}
      title="Fórum"
      description={
        locale === "sk"
          ? "Verejné kategórie a otvorené témy."
          : "Veřejné kategorie a otevřená témata."
      }
      state={result.state}
    >
      {result.state === "ok" ? (
        <>
        {forumAccess.allowed && (
          <NewForumTopicForm
            locale={locale}
            categories={result.data.categories.map((category) => ({
              id: category.id,
              label: locale === "sk" ? category.name_sk : category.name_cs,
            }))}
          />
        )}
        <div className="forum-list">
          {result.data.categories.map((category) => (
            <section className="forum-category" key={category.id}>
              <h2>{locale === "sk" ? category.name_sk : category.name_cs}</h2>
              {(
                locale === "sk"
                  ? category.description_sk
                  : category.description_cs
              ) ? (
                <p>
                  {locale === "sk"
                    ? category.description_sk
                    : category.description_cs}
                </p>
              ) : null}
              <ul>
                {result.data.topics
                  .filter((topic) => topic.category_id === category.id)
                  .map((topic) => (
                    <li key={topic.id}>
                      <Link href={`/${locale}/forum/${topic.id}`}>
                        {topic.title}
                      </Link>
                      <span>
                        {topic.status === "locked"
                          ? locale === "sk"
                            ? "Uzamknutá"
                            : "Uzamčená"
                          : locale === "sk"
                            ? "Otvorená"
                            : "Otevřená"}
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
        </>
      ) : undefined}
    </ContentPage>
  );
}
