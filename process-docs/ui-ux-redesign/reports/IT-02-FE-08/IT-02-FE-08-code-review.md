## 代码审查报告 — IT-02/FE-08 大纲键盘导航

**得分：** 96.5/100（阈值：90）
**状态：** ✅ 通过（Important-1 裁定必修，已派 fix-cr-FE08-foldable；单测证据收口）
**基线规范：** rubric-code-review.md + code-review/SKILL.md + 项目 CLAUDE.md（根/前端/renderer 三级）
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）

- **已有代码风格**（最高层，已核 6 个同构文件）：`filetreeKeys.ts`/`FileTree.tsx`（FE-06 已过审）的 resolveKey/toVisibleRows 纯逻辑 + 组件只管 DOM 焦点、`pendingFocusRef+data-nav-index` 补焦、`kbdNav`/`:focus-visible` 双轨焦点环、blur 全离开复位——`outlineKeys.ts`/`Outline.tsx` 逐条镜像该 idiom；字形 ▾/▸ 与 `fold.ts:222`、`FileTree.tsx:565` 一致；折叠 tooltip 复用 `render.fold.*` 单源。
- **CLAUDE.md 约定**：纯逻辑抽模块 + 同目录 `*.test.ts`；文案 `t('ns.key')` 且 en/zh 对齐；样式全 token 无裸值；新逻辑不入 App.tsx（本任务逻辑全在组件/纯模块，App 仅接线）。
- **结论**：风格与两层优先源一致，无风格扣分。i18n 抽查 `outline.empty`/`render.fold.collapse|expand` 在 en.ts:411,589-590 / zh.ts:406,583-584 对齐；本任务未新增快捷键，AC-FN-07/AC-RULE-11 回显双源问题不适用（无 commands/main.ts 触碰）。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 功能全实现 | 10 | 10 | — | |
| 遗漏需求 | 8 | 8 | Home/End 按契约 §3.2 不实现，无遗漏 | |
| 需求外多做 | 8 | 8 | foldable 判据为 FE-09#2 对齐件，有据 | |
| 需求理解 | 7 | 7 | Enter→onSelect(pos) 与点击同径=FE-07 jumpToHeading(pos)，方向性 ←/→ 非 toggle，正确 | |
| 边界/异常 | 3.5 | 7 | ←/→ 未过 `foldable` 门（-3.5） | 客观（正确性） |
| 职责分离 | 10 | 10 | — | |
| 错误处理 | 10 | 10 | 任务列明异常场景全落实（空态/叶子/正文焦点/无 toast）；foldable 缺口不双扣 | |
| 编码风格 | 8 | 8 | — | |
| 测试 | 8 | 8 | 31 例纯逻辑真实断言，覆盖 AC 四类映射 | |
| 安全 | 8 | 8 | 文本走 React children，无注入面 | |
| 性能 | 8 | 8 | toOutlineNodes O(n) + useMemo，无热点 | |
| DRY | 4 | 4 | 与 filetreeKeys 镜像为 FE-06 合同要求，非重复债 | |
| YAGNI | 4 | 4 | — | |
| **合计** | **96.5** | **100** | | |

### 问题清单

| severity | item | detail | location | suggestion |
|----------|------|--------|----------|------------|
| Important | ←/→ 缺 `foldable` 门控 | `resolveKey` 的 ArrowLeft/ArrowRight 只判 `hasChildren && 状态相异`，未判 `node.foldable`。可构造边界：`# A\n## B`（末尾无正文）时 A 经 `collectFoldSections`（fold.ts:70 `lines<=0` 跳过）不可折叠、三角渲染「·」占位，但键盘 ← 仍发 `collapse` → `onToggleFold` 幽灵 key 入 `foldField`（视觉零变化，与模块头注释 "toggling them would be a no-op"、契约「等效点击折叠三角」相悖）；幽灵 key 留在 `foldedKeys` 镜像与 foldField，日后该节补入正文行会突然呈现折叠态 | outlineKeys.ts:82,89 | 两处 disabled 判据补 `!node.foldable`（`if (!node.hasChildren \|\| !node.foldable \|\| …)`），使键盘与三角点击同门 |
| Minor | 单测缺 hasChildren&&!foldable 的 ←/→ 分支 | `showsFoldTriangle` 有「空章节→占位」用例，但 `resolveKey` 侧同形态（有子节、foldable=false）无断言，上述缺口未被测试拦截 | outlineKeys.test.ts:116-128 | 在「折叠/展开」describe 增一例：`node('1:a',1,'a',true,true,false)` 按 ←/→ 均期望 `none` |
| Info | 空节占位体例与正文面不同 | 大纲空节用字面「·」，正文同场景用 `visibility:hidden` 的 ▾ 幻影 caret（fold.ts:236-252）；两面设计稿各自规定（ui_05/ui_06），仅提示观感差异，不扣分 | Outline.tsx:170 | 无需改动；若后续统一观感走 UI 观感任务 |

### 结论

✅ **通过（96.5 ≥ 90）**。AC-FN-13（roving tabindex + ↑/↓/←/→/Enter）、AC-FN-30（折叠经 `toggleFold effect → foldField → syncFoldedKeys` 签名门控写 `headingFolds`，.md 零触碰、无 toast）、UI-ELEM-01（`chrome.css:590-595` 全 token，`--focus-ring-width/offset` 与 filetree.css:219-222 同构）均已在真实代码中验证落地；焦点移动不跳正文、Enter preventDefault 压双跳、空态不劫持输入均实现。唯一实质问题是 ←/→ 与三角点击的禁用门不一致（foldable 未入 resolveKey），裁定**必修**，派 fix-cr-FE08-foldable（2 处判据 + 1 测），单测证据收口不全量重审。
