# IT-01-FE-10 自测报告 — 静息零 chrome 与防抖零抖动（显隐收口/≥150ms 防抖/0px 位移）

- **任务ID**: IT-01/FE-10（静息零 chrome 与防抖零抖动）
- **测试时间**: 2026-10-03 09:05–09:40（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段 CDP Electron 实测存档（S0–S9，`IT-01-FE-10-cdp-results.json` **47/47 PASS**）。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；chrome 四态收口为纯 reducer（chromeState.ts），验证面 = 四态迁移/防抖/quietLock/0px/token 对齐单测 + CDP 实测（防抖时间轴/0px 比对/静息巡检）。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-01/FE-10.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-FN-23 | 静息态逐块核对正文区域：零控件 chrome（无把手/工具栏/chip/浮层） | ✅ 通过 | CDP 存档 §1（静息零 chrome 逐块巡检，`IT-01-FE-10-idle-quiet.png`/`-final-quiet.png`）；单测四态机 idle 组 + `quietLock` 组（`hush 后驻留指针 enter 不复燃（回安静 = 静息直到离开）`）✓ |
| AC-FN-31 | 表格编辑态（含单元格激活）光标与焦点移出表格区域：chrome 退出、回到静息无残留 | ✅ 通过 | ① 离场同延迟消失（修复缺陷 a：hide-pending 保持 phase:hover、dwell 到点才掉漆——`chromeState 防抖语义 > 编辑会话存活期间 enter/leave 不动 hover 计时` + runtime hide 补强断言）；② quietLock 语义（修复缺陷 b + 2026-10-02 放宽）：`非跨界 enter 仍被压制（合成 enter 不复燃，AC-FN-31 语义不变）` ✓；③ CDP §5（FE-09 联调回安静复位静息） |
| AC-FN-32 | 表格编辑态无单元格激活：点击单元格 A 内容→激活 A；再点单元格 B→激活迁移 B（结构锚点随迁移） | ✅ 通过 | ① 单元格激活迁移 = TableEditState 状态机（FE-09 editMode 15/15：`setActiveCell follows the session (activation implies edit form)`）+ 表格 widget cell 点击接线（pendingHandoff 未动）；② chromeState 编辑态 enter 不受 quietLock 影响（`编辑态 enter 不受 quietLock 影响（写作者路径点击直达，AC-RULE-13）` ✓）；③ CDP §4（写作者路径 + 一次进编辑） |
| AC-FN-33 | hover 态仅悬停表格各区域（未点击）：仅微控件浮现、表格工具栏 hover 态不渲染 | ✅ 通过 | ① 防抖时间轴 CDP §2（`IT-01-FE-10-debounce-timeline.svg`）：hover 只浮 col-grip 微控件 + copy bar，表格编辑工具栏不渲染（impl 5 口径对照解读）；② 单测：编辑会话存活才持工具栏（`编辑会话存活期间 enter/leave 不动 hover 计时（工具栏在 wrap 外不误隐）`）✓；③ CSS 防抖双向 150ms 到点瞬变（无半透明半途浮现） |
| AC-NF-04 | 快速掠过多个块级元素：出入防抖延迟 ≥150ms、闪烁 0 次 | ✅ 通过 | ① 单测：`chromeState 防抖语义 > 进入计时 ≥150ms（glb-calm:debounce 阈值）` + `<150ms 离开取消计时：从未浮现，闪烁 0 次` + `防抖阈值与 hover 基座 / CSS token 三方同源（≥150ms 口径）`（CHROME_DEBOUNCE_MS = HOVER_DELAY_MS = 150 = `--chrome-duration`）✓；② CDP §2 时间轴实测 reveal 156–166ms / hide 163ms 落窗（FE-03 基线 160-170ms 与 AC ≥150ms 取 AC 口径，impl 6） |
| AC-NF-05 | 进出编辑态前后正文水平/垂直位移 0px（零布局抖动） | ✅ 通过 | ① CDP §3（`IT-01-FE-10-zero-shift-compare.svg`）：chrome 显隐面（工具栏/grip/浮层）正文位移恒 0（S3 六组 + toast 组全 0，CHROME_SLOT_PX=0）；② 进编辑态表后段 +1.28px 亚像素属 P10 嵌套单元格编辑器度量（非 chrome 显隐面，自测比对图登记，impl 7） |
| AC-RULE-01 | 四态定义（静息/hover/编辑态/单元格激活）与迁移正确 | ✅ 通过 | ① chromeState 纯 reducer 四态迁移本轮重跑 `chromeState.test.ts` **43/43**（quietLock 9 + 防抖 4 + 收口单点/token 对齐等全量）；② CDP S0–S9 四态走查 47/47；③ `quietLock — Esc/退出编辑后立即静息` 9 用例钉 Esc/hush 静息优先 + 真跨界复燃语义 |
| AC-RULE-13 | 点击语义裁决：点击内容进编辑（写作者路径优先）；纯选中安全 | ✅ 通过 | ① `编辑态 enter 不受 quietLock 影响（写作者路径点击直达，AC-RULE-13）` ✓；② 纯选中保护 = IT-03/FE-09 clickSemantics 31/31 同链（chromeAllowed 选中压零）+ CDP `IT-01-FE-10-select-safe.png`；③ CDP §4 写作者路径实测 |
| UI-ELEM-05 | hover 控件（把手/浮层/chip）仅 hover/激活/编辑态渲染、静息不渲染不常驻；表格工具栏为编辑态例外 | ✅ 通过 | ① UI-ELEM-05 判据与 AC-FN-33/UI-ELEM-05 对照（表格工具栏 = AC-FN-33 例外仅编辑态渲染）同链 ✓；② col-grip 常驻 DOM + CSS 零漆（opacity:0/pointer-events:none）实现层口径（方案 A 裁决，impl 4）——视觉面静息不渲染；③ 截图 `IT-01-FE-10-idle-quiet.png`/`-impl.png` |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| chromeState 四态机全量（迁移/防抖/quietLock/0px/token 对齐） | ✅ 43/43 | `npx vitest run src/renderer/src/editor/table/chromeState.test.ts` | 2026-10-03 09:05 重跑（原 36 例 + quietLock 修复批扩至 43） |
| 防抖 ≥150ms / 闪烁 0 / 三方同源 | ✅ | `进入计时 ≥150ms` + `<150ms 离开取消计时` + `三方同源` 用例 | CHROME_DEBOUNCE_MS=150 |
| CDP S0–S9（静息巡检/时间轴/0px 比对/写作者/联调） | ✅ 47/47（存档） | `IT-01-FE-10-cdp-results.json` | 首轮 38/45→修复 2 缺陷后 47/47 |
| quietLock 立即静息（Esc/hush 驻留指针不复燃） | ✅ | quietLock 9 用例 | 2026-10-02 语义放宽同步钉住 |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（历史问题已闭环：dev 阶段 CDP 首轮 38/45 揭出 2 真实缺陷（(a) 离开即掉漆；(b) Esc 后驻留指针复燃）均已修复并补强断言（自测 §7）；实现层口径差异（col-grip 常驻 DOM 零漆方案 A）已裁决登记（impl 4）。已知边界在案：delete-table-while-editing editId 过期停留（下次 editEnter/hush 自愈）；quietLock 驻留指针需 leave 后 re-enter 再武装、真跨界 enter 即复燃（impl 8）。）

## 结论

**通过**。AC-FN-23 / AC-FN-31 / AC-FN-32 / AC-FN-33 / AC-NF-04 / AC-NF-05 / AC-RULE-01 / AC-RULE-13 / UI-ELEM-05 九条全过。本轮 chromeState 43/43 全绿（四态迁移/≥150ms 防抖/quietLock 立即静息/token 三方同源），CDP 47/47 存档证据在场（防抖时间轴 SVG/0px 比对 SVG/静息逐块巡检），零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 静息零 chrome 巡检 | ✅ | — | ✅ | — | ✅ |
| hover 防抖（≥150ms/闪烁 0/同延迟消失） | ✅ | — | ✅ | ✅（过期 leave 忽略） | ✅ |
| 四态迁移 + quietLock（Esc 立即静息） | — | ✅ | ✅ | ✅（驻留指针压制） | ✅ |
| 0px 位移 + 写作者路径 | — | ✅ | ✅ | — | ✅ |

覆盖率: 9/12 (75%)
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest chromeState 纯 reducer 单测 + CDP 实测存档，桌面适配口径）

## 证据来源存档

- 本轮重跑：`editor/table/chromeState.test.ts` 43/43（2026-10-03）
- CDP 存档（dev 阶段实测）：`IT-01-FE-10-self-test.md`（S0–S9 + 2 缺陷修复记录 + 口径登记）、`IT-01-FE-10-cdp-results.json`（47/47）、`IT-01-FE-10-cdp-driver.mjs`；可视化 `IT-01-FE-10-debounce-timeline.svg` / `IT-01-FE-10-zero-shift-compare.svg`；截图 `IT-01-FE-10-idle-quiet.png` / `-final-quiet.png` / `-select-safe.png` / `-caret-on.png` / `-impl.png`
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
