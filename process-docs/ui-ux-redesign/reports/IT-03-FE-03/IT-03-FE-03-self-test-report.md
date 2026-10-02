# IT-03-FE-03 自测报告 — hover 浮层/微操作防抖基座与退出纪律（≥150ms、不遮挡、位移 0px、无残留）

- **任务ID**: IT-03/FE-03（hover 浮层/微操作防抖基座与退出纪律）
- **测试时间**: 2026-10-03 00:05–00:20（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段 CDP Electron 实测存档（计时/闪烁/位移数据 `IT-03-FE-03-cdp-data.json`）。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；验证面 = hoverDiscipline 状态机单测 + renderFloatPos 纯定位单测 + CDP 实测存档。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-03/FE-03.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-FN-14 | hover 停留 ≥150ms 浮层浮现（图/链/列表把手等），不遮挡锚点内容 | ✅ 通过 | ① 防抖语义：`useHoverDiscipline.test.ts` > `shows only after the HOVER_DELAY_MS dwell elapses` + `clamps a sub-threshold delayMs request up to HOVER_DELAY_MS`（<150ms 请求抬到 150ms 阈值）本轮重跑 22/22 ✓；② 不遮挡锚点：`renderFloatPos.test.ts` > `never overlaps the anchor rect for every placement it can pick` + `below-align` 4 用例（含 viewport 满幅图不侧移压侧栏 r2 N1）13/13 ✓；③ CDP 实测存档：`IT-03-FE-03-selftest.md` §1「AC-FN-14 四判据（图片/链接/列表行各一次）」 |
| AC-NF-04 | 快速掠过多个块级元素：出入防抖 ≥150ms、闪烁次数 0 | ✅ 通过 | ① 单测：`never shows when the pointer leaves before the threshold (rapid pass = 0 flash)` + `cancels a pending hide when the pointer re-enters (0 flicker)` + `cancelPendingShow drops a debounce-scheduled show before it ever renders (I1 残窗)` + `retargets visible chrome immediately when the anchor changes (row sweep, no flicker)` ✓；② CDP 实测存档：§2 闪烁计数（appear 事件数）= **0** 通过（计时在 visibilityState:visible 下测得，§0 计时陷阱处置在案） |
| AC-NF-05 | 进出编辑态正文垂直/水平位移 0px（零布局抖动） | ✅ 通过 | ① 机制：浮层 `position: fixed` 覆盖层不占文档流（位移 0px 天然保证）；② CDP 实测存档：§3 位移 0px/0px 通过 + 显隐全程正文零位移；③ 定位纯函数无布局写：`renderFloatPos.test.ts` 13/13（几何计算单源，RenderFloat.tsx 只做 fixed 壳） |
| UI-ELEM-05 | hover 控件仅 hover/激活/编辑态渲染，静息态不渲染不常驻 | ✅ 通过 | ① 显隐纪律状态机：`useHoverDiscipline.test.ts` > `hideNow removes chrome immediately and clears timers` + `dispose clears every timer (unmount cleanup)` + `hideAllNow collapses every channel including pinned ones (Esc hush)` + `is exclusive: a newly activated channel collapses the previous one` ✓；② CDP 实测存档：§5「UI-ELEM-05 静息零 chrome」通过；③ 通道互斥/无残留：`hideNow(non-active) keeps the active channel snapshot`（hideNow 快照一致性）✓ |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| useHoverDiscipline 状态机全量（双向防抖/0 闪烁/pin/retain/互斥/dispose/快照） | ✅ 22/22 | `npx vitest run …/hooks/useHoverDiscipline.test.ts useHoverDiscipline.hideNow.test.ts` | 2026-10-03 00:05 重跑 |
| renderFloatPos 纯定位全量（below→above→右→左阶梯 + row-start 把手槽） | ✅ 13/13 | `npx vitest run …/components/renderFloatPos.test.ts` | 不遮挡锚点/视口钳制/满幅图不侧移 |
| HOVER_DELAY_MS 单点定义 | ✅ | dev 存档 §6：grep → 1 定义 + 3 引用 | 全仓唯一阈值 |
| Esc 收拢即时性 | ✅ | dev 存档 §4：keydown→浮层卸载 0.6ms | hideAllNow 含 pinned |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（在案备忘非缺陷：① `renderFloatPos` 上翻分支 top 0-clamp 豁免已证成登记（收口批收-D #2 顶裁豁免）；② tech-design「防抖 100ms 级」vs 实现 150ms 措辞差登记 doc-reconcile 对账清单；③ useHushLayer 落地后 Esc 幂等共存联调复核——收口批已在场。）

## 结论

**通过**。AC-FN-14 / AC-NF-04 / AC-NF-05 / UI-ELEM-05 四条全过。本轮 useHoverDiscipline 22/22 + renderFloatPos 13/13 全绿，CDP 存档计时/闪烁/位移证据在场（闪烁 0 次、位移 0/0px），零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| hover 显隐防抖（≥150ms/0 闪烁） | ✅ | — | ✅ | ✅（快速掠过取消） | ✅ |
| 定位阶梯（不遮挡锚点） | ✅ | — | ✅ | ✅（视口边界钳制） | ✅ |
| 退出纪律（Esc/hideNow/dispose） | — | — | ✅ | ✅ | ✅ |
| 位移 0px（fixed 覆盖层） | ✅ | — | ✅ | — | ✅ |

覆盖率: 10/12 (83%)（基座状态机面）
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest 状态机/定位单测 + CDP 实测存档，桌面适配口径）

## 证据来源存档

- 本轮重跑：`hooks/useHoverDiscipline.test.ts` + `.hideNow.test.ts` 22/22、`components/renderFloatPos.test.ts` 13/13（2026-10-03）
- CDP 存档（dev 阶段实测）：`IT-03-FE-03-selftest.md`（计时/闪烁/位移/Esc 数据）、`IT-03-FE-03-cdp-data.json`、`IT-03-FE-03-cdp-driver.mjs`、截图 `shots/`
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
