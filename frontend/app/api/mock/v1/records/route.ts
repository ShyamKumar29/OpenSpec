import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { jsonResponse, paginate, simulateLatency } from "@/mocks/server/respond";

/** `GET /records` — docs/api.md §Records. Filters: class_id, status, completeness_lt,
 *  supplier, q, has_unknown_reason. */
export async function GET(request: NextRequest) {
  await simulateLatency(request, "read");
  const store = getStore();
  const params = request.nextUrl.searchParams;

  let items = store.records;

  const classId = params.get("class_id");
  if (classId) items = items.filter((r) => r.class?.id === classId || r.class?.code === classId);

  const status = params.get("status");
  if (status) items = items.filter((r) => r.status === status);

  const completenessLt = params.get("completeness_lt");
  if (completenessLt) {
    const threshold = Number(completenessLt);
    items = items.filter((r) => {
      const ratio =
        r.completeness.mandatory_total === 0
          ? 0
          : r.completeness.filled / r.completeness.mandatory_total;
      return ratio < threshold;
    });
  }

  const supplier = params.get("supplier");
  if (supplier) items = items.filter((r) => r.supplier_name === supplier);

  const q = params.get("q");
  if (q) {
    const needle = q.toLowerCase();
    items = items.filter(
      (r) =>
        r.mpn_raw.toLowerCase().includes(needle) ||
        r.description_raw.toLowerCase().includes(needle),
    );
  }

  if (params.get("has_unknown_reason") === "true") {
    items = items.filter((r) => r.unknown_count > 0);
  }

  return jsonResponse(request, paginate(items, request));
}

/** `POST /records` — create records (JSON batch) -> 202 + run_id. Stubbed: F0.5 does
 *  not simulate ingestion; it acknowledges and points at the scripted batch run. */
export async function POST(request: NextRequest) {
  await simulateLatency(request, "read");
  return jsonResponse(request, { run_id: "run_batch_in_flight" }, { status: 202 });
}
