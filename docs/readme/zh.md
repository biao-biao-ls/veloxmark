# VeloxMark

用 Markdown 书写,其余皆是装饰。

[English](../../README.md) · **简体中文** · [日本語](ja.md) · [한국어](ko.md) · [Español](es.md) · [Português](pt.md) · [Français](fr.md) · [Deutsch](de.md) · [Русский](ru.md)

VeloxMark 是一款免费、开源的 Markdown 桌面阅读与编辑器,支持实时预览。它追求 [Typora](https://typora.io) 那种行云流水的写作体验,同时保证 `.md` 纯文本完全可移植——基于 Electron 与 CodeMirror 6 构建,支持 macOS、Windows 和 Linux。

![VeloxMark 浅色主题](../../website/docs/public/img/hero-light.png)

- 官网与文档:https://veloxmark.knzn.net
- 下载:https://github.com/biao-biao-ls/veloxmark/releases

## 功能特性

- **实时预览(Typora 风格)**:Markdown 源文本是唯一的数据来源。光标离开某行后,`#`、`**`、`` ` `` 等语法标记隐藏,该行按最终样式渲染;光标所在行始终显示源码形式
- **块级渲染**:代码块(语法高亮)、`$$` 数学公式(KaTeX)、```` ```mermaid ```` 图表——点击任意块即可编辑其源码
- **表格**:原生表格编辑,支持嵌套单元格编辑器、插入/转换为表格对话框、列宽拖拽与对齐
- **大纲导航**:侧边栏标题树,点击跳转,并高亮当前所在位置
- **多标签编辑**:同时打开多个文件,标签可关闭/恢复,未保存的改动以 `•` 标记
- **专注模式**:专注模式、打字机模式、源码模式
- **明暗主题**:**视图 → 切换主题**菜单切换,跨会话记忆;自定义无边框标题栏与应用内菜单(文件/编辑/查看/帮助)随主题联动
- **文件操作**:打开 / 保存 / 另存为;自定义窗口控件(最小化/最大化/关闭)
- **导出**:PDF 与 HTML,支持仅导出选区为 HTML
- **输入辅助**:粘贴裸 URL 时自动包裹链接,粘贴 HTML 转换为 Markdown
- **任务列表**:`- [ ]` 渲染为可点击的复选框
- **图片**:绝对路径、相对路径(相对于当前 `.md` 文件)以及网络图片
- **自动更新**:安装包检查 GitHub Releases 并原地更新(Windows NSIS 与 Linux AppImage)
- **多语言**:简体中文、English、日本語、한국어、Español、Português、Français、Deutsch、Русский 界面(含原生菜单与示例文档)

## 安装

从[发布页](https://github.com/biao-biao-ls/veloxmark/releases/latest)下载对应平台的构建包:

- **Windows** — NSIS 安装包(支持自动更新)或便携版 zip
- **macOS** — dmg 与 zip(未签名构建)。首次启动请右键 → **打开**,或清除隔离属性:`xattr -d com.apple.quarantine /Applications/VeloxMark.app`
- **Linux** — AppImage(支持自动更新)、deb、rpm、tar.gz 或 snap

## 开发

```bash
npm install
npm run dev      # 开发模式(热更新)
npm run build    # 构建到 out/
npm run typecheck
```

> 若在受限网络下 Electron 二进制下载失败:
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`

## 技术栈

- [Electron](https://www.electronjs.org) + [electron-vite](https://electron-vite.org) + React + TypeScript
- [CodeMirror 6](https://codemirror.net) — 编辑器内核;通过 StateField 装饰器实现实时预览
- [KaTeX](https://katex.org) — 数学公式
- [mermaid](https://mermaid.js.org) — 图表
- [highlight.js](https://highlightjs.org) — 代码高亮

## 架构

```
electron/main.ts        main process: windows, native menus, file dialogs, mdres:// image protocol
electron/preload.ts     contextBridge-safe IPC API
electron/updater.ts     auto-update routing (electron-updater / manual check)
src/renderer/src/
  App.tsx               shell: title bar, sidebar outline, file/theme state
  editor/livePreview/   live-preview core (StateField decoration engine)
  editor/widgets.ts     code/math/mermaid/image/task widgets
  editor/setup.ts       CodeMirror extension assembly, keybindings
  editor/theme.ts       light/dark themes (CM6 theme + CSS variables)
  outline/extract.ts    heading outline extraction from the syntax tree
  i18n/                 UI dictionaries (en/zh/ja/ko/es/pt/fr/de/ru)
```

核心设计:Markdown 文本永远是唯一的数据来源(保存时写出纯 `.md`,往返零丢失)。装饰引擎在每次文档/选择变化时重建 Decorations:语法标记用 replace 装饰器隐藏,代码/公式/图表块替换为 widget;当光标进入某个范围时,跳过该范围的装饰,源码形式随之恢复。

## 文档

完整用户文档见[官网](https://veloxmark.knzn.net/zh/docs/)。发布流程手册(流程、产物、签名状态、故障排查)见 [CLAUDE.md](../../CLAUDE.md) 的 "Release process" 一节。

## 贡献

- **提交信息与代码注释必须使用英文。**
- **翻译只允许出现在本地化包中**——每种语言一个包(文件或目录):
  - `src/renderer/src/i18n/<lang>.ts` — UI 字典与语言自称
  - `electron/shared/menuStrings/<lang>.ts` — 原生菜单文本
  - `src/renderer/src/content/<lang>.ts` — 欢迎/帮助文档
  - `src/renderer/src/editor/mermaidTemplates/<lang>.ts` — Mermaid 模板正文
  - `docs/readme/<lang>.md` — 本 README 的译文
  - `website/docs/<lang>/` 与 `website/docs/.vitepress/locales/<lang>.ts` — 网站页面与网站界面文本

  仓库中其余文件一律只用英文。

## 许可证

[MIT](../../LICENSE)
