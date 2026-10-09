"use client";

import { useEffect, useState, type FormEvent } from "react";
import { SafeMarkdown } from "@/components/safe-markdown";
import type { Locale } from "@/lib/i18n";

type Article = {
  id: string;
  slug: string;
  language: "sk" | "cs";
  title: string;
  excerpt: string | null;
  body_markdown: string;
  status: "draft" | "scheduled" | "published" | "archived";
  publish_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  updated_at: string;
};

type EditorState = {
  id?: string;
  slug: string;
  language: "sk" | "cs";
  title: string;
  excerpt: string;
  bodyMarkdown: string;
  status: Article["status"];
  publishAt: string;
  seoTitle: string;
  seoDescription: string;
};

function blankEditor(language: Locale): EditorState {
  return {
    slug: "",
    language,
    title: "",
    excerpt: "",
    bodyMarkdown: "",
    status: "draft",
    publishAt: "",
    seoTitle: "",
    seoDescription: "",
  };
}

function toEditor(article: Article): EditorState {
  return {
    id: article.id,
    slug: article.slug,
    language: article.language,
    title: article.title,
    excerpt: article.excerpt ?? "",
    bodyMarkdown: article.body_markdown,
    status: article.status,
    publishAt: article.publish_at
      ? new Date(article.publish_at).toISOString().slice(0, 16)
      : "",
    seoTitle: article.seo_title ?? "",
    seoDescription: article.seo_description ?? "",
  };
}

export function AdminNewsEditor({ locale }: { locale: Locale }) {
  const sk = locale === "sk";
  const [articles, setArticles] = useState<Article[]>([]);
  const [editor, setEditor] = useState<EditorState>(() => blankEditor(locale));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function loadArticles() {
    const response = await fetch("/api/admin/news", {
      credentials: "same-origin",
      cache: "no-store",
    });
    const result: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const reason =
        typeof result === "object" &&
        result !== null &&
        "error" in result &&
        typeof result.error === "string"
          ? result.error
          : "CMS unavailable";
      throw new Error(reason);
    }
    setArticles((result as { articles: Article[] }).articles);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/news", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const result: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error("Novinky sa nepodarilo načítať.");
        return result as { articles: Article[] };
      })
      .then((result) => {
        if (active) setArticles(result.articles);
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(true);
          setMessage(cause instanceof Error ? cause.message : "CMS unavailable");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function update<K extends keyof EditorState>(key: K, value: EditorState[K]) {
    setEditor((current) => ({ ...current, [key]: value }));
  }

  async function save(publishNow = false) {
    setBusy(true);
    setError(false);
    setMessage("");
    const status = publishNow ? "published" : editor.status;
    const publishAt = publishNow
      ? new Date().toISOString()
      : editor.publishAt
        ? new Date(editor.publishAt).toISOString()
        : null;
    try {
      const response = await fetch("/api/admin/news", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...editor,
          excerpt: editor.excerpt || null,
          status,
          publishAt,
          seoTitle: editor.seoTitle || null,
          seoDescription: editor.seoDescription || null,
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
            : "Article could not be saved";
        throw new Error(reason);
      }
      const id = (result as { id: string }).id;
      setEditor((current) => ({ ...current, id, status }));
      await loadArticles();
      setMessage(
        publishNow
          ? sk
            ? "Novinka bola publikovaná."
            : "Novinka byla publikována."
          : sk
            ? "Koncept bol uložený."
            : "Koncept byl uložen.",
      );
    } catch (cause) {
      setError(true);
      setMessage(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cms-editor">
      <aside className="cms-article-list">
        <div className="cms-list-heading">
          <h2>{sk ? "Uložené novinky" : "Uložené novinky"}</h2>
          <button
            className="button button-secondary"
            type="button"
            onClick={() => {
              setEditor(blankEditor(locale));
              setMessage("");
            }}
          >
            {sk ? "Nová" : "Nová"}
          </button>
        </div>
        {loading ? (
          <p className="ticket-state" role="status">{sk ? "Načítavam…" : "Načítám…"}</p>
        ) : articles.length === 0 ? (
          <p className="ticket-state">{sk ? "Zatiaľ tu nie sú uložené novinky." : "Zatím zde nejsou uložené novinky."}</p>
        ) : (
          <ul>
            {articles.map((article) => (
              <li key={article.id}>
                <button
                  className={`cms-list-item${editor.id === article.id ? " cms-list-item-active" : ""}`}
                  type="button"
                  onClick={() => {
                    setEditor(toEditor(article));
                    setMessage("");
                  }}
                >
                  <strong>{article.title}</strong>
                  <span>{article.language.toUpperCase()} · {article.status}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>
      <section className="cms-workspace">
        <form
          className="cms-form"
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();
            void save(false);
          }}
        >
          <div className="cms-form-grid">
            <label className="field">
              <span>{sk ? "Jazyk" : "Jazyk"}</span>
              <select value={editor.language} onChange={(event) => update("language", event.target.value as "sk" | "cs")}>
                <option value="sk">Slovenčina</option>
                <option value="cs">Čeština</option>
              </select>
            </label>
            <label className="field">
              <span>Slug</span>
              <input required maxLength={120} pattern="[a-z0-9][a-z0-9-]{0,119}" value={editor.slug} onChange={(event) => update("slug", event.target.value.toLowerCase())} />
            </label>
            <label className="field cms-field-wide">
              <span>{sk ? "Nadpis" : "Nadpis"}</span>
              <input required maxLength={180} value={editor.title} onChange={(event) => update("title", event.target.value)} />
            </label>
            <label className="field cms-field-wide">
              <span>{sk ? "Perex" : "Perex"}</span>
              <textarea maxLength={500} rows={2} value={editor.excerpt} onChange={(event) => update("excerpt", event.target.value)} />
            </label>
            <label className="field cms-field-wide">
              <span>Markdown</span>
              <textarea maxLength={100_000} rows={13} value={editor.bodyMarkdown} onChange={(event) => update("bodyMarkdown", event.target.value)} />
            </label>
            <label className="field">
              <span>{sk ? "Stav" : "Stav"}</span>
              <select value={editor.status} onChange={(event) => update("status", event.target.value as Article["status"])}>
                <option value="draft">{sk ? "Koncept" : "Koncept"}</option>
                <option value="scheduled">{sk ? "Naplánované" : "Naplánováno"}</option>
                <option value="published">{sk ? "Publikované" : "Publikováno"}</option>
                <option value="archived">{sk ? "Archivované" : "Archivováno"}</option>
              </select>
            </label>
            {editor.status === "scheduled" && (
              <label className="field">
                <span>{sk ? "Čas publikovania" : "Čas publikování"}</span>
                <input required type="datetime-local" value={editor.publishAt} onChange={(event) => update("publishAt", event.target.value)} />
              </label>
            )}
            <label className="field cms-field-wide">
              <span>SEO title</span>
              <input maxLength={160} value={editor.seoTitle} onChange={(event) => update("seoTitle", event.target.value)} />
            </label>
            <label className="field cms-field-wide">
              <span>SEO description</span>
              <textarea maxLength={320} rows={2} value={editor.seoDescription} onChange={(event) => update("seoDescription", event.target.value)} />
            </label>
          </div>
          <div className="cms-actions">
            <button className="button button-secondary" type="button" onClick={() => setPreview((current) => !current)}>
              {preview ? (sk ? "Skryť náhľad" : "Skrýt náhled") : (sk ? "Náhľad" : "Náhled")}
            </button>
            <button className="button button-primary" type="submit" disabled={busy}>
              {busy ? (sk ? "Ukladám…" : "Ukládám…") : (sk ? "Uložiť" : "Uložit")}
            </button>
            <button className="button button-publish" type="button" disabled={busy || !editor.slug} onClick={() => void save(true)}>
              {sk ? "Publikovať teraz" : "Publikovat nyní"}
            </button>
          </div>
          {message && <p className={error ? "form-message form-message-error" : "form-message"} role={error ? "alert" : "status"}>{message}</p>}
        </form>
        {preview && (
          <article className="cms-preview">
            <p className="section-kicker">{sk ? "NÁHĽAD" : "NÁHLED"}</p>
            <h2>{editor.title || (sk ? "Bez názvu" : "Bez názvu")}</h2>
            {editor.excerpt && <p>{editor.excerpt}</p>}
            <SafeMarkdown source={editor.bodyMarkdown} />
          </article>
        )}
      </section>
    </div>
  );
}