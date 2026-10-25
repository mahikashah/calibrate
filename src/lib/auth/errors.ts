/** Thrown when a request needs a signed-in student but has no valid session. */
export class UnauthorizedError extends Error {
  constructor(message = "Please sign in to continue.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}
