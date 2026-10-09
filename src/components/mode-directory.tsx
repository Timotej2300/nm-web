import Link from "next/link";
import type { Copy, Locale } from "@/lib/i18n";

export function ModeDirectory({
  locale,
  copy,
}: {
  locale: Locale;
  copy: Copy;
}) {
  const modes = [
    {
      name: "Duels",
      description: copy.duelDescription,
      index: "01 / ARENA",
      art: "art-sword",
    },
    {
      name: "Anarchy",
      description: copy.anarchyDescription,
      index: "02 / SURVIVAL",
      art: "art-blocks",
    },
    {
      name: "KnockbackFFA",
      description: copy.knockbackDescription,
      index: "03 / KNOCKBACK",
      art: "art-rift",
    },
  ];
  return (
    <div className="mode-grid">
      {modes.map((mode) => (
        <article className="mode-card" key={mode.name}>
          <div className={`mode-art ${mode.art}`} aria-hidden="true">
            {mode.art === "art-sword" ? (
              <>
                <span className="sword-blade" />
                <span className="sword-hilt" />
                <span className="sword-guard" />
              </>
            ) : null}
            {mode.art === "art-blocks" ? (
              <>
                <span className="mini-cube cube-one" />
                <span className="mini-cube cube-two" />
                <span className="mini-cube cube-three" />
              </>
            ) : null}
            {mode.art === "art-rift" ? (
              <>
                <span className="rift-ring" />
                <span className="rift-pixel" />
              </>
            ) : null}
            <span className="art-corner" />
          </div>
          <div className="mode-card-content">
            <div className="mode-meta">
              <span className="mode-index">{mode.index}</span>
              <span className="mode-status">
                <i />
                {copy.unknown}
              </span>
            </div>
            <h2>{mode.name}</h2>
            <p>{mode.description}</p>
            <Link className="mode-link" href={`/${locale}#server`}>
              <span>{copy.viewServer}</span>
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </article>
      ))}
    </div>
  );
}
