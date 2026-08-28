import type { Metadata, Viewport } from "next";
import { Cormorant, Manrope } from "next/font/google";

import { PublicChrome } from "@/components/layout/public-chrome";
import { OrganizationJsonLd } from "@/components/seo/organization-json-ld";
import { siteConfig } from "@/config/site";

import "./globals.css";

const sans = Manrope({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-sans",
});

const display = Cormorant({
  subsets: ["latin", "cyrillic"],
  display: "swap",
  variable: "--font-display-face",
});

export const metadata: Metadata = {
  metadataBase: siteConfig.siteUrl,
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  openGraph: {
    type: "website",
    locale: "ru_RU",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${siteConfig.name}. ${siteConfig.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
    images: ["/opengraph-image"],
  },
};

export const viewport: Viewport = {
  themeColor: "#2E7D32",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body className={`${sans.variable} ${display.variable} ${sans.className}`}>
        <OrganizationJsonLd />
        <PublicChrome>{children}</PublicChrome>
      </body>
    </html>
  );
}
