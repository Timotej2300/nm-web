"use client";

import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

type Health = {
  checkedAt: string;
  velocity: "healthy" | "unavailable";
  paper: "healthy" | "unavailable";
  luckperms: "healthy" | "unavailable";
  paperLastHeartbeatAt: string | null;
  paperVersion: string | null;
};

export function AdminDashboard({ locale }: { locale: Locale }) {
  const sk = locale === "sk";
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/admin/health", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        const data: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            typeof data === "object" &&
            data !== null &&
            "error" in data &&
            typeof data.error === "string"
              ? data.error
              : "Health check unavailable";
          throw new Error(message);
        }
        return data as Health;
      })
      .then((data) => {
        if (active) setHealth(data);
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "Unavailable");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const services = [
    ["velocity", "Velocity"],
    ["paper", "Paper"],
    ["luckperms", "LuckPerms"],
  ] as const;
  const statusName = (value: "healthy" | "unavailable" | undefined) =>
    value === "healthy"
      ? sk
        ? "Dostupné"
        : "Dostupné"
      : sk
        ? "Nedostupné"
        : "Nedostupné";

  return (
    <section className="admin-health">
      <header className="admin-health-heading">
        <div>
          <p className="section-kicker"><span>LIVE CHECK</span></p>
          <h2>{sk ? "Stav integrácií" : "Stav integrací"}</h2>
        </div>
        {health?.checkedAt && (
          <time dateTime={health.checkedAt}>
            {sk ? "Overené" : "Ověřeno"}{" "}
            {new Date(health.checkedAt).toLocaleTimeString(
              sk ? "sk-SK" : "cs-CZ",
            )}
          </time>
        )}
      </header>
      {loading ? (
        <div className="admin-health-state" role="status">
          {sk ? "Overujem aktuálne spojenia…" : "Ověřuji aktuální spojení…"}
        </div>
      ) : error ? (
        <div className="admin-health-state admin-health-error" role="alert">
          {sk
            ? "Stavy nie je možné overiť. Privilegované operácie zostávajú zablokované."
            : "Stavy nelze ověřit. Privilegované operace zůstávají zablokované."}
        </div>
      ) : (
        <>
          <div className="admin-health-grid">
            {services.map(([key, label]) => {
              const value = health?.[key];
              return (
                <article className="admin-health-card" key={key}>
                  <span
                    className={`health-indicator ${value === "healthy" ? "health-indicator-good" : ""}`}
                    aria-hidden="true"
                  />
                  <span>{label}</span>
                  <strong>{statusName(value)}</strong>
                  {key === "paper" && health?.paperLastHeartbeatAt && (
                    <small>
                      {health.paperVersion ? `${health.paperVersion} · ` : ""}
                      {new Date(
                        health.paperLastHeartbeatAt,
                      ).toLocaleTimeString(sk ? "sk-SK" : "cs-CZ")}
                    </small>
                  )}
                </article>
              );
            })}
          </div>
          {!health?.paperLastHeartbeatAt && (
            <p className="admin-health-note">
              {sk
                ? "Paper zatiaľ neposlal overený heartbeat."
                : "Paper zatím neposlal ověřený heartbeat."}
            </p>
          )}
        </>
      )}
    </section>
  );
}