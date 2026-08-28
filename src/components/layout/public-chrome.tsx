"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";

export function PublicChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/admin")) {
    return children;
  }

  return (
    <>
      <a className="skip-link" href="#main-content">
        К содержанию
      </a>
      <SiteHeader />
      <main className="site-main" id="main-content">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
