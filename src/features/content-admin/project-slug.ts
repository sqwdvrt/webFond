const alphabet: Record<string, string> = Object.fromEntries(
  [..."абвгдеёжзийклмнопрстуфхцчшщъыьэюя"].map((letter, index) => [
    letter,
    ["a", "b", "v", "g", "d", "e", "yo", "zh", "z", "i", "y", "k", "l", "m", "n", "o", "p", "r", "s", "t", "u", "f", "kh", "ts", "ch", "sh", "shch", "", "y", "", "e", "yu", "ya"][index],
  ]),
);

export function projectSlug(title: string): string {
  return [...title.toLowerCase()]
    .map((character) => alphabet[character] ?? character)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");
}
