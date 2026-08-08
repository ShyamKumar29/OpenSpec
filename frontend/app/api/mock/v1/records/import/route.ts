import { NextRequest } from "next/server";
import { jsonResponse, simulateLatency } from "@/mocks/server/respond";

/** `POST /records/import` — multipart CSV/XLSX upload + column mapping -> 202 + batch_id
 *  (docs/api.md §Records). Stubbed: acknowledges without parsing the upload — `/import`
 *  is full scope in F6. */
export async function POST(request: NextRequest) {
  await simulateLatency(request, "read");
  return jsonResponse(request, { batch_id: "batch_demo_001" }, { status: 202 });
}
