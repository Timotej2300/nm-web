"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

type AuditEvent = {
  id: number;
  actor_user_id: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  result: "success" | "denied" | "failed";
  metadata: Record<string, unknown>;
  created_at: string;
};

export function AdminAuditLog({ locale }: { locale: Locale }) {
  const sk = locale === "sk";
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/audit", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            typeof data === "object" && data !== null && "error" in data &&
            typeof data.error === "string" ? data.error : "Audit is unavailable";
          throw new Error(message);
        }
        return data as { events: AuditEvent[] };
      })
      .then((data) => {
        if (active) setEvents(data.events);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Unavailable");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const visible = filter === "all" ? events : events.filter((event) => event.result === filter);
  const labels = sk
    ? { title: "Auditný záznam", subtitle: "Citlivé operácie a ich výsledky · posledných 100 udalostí", filter: "Výsledok", all: "Všetky", success: "Úspešné", denied: "Zamietnuté", failed: "Zlyhané", time: "Čas", actor: "Aktér", action: "Akcia", target: "Cieľ", result: "Výsledok", empty: "Pre tento filter nie sú žiadne záznamy." }
    : { title: "Auditní záznam", subtitle: "Citlivé operace a jejich výsledky · posledních 100 událostí", filter: "Výsledek", all: "Všechny", success: "Úspěšné", denied: "Zamítnuté", failed: "Neúspěšné", time: "Čas", actor: "Aktér", action: "Akce", target: "Cíl", result: "Výsledek", empty: "Pro tento filtr nejsou žádné záznamy." };

  return (
    <section className="admin-audit">
      <header className="admin-audit-heading">
        <div>
          <p className="section-kicker"><span>STAFF</span><span> / ninjamelonweb.audit</span></p>
          <h1>{labels.title}</h1>
          <p>{labels.subtitle}</p>
        </div>
        <label className="field">
          <span>{labels.filter}</span>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">{labels.all}</option>
            <option value="success">{labels.success}</option>
            <option value="denied">{labels.denied}</option>
            <option value="failed">{labels.failed}</option>
          </select>
        </label>
      </header>
      {error ? <p className="admin-ticket-error" role="alert">{error}</p> :
        loading ? <p className="admin-audit-state" role="status">{sk ? "Načítavam auditné udalosti…" : "Načítám auditní události…"}</p> :
          visible.length === 0 ? <p className="admin-audit-state">{labels.empty}</p> :
            <div className="admin-audit-table-wrap">
              <table className="admin-audit-table">
                <thead><tr><th>{labels.time}</th><th>{labels.actor}</th><th>{labels.action}</th><th>{labels.target}</th><th>{labels.result}</th></tr></thead>
                <tbody>
                  {visible.map((event) => (
                    <tr key={event.id}>
                      <td><time dateTime={event.created_at}>{new Date(event.created_at).toLocaleString(sk ? "sk-SK" : "cs-CZ")}</time></td>
                      <td><code>{event.actor_user_id?.slice(0, 8) ?? "—"}</code></td>
                      <td><strong>{event.action}</strong><small>{JSON.stringify(event.metadata)}</small></td>
                      <td>{event.target_type}{event.target_id ? <code> · {event.target_id.slice(0, 12)}</code> : ""}</td>
                      <td><span className={`admin-audit-result is-${event.result}`}>{event.result === "success" ? labels.success : event.result === "denied" ? labels.denied : labels.failed}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
    </section>
  );
}