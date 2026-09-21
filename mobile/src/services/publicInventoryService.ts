import axios from "axios";
import { getWebAppOrigin } from "./api";

/*
 * Mirrors frontend/src/services/publicInventoryService.js.
 *
 * Deliberately NOT the shared `api` instance. That one attaches a bearer token
 * and, on a 401, tries to refresh and then signs the user out - none of which
 * makes sense for a share link, which is meant to be opened by someone with no
 * account at all.
 */

const publicApi = axios.create({
  baseURL: `${getWebAppOrigin()}/api/public`,
  timeout: 15000,
});

export const getSharedInventory = async (shareToken: string) => {
  const token = String(shareToken || "").trim();
  if (!token) return null;
  const res = await publicApi.get(`/inventory/${token}`);
  return res.data?.inventory || null;
};
