import { describe, expect, it } from "vitest";

import { contactAuditEvents } from "./events";

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
