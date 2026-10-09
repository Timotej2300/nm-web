"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

type Notification = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  target_path: string | null;
  is_read: boolean;
  created_at: string;
};

function safeInternalPath(path: string | null): string | null {
  if (!path || !path.startsWith("/") || path.startsWith("//") || path.includes("\\"))
    return null;
  try {
    const target = new URL(path, "https://same-origin.invalid");
    return target.origin === "https://same-origin.invalid"
      ? target.pathname + target.search + target.hash
      : null;
  } catch {
    return null;
  }
}

export function NotificationCenter({ locale }: { locale: Locale }) {
  const sk = locale === "sk";
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/notifications", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          if (response.status === 401) {
            if (active) setSignedOut(true);
            return { notifications: [] };
          }
          const reason =
            typeof data === "object" &&
            data !== null &&
            "error" in data &&
            typeof data.error === "string"
              ? data.error
              : "Unavailable";
          throw new Error(reason);
        }
        return data as { notifications: Notification[] };
      })
      .then((data) => {
        if (active) setItems(data.notifications);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unavailable");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function markRead(id?: string) {
    setBusyId(id ?? "all");
    setMessage("");
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : { all: true }),
      });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(sk ? "Stav upozornenia sa nepodarilo zmeniť." : "Stav upozornění se nepodařilo změnit.");
      setItems((previous) =>
        previous.map((item) => (!id || item.id === id ? { ...item, is_read: true } : item)),
      );
      setMessage(sk ? "Upozornenie označené ako prečítané." : "Upozornění označeno jako přečtené.");
      void data;
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : (sk ? "Zmena zlyhala." : "Změna selhala."));
    } finally {
      setBusyId("");
    }
  }

  if (signedOut)
    return (
      <section className="empty-state" role="status">
        <h2>{sk ? "Prihlás sa pre svoje upozornenia." : "Přihlas se pro svá upozornění."}</h2>
        <Link className="button button-primary" href={`/${locale}/login`}>{sk ? "Prihlásiť sa" : "Přihlásit se"}</Link>
      </section>
    );
  if (loading)
    return <div className="ticket-state" role="status">{sk ? "Načítavam upozornenia…" : "Načítám upozornění…"}</div>;
  if (error)
    return <div className="ticket-state" role="alert">{sk ? "Upozornenia nie sú dostupné." : "Upozornění nejsou dostupná."}</div>;

  const unread = items.filter((item) => !item.is_read).length;
  return (
    <section className="notifications-panel">
      <header className="notifications-heading">
        <p>{sk ? `${unread} neprečítaných` : `${unread} nepřečtených`}</p>
        {unread > 0 && (
          <button className="button button-secondary" type="button" onClick={() => void markRead()} disabled={busyId !== ""}>
            {sk ? "Označiť všetko ako prečítané" : "Označit vše jako přečtené"}
          </button>
        )}
      </header>
      {message && <p className="form-message" role="status">{message}</p>}
      {items.length === 0 ? (
        <p className="ticket-state">{sk ? "Zatiaľ nemáš žiadne upozornenia." : "Zatím nemáš žádná upozornění."}</p>
      ) : (
        <ul className="notification-list">
          {items.map((item) => {
            const path = safeInternalPath(item.target_path);
            return (
              <li className={item.is_read ? "notification-item" : "notification-item notification-unread"} key={item.id}>
                <span className="notification-indicator" aria-hidden="true" />
                <div className="notification-copy">
                  <small>{item.kind.toUpperCase()} · {new Date(item.created_at).toLocaleString(sk ? "sk-SK" : "cs-CZ")}</small>
                  <h2>{item.title}</h2>
                  {item.body && <p>{item.body}</p>}
                  {path && <Link href={path}>{sk ? "Otvoriť súvisiaci obsah" : "Otevřít související obsah"}</Link>}
                </div>
                {!item.is_read && (
                  <button className="notification-read" type="button" onClick={() => void markRead(item.id)} disabled={busyId !== ""} aria-label={sk ? "Označiť ako prečítané" : "Označit jako přečtené"}>
                    {busyId === item.id ? "…" : "✓"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}