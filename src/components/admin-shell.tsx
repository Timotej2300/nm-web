import Link from "next/link";
import type { Locale } from "@/lib/i18n";

const items = [
  ["dashboard", "Prehľad", "Přehled"],
  ["pages", "Stránky", "Stránky"],
  ["news", "Novinky", "Novinky"],
  ["team", "Tím", "Tým"],
  ["ranks", "Ranky", "Ranky"],
  ["forum", "Fórum", "Fórum"],
  ["tickets", "Tickety", "Tickety"],
  ["recruitment", "Nábor", "Nábor"],
  ["settings", "Nastavenia", "Nastavení"],
  ["audit", "Audit", "Audit"],
] as const;

export function AdminShell({
  locale,
  previewTestMode,
  children,
}: {
  locale: Locale;
  previewTestMode: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href={`/${locale}`} className="admin-brand">
          Ninja<span>Melon</span>
          <small>.cz / admin</small>
        </Link>
        <nav aria-label="Administrácia">
          {items.map(([path, sk, cs]) => (
            <Link
              key={path}
              href={`/${locale}/admin${path === "dashboard" ? "" : `/${path}`}`}
            >
              {locale === "sk" ? sk : cs}
            </Link>
          ))}
        </nav>
        <Link href={`/${locale}`} className="admin-back">
          ← {locale === "sk" ? "Verejný web" : "Veřejný web"}
        </Link>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <span>SECURE WORKSPACE</span>
          <span>{locale.toUpperCase()}</span>
        </header>
        {previewTestMode && (
          <div className="admin-preview-test-banner" role="status">
            {locale === "sk"
              ? "TEST MODE · Vercel Preview · LuckPerms oprávnenia sú simulované iba pre určený testovací účet. Stav bridge-u a herného servera sa nesimuluje."
              : "TEST MODE · Vercel Preview · Oprávnění LuckPerms jsou simulována pouze pro určený testovací účet. Stav bridge a herního serveru se nesimuluje."}
          </div>
        )}
        <main id="main" className="admin-content">
          {children}
        </main>
      </div>
    </div>
  );
}

export function AdminAccessState({
  locale,
  reason,
}: {
  locale: Locale;
  reason: string;
}) {
  const title =
    reason === "denied"
      ? locale === "sk"
        ? "Prístup zamietnutý"
        : "Přístup zamítnut"
      : locale === "sk"
        ? "Oprávnenie sa nedá overiť"
        : "Oprávnění nelze ověřit";
  const message =
    reason === "denied"
      ? locale === "sk"
        ? "Aktuálne LuckPerms oprávnenie túto akciu nepovoľuje."
        : "Aktuální LuckPerms oprávnění tuto akci nepovoluje."
      : locale === "sk"
        ? "Prihlásenie alebo serverový bridge nie je dostupný. Citlivá akcia je zablokovaná."
        : "Přihlášení nebo serverový bridge není dostupný. Citlivá akce je zablokována.";
  return (
    <section className="admin-access-state" role="status">
      <span aria-hidden="true">◈</span>
      <h1>{title}</h1>
      <p>{message}</p>
    </section>
  );
}

export async function AdminSection({
  locale,
  permission,
  title,
}: {
  locale: Locale;
  permission: import("@/lib/auth/permissions").PermissionNode;
  title: string;
}) {
  const { checkCurrentPermission } = await import("@/lib/auth/permissions");
  const result = await checkCurrentPermission(permission);
  if (!result.allowed)
    return <AdminAccessState locale={locale} reason={result.reason} />;
  return (
    <section className="admin-section-state">
      <p className="section-kicker">STAFF / {permission}</p>
      <h1>{title}</h1>
      <p>
        {locale === "sk"
          ? "Modul nemá nakonfigurovaný databázový workflow; zápis zostáva vypnutý."
          : "Modul nemá nakonfigurovaný databázový workflow; zápis zůstává vypnutý."}
      </p>
    </section>
  );
}
