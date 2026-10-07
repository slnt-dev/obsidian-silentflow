export interface Quota {
  used: number;
  limit: number | null;
  percent: string | number;
}

export interface Usage {
  storage: Quota;
  traffic: { used: number; limit: number | null | "Unlimited"; reset_date: string };
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.max(0, Math.floor(Math.log(bytes) / Math.log(1024))), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export function formatLimit(limit: number | null | "Unlimited"): string {
  return typeof limit === "number" ? formatBytes(limit) : "unlimited";
}

export function formatUsage(usage: Usage): string {
  const percent = String(usage.storage.percent);
  return `Storage: ${formatBytes(usage.storage.used)} / ${formatLimit(usage.storage.limit)} (${percent.endsWith("%") ? percent : `${percent}%`})\n` +
    `Traffic: ${formatBytes(usage.traffic.used)} / ${formatLimit(usage.traffic.limit)}\n` +
    `Traffic resets: ${usage.traffic.reset_date}`;
}
