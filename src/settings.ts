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
    const keyDescription = document.createDocumentFragment();
    keyDescription.createEl("span", { text: "Your SilentFlow API key. " });
    keyDescription.createEl("a", { text: "Get a free key", href: "https://slnt.dev/free" });
    new Setting(containerEl)
      .setName("API key")
      .setDesc(keyDescription)
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
      .setName("Upload on paste")
      .setDesc("Upload image files pasted into the editor.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.uploadOnPaste).onChange(async (value) => {
        this.plugin.settings.uploadOnPaste = value;
        await this.plugin.saveSettings();
      }));
    new Setting(containerEl)
      .setName("Upload on drop")
      .setDesc("Upload image files dropped into the editor.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.uploadOnDrop).onChange(async (value) => {
        this.plugin.settings.uploadOnDrop = value;
        await this.plugin.saveSettings();
      }));
    new Setting(containerEl)
      .setName("Use file name as alt text")
      .setDesc("Use the file name without its extension as image alt text.")
      .addToggle((toggle) => toggle.setValue(this.plugin.settings.useFileNameAsAlt).onChange(async (value) => {
        this.plugin.settings.useFileNameAsAlt = value;
        await this.plugin.saveSettings();
      }));
    new Setting(containerEl).setName("Advanced").setHeading();
    const addressError = containerEl.createDiv({ cls: "silentflow-error" });
    new Setting(containerEl)
      .setName("API address")
      .setDesc("Use HTTPS, or HTTP for localhost or 127.0.0.1.")
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
      .setName("Check usage")
      .setDesc("Check your storage and monthly traffic usage.")
      .addButton((button) => button.setButtonText("Check usage").onClick(async () => {
        button.setDisabled(true);
        usageEl.removeClass("silentflow-error");
        usageEl.setText("Checking usage…");
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
