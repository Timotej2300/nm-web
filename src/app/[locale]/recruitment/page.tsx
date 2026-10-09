import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { RecruitmentForm } from "@/components/recruitment-form";
import { copy, isLocale } from "@/lib/i18n";
import { getPublicRecruitmentForm } from "@/lib/public-content";

export default async function RecruitmentPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const result = await getPublicRecruitmentForm();
  return (
    <ContentPage
      locale={locale}
      copy={copy[locale]}
      title={locale === "sk" ? "Nábor" : "Nábor"}
      description={
        locale === "sk"
          ? "Prihlášky sú dostupné iba vtedy, keď tím otvorí overený formulár."
          : "Přihlášky jsou dostupné pouze tehdy, když tým otevře ověřený formulář."
      }
      state={result.state}
    >
      {result.state === "ok" ? (
        result.data.map((form) => (
          <RecruitmentForm key={form.id} locale={locale} form={form} />
        ))
      ) : undefined}
    </ContentPage>
  );
}
