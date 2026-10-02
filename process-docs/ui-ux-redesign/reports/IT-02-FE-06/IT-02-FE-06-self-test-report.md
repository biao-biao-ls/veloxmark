# IT-02-FE-06 自测报告 — 文件树键盘导航（filetreeKeys 纯逻辑 + roving tabindex + 焦点环 token 化）

- **任务ID**: IT-02/FE-06（文件树键盘导航）
- **测试时间**: 2026-10-03 03:45–04:05（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段 CDP 实测存档（agent-browser CDP 私有实例走查 + 批 r2 侧栏截图）。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；键盘导航为纯状态机（filetreeKeys.ts 零 DOM），验证面 = resolveKey 全键位语义单测 + 文件树行模型单测 + token 守护单测 + CDP 实测（真实输入焦点环/非劫持/拖拽回归）。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-02/FE-06.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-FN-13 | 左导航功能缺口候选「键盘导航/多选/大纲排序」按 Need Gate 取舍（裁决与清单定稿见 AC-PEND-08）：三项逐项裁决无悬空、实现项落地并 converge、不实现项留档 | ✅ 通过 | ① 三项裁决无悬空（Then-1）：取舍清单真源 `docs/requirements/ui-ux-redesign/prd/gap-tradeoffs.md` §1 取舍表——`NAV-GAPS-KBRD → 实现`（键盘导航，FE-06/FE-08 落地）/ `NAV-GAPS-MSLT → 不实现`（多选，单节点操作循环替代）/ `NAV-GAPS-SORT → 不实现`（大纲排序，剪切/粘贴替代），§2 与 grill-rulings Q9（2026-09-28 用户全锁）逐字对账「无冲突表述、无悬空项」✓；② 实现项落地 + converge（Then-2）：FE-06 = `components/filetreeKeys.ts` 纯模型 + `FileTree.tsx` roving tabindex，本轮真实重跑 `filetreeKeys.test.ts` **23/23** + `filetreeRows.test.ts` **16/16**（合计 39/39）✓，门禁基线 1094/1094 + typecheck 双 0（收口批终态）；cdp 冒烟 = dev 阶段 CDP 实测走查（impl §5 注：`scripts/cdp-smoke.mjs` 为既有基建缺口，等价冒烟经 CDP 私有实例 9444 完成全键位/非劫持/三态/拖拽回归）；③ 不实现项留档（Then-3）：gap-tradeoffs §4 留档 + NAV-sidebar.md §3.6 同源登记 ✓ |
| UI-ELEM-01 | 菜单栏/下拉/侧栏间距、圆角、对齐、hover/激活态全部取自《UI/UX 设计规范》token；实现代码中无 token 之外新增裸 px/色值 | ✅ 通过 | ① 焦点环 token 收口（impl §4）：设计稿裸值 2px/-2px 收口 `tokens.css:91-92` `:root` 新增 `--focus-ring-width: 2px` / `--focus-ring-offset: -2px`（接既有 --focus-ring 词汇表），环规则只消费 var()（`outline: var(--focus-ring-width) solid var(--accent) + outline-offset: var(--focus-ring-offset) + background: var(--bg-inset)`）；② 守护单测本轮重跑：`sidebarTokens.test.ts` **4/4**——`sidebar metrics are declared once in tokens.css :root and never shadowed` / `bare-px scan: sidebar rule bodies carry zero numeric px` / `bare-color scan: sidebar rule bodies consume color tokens only` / `FileTree row indent rides tokens — no numeric-px inline paddingLeft` ✓（侧栏面裸 px/色值机器审计零命中）；③ 批 H 设计稿裸值同口径收口（impl §9）：行高/缩进真值落 `--tree-row-h: 28px`/`--tree-indent: 16px` token（非规则体裸值），焦点环双通道 `.filetree-item[data-nav-focus].filetree-kbd-focus | :focus-visible`（`filetree.css:219-220`，同 `.search-match-focus` 惯用法）；④ 轮廓同构面 token `--outline-lv-w/--active-bar-*` 并入 sidebarTokens 守护清单（impl §12） |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| filetreeKeys resolveKey 全键位语义（焦点移动/折叠展开/Enter/禁用规则） | ✅ 23/23 | `npx vitest run src/renderer/src/components/filetreeKeys.test.ts` | 2026-10-03 03:45 重跑；4 组：`焦点移动（↑/↓/Home/End）` 8 用例（含 `movement skips rows flagged invisible (virtualized window)`、无焦点 ↓→首行）、`折叠/展开（←/→）` 8 用例（展开收起/移父/移首个可见子/文件行 no-op/越界防御）、`Enter 打开/切换` 3 用例、`禁用规则与空树` 4 用例（`empty tree: every key is a no-op and never hijacks input`/未知键 no-op/越界 focusIndex 防御/零可见行=空树） |
| filetreeRows 行模型全量（6F 列表/6C 折叠与 reveal/rename force-open） | ✅ 16/16 | `npx vitest run src/renderer/src/components/filetreeRows.test.ts` | `isDirOpen precedence: rename > user > reveal > collapsed`、`user collapse wins over reveal (manual state is never reverted)` 等；键盘导航不触碰 dragSrcPath/dropTarget（impl §6 拖拽回归同场） |
| sidebar token 机器审计（token 单点声明/裸 px 零/裸色零/缩进走 token） | ✅ 4/4 | `npx vitest run src/renderer/src/styles/sidebarTokens.test.ts` | UI-ELEM-01 直接证据 |
| CDP 实测走查（真实输入焦点环/非劫持/拖拽回归） | ✅（存档） | 批 r2 截图 + impl §3/§5/§6 | 合成 PointerEvent 无法切 Chromium 调制态，验证用真实 CDP 输入；点击无环、键盘有环 |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（历史移交已闭环：r2 #11 双根因（active 挂空=路径分隔符敏感 → pathUtil pathKey/pathsEqual 规范键修复；deep 行 accent-soft=filetree-selected 点击残留 → 去视觉保留功能标记）已修复并留档 `shots/batch-r2-sidebar-pre-fix-state.png`（修复前）/`batch-r2-sidebar-active-follow.png`（修复后）。在案非缺陷：6B root-follow 重扎根为存量行为（impl §7）；`scripts/cdp-smoke.mjs` 缺失为既有基建缺口与 FE-06 无关（impl §5）。）

## 结论

**通过**。AC-FN-13 / UI-ELEM-01 两条全过。AC-FN-13 三候选取舍（键盘导航=实现、多选/大纲排序=不实现）裁决无悬空、实现项 converge 证据链齐备（filetreeKeys 23/23 + filetreeRows 16/16 本轮重跑，门禁基线 1094/1094 + typecheck 双 0）；UI-ELEM-01 侧栏面 token 机器审计 4/4 零裸值。零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| ↑/↓/Home/End 焦点移动（含虚拟滚动跳不可见） | — | ✅ | ✅ | ✅（越界防御） | ✅ |
| ←/→ 折叠展开（文件行 no-op 禁用规则） | — | ✅ | ✅ | ✅ | ✅ |
| Enter 打开/切换（空树不劫持） | — | ✅ | ✅ | ✅ | ✅ |
| 焦点环 token 化（点击无环/键盘有环） | ✅ | — | ✅ | — | ✅ |

覆盖率: 9/12 (75%)
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest 键盘纯模型/行模型/token 审计单测 + CDP 实测存档，桌面适配口径）

## 证据来源存档

- 本轮重跑：`components/filetreeKeys.test.ts` 23/23、`components/filetreeRows.test.ts` 16/16、`styles/sidebarTokens.test.ts` 4/4（2026-10-03）
- CDP/UI 存档（dev 阶段）：`IT-02-FE-06-impl.png`、`IT-02-FE-06-impl-light.png`、`shots/batch-r2-sidebar-kbd-focus-dark.png`、`shots/batch-r2-sidebar-kbd-focus-light.png`、`shots/batch-r2-sidebar-active-follow.png`、`shots/batch-r2-sidebar-pre-fix-state.png`
- 取舍清单真源：`docs/requirements/ui-ux-redesign/prd/gap-tradeoffs.md`（Q9 三候选取舍表 + grill-rulings 逐字对账 + converge 对账）
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
