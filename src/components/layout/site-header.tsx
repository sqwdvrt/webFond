"use client";

import { Menu, Sprout, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { siteConfig } from "@/config/site";

export function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand-link" href="/" aria-label={siteConfig.name}>
          <span className="brand-mark" aria-hidden="true">
            <Sprout size={24} strokeWidth={1.8} />
          </span>
          <span className="brand-copy">
            <strong>Быть Добру</strong>
            <span>{siteConfig.tagline}</span>
          </span>
        </Link>

        <nav className="desktop-navigation" aria-label="Основная">
          {siteConfig.navigation.map((item) => (
            <Link key={item.href} href={item.href}>
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
        <nav
          className="mobile-navigation"
          id="mobile-navigation"
          aria-label="Мобильная"
        >
          <div className="container mobile-navigation-inner">
            {siteConfig.navigation.map((item) => (
              <Link key={item.href} href={item.href} onClick={closeMenu}>
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
      ) : null}
    </header>
  );
}
