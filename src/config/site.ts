export type NavigationItem = {
  label: string;
  href: string;
};

export const siteConfig = {
  name: "Фонд «Быть Добру»",
  shortName: "ФБД",
  tagline: "Делая мир лучше",
  description:
    "Благотворительный фонд поддержки людей, оказавшихся в трудной жизненной ситуации.",
  helpHref: "/help",
  navigation: [
    { label: "О фонде", href: "/about" },
    { label: "Проекты", href: "/projects" },
    { label: "Отчеты", href: "/reports" },
    { label: "Новости", href: "/news" },
    { label: "Контакты", href: "/contacts" },
  ] satisfies NavigationItem[],
  legal: {
    registeredAt: "17 июля 2025 года",
    ogrn: "1257700318974",
    inn: "9721254417",
    kpp: "772101001",
    address:
      "109462, г. Москва, б-р Волжский, д. 51, стр. 17, помещ. 101",
    email: "SOROVOI@MAIL.RU",
  },
} as const;
