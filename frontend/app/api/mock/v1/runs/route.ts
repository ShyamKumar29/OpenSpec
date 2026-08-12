import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { jsonResponse, paginate, simulateLatency } from "@/mocks/server/respond";
import type { RunKind, RunStatus } from "@/lib/contracts/run";

interface RunListItem {
  id: string;
  kind: RunKind;
  status: RunStatus;
  started_at: string;
}

/** `GET /runs` — list runs, most recent first (docs/api.md §Runs & progress, added in
 *  F6 per D2: the mock route only exists because the row above it exists first).
 *  Filters: `status`, `kind`. Powers the dashboard's active-runs tile (FR-DSH-5). */
export async function GET(request: NextRequest) {
  await simulateLatency(request, "read");
  const params = request.nextUrl.searchParams;
  const store = getStore();

  let items = store.runs as (RunListItem & Record<string, unknown>)[];

  const status = params.get("status");
  if (status) items = items.filter((r) => r.status === status);

  const kind = params.get("kind");
  if (kind) items = items.filter((r) => r.kind === kind);

  items = [...items].sort((a, b) => (a.started_at < b.started_at ? 1 : -1));

  return jsonResponse(request, paginate(items, request));
}
