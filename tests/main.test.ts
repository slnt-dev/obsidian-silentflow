import type { Editor } from "obsidian";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ notices: [] as string[], request: vi.fn() }));
vi.mock("obsidian", () => ({
  Plugin: class {
    app = { workspace: { on: vi.fn() } };
    loadData = vi.fn(async () => ({}));
    saveData = vi.fn(async () => undefined);
    registerEvent = vi.fn();
    addSettingTab = vi.fn();
    addCommand = vi.fn();
  },
  PluginSettingTab: class {},
  Notice: class { constructor(message: string) { mocks.notices.push(message); } },
  requestUrl: mocks.request,
  Setting: class {}
}));
import SilentFlowPlugin, { dropOffset } from "../src/main";
import { DEFAULT_SETTINGS } from "../src/settings";

function editorFixture(initial = "", dropPos?: number) {
  let value = initial;
  let cursor = initial.length;
  const editor = {
    getValue: () => value,
    replaceSelection: vi.fn((text: string) => { value = value.slice(0, cursor) + text + value.slice(cursor); cursor += text.length; }),
    offsetToPos: (offset: number) => {
      const lines = [...value].slice(0, offset).join("").split("\n");
      return { line: lines.length - 1, ch: [...lines[lines.length - 1]!].length };
    },
    replaceRange: vi.fn((text: string, from: { line: number; ch: number }, to?: { line: number; ch: number }) => {
      const offset = (pos: { line: number; ch: number }) => value.split("\n").slice(0, pos.line).reduce((sum, line) => sum + [...line].length + 1, 0) + pos.ch;
      const chars = [...value];
      chars.splice(offset(from), (to ? offset(to) : offset(from)) - offset(from), ...text);
      value = chars.join("");
    })
  };
  if (dropPos !== undefined) (editor as unknown as { cm: { posAtCoords: () => number } }).cm = { posAtCoords: () => dropPos };
  return { editor: editor as unknown as Editor, get: () => value, set: (text: string) => { value = text; cursor = text.length; } };
}
function image(name = "image.png", type = "image/png"): File {
  return { name, type, arrayBuffer: async () => new Uint8Array([0, 255, 13, 10]).buffer } as File;
}
function event(files: File[], drop = false, prevented = false, coords?: { x: number; y: number }) {
  const evt = {
    defaultPrevented: prevented,
    preventDefault: vi.fn(function (this: { defaultPrevented: boolean }) { this.defaultPrevented = true; }),
    ...(drop ? { dataTransfer: { files }, ...(coords ? { clientX: coords.x, clientY: coords.y } : {}) } : { clipboardData: { files } })
  };
  return evt;
}
const result = { url: "https://example.com/img.png", key: "img.png", product: "images" as const, usage: { used: 4, limit: null, percent: 0 } };

async function fixture() {
  const plugin = new SilentFlowPlugin({} as never, {} as never);
  await plugin.onload();
  const registrations = plugin.app.workspace.on as unknown as ReturnType<typeof vi.fn>;
  const paste = registrations.mock.calls.find((call) => call[0] === "editor-paste")![1] as (evt: unknown, editor: Editor) => void;
  const drop = registrations.mock.calls.find((call) => call[0] === "editor-drop")![1] as (evt: unknown, editor: Editor) => void;
  return { plugin, paste, drop };
}
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

beforeEach(() => { mocks.notices.length = 0; mocks.request.mockReset(); });

describe("editor event handling", () => {
  it("loads defaults and registers both events and the command without hotkeys", async () => {
    const { plugin } = await fixture();
    expect(plugin.settings).toEqual(DEFAULT_SETTINGS);
    expect(plugin.registerEvent).toHaveBeenCalledTimes(2);
    expect(plugin.addCommand).toHaveBeenCalledWith(expect.objectContaining({ id: "check-usage", name: "查看用量" }));
    const command = (plugin.addCommand as ReturnType<typeof vi.fn>).mock.calls[0]![0];
    expect(command.hotkeys).toBeUndefined();
  });
  it("leaves text, non-image files and already-handled events untouched", async () => {
    const { plugin, paste } = await fixture();
    plugin.settings.apiKey = "sk_test_fake";
    const editor = editorFixture();
    for (const evt of [event([]), event([image("text.txt", "text/plain")]), event([image()], false, true)]) {
      paste(evt, editor.editor);
      expect(evt.preventDefault).not.toHaveBeenCalled();
    }
    expect(editor.get()).toBe("");
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("shows one missing-key notice per session and preserves default paste", async () => {
    const { paste, drop } = await fixture();
    const editor = editorFixture();
    const first = event([image()]);
    const second = event([image()]);
    paste(first, editor.editor);
    paste(second, editor.editor);
    drop(event([image()], true), editor.editor);
    expect(first.preventDefault).not.toHaveBeenCalled();
    expect(second.preventDefault).not.toHaveBeenCalled();
    expect(mocks.notices).toEqual(["SilentFlow：请先在插件设置里填入 API 密钥，粘贴的图片才会上传。"]);
    expect(editor.get()).toBe("");
  });
  it("honors paste and drop switches independently", async () => {
    const { plugin, paste, drop } = await fixture();
    plugin.settings.apiKey = "sk_test_fake";
    plugin.settings.uploadOnPaste = false;
    plugin.settings.uploadOnDrop = false;
    const editor = editorFixture();
    const pasted = event([image()]);
    const dropped = event([image()], true);
    paste(pasted, editor.editor);
    drop(dropped, editor.editor);
    expect(pasted.preventDefault).not.toHaveBeenCalled();
    expect(dropped.preventDefault).not.toHaveBeenCalled();
  });
  it("rejects invalid API addresses before intercepting or requesting", async () => {
    const { plugin, paste } = await fixture();
    plugin.settings.apiKey = "sk_test_fake";
    plugin.settings.baseUrl = "http://remote.example.com";
    const evt = event([image()]);
    paste(evt, editorFixture().editor);
    expect(evt.preventDefault).not.toHaveBeenCalled();
    expect(mocks.request).not.toHaveBeenCalled();
    expect(mocks.notices[0]).toContain("HTTPS");
  });
  it("replaces the placeholder through Editor API after surrounding edits", async () => {
    const { plugin, paste } = await fixture();
    plugin.settings.apiKey = "sk_test_fake";
    plugin.settings.useFileNameAsAlt = true;
    let complete!: (value: typeof result) => void;
    vi.spyOn(plugin.api, "upload").mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const editor = editorFixture("Original\n");
    const evt = event([image()]);
    paste(evt, editor.editor);
    expect(evt.preventDefault).toHaveBeenCalledOnce();
    expect(editor.get()).toContain("![Uploading silentflow-");
    editor.set(`New before\n${editor.get()}\nNew after`);
    await flush();
    complete(result);
    await flush();
    expect(editor.get()).toBe("New before\nOriginal\n![pasted-image](https://example.com/img.png)\nNew after");
    expect(editor.editor.replaceRange).toHaveBeenCalledOnce();
  });
  it("puts each pasted image on its own line", async () => {
    const { plugin, paste } = await fixture();
    plugin.settings.apiKey = "sk_test_fake";
    let n = 0;
    vi.spyOn(plugin.api, "upload").mockImplementation(async () => ({ ...result, url: `https://example.com/${++n}.png` }));
    const editor = editorFixture("Intro:\n");
    paste(event([image("a.png"), image("b.png"), image("c.png")]), editor.editor);
    await flush();
    expect(editor.get()).toBe(
      "Intro:\n![](https://example.com/1.png)\n![](https://example.com/2.png)\n![](https://example.com/3.png)"
    );
  });
  it("leaves no blank line behind when a middle image fails", async () => {
    const { plugin, paste } = await fixture();
    plugin.settings.apiKey = "sk_test_fake";
    let n = 0;
    vi.spyOn(plugin.api, "upload").mockImplementation(async () => {
      n += 1;
      if (n === 2) throw new Error("boom");
      return { ...result, url: `https://example.com/${n}.png` };
    });
    const editor = editorFixture("");
    paste(event([image("a.png"), image("b.png"), image("c.png")]), editor.editor);
    await flush();
    expect(editor.get()).toBe("![](https://example.com/1.png)\n![](https://example.com/3.png)");
  });
  it("inserts a dropped image at the pointer, not the cursor", async () => {
    const { plugin, drop } = await fixture();
    plugin.settings.apiKey = "sk_test_fake";
    vi.spyOn(plugin.api, "upload").mockResolvedValue(result);
    const editor = editorFixture("Finder 拖入测试：\n\n多图粘贴测试：", 13);
    drop(event([image("green.png")], true, false, { x: 10, y: 20 }), editor.editor);
    await flush();
    expect(editor.get()).toBe("Finder 拖入测试：\n![](https://example.com/img.png)\n\n多图粘贴测试：");
  });
  it("falls back to the cursor when a drop has no coordinates", async () => {
    const { plugin, drop } = await fixture();
    plugin.settings.apiKey = "sk_test_fake";
    vi.spyOn(plugin.api, "upload").mockResolvedValue(result);
    const editor = editorFixture("x", 0);
    drop(event([image()], true), editor.editor);
    await flush();
    expect(editor.get()).toBe("x![](https://example.com/img.png)");
  });
  it("resolves a drop offset only from a real pointer", () => {
    const editor = editorFixture("abc\ndef", 5).editor;
    expect(dropOffset(editor, event([], true, false, { x: 1, y: 2 }) as never)).toBe(5);
    expect(dropOffset(editor, event([], true) as never)).toBeNull();
    expect(dropOffset(editorFixture("abc").editor, event([], true, false, { x: 1, y: 2 }) as never)).toBeNull();
  });
  it("adds no line break for a single image", async () => {
    const { plugin, paste } = await fixture();
    plugin.settings.apiKey = "sk_test_fake";
    vi.spyOn(plugin.api, "upload").mockResolvedValue(result);
    const editor = editorFixture("x");
    paste(event([image()]), editor.editor);
    await flush();
    expect(editor.get()).toBe("x![](https://example.com/img.png)");
  });
  it("silently leaves the document alone when a successful placeholder was deleted", async () => {
    const { plugin, paste } = await fixture();
    plugin.settings.apiKey = "sk_test_fake";
    let complete!: (value: typeof result) => void;
    vi.spyOn(plugin.api, "upload").mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
    const editor = editorFixture();
    paste(event([image()]), editor.editor);
    editor.set("Rewritten note");
    await flush(); complete(result); await flush();
    expect(editor.get()).toBe("Rewritten note");
    expect(editor.editor.replaceRange).not.toHaveBeenCalled();
    expect(mocks.notices).toEqual([]);
  });
  it("removes failed placeholders and shows the reason", async () => {
    const { plugin, drop } = await fixture();
    plugin.settings.apiKey = "sk_test_fake";
    vi.spyOn(plugin.api, "upload").mockRejectedValue(new Error("Storage is full."));
    const editor = editorFixture("Before");
    const evt = event([image()], true);
    drop(evt, editor.editor);
    await flush();
    expect(evt.preventDefault).toHaveBeenCalledOnce();
    expect(editor.get()).toBe("Before");
    expect(mocks.notices).toEqual(["SilentFlow: Storage is full."]);
  });
  it("keeps at most three active uploads across multiple events", async () => {
    const { plugin, paste, drop } = await fixture();
    plugin.settings.apiKey = "sk_test_fake";
    let active = 0;
    let maximum = 0;
    const pending: Array<() => void> = [];
    const upload = vi.spyOn(plugin.api, "upload").mockImplementation(() => {
      active++; maximum = Math.max(maximum, active);
      return new Promise((resolve) => pending.push(() => { active--; resolve(result); }));
    });
    const editor = editorFixture();
    paste(event(Array.from({ length: 5 }, () => image())), editor.editor);
    drop(event(Array.from({ length: 3 }, () => image()), true), editor.editor);
    await flush();
    expect(active).toBe(3);
    for (let i = 0; i < 8; i++) { pending.shift()!(); await flush(); }
    expect(maximum).toBe(3);
    expect(active).toBe(0);
    expect(upload).toHaveBeenCalledTimes(8);
    expect(editor.get().match(/!\[\]\(https:\/\/example.com\/img.png\)/g)).toHaveLength(8);
  });
});
