import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { TicketCenter } from "@/components/ticket-center";
import { copy, isLocale } from "@/lib/i18n";

export default async function SupportPage({
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
      title={locale === "sk" ? "Podpora" : "Podpora"}
      description={
        locale === "sk"
          ? "Súkromné požiadavky patria iba do chráneného ticket systému."
          : "Soukromé požadavky patří pouze do chráněného ticket systému."
      }
      state="not_configured"
    >
      <TicketCenter locale={locale} />
    </ContentPage>
  );
}
