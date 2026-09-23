# 3C 拆 renderDoc.ts

## What / Why

`export/renderDoc.ts`（708 行）是 P04 静态渲染器（HTML/PDF/复制富文本共用），混居上下文类型、纯字符串工具、六路 block/inline dispatch 与图片解析。拆为 `export/renderDoc/` 目录模块群：类型与纯函数先行（3.13/3.14），dispatch 按域落位（3.15），平行契约注释固化到文件头（3.16）。

## 背景与现状

- 入口 `renderDoc(markdown, opts)`（L51–97）；`RenderCtx`（L99–108）+ 工具（`textOf`/`escapeHtml`）；纯函数段 `renderTextRun`/`escapeWithAbbrs`/`asMathBlock`（inlineText 域）与 `attrsFromTrailing`/`stripTrailingAttrs`/`splitDefinitionList`/`isDefLineText`（blockAttrs 域）；dispatch 段 `renderBlockChildren`/`renderBlock`/`renderDefinitionList`（block）、`renderInline*`（inline）、`renderList*`/`renderTable`（listTable）、`renderFencedCode`/`codeBlockHtml`（code）、`resolveImageForExport`（image）、`dropCalloutHeadHtml`（callout）。
- 消费方 3 处：`export/buildDocument.ts`（`renderDoc, type ImageMode`）、`export/copyRichText.ts`（`renderDoc`）、`hooks/useExport.ts`（`type ImageMode`）。
- 递归互调图（拆分后必须保持可达）：block → inline/code/listTable/callout/inlineText/blockAttrs；listTable → inline/code；inline → inlineText/image。**inline 不回调 block**——按此切法模块依赖成 DAG，无环。

## 验收标准（AC）

- **AC1（3.13）**：`export/renderDoc/ctx.ts`——`ImageMode`、`RenderDocOptions`、`RenderCtx`、`textOf`、`escapeHtml`。
- **AC2（3.14）**：`inlineText.ts`（`renderTextRun`/`escapeWithAbbrs`/`asMathBlock`+`MathBlock`）+ `blockAttrs.ts`（`attrsFromTrailing`/`stripTrailingAttrs`/`splitDefinitionList`/`isDefLineText`），零状态纯函数，body 原样平移。
- **AC3（3.15）**：dispatch 模块 `block.ts`/`inline.ts`/`listTable.ts`/`code.ts`/`image.ts`/`callout.ts` + `index.ts`（入口 `renderDoc` + 类型 re-export）。**渲染输出逐字节不变**（行为不变类）。
- **AC4（3.16）**：`index.ts` 文件头固化平行契约：与 `livePreview/handlers-math.ts` 的数学正则同步约束、与 livePreview 的 class 契约（`markdown-image-ext` / callout / exportCss·inlineStyles 的 `export-*` 类名）。
- **AC5**：消费方 import 零改动（`from './renderDoc'`/`'../export/renderDoc'` 解析到 `renderDoc/index.ts`）；`npm run typecheck && npm run test:unit` 全绿；`npx madge --circular --extensions ts,tsx` 0 cycles。

## 约束

- e2e 缝：`__veloxP21.renderExportHtml`（P04 渲染器出口）、P20 富文本导出链路不得破坏；`window.api.readImageAsDataUrl` 调用面不变。
- 行为不变约束：所有函数 body 原样平移（含注释）；数学正则与 `handlers-math.ts` 的既有同步关系只加注释不改值。
- Constitution：纯逻辑模块配单测的义务——本单元为平移类，已有覆盖面不在迁移范围（无 renderDoc 既有单测）；新增单测不强制，纯函数（`asMathBlock`/`splitDefinitionList` 等）可留待后续。

## 不做

- 不改渲染逻辑/输出 class 名/HTML 结构（包括 `RenderCtxParts` 小类）。
- 不合并 `inlineText.ts` 的数学正则与 `handlers-math.ts`（平行契约保持，同步约束只注释固化）。
- 不为纯函数补单测（另立）；不动 `exportCss`/`inlineStyles`/`palette`。
