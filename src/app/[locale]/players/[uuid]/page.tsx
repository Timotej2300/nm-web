import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { copy, isLocale } from "@/lib/i18n";
import { getPublicProfile } from "@/lib/public-content";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ locale: string; uuid: string }>;
}) {
  const { locale, uuid } = await params;
  if (!isLocale(locale)) notFound();
  const result = await getPublicProfile(uuid);
  const profile = result.state === "ok" ? result.data[0] : null;
  return (
    <ContentPage
      locale={locale}
      copy={copy[locale]}
      title={locale === "sk" ? "Profil hráča" : "Profil hráče"}
      description={
        locale === "sk"
          ? "Verejné údaje načítané iba z povoleného profilu."
          : "Veřejné údaje načtené pouze z povoleného profilu."
      }
      state={result.state}
    >
      {profile ? (
        <article className="profile-card">
          <span className="person-avatar" aria-hidden="true">
            {(profile.display_name || profile.minecraft_username || "M")
              .slice(0, 1)
              .toUpperCase()}
          </span>
          <h2>
            {profile.display_name || profile.minecraft_username || "Hráč"}
          </h2>
          {profile.bio ? <p>{profile.bio}</p> : null}
          <p className="field-label">
            {locale === "sk" ? "ČLENOM OD" : "ČLENEM OD"}{" "}
            <time dateTime={profile.created_at}>
              {new Date(profile.created_at).toLocaleDateString(
                locale === "sk" ? "sk-SK" : "cs-CZ",
              )}
            </time>
          </p>
        </article>
      ) : undefined}
    </ContentPage>
  );
}
