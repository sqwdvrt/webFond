import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  usePathname: vi.fn(() => "/"),
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  })),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock("next/font/google", () => ({
  Manrope: () => ({ className: "font-sans", variable: "--font-sans" }),
  Cormorant: () => ({ className: "font-display", variable: "--font-display-face" }),
}));

vi.mock("next/navigation", () => ({
  usePathname: navigation.usePathname,
  useRouter: navigation.useRouter,
  redirect: navigation.redirect,
  notFound: navigation.notFound,
}));

afterEach(() => {
  cleanup();
  navigation.usePathname.mockReturnValue("/");
});
