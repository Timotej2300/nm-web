"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

type SearchResult = {
  type: "news" | "team" | "forum";
  title: string;
  excerpt: string | null;
  href: string;
};

export function PublicSearch({ locale }: { locale: Locale }) {
  const sk = locale === "sk";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const clean = query.trim();
    if (clean.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setMessage("");
      fetch(`/api/search?locale=${locale}&q=${encodeURIComponent(clean)}`, {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          const body: unknown = await response.json().catch(() => null);
          if (!response.ok) throw new Error("Search unavailable");
          return body as { results: SearchResult[] };
        })
        .then((body) => {
          setResults(body.results);
          setMessage(
            body.results.length
              ? ""
              : sk
                ? "Nenašli sa žiadne verejné výsledky."
                : "Nenašly se žádné veřejné výsledky.",
          );
        })
        .catch((error: unknown) => {
          if (error instanceof Error && error.name === "AbortError") return;
          setResults([]);
          setMessage(
            sk
              ? "Vyhľadávanie je momentálne nedostupné."
              : "Vyhledávání je momentálně nedostupné.",
          );
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [locale, query, sk]);

  return (
    <section className="public-search">
      <label className="field">
        <span>{sk ? "Hľadať novinky, tím a fórum" : "Hledat novinky, tým a fórum"}</span>
        <input
          type="search"
          autoComplete="off"
          maxLength={80}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={sk ? "Napíš aspoň 2 znaky…" : "Napiš alespoň 2 znaky…"}
        />
      </label>
      <p
        className="search-status"
        role={
          message.includes("nedostup") || message.includes("nedostupn")
            ? "alert"
            : "status"
        }
        aria-live="polite"
      >
        {query.trim().length >= 2 && loading
          ? sk
            ? "Vyhľadávam…"
            : "Vyhledávám…"
          : query.trim().length < 2
            ? sk
              ? "Výsledky sa zobrazujú iba z verejného obsahu."
              : "Výsledky se zobrazují pouze z veřejného obsahu."
            : message}
      </p>
      {query.trim().length >= 2 && results.length > 0 && (
        <ul className="search-results">
          {results.map((result) => (
            <li key={`${result.type}:${result.href}`}>
              <span className={`search-result-type search-result-${result.type}`}>
                {result.type === "news"
                  ? sk
                    ? "NOVINKA"
                    : "NOVINKA"
                  : result.type === "team"
                    ? "TÍM"
                    : "FÓRUM"}
              </span>
              <div>
                <Link href={result.href}>{result.title}</Link>
                {result.excerpt && <p>{result.excerpt}</p>}
              </div>
              <span className="search-arrow" aria-hidden="true">↗</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}