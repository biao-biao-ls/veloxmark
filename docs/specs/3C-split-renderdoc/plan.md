# 3C 实施方案

## 技术决策与理由

- **入口进目录（`renderDoc/index.ts`），删同级 `renderDoc.ts`**：避免 `renderDoc.ts` 与 `renderDoc/` 并存的解析遮蔽隐患；消费方 `from './renderDoc'` 由 bundler 解析到 `index.ts`，零改动。
- **dispatch 切法取「inline 不回调 block」的 DAG**：`renderInline` 的 default 分支只走 `renderInlineChildren`，嵌套块由 `renderList`/`renderBlock` 各自消化——按此边界 block → {inline, code, listTable, callout} 单向，免注入缝（spec 3.15 允许的「同模块内聚」在此升级为显式无环分层，madge 守护）。
- **`dropCalloutHeadHtml` 独立 `callout.ts`**：Blockquote 的 callout 分支装配留在 `block.ts`（dispatch 本体），HTML 头剥离纯函数随 callout 域走。
- **`RenderCtxParts` 随 `block.ts`**：唯一使用点（Blockquote 子收集）。
- **body 一律原样平移**（含注释），仅文件头 banner 与 import 增删属 sanctioned deviation。

## 文件切法

| 目标文件 | 迁入函数/类型（源行号） |
|---|---|
| `renderDoc/ctx.ts` | `ImageMode`（40）`RenderDocOptions`（42–49）`RenderCtx`（99–108）`textOf`（110–112）`escapeHtml`（114–120） |
| `renderDoc/inlineText.ts` | `renderTextRun`（149–190）`escapeWithAbbrs`（192–209）`MathBlock`+`asMathBlock`（261–274） |
| `renderDoc/blockAttrs.ts` | `attrsFromTrailing`（211–219）`stripTrailingAttrs`（221–224）`isDefLineText`（226–229）`splitDefinitionList`（231–259） |
| `renderDoc/callout.ts` | `dropCalloutHeadHtml`（122–147） |
| `renderDoc/code.ts` | `renderFencedCode`（463–481）`codeBlockHtml`（483–486） |
| `renderDoc/image.ts` | `resolveImageForExport`（699–708） |
| `renderDoc/inline.ts` | `renderInlineChildren`（597–603）`renderInlineRange`（605–624）`renderInline`（626–690） |
| `renderDoc/listTable.ts` | `renderList`（490–508）`renderListItem`（510–542）`renderTable`（546–589） |
| `renderDoc/block.ts` | `renderBlockChildren`（278–318）`renderDefinitionList`（321–339）`renderBlock`（341–454）`RenderCtxParts`（457–459） |
| `renderDoc/index.ts` | 文件头契约注释（26–38 扩写，3.16）`renderDoc`（51–97）+ `export type { ImageMode, RenderDocOptions } from './ctx'` |

模块间调用边（无环）：index → block/inlineText/ctx；block → ctx/blockAttrs/inlineText/callout/inline/code/listTable/inline-text 工具；listTable → ctx/inline/code；inline → ctx/inlineText/image；code → ctx/render-helpers/mermaid；callout → livePreview/callout 类型；image → ctx。

## 状态/契约归属

- 无模块级可变状态（renderDoc 纯函数族 + `RenderCtx` 显式传递）；`RenderCtx.parts` 是唯一输出累加器，归属不变。
- 平行契约（3.16 文字化）：数学正则 ↔ `handlers-math.ts`；`export-*`/`export-callout*` class ↔ `exportCss.ts`/`inlineStyles.ts`；`imageSizeMarkdown` ↔ `editor/markdown-image-ext`。

## import 改动面

- 删除 `export/renderDoc.ts`；新建 `export/renderDoc/` 10 文件。
- 消费方 **零改动**：`buildDocument.ts`/`copyRichText.ts`/`useExport.ts` 的 `from './renderDoc'`/`'../export/renderDoc'` 解析到 `index.ts`（re-export 保持 `renderDoc`/`ImageMode`/`RenderDocOptions` 名字不变）。

## 任务拆分

1. 3.13+3.14：切 `ctx.ts`/`inlineText.ts`/`blockAttrs.ts`（纯函数先行）
2. 3.15：切六个 dispatch 模块 + `index.ts` 入口，删 `renderDoc.ts`
3. 3.16：文件头平行契约注释扩写（随 index.ts 一步到位）

（单一路径执行；一次性脚本切分 + 迁移后 typecheck 校验缺失 import。）

## 验证方案

- `npm run typecheck && npm run test:unit`；`npx madge --circular --extensions ts,tsx src/renderer/src`（期望 0 cycles）。
- 消费方 grep 确认零 `renderDoc.ts` 直引；输出等价性靠 body 原样平移（diff review）+ 人工冒烟导出 HTML/PDF/复制富文本各一。
