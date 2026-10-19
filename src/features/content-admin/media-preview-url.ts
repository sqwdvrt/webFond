/** Unsaved URLs must not crash the image renderer before server validation. */
export function mediaPreviewUrl(value: string | undefined): string | null {
  if (!value || value.length > 2048 || /[\\\u0000-\u0020\u007f]/.test(value)) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}
