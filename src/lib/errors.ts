export const PRICING_URL = "https://slnt.dev/#pricing";

function parseBody(body: unknown): Record<string, unknown> {
  if (typeof body === "string") {
    try { return parseBody(JSON.parse(body)); } catch { return {}; }
  }
  return body !== null && typeof body === "object" ? body as Record<string, unknown> : {};
}

export function describeError(status: number | undefined, body: unknown, fallback: string): string {
  const parsed = parseBody(body);
  const detail = typeof parsed.detail === "string" && parsed.detail.trim()
    ? parsed.detail.trim()
    : typeof parsed.error === "string" ? parsed.error.trim() : "";
  if (!status || status < 100) return "Could not reach SilentFlow. Check your network connection.";
  if (status === 401) return "API key is invalid or revoked. Check it in the plugin settings.";
  if (status === 403 && parsed.code === "storage_quota_exceeded") {
    return `Storage is full. Free up space or upgrade at ${PRICING_URL}`;
  }
  if (status === 413) return `Image is larger than your plan allows.${detail ? ` ${detail}` : ""}`;
  if ((status === 400 || status === 415) &&
      ["invalid_file_type", "unsupported_file_type", "unsupported_product"].includes(String(parsed.code))) {
    return "This file type is not supported.";
  }
  if (status === 429) return "Too many requests. Try again in a moment.";
  return detail || fallback || `Upload failed (HTTP ${status}).`;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Upload failed. Try again.";
}
