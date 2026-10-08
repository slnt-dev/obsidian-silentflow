function parseAllowedUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("请输入有效的 API 地址。");
  }
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) {
    throw new Error("请使用 HTTPS。只有 localhost 或 127.0.0.1 可以使用 HTTP。");
  }
  if (parsed.username || parsed.password) {
    throw new Error("地址里不能包含用户名或密码。");
  }
  return parsed;
}

export function normalizeBaseUrl(value: string): string {
  const parsed = parseAllowedUrl(value);
  // Detect empty query/fragment delimiters too; URL.search/hash hide them.
  if (parsed.href.includes("?") || parsed.href.includes("#")) {
    throw new Error("API 地址不能包含查询参数或片段。");
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

export function validateImageUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("SilentFlow 没有返回有效的 HTTPS 图片地址。");
  }
  try {
    return parseAllowedUrl(value).href;
  } catch {
    throw new Error("SilentFlow 没有返回有效的 HTTPS 图片地址。");
  }
}
