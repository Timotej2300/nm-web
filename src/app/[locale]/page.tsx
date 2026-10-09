import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SiteHome } from "@/components/site-home";
import { copy, isLocale } from "@/lib/i18n";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return {
    title: locale === "sk" ? "Hraj po svojom" : "Hraj po svém",
    description: copy[locale].intro,
    alternates: {
      canonical: `/${locale}`,
      languages: { sk: "/sk", cs: "/cs" },
    },
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <SiteHome locale={locale} copy={copy[locale]} />;
}
