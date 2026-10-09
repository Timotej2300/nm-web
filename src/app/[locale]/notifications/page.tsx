import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { NotificationCenter } from "@/components/notification-center";
import { copy, isLocale } from "@/lib/i18n";

export default async function NotificationsPage({
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
      title={locale === "sk" ? "Upozornenia" : "Upozornění"}
      description={
        locale === "sk"
          ? "Súkromné oznámenia sú viditeľné iba po prihlásení."
          : "Soukromá oznámení jsou viditelná pouze po přihlášení."
      }
      state="not_configured"
    >
      <NotificationCenter locale={locale} />
    </ContentPage>
  );
}