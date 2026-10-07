import { describe, expect, it } from "vitest";
import { formatBytes, formatLimit, formatUsage } from "../src/lib/format";

describe("format", () => {
  it.each([
    [0, "0 B"], [-1, "0 B"], [NaN, "0 B"], [1, "1 B"], [1023, "1023 B"],
    [1024, "1.00 KB"], [1536, "1.50 KB"], [1024 ** 2, "1.00 MB"],
    [1024 ** 3, "1.00 GB"], [1024 ** 4, "1.00 TB"]
  ])("formats %s as %s", (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
  it("renders null and the server's Unlimited string consistently", () => {
    expect(formatLimit(null)).toBe("unlimited");
    expect(formatLimit("Unlimited")).toBe("unlimited");
    expect(formatLimit(1024)).toBe("1.00 KB");
  });
  it("formats full usage including percentage and reset date", () => {
    expect(formatUsage({
      storage: { used: 1024, limit: null, percent: 1 },
      traffic: { used: 1024 ** 2, limit: "Unlimited", reset_date: "Next Month 1st" }
    })).toBe("Storage: 1.00 KB / unlimited (1%)\nTraffic: 1.00 MB / unlimited\nTraffic resets: Next Month 1st");
  });
  it("does not duplicate a server percentage suffix", () => {
    expect(formatUsage({
      storage: { used: 0, limit: 1024, percent: "0.00%" },
      traffic: { used: 0, limit: null, reset_date: "2026-04-01" }
    })).toContain("(0.00%)");
  });
});
