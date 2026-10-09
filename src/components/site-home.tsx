"use client";

import { useEffect, useState } from "react";
import type { Copy, Locale } from "@/lib/i18n";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { ModeDirectory } from "@/components/mode-directory";
import {
  isFreshNetworkStatus,
  unavailableNetworkStatus,
  type NetworkStatus,
} from "@/lib/network-status";

const IP = "mc.ninjamelon.cz";

function CharacterArt({ copy }: { copy: Copy }) {
  return (
    <div
      className="hero-art"
      role="img"
      aria-label="Originálna pixel-art herná postava a bloková krajina"
    >
      <div className="art-orbit orbit-one" />
      <div className="art-orbit orbit-two" />
      <div className="art-glow" />
      <div className="pixel-cloud cloud-one" />
      <div className="pixel-cloud cloud-two" />
      <div className="voxel voxel-grass voxel-a" aria-hidden="true">
        <i />
      </div>
      <div className="voxel voxel-stone voxel-b" aria-hidden="true">
        <i />
      </div>
      <div className="voxel voxel-grass voxel-c" aria-hidden="true">
        <i />
      </div>
      <div className="voxel voxel-stone voxel-d" aria-hidden="true">
        <i />
      </div>
      <div className="hero-character" aria-hidden="true">
        <div className="character-shadow" />
        <div className="character-head">
          <span className="hair" />
          <span className="eye eye-left" />
          <span className="eye eye-right" />
          <span className="mouth" />
        </div>
        <div className="character-body">
          <span className="hood" />
          <span className="chest-mark">N</span>
        </div>
        <div className="character-arm arm-left" />
        <div className="character-arm arm-right" />
        <div className="character-leg leg-left" />
        <div className="character-leg leg-right" />
      </div>
      <div className="art-label label-top">
        <span className="label-square" />
        {copy.worldTag}
      </div>
      <div className="art-label label-bottom">
        <span className="label-ping" />
        {copy.spawnTag}
      </div>
      <div className="art-grid" aria-hidden="true" />
    </div>
  );
}

export function SiteHome({ locale, copy }: { locale: Locale; copy: Copy }) {
  const [status, setStatus] = useState<NetworkStatus>(() =>
    unavailableNetworkStatus(),
  );
  const [toast, setToast] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 2500);
    fetch("/api/network", { cache: "no-store", signal: controller.signal })
      .then((response) =>
        response.ok
          ? (response.json() as Promise<unknown>)
          : Promise.reject(new Error("Status unavailable")),
      )
      .then((payload) =>
        setStatus(
          isFreshNetworkStatus(payload)
            ? payload
            : unavailableNetworkStatus("stale"),
        ),
      )
      .catch(() => setStatus(unavailableNetworkStatus("request_failed")))
      .finally(() => window.clearTimeout(timeout));
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!reducedMotion && "IntersectionObserver" in window) {
      const observer = new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("is-visible");
              observer.unobserve(entry.target);
            }
          }),
        { threshold: 0.12 },
      );
      document
        .querySelectorAll(".reveal")
        .forEach((element) => observer.observe(element));
      return () => {
        controller.abort();
        window.clearTimeout(timeout);
        observer.disconnect();
      };
    }
    document
      .querySelectorAll(".reveal")
      .forEach((element) => element.classList.add("is-visible"));
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(IP);
      setCopied(true);
      setToast(copy.copied);
    } catch {
      setToast(copy.copyFailed);
    }
  }

  const statusLabel =
    status.status === "online"
      ? copy.online
      : status.status === "offline"
        ? copy.offline
        : copy.unavailable;
  const countIsValid =
    status.status === "online" &&
    Number.isInteger(status.players) &&
    Number.isInteger(status.maxPlayers);

  return (
    <>
      <a className="skip-link" href="#main">
        {locale === "sk" ? "Preskočiť na obsah" : "Přeskočit na obsah"}
      </a>
      <SiteHeader locale={locale} copy={copy} />
      <main id="main">
        <section className="hero wrap" id="top" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-dot" />
              {copy.eyebrow}
            </p>
            <h1 id="hero-title">
              {copy.titleOne}
              <br />
              <span className="gradient-text">{copy.titleTwo}</span>
            </h1>
            <p className="hero-lede">{copy.intro}</p>
            <div className="hero-actions">
              <a className="button button-primary" href="#server">
                <span>{copy.explore}</span>
                <span className="arrow" aria-hidden="true">
                  ↘
                </span>
              </a>
              <a className="text-link" href="#about">
                <span>{copy.story}</span>
                <span aria-hidden="true">→</span>
              </a>
            </div>
            <div className="hero-footnote">
              <span className="pixel-spark" aria-hidden="true">
                ✳
              </span>
              {copy.playerFounded}
            </div>
          </div>
          <CharacterArt copy={copy} />
          <a className="scroll-cue" href="#server">
            <span className="scroll-line" />
            {copy.scrollDown}
          </a>
        </section>
        <section
          className="server-strip"
          id="server"
          aria-labelledby="server-title"
        >
          <div className="wrap server-inner">
            <div className="server-intro">
              <span className="section-kicker">
                <span>01</span>
                <span>{copy.serverKicker}</span>
              </span>
              <h2 id="server-title">{copy.serverTitle}</h2>
              <p>{copy.serverIntro}</p>
            </div>
            <div className="server-panel">
              <div className="server-panel-top">
                <div className="server-name">
                  <span className="server-icon" aria-hidden="true">
                    N
                  </span>
                  <div>
                    <strong>NinjaMelon Network</strong>
                    <span>Java Edition · CZ / SK</span>
                  </div>
                </div>
                <div
                  className={`status-pill status-${status.status}`}
                  role="status"
                  aria-live="polite"
                >
                  <span className="status-light" />
                  {statusLabel}
                </div>
              </div>
              <div className="server-ip-row">
                <div className="server-address">
                  <span className="field-label">{copy.serverAddress}</span>
                  <code>{IP}</code>
                </div>
                <button
                  className={`copy-button${copied ? " is-copied" : ""}`}
                  type="button"
                  onClick={copyAddress}
                >
                  <span>{copyIpLabel(copy, copied)}</span>
                  <span className="copy-icon" aria-hidden="true">
                    ▣
                  </span>
                </button>
              </div>
              <div className="server-metrics">
                <div className="metric">
                  <span className="field-label">{copy.onlinePlayers}</span>
                  <strong>{countIsValid ? status.players : "—"}</strong>
                </div>
                <div className="metric">
                  <span className="field-label">{copy.maxSlots}</span>
                  <strong>{countIsValid ? status.maxPlayers : "—"}</strong>
                </div>
                <div className="metric metric-note">
                  <span className="metric-symbol" aria-hidden="true">
                    ⌁
                  </span>
                  <span>
                    {status.reason === "not_configured"
                      ? copy.waitingBridge
                      : copy.unavailable}
                  </span>
                </div>
              </div>
            </div>
            <div className="server-orbit-mark" aria-hidden="true">
              ✳
            </div>
          </div>
        </section>
        <section
          className="modes-section wrap section-space"
          id="modes"
          aria-labelledby="modes-title"
        >
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                <span>02</span>
                <span>{copy.modesKicker}</span>
              </span>
              <h2 id="modes-title">{copy.modesTitle}</h2>
            </div>
            <p>{copy.modesIntro}</p>
          </div>
          <ModeDirectory locale={locale} copy={copy} />
        </section>
        <section
          className="story-section"
          id="about"
          aria-labelledby="story-title"
        >
          <div className="wrap story-inner">
            <div
              className="story-art"
              role="img"
              aria-label="Pixel-art ilustrácia krajiny Minecraft"
            >
              <div className="story-sun" />
              <div className="story-mountain mountain-back" />
              <div className="story-mountain mountain-front" />
              <div className="story-tree tree-one">
                <i />
                <b />
              </div>
              <div className="story-tree tree-two">
                <i />
                <b />
              </div>
              <div className="story-ground" />
              <div className="story-avatar">
                <i />
                <b />
                <em />
              </div>
              <span className="story-coordinate">
                X: 2025
                <br />
                Y: 64
                <br />
                Z: 042
              </span>
            </div>
            <div className="story-copy">
              <span className="section-kicker">
                <span>03</span>
                <span>{copy.storyKicker}</span>
              </span>
              <h2 id="story-title">{copy.storyTitle}</h2>
              <p>{copy.storyBody}</p>
              <p className="story-origin">{copy.storyOrigin}</p>
              <a className="text-link story-link" href="#community">
                <span>{copy.becomePart}</span>
                <span aria-hidden="true">→</span>
              </a>
            </div>
          </div>
        </section>
        <section
          className="community-section wrap section-space"
          id="community"
          aria-labelledby="community-title"
        >
          <div className="community-panel">
            <div className="community-grid" aria-hidden="true" />
            <div className="community-copy">
              <span className="section-kicker">
                <span>04</span>
                <span>{copy.communityKicker}</span>
              </span>
              <h2 id="community-title">{copy.communityTitle}</h2>
              <p>{copy.communityBody}</p>
              <button
                className="button button-primary community-copy-button"
                type="button"
                onClick={copyAddress}
              >
                <span>{copy.copyIp}</span>
                <span className="arrow" aria-hidden="true">
                  ↗
                </span>
              </button>
              <p className="community-note">{copy.discordMissing}</p>
            </div>
            <div className="community-cubes" aria-hidden="true">
              <span className="community-cube cc-one" />
              <span className="community-cube cc-two" />
              <span className="community-cube cc-three" />
              <span className="community-cube cc-four" />
              <span className="community-character">
                <i />
                <b />
                <em />
              </span>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter locale={locale} copy={copy} />
      {toast ? (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
    </>
  );
}

function copyIpLabel(copy: Copy, copied: boolean) {
  return copied ? copy.copied : copy.copyIp;
}
