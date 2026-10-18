import { render, screen } from "@testing-library/react";
import axe from "axe-core";
import { describe, expect, it } from "vitest";

import { CONTACT_STATUS_LABELS } from "@/features/admin-messages/presentation";
import { CONTACT_STATUSES } from "@/features/admin-messages/types";

import styles from "../../admin.module.css";
import { ContactStatusBadge } from "./contact-status-badge";

describe("ContactStatusBadge", () => {
  it("renders every status as visible text with its status-specific class", () => {
    render(
      <>
        {CONTACT_STATUSES.map((status) => (
          <ContactStatusBadge key={status} status={status} />
        ))}
      </>,
    );

    for (const status of CONTACT_STATUSES) {
      const badge = screen.getByText(CONTACT_STATUS_LABELS[status]);
      expect(badge).toBeVisible();
      expect(badge).toHaveClass(styles.contactStatus);
      expect(badge).toHaveClass(styles[`contactStatus${status}`]);
    }
  });

  it("has no serious or critical accessibility violations", async () => {
    const { container } = render(
      <>
        {CONTACT_STATUSES.map((status) => (
          <ContactStatusBadge key={status} status={status} />
        ))}
      </>,
    );
    const results = await axe.run(container, {
      rules: { "color-contrast": { enabled: false } },
    });
    const violations = results.violations.filter(
      (item) => item.impact === "serious" || item.impact === "critical",
    );

    expect(violations).toEqual([]);
  });
});
