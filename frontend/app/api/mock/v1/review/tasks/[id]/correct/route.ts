import { NextRequest } from "next/server";
import { applyCorrect, findOpenTask } from "@/mocks/server/review-actions";
import { jsonResponse, problemResponse, simulateLatency } from "@/mocks/server/respond";

/** `POST /review/tasks/{id}/correct` — `{ value, reason }` -> new `HUMAN` value
 *  supersedes (docs/api.md §Review). */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await simulateLatency(request, "decision");
  const { id } = await params;
  const lookup = findOpenTask(id);
  if (!lookup.ok) {
    return problemResponse(request, {
      status: lookup.reason === "task_not_found" ? 404 : 409,
      title: "Cannot correct",
      detail: lookup.reason,
      code: lookup.reason.toUpperCase(),
    });
  }
  const body = (await request.json().catch(() => ({}))) as { value?: string; reason?: string };
  if (!body.value) {
    return problemResponse(request, {
      status: 422,
      title: "Validation failed",
      detail: "Body must include 'value'.",
      code: "VALIDATION_FAILED",
    });
  }
  applyCorrect(lookup.task, lookup.av, body.value, body.reason ?? "Reviewer correction");
  return jsonResponse(request, { task: lookup.task, attribute_value: lookup.av });
}
