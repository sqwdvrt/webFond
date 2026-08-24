import {
  getPublishedNewsPost,
  getPublishedProject,
  listPublishedNews,
} from "./repository";
import { createRequestCachedLoader } from "./request-cache";

export const listPublishedNewsForRequest =
  createRequestCachedLoader(listPublishedNews);
export const getPublishedProjectForRequest =
  createRequestCachedLoader(getPublishedProject);
export const getPublishedNewsPostForRequest =
  createRequestCachedLoader(getPublishedNewsPost);
