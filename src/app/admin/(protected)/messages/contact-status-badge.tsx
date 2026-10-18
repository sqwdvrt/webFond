import { CONTACT_STATUS_LABELS } from "@/features/admin-messages/presentation";
import type { ContactStatusValue } from "@/features/admin-messages/types";

import styles from "../../admin.module.css";

export function ContactStatusBadge({ status }: { status: ContactStatusValue }) {
  return (
    <span className={`${styles.contactStatus} ${styles[`contactStatus${status}`]}`}>
      {CONTACT_STATUS_LABELS[status]}
    </span>
  );
}
