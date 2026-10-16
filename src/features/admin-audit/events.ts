import type { ContactStatusValue } from "@/features/admin-messages/types";
import type { PublicationStatus } from "@/features/content-admin/types";

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

export type ContentAuditEntityType = "PROJECT" | "NEWS_POST" | "DOCUMENT";

export type ContentAuditEvent = {
  actorKind: "ADMIN";
  action:
    | "CONTENT_CREATED"
    | "CONTENT_PUBLISHED"
    | "CONTENT_ARCHIVED"
    | "CONTENT_STATUS_CHANGED"
    | "CONTENT_DELETED";
  entityType: ContentAuditEntityType;
  entityId: string;
  previousStatus?: PublicationStatus;
  nextStatus?: PublicationStatus;
};

type ContentIdentity = {
  entityType: ContentAuditEntityType;
  id: string;
};

export function contentCreatedAuditEvents({
  entityType,
  id,
  status,
}: ContentIdentity & { status: PublicationStatus }): ContentAuditEvent[] {
  const created: ContentAuditEvent = {
    actorKind: "ADMIN",
    action: "CONTENT_CREATED",
    entityType,
    entityId: id,
    nextStatus: status,
  };

  if (status === "DRAFT") return [created];

  return [
    created,
    {
      actorKind: "ADMIN",
      action: status === "PUBLISHED"
        ? "CONTENT_PUBLISHED"
        : "CONTENT_ARCHIVED",
      entityType,
      entityId: id,
      nextStatus: status,
    },
  ];
}

export function contentUpdatedAuditEvents({
  entityType,
  id,
  previousStatus,
  status,
}: ContentIdentity & {
  previousStatus: PublicationStatus;
  status: PublicationStatus;
}): ContentAuditEvent[] {
  if (previousStatus === status) return [];

  return [{
    actorKind: "ADMIN",
    action: status === "PUBLISHED"
      ? "CONTENT_PUBLISHED"
      : status === "ARCHIVED"
        ? "CONTENT_ARCHIVED"
        : "CONTENT_STATUS_CHANGED",
    entityType,
    entityId: id,
    previousStatus,
    nextStatus: status,
  }];
}

export function contentDeletedAuditEvents({
  entityType,
  id,
}: ContentIdentity): ContentAuditEvent[] {
  return [{
    actorKind: "ADMIN",
    action: "CONTENT_DELETED",
    entityType,
    entityId: id,
    previousStatus: "DRAFT",
  }];
}

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
