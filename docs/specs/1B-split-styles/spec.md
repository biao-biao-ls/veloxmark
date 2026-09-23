# 1B 拆分 styles.css（3141 行 → styles/ 目录 15 文件）+ token 收敛

## What / Why

`styles.css` 单文件 3141 行、15+ 个注释分区，样式定位靠行号记忆。按现有注释边界机械切分为 `styles/` 目录，新样式有明确落点；顺带收敛重复阴影/焦点环 token（1.5）与散落的 `.theme-dark` 旁路补丁（1.6）。

## 验收标准（AC）

1. **行为不变**：class 名/声明值/级联顺序不变（moved 块选择器均已验证组件私有、无跨区冲突；`scripts/cdp-*.mjs` 不扫 styles.css）；e2e 缝查询的 class 不受影响
2. 15 文件结构落地（下表），`styles.css` 变为按序 `@import` 的 barrel，`main.tsx` 的 `import './styles.css'` 零改动
3. 1.5：`--shadow-pop`/`--shadow-modal`/`--focus-ring` 进 `:root`（theme 无关），7 处字面量改引用
4. 1.6：callout 图标色翻 `var(--co-bar)`（16 行主题复制块减半）；katex 暗色 hex 翻 `var(--fg)`；lightbox svg 暗色补丁删除（值与 dark `--bg` 完全相同，静态等价）；lightbox 遮罩翻 `--lightbox-scrim` token；`.dialog-btn-primary` 暗色补丁归位到基础规则旁；**mermaid-error 琥珀三色、`.list-pick-item.is-active`（#111 vs #1e1e1e 值不同）不可无损翻 token——按约定「就近保留 theme 段」**（已在邻接位置，不动）
5. `npm run typecheck && npm run test:unit && npm run build` 全绿（build 证明 Vite CSS `@import` 管线正常）

## 切割图（当前行号，边界已逐行核验为完整规则间的空行）

| 目标 | 源行域 | 内容 |
|---|---|---|
| `tokens.css` | 1–78 | `*` 重置（L1–5，计划外，@import 须在样式表最前故重置必须进文件）+ `:root` 词表 |
| `themes.css` | 80–167 | `.theme-light`/`.theme-dark` + `.app` |
| `chrome.css` | 168–541 | 标题栏/菜单栏/窗口控制/布局骨架/侧栏拖拽 |
| `filetree.css` | 542–661 | 文件树 + 树菜单 |
| `context-menu.css` | 662–744 | 编辑器右键（P27 统一皮肤） |
| `overlays.css` | 745–931 + **1801–1851 + 2755–2798** | 对话框 + Quick Open + ListPickDialog + 表格插入（两段 moved-in，选择器私有无碰撞） |
| `forms.css` | 932–1087 | `.prefs-*` 家族 |
| `editor-modes.css` | 1088–1233 | 写作模式 + 编辑器内查找面板 |
| `markdown.css` | 1234–1800 + **3128–3141** + 1852–2222 | Markdown 渲染全谱（light 区后插回游离的 `.vm-mermaid-lightbox-zoom` 尾块） |
| `ext-syntax.css` | 2223–2330 | P11 扩展语法 |
| `global-search.css` | 2331–2632 | P13 全局搜索 |
| `statusbar.css` | 2633–2754 | P14 状态栏 |
| `code-chrome.css` | 2799–2891 | P24 代码块增强 + P28 聚焦面板 |
| `mermaid-preview.css` | 2892–3003 | P25 mermaid 预览面板 |
| `tabs.css` | 3004–3127 | P26 标签栏 |

`styles.css` = 15 行 `@import`（上表顺序 = 原文件级联顺序）。

## 1.5 shadow/focus token（`:root` 新增「elevation & focus」小节）

- `--shadow-pop: 0 4px 16px rgba(0,0,0,0.18)` → filetree L638、context-menu L676/L741
- `--shadow-modal: 0 8px 32px rgba(0,0,0,0.28)` → overlays L765/L849
- `--focus-ring: 0 0 0 1px var(--accent)` → statusbar L2712、mermaid-preview L2963（选中态 `outline: 2px` 两处语义不同不动；L287 `0 6px 24px` 菜单阴影值不同不动）

## 1.6 暗色补丁判定表

| 补丁 | 判定 | 动作 |
|---|---|---|
| callout `::before` 色 ×16 | 色值 == `--co-bar` | 图标色翻 `var(--co-bar)`，content 独立成无主题块 |
| `.theme-dark .katex` | #d4d4d4 == dark `--fg` | 翻 `color: var(--fg)`（形态保留，light 继承行为不动） |
| `.theme-dark .vm-mermaid-lightbox` | 遮罩双值 | 翻 `--lightbox-scrim`（themes 双套声明） |
| `.theme-dark .vm-mermaid-lightbox-content svg` | #1e1e1e == dark `--bg` 且触发条件同源 | **删除**（静态等价），base 注释留痕 |
| `.theme-dark .dialog-btn-primary` | 单值 #1e1e1e | 不翻 token（与 list-pick #111 值不同），**归位**到 `.dialog-btn-primary` 基础规则旁 |
| `.theme-dark .cm-md-mermaid-error` | 琥珀三色无对应 token | 就近保留（已邻接，不动） |
| `.theme-dark .list-pick-item.is-active` | #111 ≠ #1e1e1e | 就近保留（已邻接，不动） |

## 不做

- 1.7 按钮 primitives（可选项，单独评估后另立单元）
- markdown.css 内部再细分（计划明示「可后续再细分」）

## 验证方案

- `npm run typecheck && npm run test:unit`（CSS 无单测，行为基线 = build 产物 + 人工冒烟）
- `npm run build`：证明 Vite 解析 `@import` 级联无误
- 收敛后 `grep -c` 抽查 moved 块私有选择器无第二落点
