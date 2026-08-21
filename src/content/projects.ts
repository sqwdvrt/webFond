export type ProjectContent = {
  slug: "pomoshch-ryadom" | "zabota-o-starshih" | "podderzhka-detyam";
  title: string;
  description: string;
  detail: string;
  status: "Направление работы";
  href: string;
};

export const projects: readonly ProjectContent[] = [
  {
    slug: "pomoshch-ryadom",
    title: "Помощь рядом",
    description: "Поддержка людей и семей в трудной жизненной ситуации.",
    detail:
      "Направление объединяет возможные формы поддержки людей и семей, которые столкнулись со сложными обстоятельствами.",
    status: "Направление работы",
    href: "/projects/pomoshch-ryadom",
  },
  {
    slug: "zabota-o-starshih",
    title: "Забота о старших",
    description: "Помощь и поддержка пожилых людей.",
    detail:
      "Направление посвящено поддержке пожилых людей, которым нужны внимание, участие и практическая помощь.",
    status: "Направление работы",
    href: "/projects/zabota-o-starshih",
  },
  {
    slug: "podderzhka-detyam",
    title: "Поддержка детям",
    description:
      "Помощь детям и семьям, которые столкнулись со сложными обстоятельствами.",
    detail:
      "Направление предусматривает поддержку детей и семей в рамках уставных целей фонда.",
    status: "Направление работы",
    href: "/projects/podderzhka-detyam",
  },
];

export const projectSlugs = projects.map((project) => project.slug);

export function getProjectBySlug(slug: string) {
  return projects.find((project) => project.slug === slug);
}
