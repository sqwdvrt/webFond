"use client";

import { useActionState } from "react";
import type { ContactMutationState } from "@/features/admin-messages/mutation";
import type { ContactStatusValue } from "@/features/admin-messages/types";
import styles from "../../admin.module.css";

export function QuickStatusForm({ action, status, label, updatedAt }: {
  action: (state: ContactMutationState, data: FormData) => Promise<ContactMutationState>;
  status: ContactStatusValue;
  label: string;
  updatedAt: string;
}) {
  const [state, submit, pending] = useActionState(action, { status: "idle", message: "" });
  return <form action={submit}>
    <input type="hidden" name="intent" value="status-only" />
    <input type="hidden" name="status" value={status} />
    <input type="hidden" name="updatedAt" value={updatedAt} />
    <button className={styles.secondaryButton} disabled={pending} type="submit">{label}</button>
    {state.status === "error" ? <p role="alert">{state.message}</p> : null}
  </form>;
}
