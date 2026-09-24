# 8C 实施方案

## 技术决策与理由

- **`renderKatexChecked(tex, displayMode): { ok, html }`**（`render-helpers.ts`，katex 归口模块）：`ok` = `katex.renderToString(…, { throwOnError: true })` try/catch 探针；`html` 两分支**都**走既有 `renderKatexHtml`（合法 TeX HTML 与现状逐字节一致——同壳契约，探针不改渲染面）。
- **错误条挂在 `MathBlockWidget.toDOM`**（不新增 widget 类型）：`!ok` 时 `el` 追加 `.cm-md-math-error` bar（textContent `math.renderFailed`）+ `.cm-md-math-jump` 按钮（`math.jumpToSource`）。合法 TeX 零新 DOM（AC3）。
- **跳转 = 事件时 `findMathBlockAt(view.state.sliceDoc(), this.sourceFrom)`**（mathScan 文件头指定缝；返回 `match.start` = `$$` 起点 = widget `sourceFrom` 同点）→ `dispatch({ selection: { anchor }, scrollIntoView: true })` + `view.focus()`（mermaid 跳转 dispatch 形态同款）；null 回退 `Math.min(sourceFrom, doc.length)` clamp。
- **皮肤共享而非复制**（红线 6）：`markdown.css` 四条规则（`.cm-md-mermaid-error` + dark 变体 + `.cm-md-mermaid-jump` + hover）的选择器列表扩展加 `.cm-md-math-error`/`.cm-md-math-jump`——规则体零复制，mermaid class 名零改（e2e 缝安全）。
- **8B 预览态不做错误条**（plan 决策，spec Out of scope）：编辑态源码就在预览上方，跳转无增量；`MathPreviewWidget` 保持 KaTeX 错误着色现状。
- **按钮事件卫生**：mousedown/click `preventDefault + stopPropagation`（mermaid jump 同款；防 wrapWithGap click-to-source 抢跑重复跳转）。
- **i18n**：+2 key（`math.renderFailed` 公式渲染失败 / `math.jumpToSource` 跳到源码），en+zh 同落。
- **测试**：`render-helpers.test.ts` 新建——`renderKatexChecked` 合法/非法 `ok` 标志 + html 非空（html 细节不断言，KaTeX 版本间 markup 有差异空间）。跳转落点不新增测试（`findMathBlockAt` 既有测试已钉）。

## 文件切法

| 源 | 改动 |
|---|---|
| `editor/render-helpers.ts` | `renderKatexChecked`（探针 + 既有 html 面） |
| `editor/render-helpers.test.ts` | **新建**：ok 标志单测 |
| `editor/widgets-math.ts` | `MathBlockWidget.toDOM` 错误条 + 跳转按钮装配（~25 行） |
| `styles/markdown.css` | 4 条 mermaid 错误条/跳转钮规则的选择器列表扩展 |
| `i18n/zh.ts` + `i18n/en.ts` | 各 +2 key（`math.renderFailed`/`math.jumpToSource`） |

## 状态/契约归属

无新状态。错误检测是渲染时纯探针；跳转走文档选区（唯一数据源）。

## import 改动面

`widgets-math` → `./render-helpers`（renderKatexChecked，已有 renderKatexHtml import 面）、`./livePreview/mathScan`（findMathBlockAt，纯模块零依赖）。mathScan 不反向 import——madge 守护。

## 任务拆分

1. `renderKatexChecked` + 单测 [先行]
2. `MathBlockWidget` 错误条装配 [依赖 1]
3. CSS 选择器扩展 + i18n [依赖 2]

## 验证方案

- `npm run typecheck && npm run test:unit`（新单测全绿；i18n 对齐过）
- `npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles
- e2e 缝：diff 零既有字面量改动（mermaid class 名存续核对）
- 人工冒烟：
  1. 非法 TeX（如 `\frac{`）：块内 KaTeX 错误着色 + 下方错误条「公式渲染失败 …… [跳到源码]」
  2. 点按钮 → 光标落在 `$$` 起点、滚动跟随、源码显形（P09）
  3. 合法 TeX：零错误条（对照修复前渲染逐像素一致）
  4. 8B 聚焦编辑态：无错误条（预期行为）、错误着色仍在
  5. 深浅主题错误条观感（amber 色板两主题已备）

## 实现细化（2026-09-25 implement 时决策）

- `renderKatexChecked` 按 plan 落地：探针 `katex.renderToString(tex, { displayMode, throwOnError: true })` try/catch 定 `ok`；`html` 两分支均 `renderKatexHtml(tex, displayMode)`（同壳契约——合法 TeX 与 8C 前逐字节一致）。
- `MathBlockWidget.toDOM`：`!ok` 时在 KaTeX 输出后追加 `.cm-md-math-error` bar（textContent `math.renderFailed`）+ `.cm-md-math-jump` 按钮（`math.jumpToSource`）；按钮 mousedown/click 均 `preventDefault + stopPropagation`（防 wrapWithGap click-to-source 抢跑）。点击处理闭包只持 `view` + `this.sourceFrom` 提示偏移，事件时 `findMathBlockAt(view.state.sliceDoc(), this.sourceFrom)` 重解析（stale-instance 纪律），`match.start`（= `$$` 起点）→ `dispatch({ selection: { anchor }, scrollIntoView: true })` + `view.focus()`；null 回退 `Math.min(sourceFrom, doc.length)` clamp。
- CSS 红线 6 共享皮肤：`markdown.css` 4 条规则（`.cm-md-mermaid-error` + dark 变体 + `.cm-md-mermaid-jump` + `:hover`）选择器列表各扩展 `.cm-md-math-error`/`.cm-md-math-jump`，规则体零复制，mermaid class 名零改。
- `MathPreviewWidget`/`InlineMathWidget` 不动（Out of scope）；8B 预览态错误着色现状保留、无错误条。
- i18n：`math.renderFailed`/`math.jumpToSource` 落 zh.ts + en.ts（en 在 codeBlock 域内紧邻；zh 平面 key 顺序仅观感，key 对齐测试守护集合）。
- 测试：`render-helpers.test.ts` 新建 3 例——合法 TeX `ok:true` 且 html 与 `renderKatexHtml` 相同 + 含 'katex'；非法 TeX `ok:false` 且 html 非空；displayMode 透传不影响 ok 标志。跳转落点不另测（`findMathBlockAt` 既有测试已钉）。

## 收敛记录（2026-09-25）

- `npm run typecheck` 双 tsconfig 全过 ✓
- `npm run test:unit`：34 文件 / 328 例全绿（+3 render-helpers；含 i18n key 对齐）✓
- `npx madge --circular --extensions ts,tsx src/renderer/src`：✔ No circular dependency found（widgets-math → mathScan 单向）✓
- e2e 缝：diff 无 `data-op`/`data-table-handle`/`__velox` 等既有字面量改动；`cm-md-mermaid-jump`/`cm-md-mermaid-error` 在 renderHost/markdown.css 存续（仅选择器列表加共享项）✓
- 待运行时冒烟补签（5 点）：
  1. 非法 TeX（如 `\frac{`）：块内 KaTeX 错误着色 + 下方错误条「公式渲染失败 …… [跳到源码]」
  2. 点按钮 → 光标落在 `$$` 起点、滚动跟随、源码显形（P09）
  3. 合法 TeX：零错误条（对照修复前渲染逐像素一致）
  4. 8B 聚焦编辑态：无错误条（预期行为）、错误着色仍在
  5. 深浅主题错误条观感（amber 色板两主题已备）
