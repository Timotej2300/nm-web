"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

type Status = "open" | "waiting" | "in_progress" | "resolved" | "closed";
type Ticket = {
  id: string;
  owner_user_id: string;
  assigned_to: string | null;
  category: string;
  subject: string;
  status: Status;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};
type Message = {
  id: string;
  author_user_id: string | null;
  body: string;
  is_internal: boolean;
  created_at: string;
};
type Thread = { ticket: Ticket; messages: Message[] };

const statuses: Record<Status, [string, string]> = {
  open: ["Otvorený", "Otevřený"],
  waiting: ["Čaká na odpoveď", "Čeká na odpověď"],
  in_progress: ["V riešení", "V řešení"],
  resolved: ["Vyriešený", "Vyřešený"],
  closed: ["Zatvorený", "Uzavřený"],
};

async function api(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "error" in data &&
      typeof data.error === "string" ? data.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return data;
}

export function AdminTicketQueue({ locale }: { locale: Locale }) {
  const sk = locale === "sk";
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [thread, setThread] = useState<Thread | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api("/api/admin/tickets") as { tickets: Ticket[] };
      setTickets(result.tickets);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    api("/api/admin/tickets")
      .then((data) => {
        const result = data as { tickets: Ticket[] };
        if (active) setTickets(result.tickets);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unavailable");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function open(ticketId: string) {
    setSelectedId(ticketId);
    setThread(null);
    setError("");
    try {
      setThread(await api(`/api/admin/tickets?ticketId=${encodeURIComponent(ticketId)}`) as Thread);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unavailable");
    }
  }

  async function act(payload: Record<string, string>) {
    if (!selectedId) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/tickets", {
        method: "POST",
        body: JSON.stringify({ ...payload, ticketId: selectedId }),
      });
      await reload();
      await open(selectedId);
      setBody("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-ticket-queue">
      <header className="admin-ticket-heading">
        <div>
          <p className="section-kicker"><span>STAFF</span><span> / ninjamelonweb.tickets</span></p>
          <h1>{sk ? "Front podpory" : "Front podpory"}</h1>
          <p>{sk ? "Súkromná fronta. Interné poznámky sa hráčom nezobrazujú." : "Soukromá fronta. Interní poznámky se hráčům nezobrazují."}</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => void reload()} disabled={loading}>
          {loading ? (sk ? "Načítavam…" : "Načítám…") : (sk ? "Obnoviť" : "Obnovit")}
        </button>
      </header>
      {error && <p className="admin-ticket-error" role="alert">{error}</p>}
      <div className="admin-ticket-grid">
        <section className="admin-ticket-list" aria-label={sk ? "Zoznam ticketov" : "Seznam ticketů"}>
          {loading && tickets.length === 0 ? <p role="status">{sk ? "Načítavam tickety…" : "Načítám tickety…"}</p> :
            tickets.length === 0 ? <p>{sk ? "Fronta je prázdna alebo služba nie je nakonfigurovaná." : "Fronta je prázdná nebo služba není nakonfigurována."}</p> :
              tickets.map((ticket) => (
                <button
                  className={`admin-ticket-row${ticket.id === selectedId ? " is-selected" : ""}`}
                  type="button" key={ticket.id} onClick={() => void open(ticket.id)}
                  aria-pressed={ticket.id === selectedId}
                >
                  <span><strong>{ticket.subject}</strong><small>{ticket.category} · #{ticket.id.slice(0, 8)}</small></span>
                  <span className={`ticket-status ticket-status-${ticket.status}`}>{statuses[ticket.status][sk ? 0 : 1]}</span>
                </button>
              ))}
        </section>
        <section className="admin-ticket-detail" aria-live="polite">
          {!selectedId ? <p>{sk ? "Vyber ticket z fronty." : "Vyber ticket z fronty."} </p> :
            !thread ? <p role="status">{sk ? "Načítavam konverzáciu…" : "Načítám konverzaci…"}</p> :
              <>
                <div className="admin-ticket-meta">
                  <div><p className="section-kicker">{thread.ticket.category} · #{thread.ticket.id.slice(0, 8)}</p><h2>{thread.ticket.subject}</h2></div>
                  <span className={`ticket-status ticket-status-${thread.ticket.status}`}>{statuses[thread.ticket.status][sk ? 0 : 1]}</span>
                </div>
                <p className="admin-ticket-owner">{sk ? "Hráč" : "Hráč"}: {thread.ticket.owner_user_id.slice(0, 8)} · {sk ? "Pridelené" : "Přiřazeno"}: {thread.ticket.assigned_to?.slice(0, 8) ?? (sk ? "nikomu" : "nikomu")}</p>
                <div className="admin-ticket-messages">
                  {thread.messages.map((message) => (
                    <article className={`ticket-message${message.is_internal ? " is-internal" : ""}`} key={message.id}>
                      <div className="admin-message-heading"><strong>{message.is_internal ? (sk ? "Interná poznámka" : "Interní poznámka") : message.author_user_id === thread.ticket.owner_user_id ? (sk ? "Hráč" : "Hráč") : (sk ? "Tím" : "Tým")}</strong><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString(sk ? "sk-SK" : "cs-CZ")}</time></div>
                      <p>{message.body}</p>
                    </article>
                  ))}
                </div>
                <div className="admin-ticket-controls">
                  <label className="field"><span>{sk ? "Stav ticketu" : "Stav ticketu"}</span>
                    <select value={thread.ticket.status} disabled={busy} onChange={(event) => void act({ operation: "status", status: event.target.value })}>
                      {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label[sk ? 0 : 1]}</option>)}
                    </select>
                  </label>
                  <div className="admin-ticket-assignment">
                    <button className="button button-secondary" type="button" disabled={busy || thread.ticket.assigned_to === undefined} onClick={() => void act({ operation: "assign", assignee: "self" })}>{sk ? "Priradiť mne" : "Přiřadit mně"}</button>
                    <button className="button button-ghost" type="button" disabled={busy || !thread.ticket.assigned_to} onClick={() => void act({ operation: "assign", assignee: "none" })}>{sk ? "Zrušiť priradenie" : "Zrušit přiřazení"}</button>
                  </div>
                  <form className="auth-form" onSubmit={(event) => { event.preventDefault(); void act({ operation: internal ? "internal_note" : "reply", body }); }}>
                    <label className="field"><span>{internal ? (sk ? "Interná poznámka" : "Interní poznámka") : (sk ? "Odpoveď hráčovi" : "Odpověď hráči")}</span>
                      <textarea required maxLength={12_000} rows={4} value={body} onChange={(event) => setBody(event.target.value)} />
                    </label>
                    <label className="admin-ticket-toggle"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} /><span>{sk ? "Viditeľné iba tímu" : "Viditelné pouze týmu"}</span></label>
                    <button className="button button-primary" type="submit" disabled={busy || !body.trim()}>{busy ? (sk ? "Ukladám…" : "Ukládám…") : internal ? (sk ? "Pridať poznámku" : "Přidat poznámku") : (sk ? "Odoslať odpoveď" : "Odeslat odpověď")}</button>
                  </form>
                </div>
              </>}
        </section>
      </div>
    </section>
  );
}