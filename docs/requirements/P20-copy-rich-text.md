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

- [x] Edit 菜单新增命令 `copyRichText`（Copy as Rich Text）：
      - 有选区：渲染选区 Markdown 片段
      - 无选区：渲染整篇文档
- [x] 剪贴板同时写两种 flavor：`text/html`（渲染结果）+ `text/plain`
      （对应 Markdown 源码）——外部应用各取所需
- [x] HTML 输出对微信等"会剥离 class/style 标签"的目标**内联化样式**：
      标题字号/粗细、加粗、行内代码底色、引用左边框、表格边框与斑马纹、
      代码块底色等核心样式直接写进元素 style 属性
- [x] 配色跟随当前应用主题（light/dark），与导出 HTML 的
      `exportCss.ts` 调色板同源（提取共享 token，两处引用）
- [x] 相对路径图片：内联为 data URL（复用 P04 `readImageAsDataUrl`），
      保证外部应用可显示
- [x] mermaid/数学：渲染结果内联（SVG 保留在 HTML flavor 中；对不支持
      SVG 的目标的降级不做保证，验收注明）
- [x] 命令完成后状态栏/菜单短暂反馈（"已复制为富文本"，对接 P14 状态
      栏则用之，未就绪时用现有轻量提示方式）
- [x] （低优）Edit 菜单 Copy as HTML：仅写 `text/html` 且不内联样式
      （类名 + `<style>` 块），供懂 HTML 的用户使用
- [x] （低优）Export Selection…：把选区渲染结果存为独立 HTML 文件
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

## 实施状态（已完成）

提交：`feat(P20): copy as rich text — palette-shared inline styles, dual-flavor clipboard, selection export`（分支 feat/P11-P26-scenarios）

### 实现落点

- **共享调色板** `export/palette.ts`：LIGHT/DARK 十个 token（bg/bgAlt/fg/
  fgDim/border/accent/quoteBorder/codeBg/hrColor/highlightBg）+
  `paletteToCssVars`；`exportCss.ts` 的 theme 变量块改为由 palette 生成
  （CSS 变量名不变：`--bg-alt`、`--quote-border` 等），`inlineStyles.ts`
  同源取色——需求"两处引用共享 token"落实。
- **`export/inlineStyles.ts`**：纯函数 `tagStyles(palette)` /
  `classStyles(palette)`（node 可单测）+ 渲染进程专用
  `inlineStyleFragment(html, theme)`（DOMParser 遍历 renderDoc 片段，
  逐元素写 `style=`：h1–h6 字号字重、strong/b 700、code 底色、
  blockquote 左边框、table/th/td 边框、**斑马纹由 JS 按行写入**
  （nth-child 无法内联）、pre 块底色、a 主题色、mark 高亮底色等）+
  `wrapFragment` 外层 div 带背景/前景/字体，剥壳目标仍可读主题。
- **`export/copyRichText.ts`**：`selectionMarkdown(view)`（有选区切选区，
  否则全文）→ `renderDoc(md, {imageMode:'embed'})`（P04 复用；math/
  mermaid SVG、图片 data URL 由既有管线内联）→ 内联样式 →
  `window.api.clipboardWriteHtml(html, markdown)` 双 flavor 一次写入。
  低优 `copyHtmlToClipboard`（class + `<style>EXPORT_DOC_CSS</style>` +
  `export-doc` article，不逐标签内联）与 `exportSelectionHtmlFile`
  （`buildExportHtml` 整页壳 + P04 `showSaveDialog`/`exportHtml` IPC）。
- **命令/菜单**：`commands.ts` 注册 `copyRichText`（**Ctrl+Shift+C**
  bindGlobal；darwin 菜单加速键 `CmdOrCtrl+Shift+C`——main.ts 无同键
  注册项，DevTools 命令本身无默认键，无冲突）、`copyAsHtml`、
  `exportSelectionHtml`；MENU_LAYOUT Edit 组插入三项；darwin 原生菜单
  Edit 子菜单同步 `commandItem` 行 + 中英文案。
- **完成反馈**：App 新增 `toast` state + `showToast`（2.5s 自清），
  经 `CommandOps.showToast` 注入命令注册表；StatusBar 新增 `toast`
  prop 渲染 `.sb-toast` 芯片（styles.css 渐隐动画）。命令成功路径
  提示 `t('toast.copiedRich'|'copiedHtml'|'exportedSelection')`。
- **主题来源**：命令读 `getLivePreviewConfig(view.state).theme`（已由
  useAppTheme resolve 掉 'system'）与 `.baseDir`，不重复解析偏好。
- **IPC**：复用 P19 已加的 `clipboard:writeHtml`；选区导出走 P04 既有
  `showSaveDialog` + `exportHtml`。类型单一源 `electron/shared/api.ts`
  （P19 已扩，本需求零新增 IPC）。
- **e2e 钩子 `__veloxP20`**：copyRichText/copyAsHtml/exportSelectionTo
  （指定路径绕过原生对话框）/getClipboard（**真实 IPC 读回两种 flavor**，
  无需 stub 冻结的 contextBridge）/getToast/setThemePref。
  Ctrl+Shift+C 场景经 window keydown 走 bindGlobal 分发——与菜单同一
  命令体。

### 微信粘贴已知限制（验收注明）

- mermaid/KaTeX 输出为内联 SVG/MathML+字体引用：微信公众号编辑器可能
  丢失 SVG 或回退字体，复杂公式/图表不保证保真；降级观感取决于目标应用。
- 微信对 HTML 的清洗策略随版本变化：本实现以"内联 style + 语义标签"
  为最大公约数，表格边框/代码块底色目前可保留，首行缩进等公众号排版
  美化属非目标。
- 纯文本编辑器粘贴得到 Markdown 源码（plain flavor），属设计行为。

### 测试证据

- 单测：`npm run test:unit` **116/116**（新增 `export/inlineStyles.test.ts`
  5 例：palette 明暗区分、kebab CSS 变量名与 exportCss 一致、tag/class
  映射覆盖 + 明暗取色）
- e2e：`node scripts/cdp-p20.mjs`（端口 9237）**21/21 ALL PASS**——选区
  复制 h1/strong/表格/列表内联样式、plain flavor 与 sliceDoc 逐字一致、
  Ctrl+Shift+C 状态栏反馈、暗色 token（#1e1e1e/#58a6ff）、全文路径
  本地图片 data URL 内联、Copy as HTML 类名+style 块、选区导出文件落盘
- 冒烟：`npm run test:smoke` **5/5**；`npm run typecheck` 干净
