import type { ContactStatusValue } from "@/features/admin-messages/types";

type ContactAuditInput = {
  id: string;
  previousStatus: ContactStatusValue;
  status: ContactStatusValue;
  noteChanged: boolean;
};

export type ContactAuditEvent =
  | {
      actorKind: "ADMIN";
      action: "CONTACT_STATUS_CHANGED";
      entityType: "CONTACT_REQUEST";
      entityId: string;
      previousStatus: ContactStatusValue;
      nextStatus: ContactStatusValue;
    }
  | {
      actorKind: "ADMIN";
      action: "CONTACT_NOTE_CHANGED";
      entityType: "CONTACT_REQUEST";
      entityId: string;
    };

export function contactAuditEvents({
  id,
  previousStatus,
  status,
  noteChanged,
}: ContactAuditInput): ContactAuditEvent[] {
  const events: ContactAuditEvent[] = [];

  if (previousStatus !== status) {
    events.push({
      actorKind: "ADMIN",
      action: "CONTACT_STATUS_CHANGED",
      entityType: "CONTACT_REQUEST",
      entityId: id,
      previousStatus,
      nextStatus: status,
    });
  }

  if (noteChanged) {
    events.push({
      actorKind: "ADMIN",
      action: "CONTACT_NOTE_CHANGED",
      entityType: "CONTACT_REQUEST",
      entityId: id,
    });
  }

  return events;
}
