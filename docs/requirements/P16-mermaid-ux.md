# P16 Mermaid 图表体验增强

优先级：P16 | 类别：UX/功能 | 预估规模：M

## 背景

Mermaid 在 V1 只有"渲染 + P06 工具条（Copy 源码 / 导出 SVG）"。差距集中在
交互回路：渲染失败时 `MermaidWidget.toDOM`（`editor/widgets.ts`）用错误
文本**替换**整个图，正在编辑时图直接消失；没有图模板入口，新手记不住
语法；导出只有 SVG，中文写作场景（贴微信/飞书）需要 PNG/图片剪贴板；
大图无法放大查看。P05 的 `ImageWidget` 已有点击选中/缩放交互先例，P15
的渲染限流是本需求的性能前置。

## 目标

把 Mermaid 从"能渲染"提升到"敢编辑、好交付"：编辑出错不清屏、模板一键
插入、PNG 导出/复制、大图可放大细看。

## 功能需求

### 错误与编辑态体验
- [x] 重渲染期间保留上一版图（降透明度 + "Updating…" 角标），渲染成功
      后原位替换
- [x] 渲染失败：图保留并变暗，错误信息以覆盖条显示在图底部（不再替换
      内容）；错误文本含位置信息时提供 "跳到源码" 按钮 → 跳到 fence 内
      对应行
- [x] 从未成功渲染过的 fence 失败时：显示占位框 + 错误信息（与图片
      占位符风格一致）

### 图模板插入
- [x] Insert 菜单 / 命令 `insertMermaidDiagram`：选择图类型后在光标处
      插入骨架代码；类型：flowchart / sequence / class / state / ER /
      gantt / pie 七种
- [x] 选择 UI：复用对话框体系（列表选择，键盘上下 + 回车）
- [x] 模板内容含中文注释示例（帮助理解语法结构），插入后光标落在第一个
      可编辑节点名上
- [x] 若光标已在 mermaid fence 内：不插入新 fence，改为提示已存在（首版
      直接不动作）

### 导出补全
- [x] 工具条新增 "PNG"：SVG 栅格化（canvas，devicePixelRatio 2x）后走
      保存对话框，默认文件名 `diagram.png`
- [x] 工具条新增 "Copy Image"：PNG 写入系统剪贴板（图片格式），可直接
      粘贴到微信/飞书/邮件
- [x] 暗色主题下 PNG 保留当前 mermaid 主题配色（与所见一致）

### 大图预览（lightbox）
- [x] 点击渲染态图形本体进入 lightbox 全屏预览（半透明遮罩 + 居中 SVG）
- [x] 滚轮缩放（以光标为中心）、拖拽平移、双击恢复 100%、Esc/点击遮罩
      关闭
- [x] lightbox 打开时仅一个实例（仿 `closeOpenImageZoom` 的互斥模式）
- [x] 点击图形与 P06 "点击块回源码" 的关系：图形命中进 lightbox，块
      padding 命中仍回源码

## 实现要点

- 错误态改造集中在 `MermaidWidget.toDOM`（`widgets.ts`）：`body` 拆为
  `svgHost` + `errorBar` 两层；`renderMermaid` 的 then/catch 只更新对应
  层，旧 SVG 节点在成功前不移除。
- `renderMermaid(code, theme)` 已按 `theme\ncontent` 缓存（`mermaidCache`），
  stale 展示不需要改缓存逻辑；theme 切换的 `clearMermaidCache()`（
  `hooks/useAppTheme.ts`）保持不变。
- 模板插入：命令注册进 `commands.ts` 注册表（id/label/run），Menu 布局在
  MENU_LAYOUT 加 Insert 分组；选择对话框走 P02 `dialog` 体系（需要一个
  列表选择变体，可仿 `ExportDialog.tsx` 的自绘模式）。插入用
  `view.dispatch` 在光标处 replace selection，前后补齐空行。
- PNG 导出：复用 `exportSvg` 的克隆/serialize 流程，加一步
  `Image + canvas` 栅格化；clipboard 图片写入需新增 IPC
  `clipboardWriteImage(dataUrl: string)`（主进程
  `clipboard.write(nativeImage.createFromDataURL)`），类型扩
  `electron/shared/api.ts`。
- lightbox：应用级浮层（挂在 App 根部 portal，非 CM6 widget 内），打开时
  由工具条/图形点击传入 SVG 字符串；样式进 `styles.css`
  （`.vm-mermaid-lightbox`），明暗主题各一套。
- 命令需要访问 EditorView：沿用 `commands.ts` 现有 ops 注入模式
  （如 `openPreferences` 拿不到 view 的写法对照 `find` 命令）。
- 验证：`scripts/cdp-test.mjs` 模式补充场景——故意写错语法确认图不清屏；
  插入模板后 fence 渲染成功。

## 验收标准

1. 把合法 mermaid 改成语法错误：上一版图变暗保留，底部出现错误条；改回
   合法内容后图原位更新，无闪烁清空。
2. Insert 菜单选 "sequence"：光标处出现带中文注释的 sequence 骨架，渲染
   成图。
3. 点击 "PNG" 得到 2x 分辨率图片文件；"Copy Image" 后在外部应用粘贴出
   图。
4. 点击大图进入 lightbox，滚轮可缩放，Esc 关闭；点击块 padding 仍跳回
   源码。
5. 暗色主题下错误条/角标/遮罩对比度达标。

## 非目标

- 源码分屏实时预览（另见 P25）、PlantUML 等其他图语言
- 渲染并发限流（属 P15）、mermaid 配置项自定义主题色
- 图内节点点击跳转/交互图

## 实施状态（已完成）

- 提交：`feat(P16)`，e2e `scripts/cdp-p16.mjs`（端口 9233）**24/24 PASS**；
  P15 回归：`test:unit` 57/57、`test:smoke` 5/5、typecheck 绿。
- **错误态**：`MermaidWidget.toDOM` 拆 `svgHost + badge + errorBar`；按
  fence `sourceFrom` 键的模块级 `mermaidLastGood` 记住最近一次成功渲染，
  文本变更重建 widget 后错误路径恢复旧 SVG（`.is-dim` 降透明度）+
  底部错误条（错误文本 + "跳到源码" 按钮，按 mermaid `line N` 映射回
  fence 内行）；从未成功的 fence 走 `.cm-md-mermaid-placeholder` 占位框。
  重渲染期间左上角 "Updating…" 角标；成功后原位替换、清错误条。
- **模板插入**：`editor/mermaidTemplates.ts` 七种骨架（flowchart/sequence/
  class/state/ER/gantt/pie，中文 `%%` 注释，cursorOffset 落首个可编辑
  token）；命令 `insertMermaidDiagram` 进 commands.ts + MENU_LAYOUT Insert
  分组 + darwin 原生菜单（NATIVE_MENU_STRINGS zh/en）；选择 UI 为
  `components/ListPickDialog.tsx`（自绘对话框，↑↓+Enter+Esc，后续 P21/P22
  复用）；`isCursorInMermaidFence` 在 fence 内时命令 no-op（首版不动作）。
  插入时前后自动补空行，光标落在首个节点名（e2e 断言落 "客户端"）。
- **导出**：工具条 PNG（`rasterizeSvgToPng`，SVG→Image→canvas 2x，默认
  `diagram.png`）+ Copy Image（PNG dataURL）；新 IPC
  `clipboard:writeImage`（`clipboard.write({image: nativeImage.createFromDataURL})`）
  与 `file:writeBase64`（二进制安全写入）进 api.ts/preload；暗色主题
  PNG 沿渲染态 mermaid 配色（cache key 含 theme，所见即所得）。
- **lightbox**：`components/MermaidLightbox.tsx` 挂 App 根部，模块级
  bus（`mermaidLightboxBus.ts`）单例互斥；svg 本体点击进 lightbox
  （wrap 上 stopPropagation 阻断回源码），块 padding 点击仍回源码
  （e2e 断言 selection==sourceFrom）；滚轮以光标为中心缩放、拖拽平移、
  双击 100%、Esc/遮罩关闭；`.vm-mermaid-lightbox` 遮罩明暗两套
  （dark rgba(0,0,0,0.82)，e2e 断言 alpha≥0.75）。
- **e2e 观测性**：contextBridge 的 `window.api` 在当前 Electron 为
  冻结属性（non-configurable/non-writable，实测 probe 确认），无法就地
  stub；按 `__veloxTable` 惯例新增导出 IO 缝 `setMermaidExportIo`（默认
  落回 window.api），经 `__veloxP16.setExportIo` 注入捕获桩完成 PNG/
  剪贴板断言（PNG magic `iVBOR`、dataURL 前缀均校验）。
- 测试钩子：`window.__veloxP16`（templates/insertTemplate/openInsertDialog/
  getDialogOpen/isCursorInMermaidFence/setExportIo）；单测
  `editor/mermaidTemplates.test.ts`（7 模板结构 + cursorOffset + fence 探针）
  计入 unit 57/57。
- 需求文档命名备注：实现文件为 `P16-mermaid-ux.md`（非 mermaid-enhanced）。
