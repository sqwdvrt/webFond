type SectionHeadingProps = { number?: string; title: string; intro?: string };

export function SectionHeading({ number, title, intro }: SectionHeadingProps) {
  return <header className={`section-heading${number ? "" : " section-heading-plain"}`}>{number ? <span className="section-number">{number}</span> : null}<div><h2>{title}</h2>{intro ? <p>{intro}</p> : null}</div></header>;
}
