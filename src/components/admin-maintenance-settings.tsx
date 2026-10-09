"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

type Settings = { enabled: boolean; messageSk: string; messageCs: string };

export function AdminMaintenanceSettings({ locale }: { locale: Locale }) {
  const sk = locale === "sk";
  const [settings, setSettings] = useState<Settings>({
    enabled: false,
    messageSk: "",
    messageCs: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [initialEnabled, setInitialEnabled] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/maintenance", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message = typeof data === "object" && data !== null && "error" in data &&
            typeof data.error === "string" ? data.error : "Settings are unavailable";
          throw new Error(message);
        }
        return data as Settings;
      })
      .then((data) => {
        if (active) {
          setSettings(data);
          setInitialEnabled(data.enabled);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unavailable");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (settings.enabled !== initialEnabled && settings.enabled && !window.confirm(
      sk
        ? "Zapnúť údržbu? Verejné stránky a API budú dočasne blokované."
        : "Zapnout údržbu? Veřejné stránky a API budou dočasně blokované.",
    )) return;
    if (settings.enabled !== initialEnabled && !settings.enabled && !window.confirm(
      sk ? "Vypnúť údržbu a znovu sprístupniť web?" : "Vypnout údržbu a znovu zpřístupnit web?",
    )) return;
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch("/api/admin/maintenance", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = typeof data === "object" && data !== null && "error" in data &&
          typeof data.error === "string" ? data.error : "Settings could not be saved";
        throw new Error(message);
      }
      setInitialEnabled(settings.enabled);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-maintenance">
      <header className="admin-maintenance-heading">
        <p className="section-kicker"><span>STAFF</span><span> / ninjamelonweb.maintenance</span></p>
        <h1>{sk ? "Údržba webu" : "Údržba webu"}</h1>
        <p>{sk ? "Pri aktívnej údržbe verejný web aj jeho API zobrazia nedostupnosť. Administrácia vyžaduje aktuálne oprávnenie." : "Při aktivní údržbě veřejný web i jeho API zobrazí nedostupnost. Administrace vyžaduje aktuální oprávnění."}</p>
      </header>
      {loading ? <p className="admin-audit-state" role="status">{sk ? "Načítavam nastavenie…" : "Načítám nastavení…"}</p> :
        <form className="admin-maintenance-form" onSubmit={save}>
          <label className="admin-maintenance-toggle">
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(event) => { setSettings((value) => ({ ...value, enabled: event.target.checked })); setSaved(false); }}
            />
            <span>{settings.enabled ? (sk ? "Údržba je zapnutá" : "Údržba je zapnutá") : (sk ? "Údržba je vypnutá" : "Údržba je vypnutá")}</span>
          </label>
          <label className="field">
            <span>{sk ? "Správa pre návštevníkov (SK)" : "Zpráva pro návštěvníky (SK)"}</span>
            <textarea maxLength={500} rows={3} value={settings.messageSk} onChange={(event) => { setSettings((value) => ({ ...value, messageSk: event.target.value })); setSaved(false); }} />
          </label>
          <label className="field">
            <span>{sk ? "Odkaz pre návštevníkov (CZ)" : "Zpráva pro návštěvníky (CZ)"}</span>
            <textarea maxLength={500} rows={3} value={settings.messageCs} onChange={(event) => { setSettings((value) => ({ ...value, messageCs: event.target.value })); setSaved(false); }} />
          </label>
          {error && <p className="admin-ticket-error" role="alert">{error}</p>}
          {saved && <p className="admin-maintenance-saved" role="status">{sk ? "Nastavenie bolo uložené." : "Nastavení bylo uloženo."}</p>}
          <p className="admin-private-note">{sk ? "Zmena sa na jednotlivých serverless inštanciách prejaví najneskôr po krátkom vypršaní cache. Oprávnenie sa kontroluje na serveri." : "Změna se na jednotlivých serverless instancích projeví nejpozději po krátkém vypršení cache. Oprávnění se kontroluje na serveru."}</p>
          <button className="button button-primary" type="submit" disabled={saving}>
            {saving ? (sk ? "Ukladám…" : "Ukládám…") : (sk ? "Uložiť nastavenie" : "Uložit nastavení")}
          </button>
        </form>}
    </section>
  );
}