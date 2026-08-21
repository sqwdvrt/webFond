import { FileClock } from "lucide-react";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="empty-state"><FileClock aria-hidden="true" size={28} strokeWidth={1.6} /><div><h2>{title}</h2><p>{description}</p></div></div>;
}
