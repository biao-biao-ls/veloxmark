## 代码审查报告 — IT-02/FE-10 侧栏视觉 token 化审计

**得分：** 90/100（阈值：90）　**状态：** ✅ 通过（Important-1 裁定必修=登记修正，主 agent 落地；3 Minor 入收口批候选）
**基线规范：** code-review SKILL.md + rubric-code-review.md（前端 90 阈值）；风格归因已前置
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）
- **已有代码**：token 唯一声明点 `:root` + 同族先例 `--img-resize-*`/`--grid-cell-*`/`--handle-*`（tokens.css:112-155）——FE-10 侧栏 metrics 族（tokens.css:157-206）完全同构；守护测试共置于 `styles/*.test.ts`（tokens.test.ts 先例）；行 hover 用 `--bg-inset`、chrome 按钮 hover 用 `--code-bg` 为既有格局（mock ui_05:412/571 同）
- **CLAUDE.md 宪法**：`:root` 唯一声明点 / 主题只翻 `.theme-light|.theme-dark` 值 / 间距圆角走 `--space-*`/`--radius-*` / 禁 `.theme-dark` 补丁 —— 全部遵循（tokens.test.ts:97-102 allowlist 守护，侧栏分区零补丁）
- 团队规范高于以上两层处仅记 Info

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 需求合规-功能实现 | 10 | 10 | 无：token 族/分区改写/--tree-depth 无单位缩进/焦点环 token/双主题走查证据齐备 | — |
| 需求合规-遗漏 | 4 | 8 | doc-drift 登记未随 r2 收敛更新 + 守护扫描盲区（见问题 1/2） | 客观（交付完整性） |
| 需求合规-多做 | 8 | 8 | 无越界功能 | — |
| 需求合规-理解 | 7 | 7 | 代码对齐 mock 28px/16px、hover=--bg-inset、focus=同底+accent 环、active=--accent-soft+左条（像素取证一致） | — |
| 需求合规-边界 | 7 | 7 | 三态可区分/对比度/零补丁/零裸值均有测试或双主题证据 | — |
| 代码质量-职责分离 | 10 | 10 | 无 | — |
| 代码质量-错误处理 | 10 | 10 | 纯样式无运行时错误面 | — |
| 代码质量-编码风格 | 8 | 8 | 与 tokens.css 分区注释/FE-seam 引注/共置测试惯例一致 | — |
| 代码质量-测试覆盖 | 4 | 8 | 守护存在且测真实文件，但 selector 正则漏 `.recents-current`、at-rule 脆弱、无豁免登记机制（部分通过） | 客观 |
| 代码质量-安全 | 8 | 8 | 无 | — |
| 代码质量-性能 | 8 | 8 | ROW_HEIGHT=28 与 --tree-row-h=28px lockstep（FileTree.tsx:41 ↔ tokens.css:177），虚拟化数学完好 | — |
| 代码质量-DRY | 4 | 4 | 无 | — |
| 代码质量-YAGNI | 2 | 4 | `--text-glyph` 声明并入守护清单但全仓零消费（部分通过） | 客观 |
| **合计** | **90** | **100** | | |

### 问题清单

| severity | item | detail | location | suggestion |
|---|---|---|---|---|
| Important | 交付登记过期 | implementation-notes/doc-drift 仍写 `--tree-row-h=25px`、`--tree-indent=14px`、缩进 `--space-3+×depth`、hover `--code-bg`；实况为 28px/16px/`calc(var(--tree-indent)*(depth+1))`/hover `--bg-inset`。自警「勿改 28px 而不动窗口化数学」已反转（现 28↔28 lockstep）。r2 R1/R2 要求更新登记未落地，照注释改码会破坏虚拟化对齐 | `tasks/IT-02/FE-10.md:26-31`（对照 tokens.css:176-178、FileTree.tsx:41、filetree.css:21,29） | 勾销或改写 doc-drift #1/#2/#4 为现状口径（28px 契约 lockstep、16px 步进含大纲、hover/focus/active 三线索=bg-inset / bg-inset+环 / accent-soft+左条），同步 implementation-notes → **裁定必修，主 agent 登记修正落地** |
| Minor | 守护扫描盲区 | `SIDEBAR_SELECTOR` 不匹配 `.recents-current`；global-search.css 的 `.sidebar-mode-seg`/`.search-panel .sidebar-header` 有裸 px（6/2/10/22px）不在扫描文件集且无豁免登记（属搜索面板既有债务，但 grep「侧栏 selector 零裸值」会命中） | `styles/sidebarTokens.test.ts:51,129-137`；filetree.css:390；global-search.css:12-37 | selector 增补 `.recents-current`（或改为类名清单）；global-search.css 纳入扫描或在测试内登记豁免注明归属 → 收口批候选 |
| Minor | 死 token | `--text-glyph: 9px` 声明并列入 SIDEBAR_ROOT_TOKENS，全仓无 `var(--text-glyph)` 消费点 | tokens.css:202；sidebarTokens.test.ts:105 | 删除该 token 与清单项，或将 glyph 类字号（twisty/占位）接到它 → 收口批候选 |
| Minor | 解析脆弱 | `rules()` 不支持 at-rule/嵌套（文件头自认），日后被扫文件出现 `@media` 会静默漏扫 | sidebarTokens.test.ts:39-48 | 增加断言「三被扫文件不含 `@`」哨兵，或升级块解析 → 收口批候选 |
| Info | 归位 | `--statusbar-height` 落在 FE-10 侧栏 token 块内（注释标 batch-D 归属 toast） | tokens.css:195-199 | 迁至 toast/statusbar 段或保持注释即可 |
| Info | 证据路径 | AC 字面 `reports/FE-10/FE-10-impl.png` vs 实际 `reports/IT-02-FE-10/IT-02-FE-10-impl{,-light,-dark}*.png` | reports/IT-02-FE-10/ | 勾销 AC 时按仓库 `reports/IT-xx/FE-xx` 惯例注明实际路径（项目惯例优先，不扣分） |
| Info | i18n | 本任务零 i18n 交付物；`▸/▾/·` 为图形字形非文案（FileTree.tsx:565、Outline.tsx:167,171，与 mock/FE-08 glyph 换向惯例一致）；AC-FN-07/AC-RULE-11 快捷键回显属 BE-01 存量域不在本任务 | — | 无 |

### 结论

✅ **通过（90/100）**。实现侧质量好：侧栏分区零裸值/零色值/零 `.theme-dark` 补丁，token 族同构既有惯例，ROW_HEIGHT 虚拟化契约 lockstep 完好，三态与焦点环 token 化并有双主题像素级取证。两个实际缺口：(1) 任务交付登记（implementation-notes/doc-drift）与最终代码严重不同步且带反转性误导自警，须按问题 1 更新（裁定必修，登记修正由主 agent 落地）；(2) 守护测试存在扫描盲区与死 token，按 Minor 三条收口。
