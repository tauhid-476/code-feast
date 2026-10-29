/**
 * One error type for refusals the UI should show as-is. Domain modules throw
 * these; the page/action layer turns them into a banner or an HTTP status.
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError;
}

/**
 * Server Actions return `{ error }` instead of throwing across the boundary.
 * The `code` rides along so a client can tell a refusal it must explain (a
 * takeover, `session_superseded`) from one it should refresh into (a lockout).
 */
export function actionError(error: unknown): { error: string; code?: string } {
  if (isDomainError(error)) return { error: error.message, code: error.code };
  console.error(error);
  return { error: "Something went wrong. Try again." };
}
