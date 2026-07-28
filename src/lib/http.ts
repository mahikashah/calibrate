import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Wrap a route handler so thrown errors become clean JSON responses. */
export function handle(fn: () => Promise<Response>): Promise<Response> {
  return fn().catch((err) => {
    if (err instanceof ZodError) {
      return fail(err.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "), 422);
    }
    console.error("[api] unhandled error:", err);
    return fail((err as Error).message || "Internal error", 500);
  });
}
