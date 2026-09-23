# 1D 拆分 handlers.ts（907 行 → 5 文件）并解开循环依赖

## What / Why

`editor/livePreview/handlers.ts` 把「共享契约 + 树 handler + 表格/代码 + 数学 pass + 扩展语法 pass」挤在一个文件，是 live preview 装饰收集的必经之路。按语法类别拆为 5 个内聚文件 + re-export barrel，使新语法扩展有明确落点；并解开现存循环依赖 `build → handlers → table/widget → livePreview/field → build`。

## 背景与现状

- 文件地图（handlers.ts 当前行号）：共享契约 L37–73（`PendingDeco`/`BuildCtx`）；Decoration 单例 + 小工具 L75–110；行内/标题/链接/图片/列表/引用/callout/hr/任务 tree handlers L112–363、L519–552；表格 + 围栏代码 L365–517（`enterTable`/`enterFencedCode`/`buildFocusedCodePanel`）；数学 pass L554–662；扩展语法 pass L664–907
- 唯一消费方 `build.ts`（一次性 import 全部 17 个导出）→ 保留 `handlers.ts` 作 barrel 则下游零改动
- 无模块级可变状态（`MATH_SKIP_NODES` 与 6 个 Decoration 为冻结单例）——最安全拆分对象
- 循环依赖成因：`field.ts` 为重建装饰而 import `buildDecorations`，而 `table/widget.ts` 为嵌套单元格编辑器 import `livePreviewField`（field），handlers 又 import `TableWidget`

## 验收标准（AC）

1. **行为不变**：以下全部不得改变——装饰输出（`buildDecorations` 快照测试全过）、正则 pass 在树 pass 之后执行的顺序契约、`enterTable` 的「激活表保持挂载/blockTouched 逃逸源码」语义、callout 折叠区间写入 `ctx.calloutFoldRanges` 契约、数学三段 matchAll（块/单行/行内）行为
2. 新文件结构：`handlers-ctx.ts`（类型+单例 Decoration+小工具）、`handlers-tree.ts`（全部 enter*）、`handlers-code.ts`（enterTable/enterFencedCode/buildFocusedCodePanel）、`handlers-math.ts`（collectMathDecos）、`handlers-extended.ts`（collectExtendedDecos）
3. `handlers.ts` 保留为 re-export barrel，`build.ts` 的 import 面零改动
4. ~~`collectExtendedDecos` 内部局部闭包提升为参数化工具~~ **方案修订（plan 阶段）**：五段保持整函数纯平移进 `handlers-extended.ts`，局部闭包原样保留——不做跨文件二次拆分即无需提升，零代码形状变化，风险更低
5. 循环依赖解除：`npx madge --circular --extensions ts,tsx src/renderer/src` 输出 0 cycles
6. `npm run typecheck && npm run test:unit` 全绿（183+ 用例）

## e2e 缝清单（本单元不触碰，拆后须照常工作）

`window.__veloxTable`（tableTestHook）、`window.__veloxP12`–`__veloxP29`、`window.__veloxCtxDebug`/`__veloxCtxLastHit`、`window.__veloxPrefs`、`window.__veloxTableCellView`；`data-op` id 与命令 id 字面量不在本单元改动面。

## 约束

- 各新文件头部注释注明自己的契约（handlers-math/handlers-extended 文件头注明「须在树 pass 之后跑」；handlers-code 注释注明「装饰层感知编辑会话」语义）
- 两个正则 pass 与 `export/renderDoc.ts` renderTextRun 是手工平行实现——文件头注明语法改动双处同步
- 不动 `BuildCtx` 字段形态（三级触碰谓词 + `calloutFoldRanges`）

## 方案（Plan）

### 文件切法（源 → 目标）

| 目标 | 内容（源 L 行域） |
|---|---|
| `handlers-ctx.ts` | L37–110 整段：`PendingDeco`/`BuildCtx`/`hide`/`markEm`/`markStrong`/`markDel`/`markCode`/`markLink`/`markLinkBroken`/`nodeText`/`listDepth`/`quoteDepth`/`hideMarkerWithSpace`（全部 `export`，供其余 4 文件 import） |
| `handlers-tree.ts` | L112–363 + L519–552：`enterHeading`/`enterHeaderMark`/`enterEmphasisMark`/`enterInlineMark`/`enterStrikethroughMark`/`enterInlineCode`/`enterLink`/`enterImage`/`enterListMark`/`enterQuoteMark`/`enterCallout`/`enterHorizontalRule`/`enterTaskMarker` |
| `handlers-code.ts` | L365–517：`enterTable`/`enterFencedCode`/私有 `buildFocusedCodePanel` |
| `handlers-math.ts` | L554–662：`MATH_SKIP_NODES`/`collectMathDecos` |
| `handlers-extended.ts` | L664–907：`collectExtendedDecos` + 提升后的参数化工具 |
| `handlers.ts` | 仅 re-export barrel（build.ts 零改动） |

### 状态/契约归属

- 全部单例 Decoration 与 `BuildCtx`/`PendingDeco` 归 `handlers-ctx.ts` 单一归属
- `MATH_SKIP_NODES` 随 `collectMathDecos` 归 handlers-math
- `buildFocusedCodePanel` 随 `enterFencedCode` 归 handlers-code（私有函数不分家）
- `inInlineSyntax`/`inlineMarkPass`/`bodyFrom` 从 `collectExtendedDecos` 局部闭包提升为 handlers-extended 内的参数化函数（同文件内私有，行为等价）

### import 改动面

- 新文件各自 import `./handlers-ctx`；handlers-code import `../table/widget`、`./codeBlockUi`、`./hljsTokens`；handlers-tree import `../widgets`（ImageWidget/TaskWidget 等）与 callout/extendedSyntax/linkNav；handlers-extended import extendedSyntax + widgets 脚注/front-matter widgets
- `build.ts` 不动（走 barrel）；`editor/setup.ts` 不动
- **解环（关键）**：`table/widget.ts` 去掉 `import { livePreviewField } from '../livePreview/field'`，改为注入缝 `setNestedPreviewField(ext)`（模块级单参 setter，`mountCellEditor` 消费）；`editor/setup.ts`（无环节点）装配时调用 `setNestedPreviewField(livePreviewField)`。`livePreviewConfigFacet` 来自 `config.ts`（不进环）保持直连

### 任务拆分

1. [P] 抽 handlers-ctx.ts（纯平移）
2. [P] 抽 handlers-math.ts（纯平移）
3. handlers-tree.ts / handlers-code.ts（纯平移，消费 ctx）
4. handlers-extended.ts（平移 + 闭包提升——唯一形状变化，单独提交）
5. barrel + 解环注入缝（单独提交）
6. converge：typecheck + unit + madge 0 cycles

### 验证方案

- `npm run typecheck && npm run test:unit`（build.test.ts 快照是装饰输出的行为基线）
- `npx madge --circular --extensions ts,tsx src/renderer/src` → 0 cycles（解环前后对比）
