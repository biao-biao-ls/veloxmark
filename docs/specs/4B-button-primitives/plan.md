# 4.2 按钮皮肤归并 — 实施计划

## 技术决策与理由

- **别名组而非 TSX 换类名**：`.dialog-btn*` class 名保留、皮肤声明 comma 并入 `.btn` 组——零 DOM 变化即零探针/用户脚本风险（AC2）；primitives 对新代码可用。
- **皮肤/几何分层**：皮肤六声明（color/bg/border/radius/cursor/hover-bg）单源；几何留本地（两族尺寸差异是刻意的场景适配，强行统一会视觉回归）。
- **整块搬家含 `:active`**：cm-button 三态（base/hover/active）整体入 buttons.css 保内部次序；barrel 位置（forms 后、editor-modes 前）兜底保证 active 压 hover 的级联不变。

## 文件切法

| 源 | 目标 | 内容 |
|---|---|---|
| overlays.css L65–96 | buttons.css | dialog-btn 族（base/hover/primary/theme-dark/primary:hover） |
| forms.css L136–139 | buttons.css | dialog-btn-danger |
| editor-modes.css L66–85 | buttons.css | cm-button base/hover/active |
| — | buttons.css 新增 | `.btn`/`.btn-primary`/`.btn-danger` 并入各规则组 + 头注释（不并 4 族划界） |
| styles.css barrel | +1 行 | `@import './styles/buttons.css';`（forms.css 之后） |

规则组形状：

```css
.btn, .dialog-btn, .cm-search .cm-button { /* 皮肤六声明 */ }
.btn:hover, .dialog-btn:hover, .cm-search .cm-button:hover { background: var(--code-bg); }
.dialog-btn { /* 几何 */ }
.cm-search .cm-button { /* 几何 + font-family/line-height */ }
.cm-search .cm-button:active { /* 原样 */ }
.btn-primary, .dialog-btn-primary { /* 原样 */ }
.theme-dark .btn-primary, .theme-dark .dialog-btn-primary { /* #1e1e1e 特例 + 注释随迁 */ }
.btn-primary:hover, .dialog-btn-primary:hover { /* filter 原样 */ }
.btn-danger, .dialog-btn-danger { /* 原样 */ }
```

## 等价性说明

- 同值迁移：无任何声明值改动；拆分 base 规则为「皮肤组 + 几何组」不改 computed style（声明集不重叠）。
- 级联：组内相对次序保持原文件次序（dark 特例在 primary 后、active 在 hover 后）；`.btn*` 新选择器当前零消费方，不影响任何现有元素。
- 暗色特例注释（list-pick #111 ≠ #1e1e1e 的 why）逐字随迁。

## 验证方案（converge）

1. `npm run typecheck && npm run test:unit` 全绿（palette↔CSS 测试零改色应不动）。
2. grep 断言：`.dialog-btn`/`.dialog-btn-primary`/`.dialog-btn-danger`/`.cm-search .cm-button` 各声明只存于 buttons.css（overlays/forms/editor-modes 零残留）；`theme-dark` 特例注释在。
3. 零 TSX 改动：`git diff --stat -- '*.tsx'` = ∅。
4. 人工冒烟（视觉不变类）：对话框按钮三态（普通/primary/danger，亮暗主题）、搜索面板按钮（hover/active）、4 个非并控制族各过一眼（seg/stat/mermaid-bar/tab 菜单）无视觉变化。
