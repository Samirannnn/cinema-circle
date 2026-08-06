import { describe, expect, it } from "vitest";
import { sanitizeText, isValidStreamUrl, sanitizeRoomCode } from "./sanitizer";

describe("sanitizer utility", () => {
  it("escapes HTML tags to prevent XSS", () => {
    const raw = "<script>alert('xss')</script>";
    const cleaned = sanitizeText(raw);
    expect(cleaned).not.toContain("<script>");
    expect(cleaned).toContain("&lt;script&gt;");
  });

  it("validates stream URLs", () => {
    expect(isValidStreamUrl("https://example.com/stream.m3u8")).toBe(true);
    expect(isValidStreamUrl("http://example.com/video.mp4")).toBe(true);
    expect(isValidStreamUrl("javascript:alert(1)")).toBe(false);
  });

  it("sanitizes room codes", () => {
    expect(sanitizeRoomCode(" abc-123! ")).toBe("ABC123");
  });
});
