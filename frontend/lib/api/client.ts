/**
 * The one fetch wrapper. Base URL, RFC 9457 errors, `X-Correlation-Id`, cursor query
 * params, and the mock latency kill-switch all live here — nowhere else constructs a
 * request to the API (docs/14-frontend-implementation-plan.md §4.1).
 *
 * Client-only by design: `NEXT_PUBLIC_API_BASE_URL` defaults to a path-relative mock
 * (`/api/mock/v1`), which only resolves via the browser's implicit origin. This module
 * is imported exclusively from `lib/queries/*` hooks, which are themselves client-only
 * (TanStack Query).
 */
import { parseErrorResponse } from "./errors";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api/mock/v1";

/** `false` disables the mock server's simulated latency (docs §4.3) — set by E2E runs. */
const MOCK_LATENCY_ENABLED = process.env.NEXT_PUBLIC_MOCK_LATENCY !== "0";

export type QueryValue = string | number | boolean | undefined | null;

function correlationId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `cid_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function toQueryString(query: Record<string, QueryValue> | undefined): string {
  const params = new URLSearchParams();
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      params.set(key, String(value));
    }
  }
  if (!MOCK_LATENCY_ENABLED) {
    params.set("latency", "0");
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

function buildPath(path: string, query?: Record<string, QueryValue>): string {
  const base = API_BASE_URL.endsWith("/") ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}${toQueryString(query)}`;
}

export interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  query?: Record<string, QueryValue>;
  body?: unknown;
  idempotencyKey?: string;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { query, body, idempotencyKey, headers, ...rest } = options;
  const cid = correlationId();
  const finalHeaders = new Headers(headers);
  finalHeaders.set("X-Correlation-Id", cid);
  if (body !== undefined) finalHeaders.set("Content-Type", "application/json");
  if (idempotencyKey) finalHeaders.set("Idempotency-Key", idempotencyKey);

  const response = await fetch(buildPath(path, query), {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const responseCid = response.headers.get("X-Correlation-Id") ?? cid;

  if (!response.ok) {
    throw await parseErrorResponse(response, responseCid);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** Builds the absolute-relative URL for a resource that must be requested outside
 *  `apiFetch` (e.g. an `<img src>` for a page image, or an `EventSource`). */
export function apiUrl(path: string, query?: Record<string, QueryValue>): string {
  return buildPath(path, query);
}
