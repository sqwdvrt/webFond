"use client";

import { useEffect, useRef, type MouseEvent } from "react";

type FaqItem = { question: string; answer: string };

function FaqEntry({ question, answer }: FaqItem) {
  const animation = useRef<Animation | null>(null);
  const targetOpen = useRef(false);

  useEffect(() => () => animation.current?.cancel(), []);

  function toggle(event: MouseEvent<HTMLElement>) {
    event.preventDefault();
    const summary = event.currentTarget;
    const details = summary.parentElement as HTMLDetailsElement;
    const opening = animation.current ? !targetOpen.current : !details.open;
    targetOpen.current = opening;
    const startHeight = details.getBoundingClientRect().height;
    animation.current?.cancel();
    animation.current = null;

    if (!details.animate || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      details.open = opening;
      return;
    }

    // Keep native content visible while closing; remove `open` after the animation.
    details.open = true;
    const endHeight = opening
      ? details.getBoundingClientRect().height
      : summary.getBoundingClientRect().height + 1;
    const current = details.animate(
      [{ height: `${startHeight}px` }, { height: `${endHeight}px` }],
      { duration: 240, easing: "ease-in-out", fill: "both" },
    );
    animation.current = current;
    current.onfinish = () => {
      if (animation.current !== current) return;
      details.open = opening;
      animation.current = null;
      current.cancel();
    };
  }

  return (
    <details>
      <summary onClick={toggle}>{question}</summary>
      <p>{answer}</p>
    </details>
  );
}

export function FaqList({ items }: { items: ReadonlyArray<FaqItem> }) {
  return <div className="faq-list">{items.map((item) => <FaqEntry key={item.question} {...item} />)}</div>;
}
