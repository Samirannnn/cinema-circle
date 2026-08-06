import { describe, expect, it } from "vitest";
import { isRateLimited } from "./rate-limiter";

describe("rate-limiter utility", () => {
  it("allows calls under threshold", () => {
    const key = "test-user-1";
    expect(isRateLimited(key, 3, 1000)).toBe(false);
    expect(isRateLimited(key, 3, 1000)).toBe(false);
    expect(isRateLimited(key, 3, 1000)).toBe(false);
  });

  it("blocks calls exceeding threshold", () => {
    const key = "test-user-2";
    isRateLimited(key, 2, 1000);
    isRateLimited(key, 2, 1000);
    expect(isRateLimited(key, 2, 1000)).toBe(true);
  });
});
