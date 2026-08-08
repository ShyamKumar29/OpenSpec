import { NextRequest } from "next/server";
import { noContentResponse, simulateLatency } from "@/mocks/server/respond";

/** `DELETE /records/{id}/bindings/{binding_id}` — soft detach (docs/api.md §Documents).
 *  Stubbed: acknowledges only (INV-8 — a real implementation soft-deletes, never hard). */
export async function DELETE(request: NextRequest) {
  await simulateLatency(request, "decision");
  return noContentResponse(request);
}
