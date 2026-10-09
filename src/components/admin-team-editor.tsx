"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

type Player = {
  user_id: string;
  minecraft_username: string | null;
  display_name: string | null;
  is_public: boolean;
};
type Member = {
  user_id: string;
  role_sk: string;
  role_cs: string;
  bio_sk: string | null;
  bio_cs: string | null;
  display_order: number;
  is_listed: boolean;
  rank_key: string | null;
  profile: Player | null;
};
type Editor = {
  userId: string;
  roleSk: string;
  roleCs: string;
  bioSk: string;
  bioCs: string;
  displayOrder: number;
  isListed: boolean;
  isPublic: boolean;
};

const blank = (): Editor => ({
  userId: "",
  roleSk: "",
  roleCs: "",
  bioSk: "",
  bioCs: "",
  displayOrder: 0,
  isListed: false,
  isPublic: false,
});

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

export function AdminTeamEditor({ locale }: { locale: Locale }) {
  const sk = locale === "sk";
  const [members, setMembers] = useState<Member[]>([]);
  const [editor, setEditor] = useState<Editor>(blank);
  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await request("/api/admin/team") as { members: Member[] };
      setMembers(data.members);
      setMessage("");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Unavailable");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    request("/api/admin/team")
      .then((data) => { if (active) setMembers((data as { members: Member[] }).members); })
      .catch((cause: unknown) => { if (active) setMessage(cause instanceof Error ? cause.message : "Unavailable"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (search.trim().length < 3) return;
    let active = true;
    const timer = window.setTimeout(() => {
      request(`/api/admin/team?q=${encodeURIComponent(search.trim())}`)
        .then((data) => { if (active) setPlayers((data as { players: Player[] }).players); })
        .catch((cause: unknown) => { if (active) setMessage(cause instanceof Error ? cause.message : "Unavailable"); });
    }, 240);
    return () => { active = false; window.clearTimeout(timer); };
  }, [search]);

  function chooseMember(member: Member) {
    setEditor({
      userId: member.user_id,
      roleSk: member.role_sk,
      roleCs: member.role_cs,
      bioSk: member.bio_sk ?? "",
      bioCs: member.bio_cs ?? "",
      displayOrder: member.display_order,
      isListed: member.is_listed,
      isPublic: member.profile?.is_public ?? false,
    });
    setMessage("");
  }

  function choosePlayer(player: Player) {
    setEditor({
      ...blank(),
      userId: player.user_id,
      displayOrder: members.length * 10,
      isPublic: player.is_public,
      isListed: false,
    });
    setSearch(player.minecraft_username ?? "");
    setPlayers([]);
    setMessage("");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      await request("/api/admin/team", {
        method: "POST",
        body: JSON.stringify({
          ...editor,
          bioSk: editor.bioSk || null,
          bioCs: editor.bioCs || null,
        }),
      });
      await reload();
      setMessage(sk ? "Člen tímu bol uložený." : "Člen týmu byl uložen.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="admin-team-editor">
      <header className="admin-ticket-heading">
        <div>
          <p className="section-kicker"><span>STAFF</span><span> / ninjamelonweb.team</span></p>
          <h1>{sk ? "Verejný tím" : "Veřejný tým"}</h1>
          <p>{sk ? "Zaradenie na webe nemení Minecraft rank ani LuckPerms oprávnenia." : "Zařazení na webu nemění Minecraft rank ani oprávnění LuckPerms."}</p>
        </div>
        <button className="button button-secondary" type="button" disabled={loading} onClick={() => void reload()}>{sk ? "Obnoviť" : "Obnovit"}</button>
      </header>
      {message && <p className="admin-ticket-error" role="status">{message}</p>}
      <div className="admin-team-grid">
        <section className="admin-team-list">
          <h2>{sk ? "Členovia tímu" : "Členové týmu"}</h2>
          {loading && members.length === 0 ? <p role="status">{sk ? "Načítavam…" : "Načítám…"}</p> :
            members.length === 0 ? <p>{sk ? "Zatiaľ nie sú pridaní členovia." : "Zatím nejsou přidaní členové."}</p> :
              members.map((member) => (
                <button className={`admin-team-row${member.user_id === editor.userId ? " is-selected" : ""}`} type="button" key={member.user_id} onClick={() => chooseMember(member)}>
                  <strong>{member.profile?.minecraft_username ?? member.profile?.display_name ?? member.user_id.slice(0, 8)}</strong>
                  <span>{sk ? member.role_sk : member.role_cs}</span>
                  <small>{member.is_listed ? (sk ? "Zobrazený" : "Zobrazený") : (sk ? "Skrytý" : "Skrytý")} · {member.profile?.is_public ? "public" : (sk ? "Súkromný profil" : "Soukromý profil")}</small>
                </button>
              ))}
          <div className="admin-team-search">
            <label className="field">
              <span>{sk ? "Pridať prepojeného hráča" : "Přidat propojeného hráče"}</span>
              <input value={search} maxLength={16} onChange={(event) => setSearch(event.target.value.replace(/[^a-zA-Z0-9_]/g, ""))} placeholder="Minecraft nick" />
            </label>
            {players.length > 0 && <ul>{players.map((player) => (
              <li key={player.user_id}><button type="button" onClick={() => choosePlayer(player)}>{player.minecraft_username} · {player.is_public ? (sk ? "verejný profil" : "veřejný profil") : (sk ? "súkromný profil" : "soukromý profil")}</button></li>
            ))}</ul>}
          </div>
        </section>
        <form className="admin-team-form auth-form" onSubmit={save}>
          <h2>{editor.userId ? (sk ? "Upraviť člena" : "Upravit člena") : (sk ? "Vyber hráča" : "Vyber hráče")}</h2>
          {editor.userId && <>
            <p className="admin-team-player">{(members.find((item) => item.user_id === editor.userId)?.profile?.minecraft_username ?? search) || editor.userId.slice(0, 8)}</p>
            <label className="field"><span>{sk ? "Funkcia (slovensky)" : "Funkce (slovensky)"}</span><input required maxLength={80} value={editor.roleSk} onChange={(event) => setEditor((value) => ({ ...value, roleSk: event.target.value }))} /></label>
            <label className="field"><span>{sk ? "Funkcia (česky)" : "Funkce (česky)"}</span><input required maxLength={80} value={editor.roleCs} onChange={(event) => setEditor((value) => ({ ...value, roleCs: event.target.value }))} /></label>
            <label className="field"><span>{sk ? "Bio (slovensky)" : "Bio (slovensky)"}</span><textarea maxLength={1000} rows={3} value={editor.bioSk} onChange={(event) => setEditor((value) => ({ ...value, bioSk: event.target.value }))} /></label>
            <label className="field"><span>{sk ? "Bio (česky)" : "Bio (česky)"}</span><textarea maxLength={1000} rows={3} value={editor.bioCs} onChange={(event) => setEditor((value) => ({ ...value, bioCs: event.target.value }))} /></label>
            <label className="field"><span>{sk ? "Poradie" : "Pořadí"}</span><input type="number" min={-10_000} max={10_000} value={editor.displayOrder} onChange={(event) => setEditor((value) => ({ ...value, displayOrder: Number(event.target.value) }))} /></label>
            <label className="admin-team-listed"><input type="checkbox" checked={editor.isListed} disabled={!editor.isPublic} onChange={(event) => setEditor((value) => ({ ...value, isListed: event.target.checked }))} /><span>{sk ? "Zobraziť na verejnej stránke tímu" : "Zobrazit na veřejné stránce týmu"}</span></label>
            {!editor.isPublic && <p className="admin-private-note">{sk ? "Hráč má súkromný profil. Zmena jeho súkromia patrí hráčovi, nie administrátorovi." : "Hráč má soukromý profil. Změna soukromí patří hráči, ne administrátorovi."}</p>}
            <button className="button button-primary" type="submit" disabled={saving || (editor.isListed && !editor.isPublic)}>{saving ? (sk ? "Ukladám…" : "Ukládám…") : (sk ? "Uložiť profil tímu" : "Uložit profil týmu")}</button>
          </>}
        </form>
      </div>
    </section>
  );
}