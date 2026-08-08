/**
 * Shared response helpers for every route under app/api/mock/v1/**. Centralises
 * X-Correlation-Id echo (docs/api.md §Conventions), RFC 9457 errors, and the simulated
 * latency table (docs/14-frontend-implementation-plan.md §4.3) so no individual route
 * handler reimplements them.
 */
import { NextRequest, NextResponse } from "next/server";

export type LatencyClass = "read" | "explain" | "asset" | "decision" | "next" | "stage";

const LATENCY_RANGE_MS: Record<LatencyClass, [number, number]> = {
  read: [120, 260],
  explain: [90, 180],
  asset: [20, 40],
  decision: [150, 150],
  next: [200, 200],
  stage: [100, 400],
};

function correlationId(request: NextRequest): string {
  return request.headers.get("x-correlation-id") ?? `srv_${Math.random().toString(36).slice(2)}`;
}

function latencyEnabled(request: NextRequest): boolean {
  if (request.nextUrl.searchParams.get("latency") === "0") return false;
  if (process.env.NEXT_PUBLIC_MOCK_LATENCY === "0") return false;
  return true;
}

/** Awaits the simulated delay for this endpoint class, unless disabled (§4.3). */
export async function simulateLatency(request: NextRequest, klass: LatencyClass): Promise<void> {
  if (!latencyEnabled(request)) return;
  const [min, max] = LATENCY_RANGE_MS[klass];
  const ms = min === max ? min : Math.round(min + Math.random() * (max - min));
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function jsonResponse<T>(
  request: NextRequest,
  body: T,
  init?: { status?: number },
): NextResponse {
  const res = NextResponse.json(body, { status: init?.status ?? 200 });
  res.headers.set("X-Correlation-Id", correlationId(request));
  return res;
}

/** A body-less response — required for 204/304, which may not carry a body. */
export function noContentResponse(request: NextRequest, status = 204): NextResponse {
  const res = new NextResponse(null, { status });
  res.headers.set("X-Correlation-Id", correlationId(request));
  return res;
}

/** RFC 9457 `application/problem+json` (docs/api.md §Conventions). */
export function problemResponse(
  request: NextRequest,
  opts: { status: number; title: string; detail: string; code: string; type?: string },
): NextResponse {
  const cid = correlationId(request);
  const body = {
    type: opts.type ?? `https://openspec.dev/errors/${opts.code.toLowerCase().replace(/_/g, "-")}`,
    title: opts.title,
    status: opts.status,
    detail: opts.detail,
    code: opts.code,
    correlation_id: cid,
  };
  return new NextResponse(JSON.stringify(body), {
    status: opts.status,
    headers: { "Content-Type": "application/problem+json", "X-Correlation-Id": cid },
  });
}

export function notFound(request: NextRequest, entity: string, id: string): NextResponse {
  return problemResponse(request, {
    status: 404,
    title: "Not found",
    detail: `${entity} '${id}' does not exist.`,
    code: "NOT_FOUND",
  });
}

// ---- Cursor pagination (docs/api.md: "Cursor: ?cursor=<opaque>&limit=<n>") ----

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

export function decodeCursor(cursor: string | null): number {
  if (!cursor) return 0;
  try {
    const n = Number(Buffer.from(cursor, "base64url").toString("utf-8"));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), "utf-8").toString("base64url");
}

export function paginate<T>(
  items: T[],
  request: NextRequest,
): { items: T[]; next_cursor: string | null } {
  const params = request.nextUrl.searchParams;
  const offset = decodeCursor(params.get("cursor"));
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(params.get("limit")) || DEFAULT_LIMIT));
  const page = items.slice(offset, offset + limit);
  const nextOffset = offset + limit;
  return { items: page, next_cursor: nextOffset < items.length ? encodeCursor(nextOffset) : null };
}
