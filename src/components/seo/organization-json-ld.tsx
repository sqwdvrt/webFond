import { siteConfig } from "@/config/site";

export function OrganizationJsonLd() {
  const data = {
    "@context": "https://schema.org",
    "@type": "NGO",
    name: siteConfig.name,
    legalName: siteConfig.name,
    url: siteConfig.siteUrl.toString(),
    foundingDate: siteConfig.foundedAt,
    email: siteConfig.legal.emailLabel,
    taxID: siteConfig.legal.inn,
    identifier: [
      { "@type": "PropertyValue", propertyID: "ОГРН", value: siteConfig.legal.ogrn },
      { "@type": "PropertyValue", propertyID: "КПП", value: siteConfig.legal.kpp },
    ],
    address: {
      "@type": "PostalAddress",
      postalCode: "109462",
      addressLocality: "Москва",
      streetAddress: "б-р Волжский, д. 51, стр. 17, помещ. 101",
      addressCountry: "RU",
    },
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replaceAll("<", "\\u003c") }} />;
}
