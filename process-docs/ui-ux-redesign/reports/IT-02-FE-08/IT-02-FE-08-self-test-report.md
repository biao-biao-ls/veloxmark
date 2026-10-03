# IT-02-FE-08 自测报告 — 大纲键盘导航（roving tabindex + ↑/↓/←/→/Enter，折叠写 headingFolds）

- **任务ID**: IT-02/FE-08（大纲键盘导航）
- **测试时间**: 2026-10-03 06:30–06:50（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段浏览器走查记录（implementation-notes 在案）+ UI 截图存档。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；大纲键盘通道为纯状态机（outlineKeys.ts 零 DOM，镜像 filetreeKeys 模式），验证面 = resolveKey/toOutlineNodes/showsFoldTriangle 单测全量 + token 守护单测 + dev 走查记录（双向同步/跨重启/335 字节不变）。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-02/FE-08.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-FN-13 | 左导航功能缺口「键盘导航」实现项（Q9 裁决）落地并随实现阶段 converge | ✅ 通过 | ① 大纲半侧键盘模型本轮重跑 `outlineKeys.test.ts` **32/32**：`焦点移动（↑/↓，不跳转正文）` 7 用例（含 `movement never emits jump/collapse/expand (focus moves do not touch the body)`——焦点移动不跳正文钉死）+ `Enter 激活（→ jump 映射）` 3 用例（`Enter on a focused node maps to jump at that index`/`Enter never collapses or expands`）+ `空树与未知键` 2 用例（no hijack）✓；② Enter=onSelect(pos) 与点击同一路径 → FE-07 jumpToHeading（keydown preventDefault 压 button 合成 click 防双跳，impl ②）；③ converge：门禁基线 1094/1094 + typecheck 双 0 + 等价 CDP/浏览器走查（取舍清单 gap-tradeoffs §3 FE-08 行在案） |
| AC-FN-30 | 大纲侧折叠/展开入口变更→正文同步；双向同步；折叠写 headingFolds 持久；`.md` 零字节 | ✅ 通过 | ① 键盘折叠面：`折叠/展开（←/→，AC-FN-30）` 9 用例（方向性非 toggle：`ArrowLeft on an expanded node with children collapses it (focus stays)`/`leaf nodes ignore ←/→ entirely`/`non-foldable nodes with children ignore ←/→ (no ghost fold writes)`/`fold actions never move focus and never jump`）✓；② 写回链零改动：onToggleFold→toggleFold effect→useFoldSync 签名门控写 `headingFolds`（FE-07 fold 32/32 同链：不写 .md/失效清洗）；③ 双向同步（大纲 ←/→ ↔ 正文折叠三角）+ headingFolds 跨重启恢复 + `.md` 335 字节不变 + 无 toast（PEND-15）——dev 浏览器走查记录在案（impl ⑥，无独立 CDP 数据文件）；④ IT-03/FE-07 CDP S4 双向同步/零字节实测同链交叉印证 |
| UI-ELEM-01 | 侧栏间距/圆角/对齐/hover/激活态全部取 token；无 token 外新增裸 px/色值 | ✅ 通过 | ① 焦点环双轨：`.outline-item[data-nav-focus].outline-kbd-focus | :focus-visible`（chrome.css，同 filetree 惯用法），环规则只消费 `--focus-ring-width/--focus-ring-offset/--accent/--bg-inset`（impl ⑤）；② 守护单测本轮重跑 `sidebarTokens.test.ts` **4/4**（sidebar metrics 单点声明/bare-px 零/bare-color 全 token/缩进走 token）✓；③ `toOutlineNodes`/`showsFoldTriangle` 模型层零样式（32/32 内 11 用例钉几何判据：三角=有子节且可折叠、叶行/空章节「·」占位） |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| outlineKeys 纯模型全量（焦点移动/Enter/折叠展开/空树/焦点模型/三角判据） | ✅ 32/32 | `npx vitest run src/renderer/src/components/outlineKeys.test.ts` | 2026-10-03 06:30 重跑（原 25 例 + FE-09#2 空章节/showsFoldTriangle 扩至 32） |
| sidebar token 机器审计（UI-ELEM-01） | ✅ 4/4 | `npx vitest run src/renderer/src/styles/sidebarTokens.test.ts` | 裸 px/色值零命中 |
| dev 浏览器走查（双向同步/跨重启/335 字节不变/无 toast） | ✅（记录在案） | implementation-notes 验证记录 + `IT-02-FE-08-impl.png` | 无独立 CDP 数据文件（如实标注） |
| roving tabindex 与拖拽/虚拟滚动共存 | ✅ | `tabStop=focusIndex→activeIdx→0` + pendingFocusRef 补焦（impl ④，镜像 FileTree） | FE-06 同构面 |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（在案非缺陷：Home/End 不实现为 NAV-sidebar §3.2 契约未列（impl ①）；大纲列表保持平铺全量、子树隐藏不在本任务面（impl ⑥）；失效清洗复测通过（改标题后旧 key 被清）为 FE-09 持久化钩子联动记录。）

## 结论

**通过**。AC-FN-13 / AC-FN-30 / UI-ELEM-01 三条全过。本轮 outlineKeys 32/32 + sidebarTokens 4/4 全绿（焦点移动不跳正文、方向性折叠禁 ghost 写、Enter 与点击同路径、三角判据钉死），dev 走查记录在案（双向同步/跨重启/335 字节不变），零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| ↑/↓ 焦点移动（不跳正文/钳制） | — | ✅ | ✅ | ✅（空树 no-hijack） | ✅ |
| Enter 跳转（=点击同路径/防双跳） | — | ✅ | ✅ | ✅（无焦点 no-op） | ✅ |
| ←/→ 折叠展开（方向性/ghost 写禁） | — | ✅ | ✅ | ✅（叶行/空章节禁用） | ✅ |
| 焦点环 token 化 + roving tabindex | ✅ | — | ✅ | — | ✅ |

覆盖率: 9/12 (75%)
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest 键盘纯模型/token 审计单测 + dev 浏览器走查记录，桌面适配口径）

## 证据来源存档

- 本轮重跑：`components/outlineKeys.test.ts` 32/32、`styles/sidebarTokens.test.ts` 4/4（2026-10-03）
- UI/走查存档（dev 阶段）：`IT-02-FE-08-impl.png`、implementation-notes 浏览器走查记录（↑/↓ 不跳正文/Enter 落标题/叶子←/→禁用/双向同步/跨重启/335 字节不变/无 toast）
- 取舍清单：`docs/requirements/ui-ux-redesign/prd/gap-tradeoffs.md` §3（FE-08 大纲键盘导航行）
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
