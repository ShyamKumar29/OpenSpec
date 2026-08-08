import { NextRequest } from "next/server";
import { jsonResponse, simulateLatency } from "@/mocks/server/respond";

/** `GET /export/{id}` — status + download link + validation report (docs/api.md §Export). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await simulateLatency(request, "read");
  const { id } = await params;
  return jsonResponse(request, {
    id,
    status: "completed",
    download_url: `/api/mock/v1/export/${id}/download`,
    row_count: 240,
    validation_report: { valid: true, warnings: [] },
  });
}
