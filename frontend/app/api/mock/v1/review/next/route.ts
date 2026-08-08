import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { jsonResponse, problemResponse, simulateLatency } from "@/mocks/server/respond";

/** `GET /review/next` — claim the next task, supports `?reason_code=`
 *  (docs/api.md §Review). Prefetched by the review queue so the reviewer never sees its
 *  latency (docs/14-frontend-implementation-plan.md §4.3). Does not mutate task state in
 *  the mock — repeated calls are idempotent, which keeps manual testing predictable. */
export async function GET(request: NextRequest) {
  await simulateLatency(request, "next");
  const reasonCode = request.nextUrl.searchParams.get("reason_code");
  const tasks = getStore().reviewTasks as { state: string; reason_code: string }[];
  const open = tasks.filter(
    (t) => t.state === "open" && (!reasonCode || t.reason_code === reasonCode),
  );
  if (open.length === 0) {
    return problemResponse(request, {
      status: 404,
      title: "No open tasks",
      detail: reasonCode
        ? `No open tasks for reason_code '${reasonCode}'.`
        : "The review queue is empty.",
      code: "NOT_FOUND",
    });
  }
  return jsonResponse(request, open[0]);
}
