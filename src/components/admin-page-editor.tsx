"use client";

import { useEffect, useState, type FormEvent } from "react";
import { SafeMarkdown } from "@/components/safe-markdown";
import type { Locale } from "@/lib/i18n";

type PageItem = {
  id: string;
  slug: string;
  language: "sk" | "cs";
  title: string;
  body_markdown: string;
  status: "draft" | "scheduled" | "published" | "archived";
  publish_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
};
type Draft = Omit<PageItem, "id" | "publish_at" | "seo_title" | "seo_description" | "canonical_url"> & {
  id?: string;
  publishAt: string;
  seoTitle: string;
  seoDescription: string;
  canonicalUrl: string;
};

function blank(locale: Locale): Draft {
  return {
    slug: "",
    language: locale,
    title: "",
    body_markdown: "",
    status: "draft",
    publishAt: "",
    seoTitle: "",
    seoDescription: "",
    canonicalUrl: "",
  };
}

function fromPage(page: PageItem): Draft {
  return {
    ...page,
    publishAt: page.publish_at
      ? new Date(page.publish_at).toISOString().slice(0, 16)
      : "",
    seoTitle: page.seo_title ?? "",
    seoDescription: page.seo_description ?? "",
    canonicalUrl: page.canonical_url ?? "",
  };
}

export function AdminPageEditor({ locale }: { locale: Locale }) {
  const sk = locale === "sk";
  const [pages, setPages] = useState<PageItem[]>([]);
  const [draft, setDraft] = useState<Draft>(() => blank(locale));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function refresh() {
    const response = await fetch("/api/admin/pages", {
      credentials: "same-origin",
      cache: "no-store",
    });
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error("CMS pages unavailable");
    setPages((result as { pages: PageItem[] }).pages);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/pages", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error("CMS pages unavailable");
        return result as { pages: PageItem[] };
      })
      .then((result) => {
        if (active) setPages(result.pages);
      })
      .catch(() => {
        if (active) {
          setFailed(true);
          setMessage(sk ? "Stránky sa nepodarilo načítať." : "Stránky se nepodařilo načíst.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sk]);

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save(publishNow = false) {
    setBusy(true);
    setFailed(false);
    setMessage("");
    try {
      const response = await fetch("/api/admin/pages", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draft.id,
          slug: draft.slug,
          language: draft.language,
          title: draft.title,
          bodyMarkdown: draft.body_markdown,
          status: publishNow ? "published" : draft.status,
          publishAt: publishNow
            ? new Date().toISOString()
            : draft.publishAt
              ? new Date(draft.publishAt).toISOString()
              : null,
          seoTitle: draft.seoTitle || null,
          seoDescription: draft.seoDescription || null,
          canonicalUrl: draft.canonicalUrl || null,
        }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const reason =
          typeof result === "object" &&
          result !== null &&
          "error" in result &&
          typeof result.error === "string"
            ? result.error
            : "Page could not be saved";
        throw new Error(reason);
      }
      setDraft((current) => ({
        ...current,
        id: (result as { id: string }).id,
        status: publishNow ? "published" : current.status,
      }));
      await refresh();
      setMessage(publishNow ? (sk ? "Stránka bola publikovaná." : "Stránka byla publikována.") : (sk ? "Stránka bola uložená." : "Stránka byla uložena."));
    } catch (cause) {
      setFailed(true);
      setMessage(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cms-editor">
      <aside className="cms-article-list">
        <div className="cms-list-heading">
          <h2>{sk ? "Vlastné stránky" : "Vlastní stránky"}</h2>
          <button className="button button-secondary" type="button" onClick={() => setDraft(blank(locale))}>
            {sk ? "Nová" : "Nová"}
          </button>
        </div>
        {loading ? (
          <p className="ticket-state" role="status">{sk ? "Načítavam…" : "Načítám…"}</p>
        ) : pages.length === 0 ? (
          <p className="ticket-state">{sk ? "Zatiaľ tu nie sú stránky." : "Zatím zde nejsou stránky."}</p>
        ) : (
          <ul>
            {pages.map((item) => (
              <li key={item.id}>
                <button className={`cms-list-item${draft.id === item.id ? " cms-list-item-active" : ""}`} type="button" onClick={() => setDraft(fromPage(item))}>
                  <strong>{item.title}</strong>
                  <span>{item.language.toUpperCase()} · {item.status}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <section className="cms-workspace">
        <form className="cms-form" onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          void save(false);
        }}>
          <div className="cms-form-grid">
            <label className="field">
              <span>{sk ? "Jazyk" : "Jazyk"}</span>
              <select value={draft.language} onChange={(event) => update("language", event.target.value as "sk" | "cs")}>
                <option value="sk">Slovenčina</option>
                <option value="cs">Čeština</option>
              </select>
            </label>
            <label className="field">
              <span>Slug</span>
              <input required maxLength={120} pattern="[a-z0-9][a-z0-9-]{0,119}" value={draft.slug} onChange={(event) => update("slug", event.target.value.toLowerCase())} />
            </label>
            <label className="field cms-field-wide">
              <span>{sk ? "Nadpis" : "Nadpis"}</span>
              <input required maxLength={160} value={draft.title} onChange={(event) => update("title", event.target.value)} />
            </label>
            <label className="field cms-field-wide">
              <span>Markdown</span>
              <textarea rows={12} maxLength={100_000} value={draft.body_markdown} onChange={(event) => update("body_markdown", event.target.value)} />
            </label>
            <label className="field">
              <span>{sk ? "Stav" : "Stav"}</span>
              <select value={draft.status} onChange={(event) => update("status", event.target.value as Draft["status"])}>
                <option value="draft">{sk ? "Koncept" : "Koncept"}</option>
                <option value="scheduled">{sk ? "Naplánované" : "Naplánováno"}</option>
                <option value="published">{sk ? "Publikované" : "Publikováno"}</option>
                <option value="archived">{sk ? "Archivované" : "Archivováno"}</option>
              </select>
            </label>
            {draft.status === "scheduled" && (
              <label className="field">
                <span>{sk ? "Čas publikovania" : "Čas publikování"}</span>
                <input required type="datetime-local" value={draft.publishAt} onChange={(event) => update("publishAt", event.target.value)} />
              </label>
            )}
            <label className="field cms-field-wide">
              <span>SEO title</span>
              <input maxLength={160} value={draft.seoTitle} onChange={(event) => update("seoTitle", event.target.value)} />
            </label>
            <label className="field cms-field-wide">
              <span>SEO description</span>
              <textarea rows={2} maxLength={320} value={draft.seoDescription} onChange={(event) => update("seoDescription", event.target.value)} />
            </label>
            <label className="field cms-field-wide">
              <span>Canonical HTTPS URL</span>
              <input type="url" pattern="https://.*" value={draft.canonicalUrl} onChange={(event) => update("canonicalUrl", event.target.value)} />
            </label>
          </div>
          <div className="cms-actions">
            <button className="button button-secondary" type="button" onClick={() => setPreview((value) => !value)}>
              {preview ? (sk ? "Skryť náhľad" : "Skrýt náhled") : (sk ? "Náhľad" : "Náhled")}
            </button>
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? (sk ? "Ukladám…" : "Ukládám…") : (sk ? "Uložiť" : "Uložit")}
            </button>
            <button className="button button-publish" type="button" disabled={busy || !draft.slug} onClick={() => void save(true)}>
              {sk ? "Publikovať teraz" : "Publikovat nyní"}
            </button>
          </div>
          {message && <p className={failed ? "form-message form-message-error" : "form-message"} role={failed ? "alert" : "status"}>{message}</p>}
        </form>
        {preview && (
          <article className="cms-preview">
            <p className="section-kicker">{sk ? "NÁHĽAD" : "NÁHLED"}</p>
            <h2>{draft.title || (sk ? "Bez názvu" : "Bez názvu")}</h2>
            <SafeMarkdown source={draft.body_markdown} />
          </article>
        )}
      </section>
    </div>
  );
}