import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { jsonResponse, notFound, simulateLatency } from "@/mocks/server/respond";

/** `GET /records/{id}` — docs/api.md §Records. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await simulateLatency(request, "read");
  const { id } = await params;
  const detail = getStore().recordDetails.get(id);
  if (!detail) return notFound(request, "Record", id);
  return jsonResponse(request, detail);
}

/** `PATCH /records/{id}/class` lives at its own route; this file only handles GET. */
