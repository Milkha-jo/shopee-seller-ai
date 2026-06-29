import { describe, it, expect } from "vitest";
import { ApiError } from "@/services/api";

describe("ApiError", () => {
  it("carries status, code, message and details", () => {
    const e = new ApiError(404, "NOT_FOUND", "missing", { id: 1 });
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(404);
    expect(e.code).toBe("NOT_FOUND");
    expect(e.message).toBe("missing");
    expect(e.details).toEqual({ id: 1 });
    expect(e.name).toBe("ApiError");
  });
});
