# P20 复制为富文本与选区导出

优先级：P20 | 类别：功能 | 预估规模：S

## 背景

P04 打通了 PDF/HTML **文件**导出（`export/renderDoc.ts` +
`export/exportCss.ts`），但中文写作高频场景是"复制一段贴进微信/飞书/
邮件"——现在只能复制 Markdown 源码，粘贴目标不渲染。剪贴板写入只有
纯文本（`clipboardWrite`）。`renderDoc` 基建直接可复用，这是单位成本
最低的"交付"补全。

## 目标

选区（或全文）一键以富文本进入剪贴板：粘贴到外部应用保留标题、加粗、
列表、表格、代码块等结构与明暗主题配色。

## 功能需求

- [ ] Edit 菜单新增命令 `copyRichText`（Copy as Rich Text）：
      - 有选区：渲染选区 Markdown 片段
      - 无选区：渲染整篇文档
- [ ] 剪贴板同时写两种 flavor：`text/html`（渲染结果）+ `text/plain`
      （对应 Markdown 源码）——外部应用各取所需
- [ ] HTML 输出对微信等"会剥离 class/style 标签"的目标**内联化样式**：
      标题字号/粗细、加粗、行内代码底色、引用左边框、表格边框与斑马纹、
      代码块底色等核心样式直接写进元素 style 属性
- [ ] 配色跟随当前应用主题（light/dark），与导出 HTML 的
      `exportCss.ts` 调色板同源（提取共享 token，两处引用）
- [ ] 相对路径图片：内联为 data URL（复用 P04 `readImageAsDataUrl`），
      保证外部应用可显示
- [ ] mermaid/数学：渲染结果内联（SVG 保留在 HTML flavor 中；对不支持
      SVG 的目标的降级不做保证，验收注明）
- [ ] 命令完成后状态栏/菜单短暂反馈（"已复制为富文本"，对接 P14 状态
      栏则用之，未就绪时用现有轻量提示方式）
- [ ] （低优）Edit 菜单 Copy as HTML：仅写 `text/html` 且不内联样式
      （类名 + `<style>` 块），供懂 HTML 的用户使用
- [ ] （低优）Export Selection…：把选区渲染结果存为独立 HTML 文件
      （复用 P04 保存对话框路径）

## 实现要点

- IPC：`electron/shared/api.ts` 的 `RendererApi` 增
  `clipboardWriteHtml(html: string, text: string): Promise<void>`；
  handler 落 `electron/ipc/files.ts`（或 clipboard 小节），主进程
  `clipboard.write({ text, html })`；preload/env.d.ts 自动跟随。
- 渲染：新增 `export/copyRichText.ts`
  - `renderFragment(markdown, theme): Promise<string>`——内部走
    `renderDoc` 的块级渲染，但输出片段而非完整文档（不带 `<html>` 壳）
  - `inlineStyles(html): string`——解析片段，按标签映射表写 style
    （`export/inlineStyles.ts`，映射表与 `exportCss.ts` 的 token 对齐）
- 图片内联：`RenderDocOptions.imageMode` 已有 `'embed'` 路径，选区渲染
  直接复用。
- 命令：`commands.ts` 注册 `copyRichText`，MENU_LAYOUT 挂 Edit；快捷键
  `CmdOrCtrl+Shift+C`（实现时核对与 DevTools 快捷键的冲突，冲突则不设
  默认键）；macOS 原生菜单 `electron/main.ts` buildDarwinMenu 加对应行。
- 选区 Markdown 提取：`view.state.sliceDoc(from, to)`；注意选区切在块
  中间时渲染可能不完整（如半个 fence）——按原文渲染，验收不苛求。
- 微信粘贴的已知限制记录进本文档：SVG（mermaid）与部分字体可能丢失。

## 验收标准

1. 选中含标题/加粗/列表/表格的段落 → Copy as Rich Text → 粘贴到微信
   编辑器：结构与配色保留，无裸 Markdown 标记。
2. 同一操作粘贴到纯文本编辑器：得到 Markdown 源码（plain flavor）。
3. 暗色主题下复制，粘贴目标呈现暗色配色。
4. 文档含本地图片：复制全文粘贴到支持 HTML 的编辑器图片可见
   （data URL）。
5. 无选区时复制全文行为正确；命令有完成反馈。

## 非目标

- 复制为图片（整页截图）、复制为 PDF
- 微信排版美化模板（首行缩进等公众号风格）
- RTF flavor、OneNote 等特殊目标保真
