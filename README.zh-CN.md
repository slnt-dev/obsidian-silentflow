# SilentFlow Image Host

[English](README.md)

将粘贴或拖入 Obsidian 的图片上传到 [SilentFlow](https://slnt.dev)，并以 Markdown 插入公开图片外链。

## 功能

- 粘贴或拖入图片文件时上传，两种行为均可单独关闭。
- 纯文本粘贴及已被其他插件处理的事件保持原有行为。
- 使用唯一上传占位串，即使编辑周围文字也能正确替换。
- 最多同时上传三张图片。
- 可选使用文件名作为 alt 文字，默认关闭。
- 在设置页或通过 **Check usage** 命令检查存储和流量用量。
- 使用 Obsidian 的 `requestUrl`，支持桌面端与移动端。

## 安装

本插件尚未上架社区插件目录。

- **BRAT：** 后续存在带发布附件的 GitHub 仓库时，可在 BRAT 的 **Add a beta plugin** 操作中填写其仓库地址。本次初始本地实现不提供已发布仓库。
- **手动安装：** 本地构建或从发布附件获取 `main.js`、`manifest.json`、`styles.css`，将这三个文件复制到仓库的 `.obsidian/plugins/silentflow-image-host/` 目录。重新加载 Obsidian，在社区插件中启用 **SilentFlow Image Host**。

## 配置

1. [免费领取密钥](https://slnt.dev/free)。
2. 打开插件设置，填写 API key（`sk_…` 或 `sf_agent_…`）。
3. 除非使用其他 SilentFlow 实例，否则 **API address** 保持 `https://slnt.dev`。必须使用 HTTPS；仅 `localhost` 或 `127.0.0.1` 允许 HTTP。
4. 按需开启 **Use file name as alt text**，或检查用量。

Agent key 上传需要 `files:write` 权限，检查用量需要 `files:read` 权限。

## 使用

在笔记编辑器里粘贴或拖入图片文件，会出现临时 `![Uploading silentflow-…]()` 占位串，上传成功后替换为 `![](公开地址)`。开启文件名 alt 时，使用去掉扩展名的文件名；剪贴板的通用文件名（如 `image.png`）使用 `pasted-image`。失败会删除占位串并显示通知。若上传完成前主动删除占位串，插件不会再改动文字。

未配置密钥时，粘贴图片仍走 Obsidian 默认行为，每次会话只提醒一次。纯文本粘贴不受影响。可在设置页或命令面板使用 **Check usage** 查看用量摘要，不设置默认快捷键。

上传后的图片地址可以公开访问，请保留原图的本地备份。

## 免费版额度

服务端免费版提供 **500 MB 存储**、**每月 1 GB 流量**、**单图最大 2 MB**。使用二进制换算，分别为 500 × 1024²、1024³、2 × 1024² 字节。实际账户额度以服务端返回为准。升级方案见[首页价格区块](https://slnt.dev/#pricing)。

## 网络使用（Network use）

插件仅在上传图片或检查用量时，联系用户配置的 API 地址（默认 `https://slnt.dev`）。

- **上传：** `POST /v1/files` 通过 multipart 表单发送图片文件字节、文件名和 MIME 类型，并在 `Authorization: Bearer …` 请求头中发送 API key。
- **检查用量：** `GET /v1/usage` 使用同样的 Bearer 请求头发送 API key，不发送图片或笔记内容。

插件没有遥测或广告请求，不加载远程代码。文档和设置中的链接仅在用户主动打开时访问。

## 隐私

设置（包括 API key）以**明文**保存在仓库内插件的 `data.json` 文件中，密钥没有加密。请保护仓库的访问权限，并留意包含插件设置的备份与同步。插件不记录 API key 或请求头，没有遥测和广告。上传后的图片可通过返回链接公开访问，笔记内容不会上传。

## 故障排查

- **401：** 密钥无效或已撤销，请检查插件设置。
- **存储配额：** 在 SilentFlow 删除文件，或通过上面的价格区块升级套餐。
- **图片体积：** 使用不超过账户单图上限的图片（免费版 2 MB）。
- **不支持的类型：** 服务端根据文件字节判断支持的类型，不信任客户端文件名或 MIME 类型。
- **网络：** 检查网络连接和 API 地址，不合法的 API 地址会在发送请求前被拒绝。
- **Agent key 的 403：** 检查权限以及账户是否订阅 images 产品，界面会显示服务端的说明。

## 开发

仅开发阶段需要 Node.js 和 npm，安装后的插件没有运行时依赖。

```sh
npm install
npm run dev
npm run build
npm test
npx tsc --noEmit
```

`npm run dev` 监听并打包源码，`npm run build` 检查类型并生成 `main.js`。Vitest 覆盖纯逻辑、编辑器事件行为，以及使用假密钥的本地 HTTP 服务集成；测试不访问 SilentFlow。`npm version <version>` 通过版本脚本更新 manifest 和版本兼容文件。

后续推送 `0.1.0` 形式的数字 tag 到 GitHub 仓库时，发布工作流构建并附上 `main.js`、`manifest.json`、`styles.css`。tag 不带 `v` 前缀。

## 许可

[MIT](LICENSE)，版权 2026 Silent Lab。
