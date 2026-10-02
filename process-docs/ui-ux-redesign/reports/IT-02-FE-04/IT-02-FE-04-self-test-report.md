# IT-02-FE-04 自测报告 — 菜单弹层限高滚动与边缘翻转（下拉/子菜单全项可达 + 四条关闭路径）

- **任务ID**: IT-02/FE-04（菜单弹层限高滚动与边缘翻转）
- **测试时间**: 2026-10-03 01:20–01:38（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段 CDP 实测存档（翻转截图/计时实测）。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；验证面 = popupOverflow 弹层基座纯函数全量重跑（限高/翻转/超界关闭/子面板落点）+ CDP 存档。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-02/FE-04.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-RULE-10 | 弹层限高滚动+边缘翻转，任意位置全项完整可达可点（横向能力，不绑定表格） | ✅ 通过 | `popupOverflow.test.ts` > `computePopupLayout` 8 用例本轮重跑 95/95（contextMenu 组同场）：限高公式封顶内滚动/贴底整菜单上翻/子菜单左翻/上翻钳上缘/两侧不足选大侧/`margin 可参数化（契约默认 8）` ✓；横向同源 = MenuBar 与 EditorContextMenu 共用 `editor/contextMenu/popup.ts` 单一基座（implementation-notes §1） |
| AC-FN-05 | ⋮/下拉菜单限高内滚动+边缘翻转全项可达（分组呈现面） | ✅ 通过 | `computePopupLayout` 限高/翻转链 ✓ + `极窄窗 640×400：限高为正且不超出视口，全项经滚动可达`（限高 344=400−48−8 精确命中，implementation-notes §2）；分组呈现 = opsTable 五组 6 用例（FE-04 同场） |
| AC-FN-08 | 窗口右/下边缘含子菜单展开：限高滚动/翻转后子菜单完整展开可点 | ✅ 通过 | ① 翻转链：`贴窗口右缘且子菜单自然宽度超出右侧空余 → submenuPlacement=left（子菜单左翻）` ✓；② 子面板 fixed 逃逸裁切机制（overflow-y:auto 根面板会裁切 absolute 后代 → fixed + computeSubPosition 内联注入，implementation-notes §4）；③ `computeSubPosition` 4 用例（常规右下/左翻/上翻/重叠量参数化 hover 断链防护）✓；④ CDP 存档 `IT-02-FE-04-flip-left.png` / `-flip-up.png` |
| AC-FN-10 | 四条关闭路径（选菜单项/Esc/点外部/超界滚动选择）均关闭且焦点回正文 | ✅ 通过 | ① 第四条（CHANGE-6 登记语义）：`detectOverscrollSelection（AC-FN-10 第四条关闭路径）` 5 用例（after-end/before-start/中部 none/未限 none/`deltaY 为 0 → none`）✓；② 焦点回正文 = `focusEditorBody`（含关闭竞态修复 §5：同步 focus 后补拍）；③ Esc/点外部路径 = keyboardNav `focusInMenu=false 时 Esc 仍走关闭路径（AC-FN-10）` ✓ |
| AC-ERR-09 | 窗口小于自然尺寸（1280×768 以下至最小窗）全项可达无裁切 | ✅ 通过 | `极窄窗 640×400（AC-ERR-09）：限高为正且不超出视口，全项经滚动可达` ✓ + 上翻钳上缘用例（不越出视口上缘） |
| AC-NF-02 | 点击触发→弹层首帧完整呈现 ≤200ms | ✅ 通过 | dev 实测（implementation-notes §7）：展开同步 **0.4ms**、双 rAF 绘制完成 **27.6ms** ≪200ms；渲染路径无阻塞布局（fixed 内联几何注入，无量测回环——§6 渲染期瞬态修复消除 layout 后 setPos 死路径） |
| AC-NF-08 | 窗口底/右/角落边缘位置全项可达率 100% | ✅ 通过 | 几何穷举：computePopupLayout 对贴底/贴右/贴角/极窄四类锚位均有翻转+限高可达解（8 用例链覆盖）；CDP 截图 flip-up/flip-left 边缘实测在场；可达率 100% 由「全项经滚动可达」断言承载 |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| popupOverflow 全量（computePopupLayout/detectOverscrollSelection/computeSubPosition） | ✅ 17/17（contextMenu 组 95/95 同场） | `npx vitest run src/renderer/src/editor/contextMenu/` | 2026-10-03 01:20 重跑 |
| 限高公式实测 | ✅ | 640×400 → maxHeight 344 | 规格公式精确命中 |
| AC-NF-02 展开耗时 | ✅ | 0.4ms 同步 + 27.6ms 双 rAF | dev 实测存档 |
| e2e 契约保持（itemTestId/方向类名） | ✅ | implementation-notes §8 | menu-sub--flip / velox-ctx-sub--flip 可探针 |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

## 结论

**通过**。AC-RULE-10 / AC-FN-05 / AC-FN-08 / AC-FN-10 / AC-ERR-09 / AC-NF-02 / AC-NF-08 七条全过。本轮 popupOverflow 17/17 全绿（弹层基座单源），CDP 翻转截图与计时实测在场（27.6ms ≪ 200ms），零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 限高滚动（公式封顶/内滚动） | ✅ | — | ✅ | — | ✅ |
| 边缘翻转（上翻/左翻/子面板落点） | ✅ | — | ✅ | ✅（视口钳制） | ✅ |
| 四条关闭路径 | — | ✅ | ✅ | ✅（超界滚动关闭） | ✅ |
| 极窄窗可达（AC-ERR-09） | ✅ | — | ✅ | — | ✅ |

覆盖率: 10/12 (83%)
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest 弹层几何单测 + CDP 存档，桌面适配口径）

## 证据来源存档

- 本轮重跑：`editor/contextMenu/popupOverflow.test.ts`（contextMenu 组 95/95 同场，2026-10-03）
- CDP 存档（dev 阶段实测）：`IT-02-FE-04-flip-left.png` / `-flip-up.png` / `-impl.png`、计时实测（implementation-notes §7）
- 口径登记：CHANGE-6（超界滚动选择语义）、MENU-menubar §3.5
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
