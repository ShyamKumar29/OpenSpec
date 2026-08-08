import { NextRequest } from "next/server";
import { jsonResponse, simulateLatency } from "@/mocks/server/respond";

/** `GET /export/targets` — available adapters (docs/api.md §Export). */
export async function GET(request: NextRequest) {
  await simulateLatency(request, "read");
  return jsonResponse(request, {
    targets: [
      { code: "csv", name: "CSV" },
      { code: "json", name: "JSON" },
      { code: "xlsx", name: "Excel (XLSX)" },
      { code: "cx1", name: "CX1 (ADR-0010)" },
    ],
  });
}
