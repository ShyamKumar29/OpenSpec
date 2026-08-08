/**
 * Shared wire primitives mirrored from docs/api.md §Conventions.
 * This file and its siblings in lib/contracts/ are the ONLY place `snake_case` wire
 * shapes are parsed and mapped to `camelCase` domain types (docs/14-frontend-implementation-plan.md §5).
 * Components never import from here directly for wire shapes — they consume the
 * camelCase domain types via lib/queries/*.
 */
import { z } from "zod";

/** RFC 9457 `application/problem+json`, per docs/api.md §Conventions. */
export const problemDetailsWireSchema = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number().int(),
  detail: z.string(),
  code: z.string(),
  correlation_id: z.string(),
});
export type ProblemDetailsWire = z.infer<typeof problemDetailsWireSchema>;

export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  code: string;
  correlationId: string;
}

export function adaptProblemDetails(wire: unknown): ProblemDetails {
  const parsed = problemDetailsWireSchema.parse(wire);
  return {
    type: parsed.type,
    title: parsed.title,
    status: parsed.status,
    detail: parsed.detail,
    code: parsed.code,
    correlationId: parsed.correlation_id,
  };
}

/** Cursor-paginated list envelope (docs/api.md: "Cursor: ?cursor=<opaque>&limit=<n>"). */
export function cursorPageWireSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    next_cursor: z.string().nullable(),
  });
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export function adaptCursorPage<Wire, Domain>(
  wire: { items: Wire[]; next_cursor: string | null },
  adaptItem: (item: Wire) => Domain,
): CursorPage<Domain> {
  return {
    items: wire.items.map(adaptItem),
    nextCursor: wire.next_cursor,
  };
}
