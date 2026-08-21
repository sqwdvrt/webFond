type SectionHeadingProps = { number: string; title: string; intro?: string };

export function SectionHeading({ number, title, intro }: SectionHeadingProps) {
  return <header className="section-heading"><span className="section-number">{number}</span><div><h2>{title}</h2>{intro ? <p>{intro}</p> : null}</div></header>;
}
