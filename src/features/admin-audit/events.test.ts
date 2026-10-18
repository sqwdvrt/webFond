import { describe, expect, it } from "vitest";

import {
  contactAuditEvents,
  contentCreatedAuditEvents,
  contentDeletedAuditEvents,
  contentUpdatedAuditEvents,
} from "./events";

describe("contactAuditEvents", () => {
  it("creates an allow-listed status transition event", () => {
    expect(contactAuditEvents({
      id: "contact-1",
      previousStatus: "NEW",
      status: "IN_PROGRESS",
      noteChanged: false,
    })).toEqual([{
      actorKind: "ADMIN",
      action: "CONTACT_STATUS_CHANGED",
      entityType: "CONTACT_REQUEST",
      entityId: "contact-1",
      previousStatus: "NEW",
      nextStatus: "IN_PROGRESS",
    }]);
  });

  it("creates a note-change event without either note value", () => {
    expect(contactAuditEvents({
      id: "contact-1",
      previousStatus: "NEW",
      status: "NEW",
      noteChanged: true,
    })).toEqual([{
      actorKind: "ADMIN",
      action: "CONTACT_NOTE_CHANGED",
      entityType: "CONTACT_REQUEST",
      entityId: "contact-1",
    }]);
  });

  it("orders a status event before a note event", () => {
    expect(contactAuditEvents({
      id: "contact-1",
      previousStatus: "NEW",
      status: "CLOSED",
      noteChanged: true,
    })).toEqual([
      {
        actorKind: "ADMIN",
        action: "CONTACT_STATUS_CHANGED",
        entityType: "CONTACT_REQUEST",
        entityId: "contact-1",
        previousStatus: "NEW",
        nextStatus: "CLOSED",
      },
      {
        actorKind: "ADMIN",
        action: "CONTACT_NOTE_CHANGED",
        entityType: "CONTACT_REQUEST",
        entityId: "contact-1",
      },
    ]);
  });

  it("returns no events for a no-op", () => {
    expect(contactAuditEvents({
      id: "contact-1",
      previousStatus: "SPAM",
      status: "SPAM",
      noteChanged: false,
    })).toEqual([]);
  });

  it("cannot serialize contact PII or free-text metadata", () => {
    const serialized = JSON.stringify(contactAuditEvents({
      id: "contact-1",
      previousStatus: "NEW",
      status: "IN_PROGRESS",
      noteChanged: true,
    }));

    expect(serialized).not.toMatch(
      /"(?:name|email|message|note|internalNote|secret)"\s*:/i,
    );
  });
});

describe("content lifecycle audit events", () => {
  it.each(["PROJECT", "NEWS_POST", "DOCUMENT"] as const)(
    "creates one draft event for %s",
    (entityType) => {
      expect(contentCreatedAuditEvents({
        entityType,
        id: "content-1",
        status: "DRAFT",
      })).toEqual([{
        actorKind: "ADMIN",
        action: "CONTENT_CREATED",
        entityType,
        entityId: "content-1",
        nextStatus: "DRAFT",
      }]);
    },
  );

  it.each([
    ["PUBLISHED", "CONTENT_PUBLISHED"],
    ["ARCHIVED", "CONTENT_ARCHIVED"],
  ] as const)("adds a %s lifecycle event without a fictitious draft", (status, action) => {
    expect(contentCreatedAuditEvents({
      entityType: "PROJECT",
      id: "content-1",
      status,
    })).toEqual([
      {
        actorKind: "ADMIN",
        action: "CONTENT_CREATED",
        entityType: "PROJECT",
        entityId: "content-1",
        nextStatus: status,
      },
      {
        actorKind: "ADMIN",
        action,
        entityType: "PROJECT",
        entityId: "content-1",
        nextStatus: status,
      },
    ]);
  });

  it.each([
    ["DRAFT", "PUBLISHED", "CONTENT_PUBLISHED"],
    ["PUBLISHED", "ARCHIVED", "CONTENT_ARCHIVED"],
    ["ARCHIVED", "DRAFT", "CONTENT_STATUS_CHANGED"],
  ] as const)("maps %s -> %s to %s", (previousStatus, status, action) => {
    expect(contentUpdatedAuditEvents({
      entityType: "NEWS_POST",
      id: "content-1",
      previousStatus,
      status,
    })).toEqual([{
      actorKind: "ADMIN",
      action,
      entityType: "NEWS_POST",
      entityId: "content-1",
      previousStatus,
      nextStatus: status,
    }]);
  });

  it("returns no lifecycle event when status is unchanged", () => {
    expect(contentUpdatedAuditEvents({
      entityType: "DOCUMENT",
      id: "content-1",
      previousStatus: "DRAFT",
      status: "DRAFT",
    })).toEqual([]);
  });

  it("creates a draft deletion event", () => {
    expect(contentDeletedAuditEvents({
      entityType: "DOCUMENT",
      id: "content-1",
    })).toEqual([{
      actorKind: "ADMIN",
      action: "CONTENT_DELETED",
      entityType: "DOCUMENT",
      entityId: "content-1",
      previousStatus: "DRAFT",
    }]);
  });

  it("does not serialize content or arbitrary metadata", () => {
    const serialized = JSON.stringify(contentCreatedAuditEvents({
      entityType: "PROJECT",
      id: "content-1",
      status: "PUBLISHED",
    }));

    expect(serialized).not.toMatch(
      /"(?:title|slug|summary|content|imageUrl|fileUrl|metadata|secret)"\s*:/i,
    );
  });
});
