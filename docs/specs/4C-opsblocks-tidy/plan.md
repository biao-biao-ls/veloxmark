# 4.3 opsBlocks 整理 — 实施计划

## 技术决策与理由

- **`applyLineChanges` 落 transforms.ts**：文件头已宣称「纯 view dispatch、单 undo step」约定——把约定做成原语放在宣称处，opsBlocks/blockHelpers 单向复用（"opsBlocks 复用 transforms.ts dispatch 约定"字面落地）；不反向 import，contextMenu 内 DAG 无环。
- **缩进对合并**：`indentFenceBody`/`indentSelectedLines` 循环体逐字相同，合并 `indentLines(view, from, to, userEvent)` + 保留两个薄包装（调用点语义名不变）；change 形状保持 line 首插 `'  '`（不重写为整行替换——结果等价但 undo 映射形状不同，不赌）。
- **表格段迁 `editor/table/source.ts`**：纯表格源域操作 + 唯一消费方 opsTable（表格模块）；`transforms.ts` 甩掉 `table/*`/`format` 依赖后成为纯段落/行变换模块。`format → table/parse` 方向已核，`source → format` 无环。
- **死导出 `tableSource` 删除**：零调用点（`tableModelOf`/`tableMarkdown` 直接 `sliceDoc`），3.9 `cellClipboard` 先例。

## 文件切法

| 源 | 目标 | 内容 |
|---|---|---|
| opsBlocks L25–94 | `contextMenu/blockHelpers.ts` | `enclosingNode`/`mathRange`/`fenceBody`/`mermaidSvgAt`/`deleteRange`/`confirmDanger` 原样平移 |
| opsBlocks L269–303 | 同上 | 两缩进函数 → `indentLines`（循环体平移）+ 薄包装 `indentFenceBody`/`indentSelectedLines` |
| transforms L14–17 | 本地保留 | `selectionLineNumbers` 留 transforms 私有 |
| transforms 三函数循环 | `applyLineChanges`（新导出） | per-line 建 changes → guard → 单 dispatch 的原语；三函数改写为 edit 回调 |
| transforms L133–181 | `editor/table/source.ts` | `tableModelOf`/`tableMarkdown`/`formatTableSourceRange`/`deleteTableRange` 平移；`tableSource` 删除 |
| opsTable import | `../table/source` | 四函数 import 路径改写 |

原语形状：

```ts
export function applyLineChanges(
  view: EditorView,
  startLine: number,
  endLine: number,
  edit: (line: Line) => { from: number; to: number; insert: string } | null,
  userEvent: string
): void {
  const changes: { from: number; to: number; insert: string }[] = []
  for (let n = startLine; n <= endLine; n++) {
    const ch = edit(view.state.doc.line(n))
    if (ch) changes.push(ch)
  }
  if (changes.length) view.dispatch({ changes, userEvent })
}
```

## 等价性说明

| 调用点 | 原形状 | 收敛后 | 等价点 |
|---|---|---|---|
| `setHeadingLevel` | push 全行替换（`insert !== line.text` 才 push） | edit 返回 null 表跳过 | 同 changes 数组、同 userEvent |
| `toggleBlockquote` | 同上 | 同上 | 同上 |
| `convertList` | 同上 + `olIndex` 跨行闭包态 | edit 闭包携带 `olIndex` | 递增序不变 |
| `indentFenceBody`/`indentSelectedLines` | line 首插 `'  '`（跳 fence/空行） | `indentLines` → edit 返回 `{from: line.from, to: line.from, insert: '  '}` | change 形状逐字同 |
| 表格段 4 函数 | transforms 内平移 | `table/source.ts` 平移 | body 含 UX-P28 注释逐字；`deleteTableRange` 的 `setActiveCell.of(null)` 随迁 |

## 验证方案（converge）

1. `npm run typecheck && npm run test:unit` 全绿。
2. `npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles。
3. grep 断言：userEvent 字面量全集不变（`indent.code`/`indent.selection`/`callout.type`/`delete.image|mermaid|code|math|callout`/`input.contextMenu.*`）；`data-op` id 全集不变（`image.*`/`mermaid.*`/`code.*`/`math.*`/`callout.*`/`heading.*`/`fm.edit`）；`tableSource` 全仓 0 命中；transforms 不再引 `table/`。
4. 人工冒烟（行为不变类）：代码块右键（复制/缩进块/缩进选区/删除）、mermaid/图片/数学/callout/标题/front-matter 右键各一项、表格右键复制表格/格式化/删除表格、段落▶/格式▶ 转换各一。
