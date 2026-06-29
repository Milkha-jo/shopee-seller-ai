import { NextResponse } from "next/server";
import { type CalcError, type Result, isErr } from "@core/errors";
import { HttpError, fromCalcError } from "@apihttp/errors";

// Same JSON envelope the frontend already expects: success `{ data }`,
// failure `{ error: { code, message, details? } }`. Reuses the API package's
// HttpError + fromCalcError so status codes and bodies are identical.

export function data(body: unknown, status = 200): NextResponse {
  return NextResponse.json({ data: body }, { status });
}

/** Unwrap a service Result, throwing a 400 HttpError on a CalcError. */
export function take<T>(result: Result<T, CalcError>): T {
  if (isErr(result)) throw fromCalcError(result.error);
  return result.value;
}

/** Run a route body, mapping HttpError (and unexpected errors) to the envelope. */
export async function handle(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof HttpError) {
      return NextResponse.json({ error: e.body() }, { status: e.status });
    }
    console.error("[api] unhandled error", e);
    return NextResponse.json(
      { error: { code: "INTERNAL", message: "internal server error" } },
      { status: 500 },
    );
  }
}
