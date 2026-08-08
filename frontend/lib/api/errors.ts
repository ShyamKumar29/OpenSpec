import { adaptProblemDetails, type ProblemDetails } from "@/lib/contracts/common";

/** Thrown by `apiFetch` on any non-2xx response. Carries the parsed RFC 9457 body. */
export class ApiError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail || problem.title);
    this.name = "ApiError";
    this.problem = problem;
  }
}

/** Fallback for a non-2xx response whose body isn't valid problem+json (a transport
 *  failure, not a domain error) — still typed, so callers never see a bare `unknown`. */
export function syntheticProblem(
  status: number,
  correlationId: string,
  detail: string,
): ProblemDetails {
  return {
    type: "https://openspec.dev/errors/unexpected-response",
    title: "Unexpected response",
    status,
    detail,
    code: "SYSTEM_ERROR",
    correlationId,
  };
}

export async function parseErrorResponse(
  response: Response,
  correlationId: string,
): Promise<ApiError> {
  try {
    const body = await response.json();
    return new ApiError(adaptProblemDetails(body));
  } catch {
    return new ApiError(
      syntheticProblem(
        response.status,
        correlationId,
        `Request failed with status ${response.status}`,
      ),
    );
  }
}
