import { getPublishedProjectForDisplay } from "@/features/fundraising/public-projects";
import {
  getPublishedNewsPost,
  listPublishedNews,
} from "./repository";
import { createRequestCachedLoader } from "./request-cache";

export const listPublishedNewsForRequest =
  createRequestCachedLoader(listPublishedNews);
export const getPublishedProjectForRequest =
  createRequestCachedLoader(getPublishedProjectForDisplay);
export const getPublishedNewsPostForRequest =
  createRequestCachedLoader(getPublishedNewsPost);
