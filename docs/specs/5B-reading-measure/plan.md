# 5B 阅读版心与行号 实施方案

## 技术决策与理由

**现状核实（推翻 spec 阶段「版心机制缺失」假设的一半）**：

- **居中机制已存在且正确**：`editor/theme.ts` 两个主题的 `.cm-content` 已带 `maxWidth: var(--cm-content-max-width, var(--editor-max-width))` + `margin: 0 auto`（F01 变量通道给嵌套单元格编辑器归零）。
- **gutter 顾虑不存在**：`@codemirror/view` baseTheme 中 `.cm-scroller` 是 `display: flex`，`.cm-gutters`（`flexShrink: 0`）与 `.cm-content` 是 **flex 兄弟**——`margin: 0 auto` 的内容列在剩余空间居中，行号/折叠 gutter 天然贴列左缘，F06 契约（number-right → prose-left = `--editor-gutter`）自动保持。
- **截图通栏的直接原因** = 运行中偏好 `editorMaxWidth = 0` → `applyPreferencesCssVars` 写 `'100%'`（store.ts L351–354）。`.cm-content` 拿到 100% 即通栏。默认值 800 本身已是窄栏。
- **块 widget「限宽双计」**：`--editor-max-width` 的 max-width 消费点全仓只有 `.cm-md-table-wrap`（markdown.css L739）；`margin: 0 var(--editor-gutter)` 消费点 5 处（markdown.css 383/422/577/736、code-chrome.css 57、ext-syntax.css 62）。0 值改软上限后，L739 的 `max-width: min(90%, 1200px)` 中 `%` 以 content 列宽为基准 → 表格会缩到列宽 90%（**% 基准陷阱**），必须去掉该行。

**决策**：

- **D1（用户已拍板）0 = 软上限 `min(90%, 1200px)` + 居中**：`applyPreferencesCssVars` 0 分支写 `min(90%, 1200px)`；`tokens.css` 的 `:root --editor-max-width` 默认值同步（JS 注入前一致）。>0 语义不变（px 列宽）。
- **D2 删 `.cm-md-table-wrap` 的 `max-width`**（L739）：列宽由 `.cm-content` 统一约束，widget 凭 `margin: 0 var(--editor-gutter)` 与 `.cm-line` 文本对齐（F05 语义升级为「同列」而非「同 max-width」），避免 D1 的 % 基准陷阱。
- **D3 行号默认关（行为变更）**：`showLineNumbers: true → false`（store.ts L131）。只改默认值：已存偏好用户不受影响；gutter 贴列由 flex 布局保证，行号开着时无布局分支。
- **D4 文案同步**：偏好滑杆 `prefs.contentWidth`（0–4000 步进 20）的 0 值语义变了，en/zh 文案（`prefs.contentWidth` / `prefs.widthUnit` 或增 hint）表达「0 = 自适应（软上限）」。

## 文件切法

| 源 | 改动 |
|---|---|
| `preferences/store.ts` | L351–354 0 分支 → `'min(90%, 1200px)'`；L131 `showLineNumbers: false` |
| `styles/tokens.css` | L59 `--editor-max-width: 100%` → `min(90%, 1200px)` |
| `styles/markdown.css` | L738–739 删 `max-width: var(--editor-max-width)`，F05 注释改写 |
| `i18n/en.ts` + `i18n/zh.ts` | 0 值语义文案（D4） |

不动：`editor/theme.ts`（机制正确，仅注释无需动）、`code-chrome.css`/`ext-syntax.css` 的 `margin: 0 var(--editor-gutter)`（对齐机制正确）、`table/keymap.ts` `nestedCellTheme`（F01 归零通道）。

## 状态/契约归属

- `applyPreferencesCssVars` 写 `:root` inline 是 4.1 知情豁免——**不扩大**到其他 token，仅改 0 分支的值表达式。
- F01 通道（`--cm-content-max-width`/`--cm-content-padding`）、F05/F06 注释契约：F05 措辞随 D2 更新，语义（块 widget 与正文同列）保持。
- `gutterCompartment` / `toggleLineNumbers`（setup.ts）不动——P03 偏好切换路径原样。

## import 改动面

无。纯值/文案改动，零新 import。

## 任务拆分

| # | 任务 | 依赖 |
|---|---|---|
| T1 | store 0 值软上限 + `showLineNumbers` 默认关（D1/D3） | — |
| T2 | tokens.css 默认值 + 表格 max-width 清理（D1/D2） | [P] T1 |
| T3 | i18n 0 值文案 en+zh（D4） | [P] T1 |
| T4 | 人工冒烟（见验证） | T1–T3 |

## 验证方案

```bash
npm run typecheck && npm run test:unit
```

- 人工冒烟（行为变更单元，必做）：
  1. 偏好滑杆三档：0（≈1200px 居中）/ 800（800px 居中）/ 4000（通栏），块 widget（表格/代码/公式/mermaid/callout/图片）与正文同列左缘
  2. 行号开关来回切 + 重启保持（默认关、开后 F06 对齐、折叠 gutter 贴列）
  3. 嵌套表格单元格编辑器不被列宽约束（F01）、写作模式/查找面板不回归
  4. 窗口缩放 / 侧栏拖宽后列仍居中
- 截图复拍对照 AC1/2（同视口 vs `temp/typora/typora-1.png`）
- i18n 对齐测试（0.2）自动覆盖新文案 key
