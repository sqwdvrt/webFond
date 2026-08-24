import { cache } from "react";

export function createRequestCachedLoader<Args extends unknown[], Result>(
  loader: (...args: Args) => Result,
) {
  return cache(loader);
}
