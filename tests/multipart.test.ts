import { describe, expect, it } from "vitest";
import { buildMultipart } from "../src/lib/multipart";

describe("buildMultipart", () => {
  const binary = new Uint8Array([0x00, 0xff, 0x0d, 0x0a, 0x80, 0x41]);
  it("builds correctly framed multipart headers and closing boundary", () => {
    const result = buildMultipart("file", "photo.png", "image/png", binary.buffer);
    const boundary = result.contentType.split("boundary=")[1]!;
    const text = new TextDecoder().decode(result.body);
    expect(result.contentType).toMatch(/^multipart\/form-data; boundary=silentflow-[a-f0-9]{32}$/);
    expect(text.startsWith(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="photo.png"\r\nContent-Type: image/png\r\n\r\n`)).toBe(true);
    expect(text.endsWith(`\r\n--${boundary}--\r\n`)).toBe(true);
  });
  it("generates a unique random boundary for each body", () => {
    const boundaries = Array.from({ length: 100 }, () => buildMultipart("file", "x", "image/png", binary.buffer).contentType);
    expect(new Set(boundaries).size).toBe(100);
  });
  it("cleans line breaks and escapes quotes in filenames", () => {
    const result = buildMultipart("file", 'bad"\r\nInjected.png', "image/png", binary.buffer);
    const head = new TextDecoder().decode(result.body).split("\r\n\r\n")[0]!;
    expect(head).toContain('filename="bad%22Injected.png"');
    expect(head.split("\r\n")).toHaveLength(3);
  });
  it("preserves every binary byte including NUL, FF and CRLF", () => {
    const result = buildMultipart("file", "x.png", "image/png", binary.buffer);
    const body = Buffer.from(result.body);
    const start = body.indexOf(Buffer.from("\r\n\r\n")) + 4;
    expect([...body.subarray(start, start + binary.length)]).toEqual([...binary]);
    expect(body.subarray(start + binary.length, start + binary.length + 2).toString()).toBe("\r\n");
  });
  it("blocks header injection through field names and MIME types", () => {
    const result = buildMultipart('fi"\r\neld', "x.png", "image/png\r\nX-Test: x", new ArrayBuffer(0));
    const text = new TextDecoder().decode(result.body);
    expect(text).toContain('name="fi%22eld"');
    expect(text).not.toContain("\r\nX-Test:");
  });
});
