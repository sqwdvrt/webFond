"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { siteConfig } from "@/config/site";

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  useEffect(() => {
    if (!isMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand-link" href="/" aria-label={siteConfig.name}>
          <span className="brand-mark">
            <Image
              src="/brand/mark.jpg"
              width={880}
              height={880}
              sizes="52px"
              alt="Знак фонда «Быть Добру»: руки, росток и птица"
              priority
            />
          </span>
          <span className="brand-copy">
            <strong>Быть Добру</strong>
            <span>{siteConfig.tagline}</span>
          </span>
        </Link>

        <nav className="desktop-navigation" aria-label="Основная">
          {siteConfig.navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isCurrentPath(pathname, item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="header-actions">
          <Link className="button button-primary desktop-help" href={siteConfig.helpHref}>
            Помочь
          </Link>
          <button
            className="menu-button"
            type="button"
            aria-label={isMenuOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={isMenuOpen}
            aria-controls="mobile-navigation"
            title={isMenuOpen ? "Закрыть меню" : "Открыть меню"}
            onClick={() => setIsMenuOpen((current) => !current)}
          >
            {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {isMenuOpen ? (
        <>
          <div className="menu-backdrop" onClick={closeMenu} />
          <nav
            className="mobile-navigation"
            id="mobile-navigation"
            aria-label="Мобильная"
          >
            <div className="container mobile-navigation-inner">
              {siteConfig.navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isCurrentPath(pathname, item.href) ? "page" : undefined}
                  onClick={closeMenu}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                className="button button-primary mobile-help"
                href={siteConfig.helpHref}
                onClick={closeMenu}
              >
                Помочь
              </Link>
            </div>
          </nav>
        </>
      ) : null}
    </header>
  );
}
