import { buildMultipart } from "./lib/multipart";
import { describeError } from "./lib/errors";
import { normalizeBaseUrl, validateImageUrl } from "./lib/url";
import type { Quota, Usage } from "./lib/format";

export interface RequestOptions {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: ArrayBuffer;
  throw: false;
}

export interface RequestResponse {
  status: number;
  text: string;
}

export type RequestFn = (options: RequestOptions) => Promise<RequestResponse>;
export interface ApiConfig { baseUrl: string; apiKey: string }
export interface UploadResult { url: string; key: string; product: "images"; usage: Quota }

export class SilentFlowApi {
  constructor(private readonly requestFn: RequestFn) {}

  private async request(config: ApiConfig, path: string, multipart?: ReturnType<typeof buildMultipart>): Promise<unknown> {
    const baseUrl = normalizeBaseUrl(config.baseUrl);
    const apiKey = config.apiKey.trim();
    if (!apiKey) throw new Error("Add your API key in the plugin settings.");
    let response: RequestResponse;
    try {
      response = await this.requestFn({
        url: `${baseUrl}${path}`,
        method: multipart ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
          ...(multipart ? { "Content-Type": multipart.contentType } : {})
        },
        ...(multipart ? { body: multipart.body } : {}),
        throw: false
      });
    } catch {
      // Never expose request errors, which may contain credentials or headers.
      throw new Error(describeError(undefined, null, ""));
    }
    if (response.status < 200 || response.status >= 300) {
      throw new Error(describeError(response.status, response.text, ""));
    }
    try {
      return JSON.parse(response.text) as unknown;
    } catch {
      throw new Error("SilentFlow returned an invalid JSON response. Try again.");
    }
  }

  async upload(config: ApiConfig, filename: string, mimeType: string, data: ArrayBuffer): Promise<UploadResult> {
    const result = await this.request(config, "/v1/files", buildMultipart("file", filename, mimeType, data));
    const url = validateImageUrl((result as Partial<UploadResult> | null)?.url);
    return { ...(result as UploadResult), url };
  }

  async checkUsage(config: ApiConfig): Promise<Usage> {
    const result = await this.request(config, "/v1/usage") as Partial<Usage> | null;
    const quota = result?.storage;
    const traffic = result?.traffic;
    const validNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
    const validLimit = (value: unknown) => value === null || validNumber(value);
    if (!quota || !traffic || !validNumber(quota.used) || !validLimit(quota.limit) ||
        !(typeof quota.percent === "string" || typeof quota.percent === "number") ||
        !validNumber(traffic.used) || !(validLimit(traffic.limit) || traffic.limit === "Unlimited") ||
        typeof traffic.reset_date !== "string") {
      throw new Error("SilentFlow returned invalid usage data. Try again.");
    }
    return result as Usage;
  }
}
