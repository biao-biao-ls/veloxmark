# P04 导出 PDF / HTML

优先级：P04 | 类别：功能 | 预估规模：M

## 背景

V1 无任何导出能力（记忆中明确留 V2）。导出是从"编辑器"到"生产力工具"的
分界线；Typora 的导出（尤其主题化 PDF）是核心卖点之一。

## 目标

支持把当前文档导出为排版良好的 PDF 和自包含 HTML，样式与编辑态观感一致
（含代码高亮、KaTeX、Mermaid、表格、图片）。

## 功能需求

- [ ] File 菜单新增 Export ▸ PDF / HTML
- [ ] PDF：通过 Electron `webContents.printToPDF` 生成；页边距、纸张
      （A4/Letter）、页眉页脚（文件名 + 页码）可选
- [ ] HTML：自包含单文件——内联 CSS、KaTeX 字体（或 CDN 回退开关）、
      highlight.js 主题、Mermaid 导出为内联 SVG；图片转 base64 或相对
      路径（选项）
- [ ] 导出预览可选（首版可先不做预览，直接出文件）
- [ ] 导出使用与编辑器同源的渲染管线——即复用现有 Widget 渲染逻辑生成
      静态 DOM，避免维护第二套 Markdown→HTML 实现
- [ ] 暗色主题导出选项（跟随当前主题 / 强制亮色打印）

## 实现要点

### 渲染管线
- 新建 `src/renderer/src/export/renderDoc.ts`：把整篇 Markdown 渲染成
  HTML 字符串。策略：复用 `@lezer/markdown` 语法树 walk（与
  `editor/livePreview/` 同一棵树），输出语义 HTML；KaTeX
  `renderToString`、mermaid 缓存 SVG、hljs highlight——三者都已在
  `widgets.ts` 存在，抽出可复用函数。
- 注意与 live preview 的差异：导出无"光标行显示源码"概念，全量渲染。

### PDF
- 隐藏 `BrowserWindow` 加载导出 HTML（或当前窗口内开隐藏 iframe 不可行
  ——printToPDF 只作用于 webContents，故用隐藏窗口），调
  `printToPDF({ pageSize, margins, printBackground: true })`，
  结果 `writeFile`。IPC：`export:pdf` / `export:html` 新建
  `electron/ipc/export.ts` 域模块实现（沿用 P00 分域惯例），类型扩
  `electron/shared/api.ts`。
- 图片使用 `mdres://` 协议时隐藏窗口需同协议注册——复用现有
  `registerSchemesAsPrivileged` 设置即可。

### UI
- 导出对话框用 P02 的 Dialog 组件承载选项（文件名、格式选项）。
- 菜单入口经 `commands.ts` 注册表新增 Export 命令（macOS 在
  buildDarwinMenu 加 id→accelerator 行）。

## 验收标准

1. 内含代码块/数学/Mermaid/表格/相对路径图片的文档导出 PDF，排版完整、
   无空白破版。
2. 导出的 HTML 断网在浏览器打开，样式与图表完整（无外链依赖或有可选
   CDN 开关）。
3. 暗色编辑态下导出 PDF 可选强制亮色。
4. 图片在导出物中正确显示（相对路径解析与编辑器一致）。

## 非目标

- Word/RTF 导出、批量导出、导出为图片（长截图）——留后续需求。
