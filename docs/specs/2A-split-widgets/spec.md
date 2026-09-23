# 2A 拆 widgets.ts（1445 行）

## What / Why

`editor/widgets.ts` 是渲染端最大文件：hljs 注入 + mermaid 管线（缓存/并发闸/错误态记忆/导出 IO）+ 渲染 helper + `BlockWidget` 基类 + 代码块/mermaid/数学/扩展语法/图片/任务 6 组 widget 全部挤在一个模块。多消费方（handlers 五文件、renderDoc、MermaidPreviewPanel、opsBlocks、table/widget、App、e2e seam）都引这一个大文件，任一改动牵动全图。按 2.1 → 2.7 拆为职责单一模块群，大文件只留 barrel。

## 验收标准（AC）

1. **2.1 `editor/blockWidget.ts`**：`BlockWidget` 基类 + `BlockToolbarItem` 原样平移（click-to-source + hover toolbar 语义不动）；`table/widget.ts` 的 import 改走新路径
2. **2.2 纯函数层** `editor/render-helpers.ts` + `editor/image-parse.ts`：`highlightCodeHtml`/`renderKatexHtml`/`splitHighlightedLines` → render-helpers；`parseImageMarkdown`/`flipTransform`/`ParsedImage` → image-parse。零状态、DOM-less 可测；`export/renderDoc.ts` 改引这两个模块（+ mermaid），**脱离 widgets 大文件**
3. **2.3 `editor/mermaid/`**：渲染核心 + 并发闸 + 缓存 + 错误态记忆 + 导出 IO seam + `MermaidWidget`。**`mermaidCache`/`mermaidLastGood`/`mermaidIoOverride` 等模块状态与消费方单一归属**（状态跟功能走，不跨模块复制）；同步更新全部 import 站点（MermaidPreviewPanel / opsBlocks / renderDoc / useAppTheme / handlers-code / `e2e/handles.d.ts` 的 type 引用 / `e2e/seams/p16.ts`）
4. **2.4 `editor/image-widget.ts`**：`ImageWidget` + `imageCache` + `closeAllImageSelections`/`invalidateImageCache` + 私有 `rewriteImageNode`；`editor/images.ts` 的 `closeAllImageSelections` 引用改路径
5. **2.5 `editor/codeBlock-widget.ts`**：`CodeBlockWidget`、`CodeLangChip`、`CodeBlockUiOptions`、scoped CSS 注入（`injectScopedCss`/`ensureScopedCss` 一次性守卫随之迁移）
6. **2.6 小 widget 归并**：`FrontMatterWidget`/`FootnoteRefWidget`/`FootnoteDefBackWidget`/`TaskWidget` → `editor/widgets-extended.ts`；`MathBlockWidget`/`InlineMathWidget` → `editor/widgets-math.ts`
7. **2.7 收尾**：`widgets.ts` 仅留 re-export barrel（消费方零改动兜底）或删除；`widgets.p24.test.ts` 的 `splitHighlightedLines` 导入改 `render-helpers` 直引
8. 行为不变：typecheck 双配置 + unit 全绿；`npx madge --circular --extensions ts,tsx` 0 cycles（新模块群不建新环——`BlockWidget` ← 各 widget 单向，mermaid 状态不回引 widgets）；`__velox*` e2e 缝（`setMermaidExportIo` 等签名）不变

## 不做

- 不改任何 widget 行为/eq/ignoreEvent/事件闭包语义（stale-instance 纪律原样保留）
- `MermaidWidget` 的 mermaidLightbox 联动、P16 导出对话框逻辑只平移不重写
- 不合并 `hljsTokens.ts` 色源（1C 已定契约）、不动 `table/widget.ts` 结构（3B）
- `handlers-*` 侧除 import 路径外零改动

## 方案（Plan）

- **纯平移为主**：body 逐字节移动（含注释与文件头语义注释），新文件头注明原属段落；唯一结构性变化 = 模块边界与 import 图
- 建议边界（implement 可按实际耦合微调，状态归属不可破）：
  ```
  editor/blockWidget.ts      BlockWidget + BlockToolbarItem（~120 行）
  editor/render-helpers.ts   highlightCodeHtml + renderKatexHtml + splitHighlightedLines（~80）
  editor/image-parse.ts      ParsedImage + IMAGE_MARKDOWN_RE + parseImageMarkdown + flipTransform（~45）
  editor/mermaid/render.ts   mermaidCache + 并发闸 + ensureMermaidBase + renderMermaid + clearMermaidCache
  editor/mermaid/exportIo.ts MermaidExportIo + mermaidIoOverride + setMermaidExportIo + exportSvg/exportPng/copyPngImage
  editor/mermaid/errMemory.ts mermaidLastGood + rememberMermaidGood（+ mermaidErrorDocPos 归 widget 侧）
  editor/mermaid/widget.ts   MermaidWidget
  editor/mermaid/index.ts    barrel
  editor/image-widget.ts     ImageWidget + imageCache + close/invalidate + rewriteImageNode
  editor/codeBlock-widget.ts CodeBlockWidget + CodeLangChip + CodeBlockUiOptions + hljs scope 注入
  editor/widgets-extended.ts FrontMatter/FootnoteRef/FootnoteDefBack/Task
  editor/widgets-math.ts     MathBlock/InlineMath
  editor/widgets.ts          re-export barrel（兜底）+ 文件头指向新家
  ```
- mermaid 侧依赖 `editor/widgets.ts` 现有周边（`openMermaidLightbox`/`e2eSaveDialog`/`attachWidgetContextMenu`）的 import 随功能平移；`widgets.ts` 对 `test-stubs/mermaid.ts` 的 alias 关系不变（vitest alias 按包名接管）
- e2e 契约：`handles.d.ts` 只是 type 引用路径更新，`Parameters<typeof setMermaidExportIo>[0]` 形状不变

## 任务拆分

1. 2.1：`blockWidget.ts` + `table/widget.ts` import 改道
2. 2.2：`render-helpers.ts` + `image-parse.ts` + `renderDoc.ts` 改道
3. 2.3：`editor/mermaid/` 四文件 + 7 处消费方改道
4. 2.4 + 2.5：`image-widget.ts` + `codeBlock-widget.ts`（images.ts / handlers-code 改道）
5. 2.6 + 2.7：`widgets-extended.ts` + `widgets-math.ts` + barrel 收尾 + 测试导入迁移
6. 收敛（typecheck + unit + madge 0 cycles + 缝核验 + 勾销 2.1–2.7）
