import { NextRequest } from "next/server";
import { jsonResponse, simulateLatency } from "@/mocks/server/respond";

/** `GET /records/import/{batch_id}` — batch status, row counts, error report link
 *  (docs/api.md §Records). Stubbed with a plausible completed batch. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  await simulateLatency(request, "read");
  const { batchId } = await params;
  return jsonResponse(request, {
    id: batchId,
    status: "completed",
    row_count: 240,
    error_count: 3,
    error_report_url: `/api/mock/v1/records/import/${batchId}/errors.csv`,
  });
}
