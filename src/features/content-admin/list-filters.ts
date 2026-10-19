import type { PublicationStatus } from "./types";

export const CONTENT_PAGE_SIZE = 25;
export const CONTENT_SORTS = ["updated-desc", "updated-asc"] as const;
export type ContentListPath = "/admin/projects" | "/admin/news" | "/admin/documents";
export type ContentListFilters = {
  q: string;
  status: PublicationStatus | "";
  page: number;
  sort: (typeof CONTENT_SORTS)[number];
};
export type ContentPage<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
type SearchParams = Record<string, string | string[] | undefined> | URLSearchParams;

function single(input: SearchParams, key: string) {
  const value = input instanceof URLSearchParams ? input.getAll(key) : input[key];
  return (Array.isArray(value) ? (value.length === 1 ? value[0] : "") : value)?.trim() ?? "";
}

export function parseContentListFilters(input: SearchParams): ContentListFilters {
  const q = single(input, "q");
  const status = single(input, "status");
  const page = single(input, "page");
  const sort = single(input, "sort");
  return {
    q: q.length <= 120 ? q : "",
    status: status === "DRAFT" || status === "PUBLISHED" || status === "ARCHIVED" ? status : "",
    page: /^[1-9][0-9]{0,5}$/.test(page) ? Number(page) : 1,
    sort: sort === "updated-asc" ? sort : "updated-desc",
  };
}

/** Also validates callers that do not originate from URL search params. */
export function normalizeContentListFilters(filters: Partial<ContentListFilters>): ContentListFilters {
  return parseContentListFilters({
    q: filters.q,
    status: filters.status,
    sort: filters.sort,
    page: filters.page === undefined ? undefined : String(filters.page),
  });
}

export function buildContentListUrl(path: ContentListPath, input: Partial<ContentListFilters>) {
  const filters = normalizeContentListFilters(input);
  const query = new URLSearchParams();
  if (filters.q) query.set("q", filters.q);
  if (filters.status) query.set("status", filters.status);
  if (filters.page !== 1) query.set("page", String(filters.page));
  if (filters.sort !== "updated-desc") query.set("sort", filters.sort);
  return `${path}${query.size ? `?${query}` : ""}`;
}

/** Restrict return navigation to this exact list and its canonical parameters. */
export function safeContentReturnTo(input: unknown, path: ContentListPath): string {
  if (typeof input !== "string" || input.length > 2048) return path;
  if (input === path) return path;
  if (!input.startsWith(`${path}?`) || /[\\#\r\n]/.test(input)) return path;
  const query = new URLSearchParams(input.slice(path.length + 1));
  const canonical = buildContentListUrl(path, parseContentListFilters(query));
  // Reject unknown, repeated or invalid values; never interpret an arbitrary URL.
  const normalized = new URLSearchParams(canonical.split("?")[1]);
  for (const [key, value] of query) {
    if (!["q", "status", "page", "sort"].includes(key) || query.getAll(key).length !== 1) return path;
    const expected = normalized.get(key) ?? ({ q: "", status: "", page: "1", sort: "updated-desc" }[key]);
    if (value !== expected) return path;
  }
  return canonical;
}

export function contentEditorHref(path: ContentListPath, id: string, filters: ContentListFilters) {
  const returnTo = buildContentListUrl(path, filters);
  const href = `${path}/${encodeURIComponent(id)}`;
  return returnTo === path ? href : `${href}?${new URLSearchParams({ returnTo })}`;
}
