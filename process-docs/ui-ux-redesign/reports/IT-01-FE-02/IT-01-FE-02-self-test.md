# IT-01-FE-02 自测报告 — 表格结构操作键位改造（Shift 升档 3 键/Ctrl+Shift 分流/Ctrl+Enter 专职插行/非回归）

- 任务：`process-docs/ui-ux-redesign/tasks/IT-01/FE-02.md`
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`
- 日期：2026-09-29
- 验收：AC-RULE-06 / AC-RULE-11 / AC-OP-01 / AC-OP-03 / AC-OP-04 / AC-ERR-12
- 实现图：无（本任务为纯键位逻辑层，无 UI 面变更——快捷键卡片/菜单回显 UI 归 FE-04，见 §7）

## 1. 键位表 5 组逐键验证记录（TBL §3.2 冻结口径）

测试表：`lead paragraph` + 3 行 2 列表格（表头 `h1|h2`，body `a|b`、`c|d`）；单元格激活态经 `setActiveCell` 锚定，断言走 `keymap.test.ts` 22 用例（每键均有绑定层 + 路由层双断言）。

| 组 | 键位 | 语义（op id） | 绑定层断言 | 路由层断言 | toast 回执（冻结文案） | 结果 |
|---|---|---|---|---|---|---|
| ① 基础档 | Ctrl+Enter | `insertRowBelow` 下方插行 | cellKeymap → nav.struct(cmd=insertRowBelow) ✓ | i=1 下一行插空行（grid 断言 `[h1h2, ab, '', cd]`），单事务 | 「已在下方插入行（Ctrl+Z 可撤销）」 ✓ | ✓ |
| ② Shift 升档 | Ctrl+Shift+Enter | `insertRowAbove` 上方插行 | → cmd=insertRowAbove ✓ | i=2 上插空行 ✓；**i=0 表头迁移**（Q5：新空行升表头 `[ '', '' ], [h1h2], [ab], [cd]`）✓ | 「已在上方插入行（Ctrl+Z 可撤销）」 ✓ | ✓ |
| ③ Shift 升档 | Ctrl+Shift+→ | `insertColRight` 右侧插列 | → cmd=insertColRight ✓（仅 selection.empty=true） | 锚定列右侧插空列（grid `[h1,'',h2]…`），冒号行同步 3 项左对齐 ✓ | 「已在右侧插入列（Ctrl+Z 可撤销）」 ✓ | ✓ |
| ④ Shift 升档 | Ctrl+Shift+← | `insertColLeft` 左侧插列 | → cmd=insertColLeft ✓（仅 selection.empty=true） | 锚定列左侧插空列（同 grid），冒号行同步 ✓ | 「已在左侧插入列（Ctrl+Z 可撤销）」 ✓ | ✓ |
| ⑤ 移动族 | Alt+↑ | `moveRowUp` | → cmd=moveRowUp ✓（既有，不变） | 既有行为（FE-01 纯 op，本任务未动） | 无（wave③ 既有口径，不变） | ✓ 非回归 |
| ⑤ 移动族 | Alt+↓ | `moveRowDown` | → cmd=moveRowDown ✓ | 同上 | 无 | ✓ 非回归 |
| ⑤ 移动族 | Alt+← | `moveColLeft` | → cmd=moveColLeft ✓ | 同上（宽度随列 FE-06 接缝保持） | 无 | ✓ 非回归 |
| ⑤ 移动族 | Alt+→ | `moveColRight` | → cmd=moveColRight ✓ | 同上 | 无 | ✓ 非回归 |

- 锚定规则（AC-RULE-06）：全部 op 由 `ops.ts` UI-anchored 适配器（`insertRowAboveOp/insertRowBelowOp/insertColLeftOp/insertColRightOp`，FE-01 单源导出）锚定当前激活单元格相邻位；上插 i=1 走 Q5 表头身份迁移（单测 `insertRowAbove at the header migrates header identity` 钉住）。
- 键字面量唯一声明（AC-RULE-11 前置）：单测源码扫描（`key literal single source`）断言 8 个冻结字面量仅出现在 `keymap.ts`；菜单回显经 `STRUCT_KEYS → cmKeyToDisplay → fmtShortcut` 派生（opsTable `structShortcut` 消费侧既有）。

## 2. Q4 上下文分流验证（Ctrl+Shift+←/→，AC-OP-03/04 前置收口）

| 场景 | 期望 | 断言 | 结果 |
|---|---|---|---|
| `selection.empty=true`（纯光标）按 Ctrl+Shift+→ | 触发 `insertColRight` | 绑定层 tryRun 被调用 + 路由层插列 + toast ✓ | ✓ |
| `selection.empty=true` 按 Ctrl+Shift+← | 触发 `insertColLeft` | 同上 ✓ | ✓ |
| `selection.empty=false`（文本选区开着）按 Ctrl+Shift+→/← | **不触发插列**，return false 放行 CM6 默认 `Mod-Shift-Arrow`（selectGroupLeft/Right 词选扩展，@codemirror/commands 已核验存在） | tryRun 零调用 + 返回 false ✓ | ✓ |
| 有/无选区按 Ctrl+Enter / Ctrl+Shift+Enter | 不受分流影响（Q4 只裁决 ←/→） | 两种 selection 态均路由 ✓ | ✓ |
| 剪贴板/选区为空等干扰 | 不参与分流判定（仅 selection.empty） | 判定函数 `structCmdTakesKey(cmd, selectionEmpty)` 纯函数单测 ✓ | ✓ |

## 3. PEND-13 非回归验证（Ctrl+Enter 专职插行）

| 键 | 行为 | 断言 | 结果 |
|---|---|---|---|
| Ctrl+Enter | 专职下方插行，**不承担换行** | 路由 insertRowBelow + toast（§1 ①）✓ | ✓ |
| Shift+Enter | 单元格内写 `<br>`（含选区覆写 + 光标后移 4） | dispatch spec 逐字段断言 `{changes:{insert:'<br>'}, selection:{anchor: from+4}, userEvent:'input.table.br'}` ✓ | ✓ |
| Tab / Shift+Tab | 跳格 next / prev | nav.move 调用序断言 ✓ | ✓ |
| Enter | 下移单元格（down） | 同上 ✓ | ✓ |
| Escape | 退场（out） | 同上（既有绑定未动）✓ | ✓ |

## 4. AC-ERR-12 键族作用域验证

| 场景 | 期望 | 断言 | 结果 |
|---|---|---|---|
| 正文普通段落（无激活单元格）按全键族 8 键 | 无结构变化、不劫持 | `tryStructCmd` 逐 cmd 返回 false + 文档逐字节不变 ✓ | ✓ |
| main 编辑器 backstop 绑定层（`structKeyBindings(tryStructCmd)`）按全键族 | 全部 fall-through | 每键 run 返回 falsy + 文档不变 ✓ | ✓ |
| 无表格文档按键族 | 无事发生 | 同上（无 active cell 路径覆盖）✓ | ✓ |
| 不弹工具栏 | 键位层零工具栏挂载点 | keymap/commands 无 toolbar 调用（工具栏为 hover 挂载，FE-03 面）✓ | ✓（行为面由 QA 冒烟确认） |

## 5. AC 验收证据映射

### AC-RULE-06（键位表 + 锚定 + Q4 前置）
- §1 逐键表（5 组 8 键全量）+ §2 分流表；锚定断言在 §1 路由层列。
- 单测：`STRUCT_KEYS frozen key table`、`Q4 context split`、`cellKeymap routing`、`tryStructCmd op routing` 四组。

### AC-RULE-11（回显单源派生，零例外）
- 键字面量唯一声明 keymap.ts（源码扫描单测钉住）；`cmKeyToDisplay` 全 8 键 win 显示形态断言（`Ctrl+Shift+Enter`/`Ctrl+Shift+→`/`Ctrl+Shift+←` 等）；`fmtShortcut` mac ⌘/⇧/⌥ 既有派生链不变。
- **移交 FE-04**：`insertRowAbove`/`insertColLeft`/`insertColRight` 三个菜单项当前无 `shortcut:` 字段（仅 `insertRowBelow` 有），补 `structShortcut(...)` 回显后本 AC 全闭环。

### AC-OP-01（Ctrl+Enter 下插 + 冻结回执 + 单事务）
- 单测：`Ctrl+Enter inserts a row below with the frozen receipt`（grid 插位 + toast 逐字冻结文案 + 前后文不变）。
- 单事务：整表 replace 经 `runTableOp`（op.from/op.to 单次 dispatch）——FE-01 op 层已有「单 replace 逆操作逐字节还原」断言。

### AC-OP-03 / AC-OP-04（右/左插列 + 冒号行左对齐项 + Q4 前置）
- 单测：`Ctrl+Shift+→/← inserts a column…`（grid 插位 + `alignsOfDoc` 长度同步 + 冻结 toast）；Q4 前置由 §2 收口为正式语义（AC-PEND-03 → Q4 转正，语义与 [TBL §3.3](../../design/api/TBL-table-ops.md) 一致）。

### AC-ERR-12（键族仅单元格激活态）
- §4 全表 + 单测 `tryStructCmd scope` 两用例（op 层 + 绑定层）。

## 6. 质量门禁

| 门禁 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npm run typecheck`（tsconfig.web + tsconfig.node） | **0 Error** ✓ |
| 单测 | `npm run test:unit` | **50 文件 592/592 全绿**（含本任务 keymap.test.ts 22 用例：15 新增 RED→GREEN）✓ |
| Lint | 项目无 lint 脚本 | 跳过 |
| 构建 | `npm run build` | 未单独执行（FE-01 同 worktree 收敛时已过；本次改动仅 TS 纯逻辑，typecheck 双配置已覆盖） |
| cdp 冒烟 | `npm run test:smoke` | 不可跑（worktree 无 `scripts/cdp-smoke.mjs`，git 树中不存在）——e2e 缝未破坏（未触碰 `window.__velox*`/`data-op`/命令 id 字面量） |

TDD 记录：先落 22 用例跑出 15 失败（RED：3 新键缺位/分流函数缺位/路由 case 缺位/toast 缺位）→ 实现 keymap.ts + commands.ts 后 22 全绿（GREEN）→ 全仓 592 绿无回归。

## 7. 新增/修改文件

| 文件 | 变更 |
|---|---|
| `src/renderer/src/editor/table/keymap.ts` | `StructCmd` 扩 8 op id；`STRUCT_KEYS` 入库 Shift 升档 3 键（注释覆盖 5 组冻结口径）；新增 `structCmdTakesKey`（Q4 分流纯函数）；`structKeyBindings` 按 `selection.empty` 分流（仅插列 2 键） |
| `src/renderer/src/editor/table/commands.ts` | `tryStructCmd` 接线 `insertRowAbove/insertColLeft/insertColRight`（import FE-01 ops.ts 适配器单源，不内联锚定映射）；插列接 FE-06 `insertColWidths` 宽度随列接缝；键盘路径 toast 回执（`INSERT_TOAST_KEYS` 冻结 key）；`runTableOp` 返回 boolean；delete toast 补 `{i}/{j}` 1 起传参（修字面占位符泄漏） |
| `src/renderer/src/editor/table/keymap.test.ts` | 22 用例：冻结键表/回显派生/字面量唯一扫描/Q4 分流/cellKeymap 非回归/AC-ERR-12 作用域/tryStructCmd 路由+toast 冻结文案 |
| `src/renderer/src/editor/table/nestedSession.ts` | **无改动**（评估结论：Q4 放行后词选扩展由 `keymap.of([...cellKeymap, ...defaultKeymap])` 既有顺序承接——defaultKeymap `Mod-Shift-Arrow` = selectGroupLeft/Right 已核验；Shift+Enter/Tab/Enter 绑定在 cellKeymap 内未动，分流不破坏） |

## 8. 阶段 3 联调移交项（主 agent 编排）

1. **FE-01（已完成）**：i=1 按 Ctrl+Shift+Enter 表头身份迁移 + 一次 undo 还原——路由层已断言 grid 结果；undo 逐字节还原由 FE-01 op 单测覆盖（「单 replace 逆操作对参差源码逐字节还原」），联调确认一次 Ctrl+Z 即可。
2. **FE-04**：① ⋮/右键菜单 3 项补 `shortcut: structShortcut('insertRowAbove'|'insertColLeft'|'insertColRight')`（STRUCT_KEYS 已可派生）；② 菜单路径 insert/delete toast 回执（同 i18n key 单源）；③ 清理 opsTable.ts 底部与 ops.ts 重复的 4 个 local 适配器 const（旧双源）；④ `t('toast.rowDeleted', { i: row + 1 })` / `colDeleted { j: col + 1 }` 传参（键盘路径本任务已修，opsTable 同款漏参已由 FE-01 记入其 implementation-notes）。
3. **FE-07**：toast「（Ctrl+Z 可撤销）」后缀已含于冻结文案；撤销按钮与 Ctrl+Z 等效（undo 三入口）归其回执面。

## 9. 动态发现（已回写任务 frontmatter）

- op id→锚定参数映射单源 = `ops.ts` 适配器导出（FE-01 增量），键盘/菜单两侧 import 均不得内联 `row-1`/`col+1`。
- Q4 分流判定收在 `structCmdTakesKey`（keymap.ts 纯函数），读「收到按键的 view」的 `selection.empty`——单元格内嵌编辑器聚焦时即内嵌选区（契约原话「内嵌编辑器选区」），main backstop 时为 main 选区；keymap.ts 零项目 import 纪律不破（不引 nestedSession）。
- `runTableOp` 返回 boolean 后键盘路径才可条件 toast；widget/toolbar 既有调用点忽略返回值、行为不变。
- Mac 口径备注：CM 字面量为 `Ctrl-*`（冻结表原样），显示经 fmtShortcut 映射 ⌘/⇧/⌥——与既有 `Ctrl-Enter` 约定一致，本任务不改平台绑定语义。
