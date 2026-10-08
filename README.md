# SilentFlow Image Host

[简体中文](README.zh-CN.md)

Upload images pasted or dropped into Obsidian to [SilentFlow](https://slnt.dev) and insert public image links as Markdown.

## Features

- Upload image files on paste or drop; each behavior can be turned off.
- Keep text-only paste and events handled by other plugins unchanged.
- Replace unique upload placeholders even when you edit the surrounding text.
- Upload up to three images concurrently.
- Optional file-name alt text, off by default.
- Check storage and traffic usage from settings or the **Check usage** command.
- Desktop and mobile support using Obsidian's `requestUrl`.

## Install

- **Community plugins:** in Obsidian, open **Settings → Community plugins → Browse**, search for **SilentFlow**, then install and enable **SilentFlow Image Host**. Listing: [community.obsidian.md/plugins/silentflow-image-host](https://community.obsidian.md/plugins/silentflow-image-host).
- **Manual:** build locally or obtain `main.js`, `manifest.json`, and `styles.css` from a release. Copy those three files into your vault's `.obsidian/plugins/silentflow-image-host/` folder. Reload Obsidian, then enable **SilentFlow Image Host** in Community plugins.

## Setup

1. [Get a free key](https://slnt.dev/free).
2. Open the plugin settings and enter your API key (`sk_…` or `sf_agent_…`).
3. Leave **API address** at `https://slnt.dev`, unless you use a different SilentFlow instance. HTTPS is required; HTTP is accepted only for `localhost` or `127.0.0.1`.
4. Optionally turn on **Use file name as alt text** or check usage.

Agent keys need `files:write` to upload and `files:read` to check usage.

## Usage

Paste or drop image files into a note editor. A temporary `![Uploading silentflow-…]()` placeholder appears and is replaced with `![](public-url)` after upload. With file-name alt text enabled, the name without its extension becomes the alt text; generic clipboard names such as `image.png` become `pasted-image`. Failures remove the placeholder and show a notice. If you delete a placeholder before upload finishes, the plugin leaves your text alone.

Without an API key, pasting images follows Obsidian's default behavior and shows a reminder once per session. Text-only paste is unaffected. Use **Check usage** in settings or in the command palette for a usage summary; no default shortcut is assigned.

Uploaded image URLs are public. Keep local backups of original images.

## Free plan

The server's free plan provides **500 MB storage**, **1 GB monthly traffic**, and a **2 MB maximum per image**. The limits use binary units: 500 × 1024², 1024³, and 2 × 1024² bytes, respectively. Account limits returned by the server take precedence. Upgrade options are on the [pricing section](https://slnt.dev/#pricing).

## Network use

The plugin contacts only the configured API address (default: `https://slnt.dev`), and only when uploading an image or checking usage.

- **Upload:** `POST /v1/files` sends image file bytes in multipart form data with the file name and MIME type, and the API key in the `Authorization: Bearer …` header.
- **Check usage:** `GET /v1/usage` sends the API key in the same Bearer header; no image or note content is sent.

The plugin makes no telemetry or advertising requests and loads no remote code. Documentation and settings links open only when you choose to follow them.

## Privacy

Settings, including your API key, are stored **in plain text** in the plugin's `data.json` inside your vault. The key is not encrypted. Protect access to your vault and account for any vault backup or sync that includes plugin settings. The plugin does not log the API key or request headers. There is no telemetry or advertising. Uploaded images are publicly accessible through the returned links; note contents are not uploaded.

## Troubleshooting

- **401:** your key is invalid or revoked. Check it in the plugin settings.
- **Storage quota:** delete files through SilentFlow or upgrade your plan at the pricing section above.
- **Image size:** use an image within your account's per-file limit (2 MB on the free plan).
- **Unsupported type:** the server determines supported types from file bytes, independently of the supplied file name and MIME type.
- **Network:** check your connection and API address. Invalid API addresses are rejected before sending requests.
- **403 with an agent key:** check its scopes and the account's images subscription; the server's explanation is shown.

## Development

Requires Node.js and npm for development only; the installed plugin has no runtime dependencies.

```sh
npm install
npm run dev
npm run build
npm test
npx tsc --noEmit
```

`npm run dev` watches and bundles source. `npm run build` checks types and creates `main.js`. Vitest covers pure utilities, event/editor behavior, and the API against a local HTTP server with fake credentials; tests do not contact SilentFlow. `npm version <version>` updates the manifest and version compatibility file through the version script.

The release workflow builds and attaches `main.js`, `manifest.json`, and `styles.css` when a numeric tag such as `0.1.0` is pushed to a future GitHub repository. Use tags without a `v` prefix.

## License

[MIT](LICENSE), copyright 2026 Silent Lab.
