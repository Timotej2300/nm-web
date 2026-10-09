"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Locale } from "@/lib/i18n";

type Ticket = {
  id: string;
  category: string;
  subject: string;
  status: "open" | "waiting" | "in_progress" | "resolved" | "closed";
  created_at: string;
  updated_at: string;
  closed_at: string | null;
};
type TicketMessage = {
  id: string;
  ticket_id: string;
  body: string;
  created_at: string;
};
type TicketThread = { ticket: Ticket; messages: TicketMessage[] };

async function requestJson(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
        ? data.error
        : `Request failed (${response.status})`;
    throw Object.assign(new Error(error), { status: response.status });
  }
  return data;
}

const statusLabels: Record<Ticket["status"], [string, string]> = {
  open: ["Otvorený", "Otevřený"],
  waiting: ["Čaká na odpoveď", "Čeká na odpověď"],
  in_progress: ["V riešení", "V řešení"],
  resolved: ["Vyriešený", "Vyřešený"],
  closed: ["Zatvorený", "Uzavřený"],
};

export function TicketCenter({ locale }: { locale: Locale }) {
  const sk = locale === "sk";
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedOut, setSignedOut] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [category, setCategory] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [thread, setThread] = useState<TicketThread | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [replyBusy, setReplyBusy] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const data = (await requestJson("/api/tickets")) as {
        tickets: Ticket[];
      };
      setTickets(data.tickets);
      setSignedOut(false);
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 401) setSignedOut(true);
      else setLoadError(error instanceof Error ? error.message : "Unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    requestJson("/api/tickets")
      .then((data: unknown) => {
        if (!active) return;
        setTickets((data as { tickets: Ticket[] }).tickets);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const status = (error as { status?: number }).status;
        if (status === 401) setSignedOut(true);
        else setLoadError(error instanceof Error ? error.message : "Unavailable");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function openTicket(id: string) {
    if (selected === id) {
      setSelected(null);
      setThread(null);
      return;
    }
    setSelected(id);
    setThread(null);
    setThreadLoading(true);
    try {
      const result = (await requestJson(`/api/tickets/${id}`)) as TicketThread;
      setThread(result);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unavailable");
    } finally {
      setThreadLoading(false);
    }
  }

  async function createTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormMessage("");
    try {
      await requestJson("/api/tickets", {
        method: "POST",
        body: JSON.stringify({ category, subject, message }),
      });
      setSubject("");
      setMessage("");
      setFormMessage(sk ? "Ticket bol vytvorený." : "Ticket byl vytvořen.");
      await loadTickets();
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : (sk ? "Odoslanie zlyhalo." : "Odeslání selhalo."));
    } finally {
      setSubmitting(false);
    }
  }

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    setReplyBusy(true);
    setFormMessage("");
    try {
      await requestJson(`/api/tickets/${selected}`, {
        method: "POST",
        body: JSON.stringify({ message: reply }),
      });
      setReply("");
      const result = (await requestJson(`/api/tickets/${selected}`)) as TicketThread;
      setThread(result);
      await loadTickets();
      setFormMessage(sk ? "Odpoveď bola odoslaná." : "Odpověď byla odeslána.");
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : (sk ? "Odoslanie zlyhalo." : "Odeslání selhalo."));
    } finally {
      setReplyBusy(false);
    }
  }

  if (signedOut)
    return (
      <section className="empty-state" role="status">
        <h2>{sk ? "Na tickety sa prihlás." : "Pro tickety se přihlas."}</h2>
        <p>{sk ? "Každý hráč vidí iba svoje požiadavky." : "Každý hráč vidí pouze své požadavky."}</p>
        <Link className="button button-primary" href={`/${locale}/login`}>
          {sk ? "Prihlásiť sa" : "Přihlásit se"}
        </Link>
      </section>
    );

  return (
    <div className="ticket-center">
      <section className="ticket-create">
        <div className="section-kicker"><span>01</span><span>{sk ? "NOVÁ POŽIADAVKA" : "NOVÝ POŽADAVEK"}</span></div>
        <h2>{sk ? "Ako ti môžeme pomôcť?" : "Jak ti můžeme pomoci?"}</h2>
        <form className="auth-form" onSubmit={createTicket}>
          <label className="field">
            <span>{sk ? "Kategória" : "Kategorie"}</span>
            <select required value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">{sk ? "Vyber kategóriu" : "Vyber kategorii"}</option>
              <option value={sk ? "Technický problém" : "Technický problém"}>{sk ? "Technický problém" : "Technický problém"}</option>
              <option value={sk ? "Účet a prepojenie" : "Účet a propojení"}>{sk ? "Účet a prepojenie" : "Účet a propojení"}</option>
              <option value={sk ? "Nahlásenie hráča" : "Nahlášení hráče"}>{sk ? "Nahlásenie hráča" : "Nahlášení hráče"}</option>
              <option value={sk ? "Iné" : "Jiné"}>{sk ? "Iné" : "Jiné"}</option>
            </select>
          </label>
          <label className="field">
            <span>{sk ? "Predmet" : "Předmět"}</span>
            <input required minLength={4} maxLength={180} value={subject} onChange={(event) => setSubject(event.target.value)} />
          </label>
          <label className="field">
            <span>{sk ? "Správa" : "Zpráva"}</span>
            <textarea required minLength={1} maxLength={12_000} rows={5} value={message} onChange={(event) => setMessage(event.target.value)} />
          </label>
          <button className="button button-primary" type="submit" disabled={submitting}>
            {submitting ? (sk ? "Odosielam…" : "Odesílám…") : (sk ? "Vytvoriť ticket" : "Vytvořit ticket")}
          </button>
          {formMessage && <p className="form-message" role="status">{formMessage}</p>}
        </form>
      </section>
      <section className="ticket-list">
        <div className="section-kicker"><span>02</span><span>{sk ? "TVOJE POŽIADAVKY" : "TVÉ POŽADAVKY"}</span></div>
        <h2>{sk ? "Moje tickety" : "Moje tickety"}</h2>
        {loading ? (
          <p className="ticket-state" role="status">{sk ? "Načítavam tvoje tickety…" : "Načítám tvé tickety…"}</p>
        ) : loadError ? (
          <p className="ticket-state" role="alert">{loadError}</p>
        ) : tickets.length === 0 ? (
          <p className="ticket-state">{sk ? "Zatiaľ nemáš žiadne tickety." : "Zatím nemáš žádné tickety."}</p>
        ) : (
          <ul className="ticket-items">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <button className="ticket-item" type="button" onClick={() => void openTicket(ticket.id)} aria-expanded={selected === ticket.id}>
                  <span><strong>{ticket.subject}</strong><small>{ticket.category} · {new Date(ticket.updated_at).toLocaleDateString(sk ? "sk-SK" : "cs-CZ")}</small></span>
                  <span className={`ticket-status ticket-status-${ticket.status}`}>{statusLabels[ticket.status][sk ? 0 : 1]}</span>
                </button>
                {selected === ticket.id && (
                  <div className="ticket-thread">
                    {threadLoading ? <p role="status">{sk ? "Načítavam konverzáciu…" : "Načítám konverzaci…"}</p> : null}
                    {thread?.messages.map((item) => (
                      <article className="ticket-message" key={item.id}>
                        <p>{item.body}</p>
                        <time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString(sk ? "sk-SK" : "cs-CZ")}</time>
                      </article>
                    ))}
                    {thread && !["resolved", "closed"].includes(thread.ticket.status) && (
                      <form className="auth-form" onSubmit={sendReply}>
                        <label className="field">
                          <span>{sk ? "Tvoja odpoveď" : "Tvoje odpověď"}</span>
                          <textarea required maxLength={12_000} rows={3} value={reply} onChange={(event) => setReply(event.target.value)} />
                        </label>
                        <button className="button button-secondary" type="submit" disabled={replyBusy}>{replyBusy ? (sk ? "Odosielam…" : "Odesílám…") : (sk ? "Odoslať odpoveď" : "Odeslat odpověď")}</button>
                      </form>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}