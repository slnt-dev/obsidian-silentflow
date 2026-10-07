import { createServer, request as httpRequest, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SilentFlowApi, type RequestFn } from "../src/api";

const usage = {
  storage: { used: 512, limit: 524288000, percent: "0.00%" },
  traffic: { used: 1024, limit: "Unlimited", reset_date: "Next Month 1st" }
};

// A Node-only transport for tests. Production wraps Obsidian requestUrl.
const localRequest: RequestFn = (options) => new Promise((resolve, reject) => {
  const url = new URL(options.url);
  if (url.hostname !== "127.0.0.1") return reject(new Error("Only local test servers are allowed."));
  const request = httpRequest(url, { method: options.method, headers: options.headers }, (response) => {
    const chunks: Buffer[] = [];
    response.on("data", (chunk: Buffer) => chunks.push(chunk));
    response.on("end", () => resolve({ status: response.statusCode!, text: Buffer.concat(chunks).toString("utf8") }));
  });
  request.on("error", reject);
  if (options.body) request.write(Buffer.from(options.body));
  request.end();
});

describe("API against a local HTTP server", () => {
  let server: Server;
  let baseUrl: string;
  let failure = 0;
  let invalidUrl = false;
  let receivedBytes: Buffer;
  let receivedAuthorization: string | undefined;
  let receivedAccept: string | undefined;
  let multipartHeader: string;
  let receivedPath: string | undefined;
  const api = new SilentFlowApi(localRequest);
  const data = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff, 0x0d, 0x0a, 0x80]);

  beforeAll(async () => {
    server = createServer(async (request, response) => {
      receivedAuthorization = request.headers.authorization;
      receivedAccept = request.headers.accept;
      receivedPath = request.url;
      response.setHeader("Content-Type", "application/json");
      if (receivedAuthorization !== "Bearer sk_test_fake" || failure === 401) {
        response.writeHead(401).end(JSON.stringify({ code: "unauthorized", detail: "The credential is invalid or revoked." }));
        return;
      }
      if (failure === 403 || failure === 413) {
        response.writeHead(failure).end(JSON.stringify(failure === 403
          ? { code: "storage_quota_exceeded", detail: "Storage quota exceeded." }
          : { code: "file_size_invalid", detail: "File size must be between 1 byte and 2097152 bytes." }));
        return;
      }
      if (request.method === "GET" && request.url === "/v1/usage") {
        response.end(JSON.stringify(usage));
        return;
      }
      if (request.method === "POST" && request.url === "/v1/files") {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk as Buffer));
        const body = Buffer.concat(chunks);
        const boundary = /boundary=([^;]+)/.exec(request.headers["content-type"] || "")?.[1];
        if (!boundary) { response.writeHead(400).end('{}'); return; }
        const separator = body.indexOf(Buffer.from("\r\n\r\n"));
        multipartHeader = body.subarray(0, separator).toString("utf8");
        const closing = Buffer.from(`\r\n--${boundary}--\r\n`);
        if (separator < 0 || !body.subarray(-closing.length).equals(closing) ||
            !multipartHeader.includes('name="file"')) {
          response.writeHead(400).end('{}'); return;
        }
        receivedBytes = body.subarray(separator + 4, body.length - closing.length);
        response.end(JSON.stringify({
          url: invalidUrl ? "http://example.com/x.png" : `${baseUrl}/img/x.png`,
          key: "x.png", product: "images", usage: usage.storage
        }));
        return;
      }
      response.writeHead(404).end('{}');
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  beforeEach(() => { failure = 0; invalidUrl = false; });
  afterAll(async () => { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); });

  const upload = (apiKey = "sk_test_fake") => api.upload({ baseUrl, apiKey }, "test.png", "image/png", data.buffer);

  it("uploads exact binary bytes with Bearer authorization and multipart metadata", async () => {
    const result = await upload();
    expect(result).toEqual({ url: `${baseUrl}/img/x.png`, key: "x.png", product: "images", usage: usage.storage });
    expect(receivedAuthorization).toBe("Bearer sk_test_fake");
    expect(receivedAccept).toBe("application/json");
    expect(receivedPath).toBe("/v1/files");
    expect(multipartHeader).toContain('filename="test.png"');
    expect(multipartHeader).toContain("Content-Type: image/png");
    expect([...receivedBytes]).toEqual([...data]);
  });
  it("gets usage with Bearer authorization and preserves Unlimited", async () => {
    expect(await api.checkUsage({ baseUrl, apiKey: "sk_test_fake" })).toEqual(usage);
    expect(receivedAuthorization).toBe("Bearer sk_test_fake");
    expect(receivedPath).toBe("/v1/usage");
  });
  it("maps server 401 upload responses", async () => {
    await expect(upload("sk_wrong_fake")).rejects.toThrow("API key is invalid or revoked. Check it in the plugin settings.");
  });
  it("maps server 403 storage quota responses", async () => {
    failure = 403;
    await expect(upload()).rejects.toThrow("Storage is full. Free up space or upgrade at https://slnt.dev/#pricing");
  });
  it("maps server 413 responses including detail", async () => {
    failure = 413;
    await expect(upload()).rejects.toThrow("Image is larger than your plan allows. File size must be between 1 byte and 2097152 bytes.");
  });
  it("maps server errors on usage too", async () => {
    failure = 401;
    await expect(api.checkUsage({ baseUrl, apiKey: "sk_test_fake" })).rejects.toThrow("API key is invalid or revoked.");
  });
  it("rejects an insecure remote URL returned by a successful upload", async () => {
    invalidUrl = true;
    await expect(upload()).rejects.toThrow("valid HTTPS image URL");
  });
});

describe("API validation and transport failures", () => {
  const data = new ArrayBuffer(1);
  const config = { baseUrl: "http://127.0.0.1:1", apiKey: "sk_test_fake" };
  it("does not request invalid addresses or missing credentials", async () => {
    const request = vi.fn<RequestFn>();
    const api = new SilentFlowApi(request);
    await expect(api.upload({ ...config, baseUrl: "http://remote.example.com" }, "x", "image/png", data)).rejects.toThrow("HTTPS");
    await expect(api.checkUsage({ ...config, apiKey: "" })).rejects.toThrow("Add your API key");
    expect(request).not.toHaveBeenCalled();
  });
  it("hides transport exception text and returns the network explanation", async () => {
    const api = new SilentFlowApi(async () => { throw new Error("Transport included fake request headers"); });
    await expect(api.checkUsage(config)).rejects.toThrow("Could not reach SilentFlow. Check your network connection.");
  });
  it("handles invalid JSON and missing upload URLs", async () => {
    const api = new SilentFlowApi(async () => ({ status: 200, text: "bad json" }));
    await expect(api.checkUsage(config)).rejects.toThrow("invalid JSON response");
    const missingUrl = new SilentFlowApi(async () => ({ status: 200, text: "{}" }));
    await expect(missingUrl.upload(config, "x", "image/png", data)).rejects.toThrow("valid HTTPS image URL");
  });
  it("accepts null limits and rejects malformed usage", async () => {
    const valid = { storage: { used: 0, limit: null, percent: 0 }, traffic: { used: 0, limit: null, reset_date: "Tomorrow" } };
    const api = new SilentFlowApi(async () => ({ status: 200, text: JSON.stringify(valid) }));
    expect(await api.checkUsage(config)).toEqual(valid);
    const malformed = new SilentFlowApi(async () => ({ status: 200, text: "{}" }));
    await expect(malformed.checkUsage(config)).rejects.toThrow("invalid usage data");
  });
});
