import { App, PluginSettingTab, Setting } from "obsidian";
import type SilentFlowPlugin from "./main";
import { errorMessage } from "./lib/errors";
import { formatUsage } from "./lib/format";
import { normalizeBaseUrl } from "./lib/url";

export interface SilentFlowSettings {
  apiKey: string;
  baseUrl: string;
  uploadOnPaste: boolean;
  uploadOnDrop: boolean;
  useFileNameAsAlt: boolean;
}

export const DEFAULT_SETTINGS: SilentFlowSettings = {
  apiKey: "",
  baseUrl: "https://slnt.dev",
  uploadOnPaste: true,
  uploadOnDrop: true,
  useFileNameAsAlt: false
};

export class SilentFlowSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: SilentFlowPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl)
      .setName("API 密钥")
      .setDesc("你的 SilentFlow API 密钥。可以在 https://slnt.dev/free 免费领取。")
      .addText((text) => {
        text.inputEl.type = "password";
        text.setPlaceholder("sk_… or sf_agent_…")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          });
      });
    new Setting(containerEl)
      .setName("粘贴时上传")
      .setDesc("把粘贴进笔记的图片上传到 SilentFlow。")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.uploadOnPaste).onChange(async (value) => {
        this.plugin.settings.uploadOnPaste = value;
        await this.plugin.saveSettings();
      }));
    new Setting(containerEl)
      .setName("拖入时上传")
      .setDesc("把拖进笔记的图片上传到 SilentFlow。")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.uploadOnDrop).onChange(async (value) => {
        this.plugin.settings.uploadOnDrop = value;
        await this.plugin.saveSettings();
      }));
    new Setting(containerEl)
      .setName("用文件名作为替代文本")
      .setDesc("用去掉扩展名的文件名作为图片的替代文本。")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.useFileNameAsAlt).onChange(async (value) => {
        this.plugin.settings.useFileNameAsAlt = value;
        await this.plugin.saveSettings();
      }));
    new Setting(containerEl).setName("高级").setHeading();
    const addressError = containerEl.createDiv({ cls: "silentflow-error" });
    new Setting(containerEl)
      .setName("API 地址")
      .setDesc("使用 HTTPS；只有 localhost 或 127.0.0.1 可以使用 HTTP。")
      .addText((text) => text.setPlaceholder(DEFAULT_SETTINGS.baseUrl)
        .setValue(this.plugin.settings.baseUrl)
        .onChange(async (value) => {
          try {
            const normalized = normalizeBaseUrl(value);
            addressError.setText("");
            this.plugin.settings.baseUrl = normalized;
            await this.plugin.saveSettings();
          } catch (error: unknown) {
            addressError.setText(errorMessage(error));
          }
        }));
    new Setting(containerEl)
      .setName("查看用量")
      .setDesc("查看存储空间和本月流量。")
      .addButton((button) => button.setButtonText("查看用量").onClick(async () => {
        button.setDisabled(true);
        usageEl.removeClass("silentflow-error");
        usageEl.setText("正在查询用量…");
        try {
          usageEl.setText(formatUsage(await this.plugin.api.checkUsage(this.plugin.settings)));
        } catch (error: unknown) {
          usageEl.addClass("silentflow-error");
          usageEl.setText(errorMessage(error));
        } finally {
          button.setDisabled(false);
        }
      }));
    const usageEl = containerEl.createDiv({ cls: "silentflow-usage" });
  }
}
