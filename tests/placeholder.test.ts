import { describe, expect, it } from "vitest";
import { createPlaceholder, findPlaceholderReplacement, imageAlt, imageMarkdown, uploadFilename } from "../src/lib/placeholder";

function replace(content: string, placeholder: string, replacement: string): string | null {
  const range = findPlaceholderReplacement(content, placeholder, replacement);
  return range ? content.slice(0, range.from) + range.replacement + content.slice(range.to) : null;
}

describe("placeholders", () => {
  it("creates unique placeholders with safe Markdown text", () => {
    const values = Array.from({ length: 100 }, createPlaceholder);
    expect(new Set(values).size).toBe(100);
    expect(values[0]).toMatch(/^!\[Uploading silentflow-[a-f0-9]+-\d+\]\(\)$/);
  });
  it("locates placeholders after edits before and after them", () => {
    const placeholder = createPlaceholder();
    const content = `New intro\nOriginal before ${placeholder} original after\nNew ending`;
    expect(replace(content, placeholder, "![](https://example.com/x.png)"))
      .toBe("New intro\nOriginal before ![](https://example.com/x.png) original after\nNew ending");
  });
  it("returns not found when the placeholder was deleted", () => {
    expect(findPlaceholderReplacement("user deleted it", createPlaceholder(), "replacement")).toBeNull();
  });
  it("replaces multiple placeholders independently in any completion order", () => {
    const first = createPlaceholder();
    const second = createPlaceholder();
    const content = `A${first}\nB${second}C`;
    const afterSecond = replace(content, second, "second")!;
    expect(afterSecond).toContain(first);
    expect(replace(afterSecond, first, "first")).toBe("Afirst\nBsecondC");
  });
  it("supports deletion on failed uploads", () => {
    const placeholder = createPlaceholder();
    expect(replace(`before${placeholder}after`, placeholder, "")).toBe("beforeafter");
  });
});

describe("file names and Markdown", () => {
  it("keeps alt empty by default", () => {
    expect(imageAlt("photo.png", false, false)).toBe("");
  });
  it("strips only the extension and escapes brackets and backslashes", () => {
    expect(imageAlt("a.b[1]\\x.png", true, false)).toBe("a.b\\[1\\]\\\\x");
  });
  it("uses pasted-image only for generic clipboard file names", () => {
    expect(imageAlt("image.png", true, true)).toBe("pasted-image");
    expect(imageAlt("image (1).png", true, true)).toBe("pasted-image");
    expect(imageAlt("holiday.png", true, true)).toBe("holiday");
    expect(imageAlt("image.png", true, false)).toBe("image");
  });
  it("preserves valid names and generates MIME-based names for invalid ones", () => {
    expect(uploadFilename("photo.png", "image/png", 42)).toBe("photo.png");
    expect(uploadFilename("", "image/jpeg", 42)).toBe("image-42.jpg");
    expect(uploadFilename("bad\r\n.png", "image/svg+xml", 42)).toBe("image-42.svg");
    expect(uploadFilename("../bad", "image/avif", 42)).toBe("image-42.avif");
    expect(uploadFilename("", "image/unknown", 42)).toBe("image-42.img");
  });
  it("encodes URL punctuation that could break a Markdown destination", () => {
    expect(imageMarkdown("", "https://example.com/a(b).png")).toBe("![](https://example.com/a%28b%29.png)");
  });
});
