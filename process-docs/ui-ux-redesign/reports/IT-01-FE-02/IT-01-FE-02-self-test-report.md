# IT-01-FE-02 自测报告 — 表格结构操作键位改造（Shift 升档 3 键/Ctrl+Shift 分流/Ctrl+Enter 专职插行/非回归）

- **任务ID**: IT-01/FE-02（表格结构操作键位改造）
- **测试时间**: 2026-10-02 22:05–22:15（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段逐键联调证据存档。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；键位语义为纯逻辑层，验证面 = keymap 路由/绑定双层单测 + toast 冻结文案断言。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-01/FE-02.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-RULE-06 | 键位表 5 组冻结（基础 1 键/Shift 升档 3 键/移动 4 键）+ op 锚定激活单元格相邻位 | ✅ 通过 | `keymap.test.ts` > `STRUCT_KEYS frozen key table` 2 用例（冻结 chord 逐 op 声明 + 回显 hint 单源）+ `cellKeymap routing`（8 键 → op id 经 nav.struct）本轮重跑 25/25 ✓；锚定走 FE-01 UI-anchored 适配器单源（`ops.test.ts` 适配器组 ✓） |
| AC-RULE-11 | 快捷键提示单源派生零例外（键字面量唯一声明，回显经派生） | ✅ 通过 | `keymap.test.ts` > `key literal single source (grep unique to keymap.ts)`（8 冻结字面量仅 keymap.ts）+ `cmKeyToDisplay` 2 用例 ✓；菜单回显 `opsTable.test.ts` > `8 个 shortcutCmd 恰好覆盖 STRUCT_KEYS 全部 8 键` + `AC-RULE-11 零例外` ✓（contextMenu 组 95/95） |
| AC-OP-01 | Ctrl+Enter 下方插行 + 冻结回执「已在下方插入行（Ctrl+Z 可撤销）」+ 单事务 | ✅ 通过 | `keymap.test.ts` > `Ctrl+Enter inserts a row below with the frozen receipt (AC-OP-01)`（grid 插位 + toast 逐字冻结 + 前后文不变）✓；单事务 = `commands.test.ts` runTableOp 单 replace（18/18 ✓） |
| AC-OP-03 | Ctrl+Shift+→ 右侧插列 + 冒号行左对齐项同步 + Q4 分流前置 | ✅ 通过 | `keymap.test.ts` > `Ctrl+Shift+→ inserts a column right of the anchor (AC-OP-03)` ✓ + `Q4 context split` 5 用例（选区开着不触发/空选区触发/行移键不受分流）✓；冒号行 `:---` 同步 `ops.test.ts` > `insertColOp writes … :---` ✓ |
| AC-OP-04 | Ctrl+Shift+← 左侧插列（同上镜像） | ✅ 通过 | `keymap.test.ts` > `Ctrl+Shift+← inserts a column left of the anchor (AC-OP-04)` ✓ + Q4 分流 ✓ |
| AC-ERR-12 | 键族仅单元格激活态生效；正文/无表格不劫持不弹 chrome | ✅ 通过 | `keymap.test.ts` > `tryStructCmd scope (AC-ERR-12)` 2 用例（正文段落全 cmd 拒绝文档不变 + main backstop 绑定层 fall-through）✓ |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| keymap 全量（冻结键表/回显/单源扫描/Q4 分流/路由/toast/undo 三入口） | ✅ 25/25 | `npx vitest run src/renderer/src/editor/table/keymap.test.ts` | 2026-10-02 22:05 重跑 |
| 回执 i18n 单源（与 ⋮ 菜单同 key） | ✅ | `keymap.test.ts` > `receipts use the same frozen i18n keys the ⋮ menu items share` | 零双写 |
| 非回归（PEND-13：Shift+Enter `<br>`/Tab 跳格/Enter 下移/Esc 退场） | ✅ | `keymap.test.ts` > `cellKeymap routing and non-regression` 4 用例 | 行为不变 |
| Ctrl+Enter 专职插行不承担换行 | ✅ | 路由断言 + `Shift+Enter writes <br>` 分立 | — |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（历史移交项已闭环：FE-04 菜单 3 项 `structShortcut` 回显补全由 opsTable.test 95/95 钉住；收口批收-A 已清 formatShortcut 死链。）

## 结论

**通过**。AC-RULE-06 / AC-RULE-11 / AC-OP-01 / AC-OP-03 / AC-OP-04 / AC-ERR-12 六条全过。本轮 keymap.test.ts 25/25 全绿（含收口批新增 undo 三入口用例），contextMenu 组 95/95、commands 18/18 同场佐证，零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 8 键结构操作（键盘通道） | — | ✅ | ✅（Q4 分流/作用域） | ✅（ERR-12 不劫持） | ✅ |
| 回执 toast 冻结文案 | ✅ | — | ✅ | — | ✅ |
| PEND-13 非回归键族 | — | ✅ | — | — | ✅ |

覆盖率: 8/12 (67%)（纯键位逻辑层，「渲染」列大面积不适用）
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest 双层路由单测，桌面适配口径）
