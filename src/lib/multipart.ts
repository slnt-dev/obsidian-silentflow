function headerValue(value: string): string {
  return value.replace(/[\r\n]/g, "").replace(/\\/g, "\\\\").replace(/"/g, "%22");
}

export function buildMultipart(
  fieldName: string,
  filename: string,
  mimeType: string,
  data: ArrayBuffer
): { body: ArrayBuffer; contentType: string } {
  const random = new Uint8Array(16);
  crypto.getRandomValues(random);
  const boundary = `silentflow-${Array.from(random, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
  const encoder = new TextEncoder();
  const head = encoder.encode(
    `--${boundary}\r\n` +
    `Content-Disposition: form-data; name="${headerValue(fieldName)}"; filename="${headerValue(filename)}"\r\n` +
    `Content-Type: ${mimeType.replace(/[\r\n]/g, "") || "application/octet-stream"}\r\n\r\n`
  );
  const tail = encoder.encode(`\r\n--${boundary}--\r\n`);
  const body = new Uint8Array(head.length + data.byteLength + tail.length);
  body.set(head);
  body.set(new Uint8Array(data), head.length);
  body.set(tail, head.length + data.byteLength);
  return { body: body.buffer, contentType: `multipart/form-data; boundary=${boundary}` };
}
