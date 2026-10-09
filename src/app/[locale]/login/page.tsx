import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentPage } from "@/components/content-page";
import { LoginForm } from "@/components/auth-forms";
import { copy, isLocale } from "@/lib/i18n";

export default async function LoginPage({
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
      title={locale === "sk" ? "Prihlásenie" : "Přihlášení"}
      description={
        locale === "sk"
          ? "Účet sa bude overovať cez Minecraft UUID; heslo z Minecraftu nikdy nepýtame."
          : "Účet se bude ověřovat přes Minecraft UUID; heslo z Minecraftu nikdy nežádáme."
      }
      state="not_configured"
    >
      <section className="auth-panel">
        <LoginForm locale={locale} />
      </section>
      <div className="empty-state">
        <Link className="text-link" href={`/${locale}/link`}>
          <span>
            {locale === "sk"
              ? "Prepojenie Minecraft účtu"
              : "Propojení Minecraft účtu"}
          </span>
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    </ContentPage>
  );
}
