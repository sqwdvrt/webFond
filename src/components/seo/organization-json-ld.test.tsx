import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrganizationJsonLd } from "@/components/seo/organization-json-ld";

describe("OrganizationJsonLd", () => {
  it("maps confirmed identifiers to Schema.org fields", () => {
    const { container } = render(<OrganizationJsonLd />);
    const data = JSON.parse(container.querySelector("script")?.textContent ?? "{}");
    expect(data["@type"]).toBe("NGO");
    expect(data.taxID).toBe("9721254417");
    expect(data.identifier).toEqual([
      { "@type": "PropertyValue", propertyID: "ОГРН", value: "1257700318974" },
      { "@type": "PropertyValue", propertyID: "КПП", value: "772101001" },
    ]);
    expect(data.address.streetAddress).toContain("б-р Волжский");
  });
});
