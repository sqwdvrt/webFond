"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

function snapshot(form: HTMLFormElement) {
  return Object.fromEntries(Array.from(form.elements).flatMap((element) => {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) || !element.name || element.type === "hidden" || element.type === "file") return [];
    return [[element.name, element.value]];
  }));
}

export function useUnsavedChanges(formRef: RefObject<HTMLFormElement | null>) {
  const [baseline, setBaseline] = useState<Record<string, string>>({});
  const [values, setValues] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [departure, setDeparture] = useState<HTMLElement | null>(null);
  const allowDeparture = useRef(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const initial = snapshot(form);
    const update = () => setValues(snapshot(form));
    const uploads = () => setUploading(Boolean(form.querySelector('[data-uploading="true"]')));
    const reset = (event: Event) => event.preventDefault(); // React actions reset even when validation fails.
    const submit = (event: Event) => {
      if (form.querySelector('[data-uploading="true"]')) event.preventDefault();
    };
    const initialize = () => { setBaseline(initial); update(); };
    initialize();
    form.addEventListener("input", update);
    form.addEventListener("change", update);
    form.addEventListener("editorialchange", update);
    form.addEventListener("uploadstate", uploads);
    form.addEventListener("reset", reset);
    form.addEventListener("submit", submit);
    return () => {
      form.removeEventListener("input", update);
      form.removeEventListener("change", update);
      form.removeEventListener("editorialchange", update);
      form.removeEventListener("uploadstate", uploads);
      form.removeEventListener("reset", reset);
      form.removeEventListener("submit", submit);
    };
  }, [formRef]);

  useEffect(() => {
    if (!dirty && !uploading) return;
    const unload = (event: BeforeUnloadEvent) => {
      if (allowDeparture.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (allowDeparture.current || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      const anchor = event.target instanceof Element ? event.target.closest("a") : null;
      if (!anchor || anchor.hasAttribute("download") || anchor.target && anchor.target !== "_self") return;
      const url = new URL(anchor.href);
      if (!["http:", "https:"].includes(url.protocol) || url.href === location.href || url.origin === location.origin && url.pathname === location.pathname && url.search === location.search && url.hash) return;
      event.preventDefault();
      event.stopPropagation();
      setDeparture(anchor);
    };
    const otherSubmit = (event: SubmitEvent) => {
      if (allowDeparture.current || event.defaultPrevented || event.target === formRef.current) return;
      // Logout and quick status actions can redirect away from a dirty editor too.
      if (!(event.submitter instanceof HTMLElement)) return;
      event.preventDefault();
      event.stopPropagation();
      setDeparture(event.submitter);
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    document.addEventListener("submit", otherSubmit, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
      document.removeEventListener("submit", otherSubmit, true);
    };
  }, [dirty, uploading, formRef]);

  return { dirty, uploading, values, baseline, departure,
    stay() { departure?.focus(); setDeparture(null); },
    leave() {
      allowDeparture.current = true;
      departure?.click();
      setDeparture(null);
      queueMicrotask(() => { allowDeparture.current = false; });
    },
  };
}
