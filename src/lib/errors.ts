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
  if (!status || status < 100) return "连不上 SilentFlow。请检查网络。";
  if (status === 401) return "API 密钥无效或已被撤销。请在插件设置里检查。";
  if (status === 403 && parsed.code === "storage_quota_exceeded") {
    return `存储空间已满。请删除一些图片，或前往 ${PRICING_URL} 升级。`;
  }
  if (status === 413) return `图片超过当前套餐的大小限制。${detail ? ` ${detail}` : ""}`;
  if ((status === 400 || status === 415) &&
      ["invalid_file_type", "unsupported_file_type", "unsupported_product"].includes(String(parsed.code))) {
    return "不支持这种文件类型。";
  }
  if (status === 429) return "请求太频繁，请稍后再试。";
  return detail || fallback || `上传失败（HTTP ${status}）。`;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "上传失败，请重试。";
}
