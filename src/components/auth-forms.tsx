"use client";

import { useState, type FormEvent } from "react";
import type { Locale } from "@/lib/i18n";

type AuthFormProps = { locale: Locale };

async function postJson(path: string, payload: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });
  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof result === "object" &&
      result !== null &&
      "error" in result &&
      typeof result.error === "string"
        ? result.error
        : "Request could not be completed";
    throw new Error(message);
  }
  return result;
}

export function LoginForm({ locale }: AuthFormProps) {
  const sk = locale === "sk";
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    setMessage("");
    try {
      if (!sent) {
        await postJson("/api/auth/login/request", { email });
        setSent(true);
        setMessage(
          sk
            ? "Ak účet existuje, poslali sme naň prihlasovací kód."
            : "Pokud účet existuje, poslali jsme na něj přihlašovací kód.",
        );
      } else {
        await postJson("/api/auth/login/verify", { email, token });
        window.location.assign(`/${locale}/link`);
      }
    } catch (cause) {
      setError(true);
      setMessage(
        cause instanceof Error
          ? cause.message
          : sk
            ? "Prihlásenie sa nepodarilo."
            : "Přihlášení se nezdařilo.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <label className="field">
        <span>{sk ? "E-mail účtu" : "E-mail účtu"}</span>
        <input
          autoComplete="email"
          required
          maxLength={254}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={busy || sent}
        />
      </label>
      {sent && (
        <label className="field">
          <span>{sk ? "Jednorazový kód" : "Jednorázový kód"}</span>
          <input
            autoComplete="one-time-code"
            required
            inputMode="numeric"
            pattern="[0-9]{6,8}"
            minLength={6}
            maxLength={8}
            value={token}
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
      )}
      <button className="button button-primary" disabled={busy} type="submit">
        {busy
          ? sk
            ? "Spracúvam…"
            : "Zpracovávám…"
          : sent
            ? sk
              ? "Overiť kód"
              : "Ověřit kód"
            : sk
              ? "Poslať prihlasovací kód"
              : "Poslat přihlašovací kód"}
      </button>
      {message && (
        <p className={error ? "form-message form-message-error" : "form-message"} role={error ? "alert" : "status"}>
          {message}
        </p>
      )}
      <p className="form-hint">
        {sk
          ? "Verejná registrácia je vypnutá. Prihlásiť sa môžu iba vopred vytvorené účty."
          : "Veřejná registrace je vypnutá. Přihlásit se mohou pouze předem vytvořené účty."}
      </p>
    </form>
  );
}

export function AccountLinkForm({ locale }: AuthFormProps) {
  const sk = locale === "sk";
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await postJson("/api/auth/link", { code });
      setSuccess(true);
      setMessage(
        sk
          ? "Minecraft účet bol bezpečne prepojený."
          : "Minecraft účet byl bezpečně propojen.",
      );
    } catch (cause) {
      setSuccess(false);
      setMessage(
        cause instanceof Error
          ? cause.message
          : sk
            ? "Účet sa nepodarilo prepojiť."
            : "Účet se nepodařilo propojit.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth-form" onSubmit={submit}>
      <ol className="link-steps">
        <li>{sk ? "Prihlás sa do svojho vopred vytvoreného účtu." : "Přihlas se do svého předem vytvořeného účtu."}</li>
        <li><code>/web link</code> {sk ? "zadaj v hre." : "zadej ve hře."}</li>
        <li>{sk ? "Jednorazový kód zadaj sem; heslo z Minecraftu nikdy nepýtame." : "Jednorázový kód zadej sem; heslo z Minecraftu nikdy nežádáme."}</li>
      </ol>
      <label className="field">
        <span>{sk ? "Kód z hry" : "Kód ze hry"}</span>
        <input
          autoComplete="off"
          required
          maxLength={24}
          minLength={6}
          pattern="[A-Za-z0-9-]{6,24}"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          disabled={busy || success}
        />
      </label>
      <button className="button button-primary" disabled={busy || success} type="submit">
        {busy
          ? sk
            ? "Overujem…"
            : "Ověřuji…"
          : sk
            ? "Overiť a prepojiť"
            : "Ověřit a propojit"}
      </button>
      {message && (
        <p className={success ? "form-message" : "form-message form-message-error"} role={success ? "status" : "alert"}>
          {message}
        </p>
      )}
    </form>
  );
}