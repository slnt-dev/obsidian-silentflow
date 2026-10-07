import { describe, expect, it } from "vitest";
import { normalizeBaseUrl, validateImageUrl } from "../src/lib/url";

describe("normalizeBaseUrl", () => {
  it("accepts HTTPS and removes trailing slashes", () => {
    expect(normalizeBaseUrl(" https://slnt.dev/api/// ")).toBe("https://slnt.dev/api");
    expect(normalizeBaseUrl("https://slnt.dev/")).toBe("https://slnt.dev");
  });
  it.each(["http://localhost:4312/", "http://127.0.0.1:4312/"])("allows local HTTP: %s", (url) => {
    expect(normalizeBaseUrl(url)).toBe(url.slice(0, -1));
  });
  it.each([
    "http://slnt.dev", "http://localhost.example.com", "ftp://localhost", "not a url",
    "https://user:password@slnt.dev", "https://user@slnt.dev", "https://slnt.dev?x=1",
    "https://slnt.dev#section", "https://slnt.dev?", "https://slnt.dev#"
  ])("rejects disallowed address: %s", (url) => {
    expect(() => normalizeBaseUrl(url)).toThrow();
  });
});

describe("validateImageUrl", () => {
  it.each(["https://cdn.example.com/a.png", "http://localhost:123/img.png", "http://127.0.0.1:123/img.png"])("accepts allowed image URL: %s", (url) => {
    expect(validateImageUrl(url)).toBe(url);
  });
  it.each([undefined, null, 12, "/img.png", "http://cdn.example.com/img.png", "javascript:alert(1)", "data:image/png;base64,AA", "https://user:password@example.com/a.png"])("rejects invalid image URL: %s", (url) => {
    expect(() => validateImageUrl(url)).toThrow("valid HTTPS image URL");
  });
});
