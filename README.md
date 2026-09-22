# VeloxMark

一个类似 [Typora](https://typora.io) 的 Markdown 桌面阅读/编辑器（VeloxMark），基于 Electron + CodeMirror 6 构建。

## 特性

- **实时预览（Typora 式）**：Markdown 源码即数据，光标离开的行自动隐藏 `#`、`**`、`` ` `` 等语法标记并按渲染样式显示；光标所在行回到源码态
- **块级渲染**：代码块（语法高亮）、`$$` 数学公式（KaTeX）、```mermaid 图表，点击即可编辑源码
- **大纲导航**：侧栏标题树，点击跳转，当前位置高亮
- **明暗主题**：`Ctrl+Shift+T` 切换，自动记忆；自绘无边框标题栏与应用内菜单（File/Edit/View/Help）完全跟随主题
- **文件操作**：打开 / 保存 / 另存为，未保存修改以 `•` 标记；自绘窗口控制按钮（最小化/最大化/关闭）
- **快捷键**：`Ctrl+O` 打开、`Ctrl+S` 保存、`Ctrl+Shift+S` 另存为、`Ctrl+B` 加粗、`Ctrl+I` 斜体、`Ctrl+E` 行内代码、`Ctrl+F` 搜索（无原生菜单后由渲染进程全局接管）
- **任务列表**：`- [ ]` 渲染为可勾选的复选框
- **图片**：支持绝对路径、相对路径（相对当前 md 文件）与网络图片

## 开发

```bash
npm install
npm run dev      # 开发模式（热更新）
npm run build    # 构建到 out/
npm run typecheck
```

> 国内网络如遇 Electron 二进制下载失败：
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install`

## 技术栈

- [Electron](https://www.electronjs.org) + [electron-vite](https://electron-vite.org) + React + TypeScript
- [CodeMirror 6](https://codemirror.net) — 编辑器内核，通过 StateField 装饰实现 live preview
- [KaTeX](https://katex.org) — 数学公式
- [mermaid](https://mermaid.js.org) — 图表
- [highlight.js](https://highlightjs.org) — 代码高亮

## 架构说明

```
electron/main.ts        主进程：窗口、原生菜单、文件对话框、mdres:// 图片协议
electron/preload.ts     contextBridge 安全暴露 IPC API
src/renderer/src/
  App.tsx               外壳：标题栏、侧栏大纲、文件/主题状态
  editor/livePreview.ts 实时预览核心（StateField 装饰引擎）
  editor/widgets.ts     代码/公式/mermaid/图片/任务 Widget
  editor/setup.ts       CodeMirror 扩展组装、快捷键
  editor/theme.ts       明暗主题（CM6 theme + CSS 变量）
  outline/extract.ts    语法树提取标题大纲
```

关键设计：Markdown 文本始终是唯一数据源（存盘即纯 `.md`，零往返失真）。装饰引擎在每次文档/选区变化时重建 Decoration：语法标记用 replace 隐藏，代码/公式/图替换为 Widget；光标进入相应范围时跳过装饰，回到源码态。

> 已知限制（V1）：表格按源码等宽显示；不支持多标签页、导出 PDF。
