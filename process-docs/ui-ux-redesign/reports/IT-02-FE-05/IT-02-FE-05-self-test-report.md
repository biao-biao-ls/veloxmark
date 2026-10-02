# IT-02-FE-05 自测报告 — 菜单与子菜单键盘遍历（方向键遍历/Enter 执行/Esc 关闭，Q8 菜单键盘化兜底）

- **任务ID**: IT-02/FE-05（菜单与子菜单键盘遍历）
- **测试时间**: 2026-10-03 02:35–02:50（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ 三态截图存档。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；键盘遍历为纯状态机（keyboardNav.ts 零 DOM），验证面 = applyMenuKey 状态机单测全量 + 三态 UI 截图存档。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-02/FE-05.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-RULE-02 | 菜单状态机（关闭/一级展开/子菜单展开）：子菜单移回父级收拢回一级不关菜单 | ✅ 通过 | `keyboardNav.test.ts` > `applyMenuKey — 子菜单进出（AC-RULE-02）` 3 用例：`← 从子菜单收拢回一级，菜单不关闭，激活态还给父行` / `Esc 一键到底（glb-hush:one-shot）：任意层级直接 close，分级收拢只走 ←` / 子菜单内 ↑/↓ 循环跳禁用；另 `→ 在叶项切换根菜单并保持一级展开（AC-RULE-02 不关菜单）` + 根/一级开合组 6 用例本轮重跑 **26/26** ✓ |
| AC-RULE-09 | 同一操作键盘/鼠标通道行为一致（同源语义） | ✅ 通过 | ① 双通道同源：MenuBar 单一 nav 状态统一鼠标/键盘（点击与 Enter 同一 runItem 入口，implementation-notes §3）；② `叶项 Enter/Space → effect=run（调用方走命令注册表同一 action）` ✓（命令注册表单一 action 源）；③ 打开预选口径统一（`openActiveIndex` 组：指针打开无预选/键盘打开首项默认激活） |
| AC-FN-10 | 四条关闭路径（选菜单项/Esc/点外部/超界滚动选择）关闭且焦点回正文 | ✅ 通过 | ① Esc：`focusInMenu=false 时 Esc 仍走关闭路径（AC-FN-10）` + Esc 一键到底 ✓；② 选菜单项：Enter effect=run 后 close（action 先于 close，UX-P04 F4b）；③ 点外部/超界滚动：popupOverflow `detectOverscrollSelection（AC-FN-10 第四条关闭路径）` 5 用例（FE-04 同场）+ focusEditorBody 回正文；④ `未消费键（Tab）返回原状态且 effect=none（调用方不 preventDefault）` 不误触关闭 ✓ |
| UI-IXD-11 | 菜单项 hover/激活/禁用三态可区分 | ✅ 通过 | ① 激活态导航：`cycleNavIndex` 4 用例（↑/↓ 循环跳过禁用/分隔线/分组标题并绕回、单调序列稳定）+ `isNavLandable … separator/groupTitle/disabled 均不可落点` ✓；② 三态视觉：批 C 菜单面 CDP 34/34（hover/键盘激活回 --bg-inset、键盘行 inset 1px --accent 环、禁用 --fg-disabled）+ `IT-02-FE-05-three-states-dark.png` 三态截图 |
| UI-ELEM-04 | 禁用项灰显可区分且不可点 | ✅ 通过 | `applyMenuKey — Enter 执行与禁用语义（UI-ELEM-04 / AC-RULE-09 同源）` 3 用例：`禁用项 Enter 不执行不报错` / `子层空子菜单父行 Enter/Space 同样 no-op（不 run 不关菜单）` / 叶项正常 run ✓；灰显不可落点 = isNavLandable/cycleNavIndex 跳禁用 ✓ |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| keyboardNav 状态机全量（开合/遍历/子菜单进出/Enter/禁用/作用域） | ✅ 26/26 | `npx vitest run src/renderer/src/editor/contextMenu/keyboardNav.test.ts` | 2026-10-03 02:35 重跑 |
| CtxMenuItem/MenuBar.MenuItem ↔ NavItemShape 编译期对齐 | ✅ | `键盘模型与两类菜单项形状对齐（Q8 CtxMenuItem 对齐契约）` | 零形状漂移 |
| 作用域契约（正文焦点不被劫持） | ✅ | `focusInMenu=false 时方向键/Enter/Space 全部 no-op` | 结构路径 + 模型兜底双保险 |
| 三态视觉实证 | ✅（存档） | `IT-02-FE-05-three-states-dark.png` + 批 C 34/34 | hover/激活/禁用可辨 |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

## 结论

**通过**。AC-RULE-02 / AC-RULE-09 / AC-FN-10 / UI-IXD-11 / UI-ELEM-04 五条全过。本轮 keyboardNav 26/26 全绿（纯状态机零 DOM），三态截图与批 C 存档在场，零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 方向键遍历/循环钳制 | — | ✅ | ✅ | ✅（跳禁用） | ✅ |
| Enter 执行/禁用 no-op | — | ✅ | ✅ | ✅ | ✅ |
| 子菜单进出/Esc 一键到底 | — | ✅ | ✅ | ✅ | ✅ |
| 作用域（正文不劫持） | — | — | ✅ | ✅ | ✅ |

覆盖率: 9/12 (75%)
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest 键盘状态机单测 + 截图存档，桌面适配口径）

## 证据来源存档

- 本轮重跑：`editor/contextMenu/keyboardNav.test.ts` 26/26（2026-10-03）
- 截图存档（dev 阶段）：`IT-02-FE-05-three-states-dark.png`、`IT-02-FE-05-impl.png`、批 C 菜单面 34/34（shots/）
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
