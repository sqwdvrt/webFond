"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";

import { siteConfig } from "@/config/site";

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = (returnFocus = true) => {
    dialogRef.current?.close();
    setIsMenuOpen(false);
    if (returnFocus) menuButtonRef.current?.focus();
    else menuButtonRef.current?.blur();
  };

  const navigateFromMenu = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const isSamePage = pathname === event.currentTarget.pathname;
    if (isSamePage) event.preventDefault();
    closeMenu(isSamePage);
  };

  const openMenu = () => {
    dialogRef.current?.showModal();
    setIsMenuOpen(true);
    closeButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!isMenuOpen) return;
    const desktop = window.matchMedia("(min-width: 981px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        dialogRef.current?.close();
        setIsMenuOpen(false);
      }
    };
    desktop.addEventListener("change", closeOnDesktop);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      desktop.removeEventListener("change", closeOnDesktop);
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand-link" href="/" aria-label={siteConfig.name}>
          <span className="brand-mark">
            <Image
              src="/brand/mark-small.webp"
              width={104}
              height={104}
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
            ref={menuButtonRef}
            className="menu-button"
            type="button"
            aria-label="Открыть меню"
            aria-haspopup="dialog"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-menu"
            title="Открыть меню"
            onClick={openMenu}
          >
            <Menu size={24} />
          </button>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        className="mobile-menu"
        id="mobile-menu"
        aria-label="Меню сайта"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = event.currentTarget.querySelectorAll<HTMLElement>("button:not([disabled]), a[href]");
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        onCancel={(event) => {
          event.preventDefault();
          closeMenu();
        }}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          if (event.clientX < bounds.left || event.clientX > bounds.right ||
              event.clientY < bounds.top || event.clientY > bounds.bottom) closeMenu();
        }}
      >
        <div className="container mobile-menu-heading">
          <strong>Меню сайта</strong>
          <button ref={closeButtonRef} className="menu-button" type="button"
            aria-label="Закрыть меню" onClick={() => closeMenu()}>
            <X size={24} />
          </button>
        </div>
        <nav className="mobile-navigation" aria-label="Мобильная">
          <div className="container mobile-navigation-inner">
            {siteConfig.navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isCurrentPath(pathname, item.href) ? "page" : undefined}
                onClick={navigateFromMenu}
              >
                {item.label}
              </Link>
            ))}
            <Link className="button button-primary mobile-help" href={siteConfig.helpHref}
              onClick={navigateFromMenu}>
              Помочь
            </Link>
          </div>
        </nav>
      </dialog>
    </header>
  );
}
