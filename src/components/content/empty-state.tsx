import Link from "next/link";
import { FileClock } from "lucide-react";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><FileClock aria-hidden="true" size={28} strokeWidth={1.6} /><div><h2>{title}</h2><p>{description}</p></div></div>;
}

export function CollectionEmpty({
  title,
  description,
  links,
}: {
  title: string;
  description: string;
  links: readonly { href: string; label: string }[];
}) {
  return (
    <div className="collection-empty">
      <h2>{title}</h2>
      <p>{description}</p>
      <div className="quiet-row">
        {links.map((link) => (
          <Link href={link.href} key={link.href}>
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
