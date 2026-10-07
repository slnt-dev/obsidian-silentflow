let sequence = 0;

export function createPlaceholder(): string {
  const random = new Uint8Array(8);
  crypto.getRandomValues(random);
  const id = Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `![Uploading silentflow-${id}-${++sequence}]()`;
}

export interface ReplacementRange {
  from: number;
  to: number;
  replacement: string;
}

export function findPlaceholderReplacement(
  content: string,
  placeholder: string,
  replacement: string
): ReplacementRange | null {
  const from = content.indexOf(placeholder);
  return from < 0 ? null : { from, to: from + placeholder.length, replacement };
}

export function imageAlt(filename: string, useFileName: boolean, pasted: boolean): string {
  if (!useFileName) return "";
  let name = filename.trim().replace(/[\r\n]/g, "").replace(/\.[^.]+$/, "");
  if (pasted && /^image(?:[- ]?\d+|\s*\(\d+\))?$/i.test(name)) name = "pasted-image";
  return name.replace(/\\/g, "\\\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}

export function uploadFilename(filename: string, mimeType: string, timestamp = Date.now()): string {
  if (filename.trim() && !/[\x00-\x1f\x7f/\\]/.test(filename)) return filename;
  const extensions: Record<string, string> = {
    "image/png": "png", "image/jpeg": "jpg", "image/gif": "gif", "image/webp": "webp",
    "image/avif": "avif", "image/bmp": "bmp", "image/svg+xml": "svg", "image/tiff": "tiff",
    "image/x-icon": "ico", "image/heic": "heic", "image/heif": "heif"
  };
  return `image-${timestamp}.${extensions[mimeType.toLowerCase()] || "img"}`;
}

export function imageMarkdown(alt: string, url: string): string {
  // URL punctuation must not terminate the Markdown destination.
  const destination = url.replace(/[()<>\s\\]/g, (char) =>
    char === "(" ? "%28" : char === ")" ? "%29" : encodeURIComponent(char));
  return `![${alt}](${destination})`;
}
