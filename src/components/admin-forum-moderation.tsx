"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

type Report = {
  id: string;
  reporter_user_id: string;
  target_type: "forum_topic" | "forum_post" | "profile";
  target_id: string;
  reason: string;
  status: "new" | "reviewing" | "resolved" | "dismissed";
  created_at: string;
};
type ReportDetail = { report: Report; target: Record<string, unknown> | null };

async function request(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof body === "object" && body !== null && "error" in body &&
      typeof body.error === "string" ? body.error : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body;
}

export function AdminForumModeration({ locale }: { locale: Locale }) {
  const sk = locale === "sk";
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState<ReportDetail | null>(null);
  const [status, setStatus] = useState<Report["status"]>("new");
  const [action, setAction] = useState("none");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request("/api/admin/forum") as { reports: Report[] };
      setReports(data.reports);
      setMessage("");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    request("/api/admin/forum")
      .then((data) => {
        if (active) setReports((data as { reports: Report[] }).reports);
      })
      .catch((cause: unknown) => {
        if (active) setMessage(cause instanceof Error ? cause.message : "Unavailable");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function open(report: Report) {
    setSelectedId(report.id);
    setDetail(null);
    setStatus(report.status);
    setAction("none");
    try {
      const data = await request(`/api/admin/forum?reportId=${encodeURIComponent(report.id)}`) as ReportDetail;
      setDetail(data);
      setMessage("");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unavailable");
    }
  }

  async function save() {
    if (!selectedId) return;
    setBusy(true);
    try {
      await request("/api/admin/forum", {
        method: "POST",
        body: JSON.stringify({ reportId: selectedId, status, action }),
      });
      await load();
      const report = reports.find((item) => item.id === selectedId);
      if (report) await open({ ...report, status });
      setMessage(sk ? "Moderátorské rozhodnutie bolo uložené." : "Moderátorské rozhodnutí bylo uloženo.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Moderation failed");
    } finally {
      setBusy(false);
    }
  }

  const target = detail?.target;
  const targetText =
    typeof target?.title === "string" ? target.title :
      typeof target?.body_markdown === "string" ? target.body_markdown :
        typeof target?.minecraft_username === "string" ? target.minecraft_username :
          (sk ? "Cieľový obsah už nie je dostupný." : "Cílový obsah už není dostupný.");
  const labels = sk
    ? { title: "Moderovanie fóra", subtitle: "Nahlásenia a rozhodnutia · posledných 100 záznamov", empty: "Žiadne nahlásenia.", all: "Nahlásenia", reason: "Dôvod nahlásenia", reporter: "Nahlásil", content: "Nahlásený obsah", status: "Stav nahlásenia", action: "Akcia nad obsahom", save: "Uložiť rozhodnutie", refresh: "Obnoviť", loading: "Načítavam…" }
    : { title: "Moderování fóra", subtitle: "Nahlášení a rozhodnutí · posledních 100 záznamů", empty: "Žádná nahlášení.", all: "Nahlášení", reason: "Důvod nahlášení", reporter: "Nahlásil", content: "Nahlášený obsah", status: "Stav nahlášení", action: "Akce nad obsahem", save: "Uložit rozhodnutí", refresh: "Obnovit", loading: "Načítám…" };

  return (
    <section className="admin-forum-moderation">
      <header className="admin-ticket-heading">
        <div>
          <p className="section-kicker"><span>STAFF</span><span> / ninjamelonweb.forum</span></p>
          <h1>{labels.title}</h1><p>{labels.subtitle}</p>
        </div>
        <button className="button button-secondary" type="button" disabled={loading} onClick={() => void load()}>
          {loading ? labels.loading : labels.refresh}
        </button>
      </header>
      {message && <p className="admin-ticket-error" role="status">{message}</p>}
      <div className="admin-forum-grid">
        <nav className="admin-forum-reports" aria-label={labels.all}>
          {loading && reports.length === 0 ? <p role="status">{labels.loading}</p> :
            reports.length === 0 ? <p>{labels.empty}</p> :
              reports.map((report) => (
                <button className={`admin-forum-report${report.id === selectedId ? " is-selected" : ""}`} type="button" key={report.id} onClick={() => void open(report)} aria-pressed={report.id === selectedId}>
                  <strong>{report.target_type.replace("_", " ")}</strong>
                  <span>{report.reason}</span>
                  <small>{report.status} · {new Date(report.created_at).toLocaleDateString(sk ? "sk-SK" : "cs-CZ")}</small>
                </button>
              ))}
        </nav>
        <section className="admin-forum-detail">
          {!selectedId ? <p>{sk ? "Vyber nahlásenie na kontrolu." : "Vyber nahlášení ke kontrole."}</p> :
            !detail ? <p role="status">{labels.loading}</p> :
              <>
                <p className="section-kicker">{labels.reporter}: {detail.report.reporter_user_id.slice(0, 8)} · #{detail.report.id.slice(0, 8)}</p>
                <h2>{labels.reason}</h2><p className="admin-forum-reason">{detail.report.reason}</p>
                <h3>{labels.content}</h3><pre className="admin-forum-target">{targetText}</pre>
                <div className="admin-forum-controls">
                  <label className="field"><span>{labels.status}</span>
                    <select value={status} onChange={(event) => setStatus(event.target.value as Report["status"])}>
                      <option value="new">{sk ? "Nové" : "Nové"}</option>
                      <option value="reviewing">{sk ? "Kontroluje sa" : "Kontroluje se"}</option>
                      <option value="resolved">{sk ? "Vyriešené" : "Vyřešeno"}</option>
                      <option value="dismissed">{sk ? "Zamietnuté" : "Zamítnuto"}</option>
                    </select>
                  </label>
                  <label className="field"><span>{labels.action}</span>
                    <select value={action} onChange={(event) => setAction(event.target.value)}>
                      <option value="none">{sk ? "Bez zmeny obsahu" : "Bez změny obsahu"}</option>
                      {detail.report.target_type !== "profile" && <>
                        <option value="hide">{sk ? "Skryť obsah" : "Skrýt obsah"}</option>
                        <option value="restore">{sk ? "Obnoviť skrytý obsah" : "Obnovit skrytý obsah"}</option>
                      </>}
                      {detail.report.target_type === "forum_topic" && <>
                        <option value="lock">{sk ? "Uzamknúť tému" : "Uzamknout téma"}</option>
                        <option value="unlock">{sk ? "Odomknúť tému" : "Odemknout téma"}</option>
                      </>}
                    </select>
                  </label>
                  <button className="button button-primary" type="button" disabled={busy} onClick={() => void save()}>
                    {busy ? labels.loading : labels.save}
                  </button>
                </div>
              </>}
        </section>
      </div>
    </section>
  );
}