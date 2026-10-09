"use client";

import { useState, type FormEvent } from "react";
import type { RecruitmentField } from "@/lib/recruitment/schema";
import type { Locale } from "@/lib/i18n";

type RecruitmentFormData = {
  id: string;
  title_sk: string;
  title_cs: string;
  fields: RecruitmentField[];
  closes_at: string | null;
};

export function RecruitmentForm({
  locale,
  form,
}: {
  locale: Locale;
  form: RecruitmentFormData;
}) {
  const sk = locale === "sk";
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [complete, setComplete] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const label = (field: RecruitmentField) =>
    sk ? field.label_sk : field.label_cs;

  function update(id: string, value: unknown) {
    setAnswers((current) => ({ ...current, [id]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError(false);
    try {
      const response = await fetch("/api/recruitment", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formId: form.id,
          email,
          answers,
          website,
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
            : "Application could not be submitted";
        throw new Error(reason);
      }
      setComplete(true);
      setMessage(sk ? "Prihláška bola odoslaná." : "Přihláška byla odeslána.");
    } catch (cause) {
      setError(true);
      setMessage(
        cause instanceof Error
          ? cause.message
          : sk
            ? "Prihlášku sa nepodarilo odoslať."
            : "Přihlášku se nepodařilo odeslat.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="recruitment-panel">
      <div className="section-kicker"><span>APPLICATION</span></div>
      <h2>{sk ? form.title_sk : form.title_cs}</h2>
      {form.closes_at && (
        <p className="form-hint">
          {sk ? "Uzávierka" : "Uzávěrka"}:{" "}
          <time dateTime={form.closes_at}>
            {new Date(form.closes_at).toLocaleDateString(sk ? "sk-SK" : "cs-CZ")}
          </time>
        </p>
      )}
      {complete ? (
        <p className="form-message" role="status">{message}</p>
      ) : (
        <form className="auth-form" onSubmit={submit}>
          <label className="field">
            <span>{sk ? "Kontaktný e-mail" : "Kontaktní e-mail"}</span>
            <input required autoComplete="email" type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          {form.fields.map((field) => {
            const title = label(field);
            const required = field.required;
            if (field.type === "info")
              return (
                <aside className="recruitment-info" key={field.id}>
                  <strong>{title}</strong>
                  <p>{sk ? field.content_sk : field.content_cs}</p>
                </aside>
              );
            if (field.type === "long_text")
              return (
                <label className="field" key={field.id}>
                  <span>{title}{required ? " *" : ""}</span>
                  <textarea required={required} maxLength={5000} rows={5} value={(answers[field.id] as string) ?? ""} onChange={(event) => update(field.id, event.target.value)} />
                </label>
              );
            if (field.type === "select" || field.type === "multi_select")
              return (
                <label className="field" key={field.id}>
                  <span>{title}{required ? " *" : ""}</span>
                  <select
                    required={required && field.type === "select"}
                    multiple={field.type === "multi_select"}
                    value={field.type === "multi_select" ? ((answers[field.id] as string[]) ?? []) : ((answers[field.id] as string) ?? "")}
                    onChange={(event) =>
                      update(
                        field.id,
                        field.type === "multi_select"
                          ? Array.from(event.target.selectedOptions, (option) => option.value)
                          : event.target.value,
                      )
                    }
                  >
                    {field.type === "select" && <option value="">{sk ? "Vyber možnosť" : "Vyber možnost"}</option>}
                    {field.options?.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              );
            if (field.type === "boolean")
              return (
                <label className="field" key={field.id}>
                  <span>{title}{required ? " *" : ""}</span>
                  <select
                    required={required}
                    value={
                      typeof answers[field.id] === "boolean"
                        ? String(answers[field.id])
                        : ""
                    }
                    onChange={(event) =>
                      update(field.id, event.target.value === "true")
                    }
                  >
                    <option value="">{sk ? "Vyber odpoveď" : "Vyber odpověď"}</option>
                    <option value="true">{sk ? "Áno" : "Ano"}</option>
                    <option value="false">{sk ? "Nie" : "Ne"}</option>
                  </select>
                </label>
              );
            return (
              <label className="field" key={field.id}>
                <span>{title}{required ? " *" : ""}</span>
                <input
                  required={required}
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  maxLength={field.type === "short_text" ? 180 : undefined}
                  value={(answers[field.id] as string | number) ?? ""}
                  onChange={(event) =>
                    update(
                      field.id,
                      field.type === "number" && event.target.value !== ""
                        ? Number(event.target.value)
                        : event.target.value,
                    )
                  }
                />
              </label>
            );
          })}
          <label className="recruitment-honeypot" aria-hidden="true" tabIndex={-1}>
            <span>Website</span>
            <input
              tabIndex={-1}
              autoComplete="off"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />
          </label>
          <button className="button button-primary" type="submit" disabled={busy}>
            {busy ? (sk ? "Odosielam…" : "Odesílám…") : (sk ? "Odoslať prihlášku" : "Odeslat přihlášku")}
          </button>
          {message && <p className={error ? "form-message form-message-error" : "form-message"} role={error ? "alert" : "status"}>{message}</p>}
          <p className="form-hint">
            {sk
              ? "Odpovede spracúva iba oprávnený tím náboru."
              : "Odpovědi zpracovává pouze oprávněný náborový tým."}
          </p>
        </form>
      )}
    </section>
  );
}