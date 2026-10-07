function parseAllowedUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error("Enter a valid API address.");
  }
  const local = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && local)) {
    throw new Error("Use HTTPS. HTTP is allowed only for localhost or 127.0.0.1.");
  }
  if (parsed.username || parsed.password) {
    throw new Error("The address must not contain a username or password.");
  }
  return parsed;
}

export function normalizeBaseUrl(value: string): string {
  const parsed = parseAllowedUrl(value);
  // Detect empty query/fragment delimiters too; URL.search/hash hide them.
  if (parsed.href.includes("?") || parsed.href.includes("#")) {
    throw new Error("The API address must not contain a query string or fragment.");
  }
  return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
}

export function validateImageUrl(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("SilentFlow did not return a valid HTTPS image URL.");
  }
  try {
    return parseAllowedUrl(value).href;
  } catch {
    throw new Error("SilentFlow did not return a valid HTTPS image URL.");
  }
}
