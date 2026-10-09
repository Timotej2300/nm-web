"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

type Status = "new" | "reviewing" | "interview" | "accepted" | "rejected";
type Application = {
  id: string;
  form_id: string;
  applicant_email: string;
  answers: Record<string, unknown>;
  status: Status;
  internal_notes: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
};
type Form = { id: string; title_sk: string; title_cs: string };
type Data = { applications: Application[]; forms: Form[] };

const statusLabels: Record<Status, [string, string]> = {
  new: ["Nová", "Nová"],
  reviewing: ["Kontroluje sa", "Kontroluje se"],
  interview: ["Pohovor", "Pohovor"],
  accepted: ["Prijatá", "Přijata"],
  rejected: ["Zamietnutá", "Zamítnuta"],
};

export function AdminRecruitmentReview({ locale }: { locale: Locale }) {
  const sk = locale === "sk";
  const [data, setData] = useState<Data>({ applications: [], forms: [] });
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState<Status>("new");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/recruitment", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const body: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const error = typeof body === "object" && body !== null && "error" in body &&
            typeof body.error === "string" ? body.error : "Applications are unavailable";
          throw new Error(error);
        }
        return body as Data;
      })
      .then((result) => { if (active) setData(result); })
      .catch((error: unknown) => {
        if (active) setMessage(error instanceof Error ? error.message : "Unavailable");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const selected = data.applications.find((item) => item.id === selectedId) ?? null;

  function select(application: Application) {
    setSelectedId(application.id);
    setStatus(application.status);
    setNotes(application.internal_notes ?? "");
    setMessage("");
  }

  async function save() {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/recruitment", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId: selected.id,
          status,
          internalNotes: notes || null,
        }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error = typeof result === "object" && result !== null && "error" in result &&
          typeof result.error === "string" ? result.error : "Could not save review";
        throw new Error(error);
      }
      setData((current) => ({
        ...current,
        applications: current.applications.map((item) =>
          item.id === selected.id ? { ...item, status, internal_notes: notes || null } : item,
        ),
      }));
      setMessage(sk ? "Posúdenie bolo uložené." : "Posouzení bylo uloženo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const formLabel = (id: string) => {
    const form = data.forms.find((item) => item.id === id);
    return form ? (sk ? form.title_sk : form.title_cs) : id.slice(0, 8);
  };

  return (
    <section className="admin-recruitment">
      <header className="admin-recruitment-heading">
        <div>
          <p className="section-kicker"><span>STAFF</span><span> / ninjamelonweb.recruitment</span></p>
          <h1>{sk ? "Posúdenie náboru" : "Posouzení náboru"}</h1>
          <p>{sk ? "Osobné údaje sú dostupné iba oprávnenému tímu." : "Osobní údaje jsou dostupné pouze oprávněnému týmu."}</p>
        </div>
      </header>
      {message && <p className="admin-ticket-error" role="status">{message}</p>}
      {loading ? <p className="admin-audit-state" role="status">{sk ? "Načítavam prihlášky…" : "Načítám přihlášky…"}</p> :
        data.applications.length === 0 ? <p className="admin-audit-state">{sk ? "Zatiaľ nie sú žiadne prihlášky alebo služba nie je nakonfigurovaná." : "Zatím nejsou žádné přihlášky nebo služba není nakonfigurována."}</p> :
          <div className="admin-recruitment-grid">
            <nav className="admin-recruitment-list" aria-label={sk ? "Prihlášky" : "Přihlášky"}>
              {data.applications.map((application) => (
                <button className={`admin-recruitment-row${application.id === selectedId ? " is-selected" : ""}`} key={application.id} type="button" onClick={() => select(application)} aria-pressed={application.id === selectedId}>
                  <strong>{application.applicant_email}</strong>
                  <span>{formLabel(application.form_id)}</span>
                  <span className={`ticket-status ticket-status-${application.status}`}>{statusLabels[application.status][sk ? 0 : 1]}</span>
                  <time dateTime={application.created_at}>{new Date(application.created_at).toLocaleDateString(sk ? "sk-SK" : "cs-CZ")}</time>
                </button>
              ))}
            </nav>
            <section className="admin-recruitment-detail">
              {!selected ? <p>{sk ? "Vyber prihlášku na kontrolu." : "Vyber přihlášku ke kontrole."}</p> :
                <>
                  <p className="section-kicker">{formLabel(selected.form_id)}</p>
                  <h2>{selected.applicant_email}</h2>
                  <div className="admin-application-answers">
                    {Object.entries(selected.answers).map(([key, value]) => (
                      <article key={key}><h3>{key}</h3><p>{typeof value === "string" ? value : JSON.stringify(value)}</p></article>
                    ))}
                  </div>
                  <div className="admin-recruitment-form">
                    <label className="field"><span>{sk ? "Stav" : "Stav"}</span>
                      <select value={status} onChange={(event) => setStatus(event.target.value as Status)}>
                        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label[sk ? 0 : 1]}</option>)}
                      </select>
                    </label>
                    <label className="field"><span>{sk ? "Interné poznámky" : "Interní poznámky"}</span>
                      <textarea rows={5} maxLength={12_000} value={notes} onChange={(event) => setNotes(event.target.value)} />
                    </label>
                    <p className="admin-private-note">{sk ? "Tieto poznámky a odpovede nie sú verejné." : "Tyto poznámky a odpovědi nejsou veřejné."}</p>
                    <button className="button button-primary" type="button" disabled={saving} onClick={() => void save()}>{saving ? (sk ? "Ukladám…" : "Ukládám…") : (sk ? "Uložiť posúdenie" : "Uložit posouzení")}</button>
                  </div>
                </>}
            </section>
          </div>}
    </section>
  );
}