import { describe, expect, it } from "vitest";
import { describeError, errorMessage, PRICING_URL } from "../src/lib/errors";

describe("describeError", () => {
  it("maps 401 regardless of server detail", () => {
    expect(describeError(401, { detail: "Invalid token" }, "")).toBe("API key is invalid or revoked. Check it in the plugin settings.");
  });
  it("maps storage quota to the verified pricing anchor", () => {
    expect(describeError(403, { code: "storage_quota_exceeded" }, "")).toBe(`Storage is full. Free up space or upgrade at ${PRICING_URL}`);
    expect(PRICING_URL).toBe("https://slnt.dev/#pricing");
  });
  it("preserves other 403 explanations", () => {
    expect(describeError(403, { code: "product_required", detail: "Subscribe to images." }, "")).toBe("Subscribe to images.");
  });
  it("appends server detail to 413", () => {
    expect(describeError(413, { detail: "Limit: 2097152 bytes." }, "")).toBe("Image is larger than your plan allows. Limit: 2097152 bytes.");
    expect(describeError(413, {}, "")).toBe("Image is larger than your plan allows.");
  });
  it.each([400, 415])("maps file-type errors for HTTP %i", (status) => {
    for (const code of ["invalid_file_type", "unsupported_file_type", "unsupported_product"]) {
      expect(describeError(status, { code }, "")).toBe("This file type is not supported.");
    }
  });
  it("preserves explanations for other 400/415 codes", () => {
    expect(describeError(400, { code: "file_required", detail: "A file field is required." }, "")).toBe("A file field is required.");
    expect(describeError(415, { code: "other", error: "Other explanation." }, "")).toBe("Other explanation.");
  });
  it("maps rate limiting", () => {
    expect(describeError(429, {}, "")).toBe("Too many requests. Try again in a moment.");
  });
  it.each([undefined, 0])("maps missing responses and network errors: %s", (status) => {
    expect(describeError(status, { detail: "Unsafe transport error" }, "raw transport error")).toBe("Could not reach SilentFlow. Check your network connection.");
  });
  it("prefers detail over error and parses JSON text", () => {
    expect(describeError(500, '{"detail":" Retry later. ","error":"Wrong"}', "")).toBe("Retry later.");
    expect(describeError(502, { error: "Upstream unavailable." }, "")).toBe("Upstream unavailable.");
  });
  it("uses fallback or HTTP status when there is no explanation", () => {
    expect(describeError(500, "invalid json", "")).toBe("Upload failed (HTTP 500).");
    expect(describeError(503, null, "Try later.")).toBe("Try later.");
    expect(describeError(403, {}, "")).toBe("Upload failed (HTTP 403).");
    expect(describeError(500, { detail: 123, error: false }, "")).toBe("Upload failed (HTTP 500).");
    expect(describeError(500, "null", "")).toBe("Upload failed (HTTP 500).");
  });
  it("provides safe text for unknown errors", () => {
    expect(errorMessage(new Error("Try again."))).toBe("Try again.");
    expect(errorMessage(null)).toBe("Upload failed. Try again.");
  });
});
