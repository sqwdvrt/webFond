import type { ReactNode } from "react";

type PageHeroProps = { eyebrow: string; title: string; description?: string; children?: ReactNode; compact?: boolean };

export function PageHero({ eyebrow, title, description, children, compact = false }: PageHeroProps) {
  return <section className={`page-hero${compact ? " page-hero-compact" : ""}`}><div className="container page-hero-inner"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{description ? <p>{description}</p> : null}{children ? <div className="hero-actions">{children}</div> : null}</div></section>;
}
