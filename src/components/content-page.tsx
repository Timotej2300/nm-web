import Link from "next/link";
import type { Copy, Locale } from "@/lib/i18n";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export type ContentState = "not_configured" | "unavailable" | "empty" | "ok";

export function ContentPage({
  locale,
  copy,
  title,
  description,
  state,
  children,
}: {
  locale: Locale;
  copy: Copy;
  title: string;
  description: string;
  state: ContentState;
  children?: React.ReactNode;
}) {
  const messages = {
    not_configured:
      locale === "sk"
        ? "Táto časť ešte nie je nakonfigurovaná."
        : "Tato část ještě není nakonfigurována.",
    unavailable:
      locale === "sk"
        ? "Služba je momentálne nedostupná. Skús to neskôr."
        : "Služba je momentálně nedostupná. Zkus to později.",
    empty:
      locale === "sk"
        ? "Zatiaľ tu nie je zverejnený žiadny obsah."
        : "Zatím zde není zveřejněn žádný obsah.",
    ok: locale === "sk" ? "Obsah je načítaný." : "Obsah je načtený.",
  };
  return (
    <>
      <a className="skip-link" href="#main">
        {locale === "sk" ? "Preskočiť na obsah" : "Přeskočit na obsah"}
      </a>
      <SiteHeader locale={locale} copy={copy} />
      <main id="main" className="content-page wrap">
        <nav
          className="breadcrumbs"
          aria-label={locale === "sk" ? "Navigácia" : "Navigace"}
        >
          <Link href={`/${locale}`}>NinjaMelon.cz</Link>
          <span aria-hidden="true">/</span>
          <span>{title}</span>
        </nav>
        <header className="content-page-heading">
          <span className="section-kicker">
            <span>NM</span>
            <span>{locale === "sk" ? "KOMUNITNÝ WEB" : "KOMUNITNÍ WEB"}</span>
          </span>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>
        {children ?? (
          <section className="empty-state" role="status">
            <span className="empty-state-icon" aria-hidden="true">
              ◇
            </span>
            <h2>{messages[state]}</h2>
            <p>
              {locale === "sk"
                ? "Zobrazujeme len overené údaje; nič nenahrádzame ukážkovým obsahom."
                : "Zobrazujeme pouze ověřené údaje; nic nenahrazujeme ukázkovým obsahem."}
            </p>
            <Link className="text-link" href={`/${locale}`}>
              <span>{locale === "sk" ? "Späť na domov" : "Zpět na domov"}</span>
              <span aria-hidden="true">→</span>
            </Link>
          </section>
        )}
      </main>
      <SiteFooter locale={locale} copy={copy} />
    </>
  );
}
