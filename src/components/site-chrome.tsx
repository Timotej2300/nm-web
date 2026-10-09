"use client";

import Link from "next/link";
import { useState } from "react";
import type { Copy, Locale } from "@/lib/i18n";

function Brand() {
  return (
    <span className="brand" aria-label="NinjaMelon.cz">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span className="brand-word">
        Ninja<span>Melon</span>
        <small>.cz</small>
      </span>
    </span>
  );
}

export function SiteHeader({ locale, copy }: { locale: Locale; copy: Copy }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="site-header">
      <div className="header-inner wrap">
        <Link href={`/${locale}`} aria-label="NinjaMelon.cz — domov">
          <Brand />
        </Link>
        <button
          className="menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="primary-nav"
          aria-label={
            locale === "sk" ? "Otvoriť navigáciu" : "Otevřít navigaci"
          }
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span />
          <span />
        </button>
        <nav
          className={`primary-nav${menuOpen ? " is-open" : ""}`}
          id="primary-nav"
          aria-label={locale === "sk" ? "Hlavná navigácia" : "Hlavní navigace"}
        >
          <Link href={`/${locale}/modes`} onClick={() => setMenuOpen(false)}>
            {copy.navModes}
          </Link>
          <Link href={`/${locale}/news`} onClick={() => setMenuOpen(false)}>
            {locale === "sk" ? "Novinky" : "Novinky"}
          </Link>
          <Link href={`/${locale}/team`} onClick={() => setMenuOpen(false)}>
            {locale === "sk" ? "Tím" : "Tým"}
          </Link>
          <Link href={`/${locale}/forum`} onClick={() => setMenuOpen(false)}>
            Fórum
          </Link>
          <Link href={`/${locale}/notifications`} onClick={() => setMenuOpen(false)}>
            {locale === "sk" ? "Upozornenia" : "Upozornění"}
          </Link>
          <Link href={`/${locale}/search`} onClick={() => setMenuOpen(false)}>
            {locale === "sk" ? "Hľadať" : "Hledat"}
          </Link>
          <Link href={`/${locale}#about`} onClick={() => setMenuOpen(false)}>
            {copy.navStory}
          </Link>
        </nav>
        <div className="header-actions">
          <Link
            className="language-switch"
            href={locale === "sk" ? "/cs" : "/sk"}
            aria-label={
              locale === "sk"
                ? "Zmeniť jazyk na češtinu"
                : "Změnit jazyk na slovenštinu"
            }
          >
            <span className="language-current">{locale.toUpperCase()}</span>
            <span className="language-divider">/</span>
            <span className="language-next">
              {locale === "sk" ? "CZ" : "SK"}
            </span>
          </Link>
          <Link
            className="button button-small button-quiet header-join"
            href={`/${locale}/support`}
          >
            <span>{copy.join}</span>
            <span className="arrow" aria-hidden="true">
              ↗
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export function SiteFooter({ locale, copy }: { locale: Locale; copy: Copy }) {
  return (
    <footer className="site-footer">
      <div className="wrap footer-main">
        <Link href={`/${locale}`}>
          <Brand />
        </Link>
        <p>{copy.footerLine}</p>
        <a href="#top" className="back-to-top">
          <span>{copy.backTop}</span>
          <span aria-hidden="true">↑</span>
        </a>
      </div>
      <div className="wrap footer-bottom">
        <span>© {new Date().getFullYear()} NinjaMelon.cz</span>
        <span>
          {locale === "sk"
            ? "Žiadne vymyslené štatistiky."
            : "Žádné vymyšlené statistiky."}
        </span>
        <a href="https://ninjamelon.cz/" target="_blank" rel="noreferrer">
          <span>{copy.originalSite}</span>
          <span aria-hidden="true">↗</span>
        </a>
      </div>
    </footer>
  );
}
