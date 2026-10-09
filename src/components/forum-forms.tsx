"use client";

import { useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";

async function post(url: string, value: unknown) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(value),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "Request failed";
    throw new Error(error);
  }
  return result;
}

export function NewForumTopicForm({
  locale,
  categories,
}: {
  locale: Locale;
  categories: Array<{ id: string; label: string }>;
}) {
  const sk = locale === "sk";
  const [categoryId, setCategoryId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = (await post("/api/forum/topics", {
        categoryId,
        title,
        body,
      })) as { topicId: string };
      window.location.assign(`/${locale}/forum/${result.topicId}`);
    } catch (cause) {
      setMessage(
        cause instanceof Error
          ? cause.message
          : sk
            ? "Tému sa nepodarilo vytvoriť."
            : "Téma se nepodařila vytvořit.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="forum-compose">
      <details>
        <summary>{sk ? "Vytvoriť tímovú tému" : "Vytvořit týmové téma"}</summary>
        <form className="auth-form" onSubmit={submit}>
          <label className="field">
            <span>{sk ? "Kategória" : "Kategorie"}</span>
            <select required value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">{sk ? "Vyber kategóriu" : "Vyber kategorii"}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>{category.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>{sk ? "Názov témy" : "Název tématu"}</span>
            <input required minLength={4} maxLength={180} value={title} onChange={(event) => setTitle(event.target.value)} />
          </label>
          <label className="field">
            <span>{sk ? "Prvý príspevok" : "První příspěvek"}</span>
            <textarea required maxLength={12_000} rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
          </label>
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? (sk ? "Vytváram…" : "Vytvářím…") : (sk ? "Zverejniť tému" : "Zveřejnit téma")}
          </button>
          {message && <p className="form-message form-message-error" role="alert">{message}</p>}
        </form>
      </details>
    </section>
  );
}

export function ForumReplyForm({
  locale,
  topicId,
}: {
  locale: Locale;
  topicId: string;
}) {
  const sk = locale === "sk";
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    try {
      await post("/api/forum/replies", { topicId, body });
      window.location.reload();
    } catch (cause) {
      setError(true);
      setMessage(
        cause instanceof Error
          ? cause.message
          : sk
            ? "Odpoveď sa nepodarilo odoslať."
            : "Odpověď se nepodařilo odeslat.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="forum-reply-form auth-form" onSubmit={submit}>
      <label className="field">
        <span>{sk ? "Tvoja odpoveď" : "Tvoje odpověď"}</span>
        <textarea required maxLength={12_000} rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
      </label>
      <button className="button button-primary" type="submit" disabled={busy}>
        {busy ? (sk ? "Odosielam…" : "Odesílám…") : (sk ? "Odpovedať" : "Odpovědět")}
      </button>
      {message && <p className={error ? "form-message form-message-error" : "form-message"} role={error ? "alert" : "status"}>{message}</p>}
    </form>
  );
}

export function ContentReportForm({
  locale,
  targetId,
  targetType,
}: {
  locale: Locale;
  targetId: string;
  targetType: "forum_topic" | "forum_post" | "profile";
}) {
  const sk = locale === "sk";
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await post("/api/forum/reports", { targetType, targetId, reason });
      setSent(true);
      setMessage(sk ? "Nahlásenie bolo odoslané moderátorom." : "Nahlášení bylo odesláno moderátorům.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : (sk ? "Nahlásenie sa nepodarilo." : "Nahlášení se nezdařilo."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="content-report">
      <summary>{sk ? "Nahlásiť príspevok" : "Nahlásit příspěvek"}</summary>
      <form className="auth-form" onSubmit={submit}>
        <label className="field">
          <span>{sk ? "Dôvod nahlásenia" : "Důvod nahlášení"}</span>
          <textarea required minLength={3} maxLength={1200} rows={3} value={reason} onChange={(event) => setReason(event.target.value)} disabled={sent} />
        </label>
        <button className="button button-secondary" type="submit" disabled={busy || sent}>
          {busy ? (sk ? "Odosielam…" : "Odesílám…") : sent ? (sk ? "Odoslané" : "Odesláno") : (sk ? "Odoslať nahlásenie" : "Odeslat nahlášení")}
        </button>
        {message && <p className={sent ? "form-message" : "form-message form-message-error"} role={sent ? "status" : "alert"}>{message}</p>}
      </form>
    </details>
  );
}