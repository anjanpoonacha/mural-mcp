import { getValidAccessToken, refreshAccessToken } from "../auth/oauth";
import { loadTokens } from "../auth/token-store";

const BASE_URL = "https://app.mural.co/api/public/v1";

export class MuralApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: string
  ) {
    super(`Mural API error ${status} ${statusText}: ${body}`);
    this.name = "MuralApiError";
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  queryParams?: Record<string, string>,
  retried = false
): Promise<T> {
  const token = await getValidAccessToken();
  const url = new URL(`${BASE_URL}${path}`);
  if (queryParams) {
    for (const [key, value] of Object.entries(queryParams)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  const options: RequestInit = { method, headers };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url.toString(), options);

  if (response.status === 401 && !retried) {
    const tokens = await loadTokens();
    if (tokens) {
      const newTokens = await refreshAccessToken(tokens);
      const retryHeaders: Record<string, string> = {
        Authorization: `Bearer ${newTokens.access_token}`,
        Accept: "application/json",
      };
      const retryOptions: RequestInit = { method, headers: retryHeaders };
      if (body !== undefined) {
        retryHeaders["Content-Type"] = "application/json";
        retryOptions.body = JSON.stringify(body);
      }
      const retryResponse = await fetch(url.toString(), retryOptions);
      if (!retryResponse.ok) {
        const text = await retryResponse.text();
        throw new MuralApiError(retryResponse.status, retryResponse.statusText, text);
      }
      if (retryResponse.status === 204) {
        return undefined as T;
      }
      return retryResponse.json() as Promise<T>;
    }
  }

  if (!response.ok) {
    const text = await response.text();
    throw new MuralApiError(response.status, response.statusText, text);
  }

  // DELETE returns 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// --- Convenience methods ---

export const muralApi = {
  get: <T>(path: string, queryParams?: Record<string, string>) =>
    request<T>("GET", path, undefined, queryParams),

  post: <T>(path: string, body?: unknown) =>
    request<T>("POST", path, body),

  patch: <T>(path: string, body?: unknown) =>
    request<T>("PATCH", path, body),

  put: <T>(path: string, body?: unknown) =>
    request<T>("PUT", path, body),

  delete: <T>(path: string) =>
    request<T>("DELETE", path),
};
