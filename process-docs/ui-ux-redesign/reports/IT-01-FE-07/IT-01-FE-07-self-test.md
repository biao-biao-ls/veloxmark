# IT-01-FE-07 自测报告 — toast 动作按钮能力（useToast+ToastHost/5s 驻留/撤销按钮/多 toast 队列）

- 任务：`process-docs/ui-ux-redesign/tasks/IT-01/FE-07.md`
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`
- 日期：2026-09-30
- 验收：AC-OP-12 / AC-ERR-04 / AC-FN-06 / UI-ELEM-03
- 实现图：`IT-01-FE-07-impl.png`（执行态：结构回执 + 「撤销」按钮）；`IT-01-FE-07-undone.png`（undo 后态：「已撤销」无按钮）
- CDP 全量结果：`IT-01-FE-07-cdp-results.json`（22/22 PASS，场景 S0–S8）

验证驱动：`temp/fe07-driver.mjs`（CDP WebSocket，全部 `Runtime.evaluate` 带 10s 超时；目标实例为全新 Electron：debug port 9255 + 独立 `temp/fe07-userdata-r2`，未触碰旧卡死实例 9241/9243）。验证前已发 `Page.setWebLifecycleState({state:'active'})` + `Emulation.setFocusEmulationEnabled` + `Page.bringToFront`，避免遮挡窗口拖慢定时器。

## 1. 结构操作回执 + 撤销按钮（AC-FN-06 / 交互 #1）

`__veloxTable.activate + op('deleteRow')` 驱动（与产品同一 `runTableOp` 派发层）：

| 检查点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 冻结回执行 | 「已删除第 i 行（Ctrl+Z 可撤销）」（含 undo 后缀） | 「已删除第 3 行（Ctrl+Z 可撤销）」 | ✓ |
| 撤销按钮 | 在场、文案「撤销」 | `data-testid="toast-undo-btn"`，label「撤销」 | ✓ |
| 同屏卡片数 | 1 | 1 | ✓ |
| e2e 契约 | `__veloxP20.getToast()` 与 DOM 同步 | 两者同串 | ✓ |
| 消失后零残留 | host/card 全无 | `cardCount: 0` | ✓ |

## 2. 5s 驻留时间戳记录（PEND-05 / UI-ELEM-03，交互 #2）

固定 5000ms 驻留——**不因 hover 延长、不提前消失**。时间戳（epoch ms，来自 `IT-01-FE-07-cdp-results.json`）：

| 事件 | 时间戳（UTC） | 相对 t0 | 说明 |
|---|---|---|---|
| S1 toast 出现（t0） | `1790736561712` = 2026-09-30T02:49:21.712Z | 0 | op 派发前取样 |
| hover 到卡片上 | t0+~4.5s | 4500ms | 坐标 (1052.6, 764.5)，停留至消失 |
| 4.5s 时卡片仍在 | — | 4500ms | `hoverKeptAt4_5s: true`（hover 未延长驻留，4.5s 尚未到点属预期） |
| 卡片消失（轮询 100ms 粒度） | t0+5134ms | **5134ms** | 落 4800–5800 判定窗 |

- 驻留精确值 5000ms 由单测钉死（`useToast.test.ts`：`advanceTimersByTime(TOAST_DWELL_MS-1)` 仍在、`+1` 即无）；CDP 实测 5134ms 含探针取样/轮询延迟（t0 在 op 前、消失检测在 100ms 轮询格点上），断言窗 4800–5800ms。
- 「已撤销」ack 同样驻留 5s：S3 从点击撤销计 **5135ms** 消失（同判定窗）。
- 第二条 toast 按自身时钟驻留：S5 `dwell2: 4912ms`（tSecond 在 op+80ms 后取样，略小于 5000ms 名义值，同探针口径）。

## 3. 撤销按钮：一步还原 + 「已撤销」ack（AC-OP-12 入口 A / glb-toast:undo）

| 检查点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 一步还原 | doc 逐字节回到删除前 | `afterUndo === preOpDoc`（op 前快照字节比对） | ✓ |
| 回执换态 | 「已撤销」且无按钮 | `msg=已撤销, btn=false` | ✓ |
| ack 再驻留 | 自己的完整 5s | 5135ms 后消失 | ✓ |

> 字节比对口径：`formatTable` 每次结构 op 以 `padEnd` 重写行宽，undo 还原的是 **op 前那一份文档字节**（含既有 padding），故断言用 op 前快照比对而非 fixture 字面量。

## 4. 三入口等效（AC-OP-12 / AC-ERR-04）

undo 三入口（toast 按钮 / Ctrl+Z / 编辑菜单「撤销」）共用一条 CM6 history 栈 + 同一 `undoWithAck` 回执面：

| 入口 | 一步还原 | 回执「已撤销」 | 终态焦点（键盘输入可达） | 结果 |
|---|---|---|---|---|
| toast 按钮 | ✓（§3） | ✓ | `cm-content`（正文） | ✓ |
| Ctrl+Z（结构 op 后嵌套单元格焦点态） | ✓ `restored: true` | ✓ | `cm-content` | ✓ |
| 编辑菜单「撤销」 | ✓ `restored: true` | ✓ | `cm-content` | ✓ |

**关键缺陷修复（本轮发现并修复）**：结构 op 后焦点在嵌套单元格编辑器（nested history 为空），此时按 Ctrl+Z 原本**完全无效**——nested `historyKeymap` 的 `Mod-z`（`undo(nested), preventDefault: true`）在空历史上返回 false 但仍 `preventDefault`，事件到外层时 `eventBelongsToEditor` 因 `defaultPrevented`（叠加表格 widget `ignoreEvent:true`）直接短路，主编辑器的 Mod-z 绑定永远跑不到。AC-ERR-04「误触结构操作后执行一次 Ctrl+Z」正是这个状态。修复：`cellKeymap` 增 Mod-z 转发绑定（`undo(nested) || undoMain(main)`），单元格内打字撤销优先，空栈落到主 history + 冻结「已撤销」ack（`NestedNavFns.undoMain` 注入，keymap.ts 保持零项目依赖纪律）。

另修：撤销按钮点击后焦点回到正文（`refocusAfterUndo`，光标已在正文编辑域内则不抢）——AC-OP-12 终态「随后的键盘输入可直接进入正文编辑」；编辑菜单路径同口径（菜单 `closeAll({refocus:false})` 不回焦，命令内自补）。

## 5. 队列替换（交互 #2 / glb-toast queue-replace）

连续两次结构回执（deleteRow → deleteCol，均走 STRUCTURE_TOASTS 派发层）：

| 检查点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 顶替 | 同屏 1 条、最新可见 | `cardCount: 1`，first「已删除第 3 行…」→ second「已删除第 2 列…」 | ✓ |
| 计时重置 | 旧计时不误杀新 toast | 旧 toast 原定 5s 到点时新 toast 仍在（ageMs 4371 < 自身 5s） | ✓ |
| 自身驻留 | 第二条按自己的 5s 消失 | 4912ms（探针口径，见 §2） | ✓ |

> 探针口径注记：`__veloxTable.op('insertRow')` 不产 toast（插入回执挂 cmd 级 `INSERT_TOAST_KEYS`，派发层 `STRUCTURE_TOASTS` 只覆盖 delete/resize/move 族）——队列用 deleteRow→deleteCol 双回执驱动，与产品 ⋮ 菜单/快捷键路径文案同源。

## 6. 既有字符串 toast 迁移（交互 #3 / 非回归）

| 调用点 | 触发 | 实测 | 结果 |
|---|---|---|---|
| `toast.copiedHtml`（复制为 HTML） | 编辑菜单 `menu-item-copyAsHtml` | 「已复制 HTML」，无按钮 | ✓ |

无动作形态（string shorthand → `{ message }`）由 `useToast.test.ts` 单测钉住（`action: null`）；App.tsx 侧仅装配变更（旧 useState/useRef 计时块删除、`<ToastHost />` 一行 + `toast as showToast` 导入替换）。

## 7. UI-ELEM-03（toast 不夺焦、零位移）

| 检查点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 出现不夺键盘焦点 | 焦点留在正文 | `cm-content cm-lineWrapping` | ✓ |
| 出现/消失布局位移 | 0px | 编辑器 rect 高度/顶边变化 0（`shiftDuring: 0`） | ✓ |
| 点撤销按钮后焦点 | 回正文、不落 toast/body | `cm-content` | ✓ |

UI-ELEM-03「不遮挡光标所在输入行」：toast 宿主固定 `right/bottom: --space-3` 窗口右下角（ui_07 toast-anchor），矩形上边界 y≈720，与正文表格编辑区（顶 74 / 高 702）不相交，且 hover 探针坐标已验证卡片实际渲染位置。

## 8. AC 证据映射

- **AC-OP-12**（undo 三入口等效 + 一步还原 + 「已撤销」+ 终态焦点）：§3 + §4 全表；字节级还原（op 前快照）；三入口终态焦点均回 `cm-content`。
- **AC-ERR-04**（误触结构操作一次 Ctrl+Z 还原）：§4 Ctrl+Z 行（嵌套单元格焦点态即误触后的常态，修复后 `restored: true` + 「已撤销」）；单步即还原，无需多步。
- **AC-FN-06**（冻结回执 + undo 后缀 + 同源文案 + 5s 驻留 + 不遮挡锚定单元格）：§1 + §2 + §5；回执 key 单源（`STRUCTURE_TOASTS`/`TABLE_OP_TOAST_KEYS`/`INSERT_TOAST_KEYS` → i18n 冻结键），同 op id 跨入口文案由字典保证一致。
- **UI-ELEM-03**（自动消失/不夺焦/不遮挡/零位移）：§2 + §7。

## 9. 质量门禁

| 门禁 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npm run typecheck`（tsconfig.web + tsconfig.node） | **0 Error** ✓ |
| 单测 | `npm run test:unit` | **57 文件 701/701 全绿**（含 useToast 8 例 + keymap 25 例；本轮 Mod-z 转发 3 例先 RED「binding for Mod-z 不存在」后 GREEN）✓ |
| 构建 | `npm run build` | **成功**（electron-vite 产物 24.67s）✓ |
| cdp 冒烟 | `temp/fe07-driver.mjs` 全量 | **22/22 PASS** ✓ |
| e2e 缝 | `window.__velox*` / `data-op` / 命令 id | 未破坏（`__veloxTable.op/activate`、`__veloxP20/P23/P26.getToast`、`__veloxP26.loadDoc/getDoc` 全程只消费未改形；`toast-undo-btn`/`toast-host` 为新增 testid）✓ |

TDD 记录：keymap.test.ts 新增「Mod-z in-cell undo fallback」3 用例先行 RED（`binding for Mod-z: expected undefined to be truthy`，其余 22 例保持绿）→ 实现 `cellKeymap` Mod-z 转发 + `NestedNavFns.undoMain` → 3 用例 GREEN → 全量 701/701。`undoWithAck`（undo+ack+焦点收口）补 2 例单测（还原+回执 / 空栈无回执）。

## 10. 新增/修改文件

| 文件 | 变更 |
|---|---|
| `src/renderer/src/hooks/useToast.ts` | toast 单例 bus（Dialog/ctxMenu 模式）：`show`（string|object 归一、单卡片替换、`TOAST_DWELL_MS=5000` 固定计时）、`runAction`（跑一次动作→冻结「已撤销」ack→新 5s）、`toast/toastUndone/undoAction/getToastMessage/useToast`；本轮新增 `undoWithAck`（三入口共用：一步 undo + ack + 焦点收口）与 `refocusAfterUndo`（AC-OP-12 终态） |
| `src/renderer/src/components/ToastHost.tsx` | 渲染面：`toast-host[role=status]` → 消息 + 可选 `toast-undo-btn`（`tabIndex=-1` + mousedown `preventDefault` 不夺焦） |
| `src/renderer/src/styles/toast.css` | toast 分区（token 化：`--toast-*`/`--shadow-pop`/`--space-3`，`toast-in` 120ms 入场） |
| `src/renderer/src/App.tsx` | 仅装配：`<ToastHost />` 一行 + `toast as showToast` 接管旧 useState 计时块（旧块删除） |
| `src/renderer/src/hooks/useToast.test.ts` | 8 用例：5s 精确驻留 / 替换+计时重置 / undo 动作一次+ack 新驻留 / 无动作形态 / getMessage 镜像 / 订阅通知 / `undoWithAck` 还原+回执 / 空栈无回执 |
| `src/renderer/src/editor/table/keymap.ts` | `NestedNavFns` 增 `undoMain`；`cellKeymap` 增 Mod-z 转发绑定（嵌套 undo 优先 → 主 undo+ack）——**AC-OP-12 嵌套焦点缺陷修复** |
| `src/renderer/src/editor/table/keymap.test.ts` | +3 用例（Mod-z 优先级/转发/双空回落）；`navSpy` 增 `undoMain` |
| `src/renderer/src/editor/table/widget.ts` | `tableNav.undoMain = undoWithAck` 注入 |
| `src/renderer/src/editor/setup.ts` | 主编辑器 Mod-z 绑定收敛到 `undoWithAck`（行为不变 + 焦点收口） |
| `src/renderer/src/commands/editCmds.ts` | 菜单「撤销」收敛到 `undoWithAck`（回执 + 菜单 `refocus:false` 口径下自补焦点） |

## 11. 动态发现 / 实现决策（已回写任务 frontmatter）

1. **嵌套单元格焦点下 Ctrl+Z 被吞**（真缺陷，已修）：表格 widget `ignoreEvent: true` + nested `historyKeymap` 的 `Mod-z { preventDefault: true }` 双重短路——结构 op 后（嵌套焦点、嵌套空栈）Ctrl+Z 什么都不做。修复口径：`cellKeymap` 注册 Mod-z 转发（`undo(v) || nav.undoMain(main)`），同键合并 run 数组中排在 historyKeymap 之前；单元格打字撤销（轻量，无 toast）优先，空栈落到主 history 并回执「已撤销」。后续任何嵌套 EditorView 需要透传主编辑器命令的，走 `NestedNavFns` 注入（keymap.ts 保持零项目依赖的循环切断纪律）。
2. **undo 三入口收敛 `undoWithAck`**：undo + 冻结 ack + 焦点收口一份实现（setup.ts Mod-z / editCmds 菜单 / 嵌套转发共用）；toast 按钮的 ack 归 store `runAction`（状态机契约，已有单测），run 体内只做 undo + 焦点。
3. **AC-OP-12 终态焦点**：点撤销按钮/菜单后焦点会落 `<body>`/菜单按钮（`closeAll({refocus:false})` 为 dialog invoker 语义故意不回焦），键盘输入进不了正文。`refocusAfterUndo`：焦点已在 `view.dom` 内（含嵌套单元格编辑器）则不动，否则 `view.focus()`。
4. **探针 op 的回执层级**：`__veloxTable.op('insertRow/insertCol')` 不产 toast（插入回执挂 cmd 级 `INSERT_TOAST_KEYS`）；delete/resize/move 族挂派发层 `STRUCTURE_TOASTS`。CDP 队列验证用双 delete 族 op。另：回执行/列号参数取 **op 前活动单元格锚点**（`{i,j}` from `edit.active`），不是被删行/列的索引。
5. **formatTable padding 与字节比对**：每次结构 op 以 `padEnd` 重写行宽，undo 还原到 op 前的字节形态（含 padding）——任何"逐字节还原"断言必须对 **op 前快照** 比对，不能对 fixture 字面量。
6. **验证环境纪律**：`npm run dev -- --userDataDir` 被 electron-vite 的 cac 吞参报 `CACError`，须 `npx electron-vite dev -- --remote-debugging-port=N --user-data-dir=...`；遮挡窗口拖慢定时器，验证前 `Page.setWebLifecycleState` + `setFocusEmulationEnabled` + `bringToFront`；全部 CDP evaluate 带超时（上一轮 FE-07 卡死即无超时 evaluate 挂 600s 所致）。

## 12. 阶段 3 联调移交项（主 agent 编排）

1. **FE-01/02/04/05（结构 op 回执面）**：回执行文案/undo 后缀均为冻结 key 单源；撤销按钮 action 由 `undoAction(view)` 供给，op 侧无需改。插入族回执在 cmd 级（`toastStructCmd`）、delete/resize/move 在派发级（`STRUCTURE_TOASTS`）——四入口（快捷键/⋮/右键/工具栏）文案一致性已有 keymap.test.ts/contract 侧断言。
2. **FE-09（一键回安静）**：toast 是操作回执浮层，不在 chrome 浮层关照口径内——联调确认 Esc/回安静不误关 toast（PEND-05 5s 自然消失为准）。
3. **FE-10（布局位移）**：toast 宿主 fixed 右下角，出现/消失位移 0px 已实测；深色主题 token 同源翻值建议抽验一眼（本轮实测浅色）。
