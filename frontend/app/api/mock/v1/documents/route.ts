import { NextRequest } from "next/server";
import { getStore } from "@/mocks/fixtures/store";
import { jsonResponse, paginate, simulateLatency } from "@/mocks/server/respond";

/** `GET /documents` — corpus list. Filters: publisher, bound_count, parse_status
 *  (docs/api.md §Documents). */
export async function GET(request: NextRequest) {
  await simulateLatency(request, "read");
  const params = request.nextUrl.searchParams;
  let items = getStore().documents as {
    publisher: string;
    bound_record_count: number;
    parse_status: string;
  }[];

  const publisher = params.get("publisher");
  if (publisher) items = items.filter((d) => d.publisher === publisher);

  const parseStatus = params.get("parse_status");
  if (parseStatus) items = items.filter((d) => d.parse_status === parseStatus);

  const boundCount = params.get("bound_count");
  if (boundCount === "0") items = items.filter((d) => d.bound_record_count === 0);
  else if (boundCount === "gt0") items = items.filter((d) => d.bound_record_count > 0);

  return jsonResponse(request, paginate(items, request));
}

/** `POST /documents` — upload a PDF -> document_version_id (docs/api.md §Documents).
 *  Stubbed: acknowledges without parsing/rasterising an upload — real ingestion is a
 *  backend concern (ADR-0005, ADR-0012). */
export async function POST(request: NextRequest) {
  await simulateLatency(request, "read");
  return jsonResponse(
    request,
    { document_version_id: `docver_upload_${Date.now().toString(36)}` },
    { status: 201 },
  );
}
