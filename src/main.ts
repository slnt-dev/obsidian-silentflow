import { Editor, Notice, Plugin, requestUrl } from "obsidian";
import { SilentFlowApi } from "./api";
import { DEFAULT_SETTINGS, SilentFlowSettingTab, type SilentFlowSettings } from "./settings";
import { errorMessage } from "./lib/errors";
import { formatUsage } from "./lib/format";
import { createPlaceholder, findPlaceholderReplacement, imageAlt, imageMarkdown, uploadFilename } from "./lib/placeholder";
import { runWithLimit } from "./lib/pool";
import { normalizeBaseUrl } from "./lib/url";

export default class SilentFlowPlugin extends Plugin {
  settings: SilentFlowSettings = { ...DEFAULT_SETTINGS };
  readonly api = new SilentFlowApi(async (options) => {
    const response = await requestUrl(options);
    return { status: response.status, text: response.text };
  });
  private missingKeyNotified = false;
  private readonly queue: Array<() => Promise<void>> = [];
  private draining = false;

  async onload(): Promise<void> {
    this.settings = { ...DEFAULT_SETTINGS, ...await this.loadData() };
    this.addSettingTab(new SilentFlowSettingTab(this.app, this));
    this.registerEvent(this.app.workspace.on("editor-paste", (evt, editor) => {
      if (evt.defaultPrevented || !this.settings.uploadOnPaste) return;
      this.handleImages(evt, editor, true);
    }));
    this.registerEvent(this.app.workspace.on("editor-drop", (evt, editor) => {
      if (evt.defaultPrevented || !this.settings.uploadOnDrop) return;
      this.handleImages(evt, editor, false);
    }));
    this.addCommand({
      id: "check-usage",
      name: "查看用量",
      callback: async () => {
        try {
          new Notice(`SilentFlow\n${formatUsage(await this.api.checkUsage(this.settings))}`, 10000);
        } catch (error: unknown) {
          new Notice(`SilentFlow: ${errorMessage(error)}`);
        }
      }
    });
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  private handleImages(evt: ClipboardEvent | DragEvent, editor: Editor, pasted: boolean): void {
    if (evt.defaultPrevented) return;
    const transfer = "clipboardData" in evt ? evt.clipboardData : evt.dataTransfer;
    if (!transfer) return;
    const files = Array.from(transfer.files).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;
    if (!this.settings.apiKey.trim()) {
      if (pasted && !this.missingKeyNotified) {
        this.missingKeyNotified = true;
        new Notice("SilentFlow：请先在插件设置里填入 API 密钥，粘贴的图片才会上传。");
      }
      return;
    }
    try {
      normalizeBaseUrl(this.settings.baseUrl);
    } catch (error: unknown) {
      new Notice(`SilentFlow: ${errorMessage(error)}`);
      return;
    }
    evt.preventDefault();
    const config = { baseUrl: this.settings.baseUrl, apiKey: this.settings.apiKey };
    // A drop is intercepted before Obsidian moves the cursor, so use the pointer.
    let dropAt = pasted ? null : dropOffset(editor, evt as DragEvent);
    for (const [index, file] of files.entries()) {
      // Put each image on its own line so several images do not run together.
      const separated = index > 0;
      const placeholder = createPlaceholder();
      const filename = uploadFilename(file.name, file.type);
      const alt = imageAlt(filename, this.settings.useFileNameAsAlt, pasted);
      let text = separated ? `\n${placeholder}` : placeholder;
      if (dropAt === null) {
        editor.replaceSelection(text);
      } else {
        // A drop that lands at the end of a line must not glue onto the next line.
        if (editor.getValue()[dropAt] === "\n") text += "\n";
        editor.replaceRange(text, editor.offsetToPos(dropAt));
        dropAt += text.length;
      }
      this.queue.push(async () => {
        try {
          const result = await this.api.upload(config, filename, file.type, await file.arrayBuffer());
          this.replacePlaceholder(editor, placeholder, imageMarkdown(alt, result.url), separated);
        } catch (error: unknown) {
          this.replacePlaceholder(editor, placeholder, "", separated);
          new Notice(`SilentFlow: ${errorMessage(error)}`);
        }
      });
    }
    void this.drainQueue();
  }

  private replacePlaceholder(editor: Editor, placeholder: string, replacement: string, separated: boolean): void {
    const content = editor.getValue();
    const range = findPlaceholderReplacement(content, placeholder, replacement);
    if (!range) return;
    // A failed upload also removes the line break added before it.
    if (separated && replacement === "" && content[range.from - 1] === "\n") range.from -= 1;
    editor.replaceRange(range.replacement, editor.offsetToPos(range.from), editor.offsetToPos(range.to));
  }

  private async drainQueue(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      const worker = async () => {
        while (this.queue.length > 0) await this.queue.shift()!();
      };
      await runWithLimit([worker, worker, worker], 3);
    } finally {
      this.draining = false;
      if (this.queue.length > 0) void this.drainQueue();
    }
  }
}

/** Document offset under a drop pointer, or null when it cannot be resolved. */
export function dropOffset(editor: Editor, event: DragEvent): number | null {
  const cm = (editor as unknown as { cm?: { posAtCoords(coords: { x: number; y: number }, precise: false): number } }).cm;
  if (!cm || typeof event.clientX !== "number" || typeof event.clientY !== "number") return null;
  try {
    const pos = cm.posAtCoords({ x: event.clientX, y: event.clientY }, false);
    return Number.isInteger(pos) && pos >= 0 ? pos : null;
  } catch {
    return null;
  }
}
