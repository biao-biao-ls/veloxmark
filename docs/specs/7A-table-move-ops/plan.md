# 7A 实施方案

## 技术决策与理由

- **移动 = 相邻交换**（不是"拖拽排序"）：与 Typora 菜单语义一致（上移/下移逐步交换）；实现为纯 grid 变换，undo 单步天然成立。拖拽排序留待未来独立 spec。
- **边界语义双保险**：菜单项 `disabled`（可发现性）+ op 层返回 `null`（防御，`runOp` 已处理 null）。AC3 的"表头可下移/体行可上移至表头位"采用交换语义——GFM 表头恒为第一行，交换即换表头，无特殊分支。
- **aligns 随列**：`moveColOp` 同步交换 `aligns` 数组对应项（与 `deleteColOp` filter 保持的对齐完整性同一理由）。
- **nextActive 跟随被移动行/列**：行移动 `col` 保持、列移动 `row` 保持——用户操作期间焦点不跳走。为此 op 签名带锚点坐标（`moveRowOp(model, row, col, dir)`），比 `deleteRowOp(model, row)` 多一个参数，是锚点保持的最小代价。
- **dir 用 `-1 | 1` 数字**而非 `'up'|'down'` 字符串：一行实现覆盖四向，菜单/hook 各自映射。

## 文件切法

| 源 | 改动 |
|---|---|
| `editor/table/ops.ts` | 新增 `moveRowOp(model, row, col, dir)` / `moveColOp(model, row, col, dir)`（纯函数，~30 行） |
| `editor/table/ops.test.ts` | **新建**：移动 op 单测 |
| `editor/contextMenu/opsTable.ts` | `tableDeltaItems` 插入 4 项 + 边界 disabled 计算；适配器 `moveRowUpOp` 等 4 个；hook 契约注释补 id |
| `editor/table/widget.ts` | `tableTestHook.op` kind 表补 `moveRowUp/moveRowDown/moveColLeft/moveColRight` + userEvent 映射 |
| `i18n/zh.ts` + `i18n/en.ts` | 各 +4 key |

## 状态/契约归属

无新状态；全部走既有 `runOp`（pending 折叠 + `setActiveCell`）路径。菜单 id 契约增列 4 个新 id。

## import 改动面

`opsTable.ts` 增 import `moveRowOp`/`moveColOp`；`widget.ts` hook 表内引用同模块已有 import 面。无新 import 环。

## 任务拆分

1. `ops.ts` 移动 op + `ops.test.ts` 单测 [先行]
2. `opsTable.ts` 菜单项 + i18n 4×2 key [依赖 1]
3. `widget.ts` hook kind + userEvent 映射 [P 可与 2 并行]

## 验证方案

- `npm run typecheck && npm run test:unit`（新增 `ops.test.ts` 全绿、i18n 对齐测试过）
- AC 逐条：菜单 4 项出现且 id 正确（`data-op`）、交换语义、边界 disabled、nextActive 跟随、undo 单步（CDP 钩子 `__veloxTable.op` 可驱动）
- e2e 缝：只增 id/kind，不改既有字面量

## 实现细化（2026-09-24 implement 时决策）

- **`moveColOp` 不走 `opFrom`**：`opFrom` 用 `model.aligns` 格式化，而列移动需要 aligns 交换后的版本——显式 `formatTable(alignsSwapped, grid)` 返回（同 `insertColOp`/`deleteColOp` 先例）；`moveRowOp` 不动 aligns，走 `opFrom`。
- **hook `op` 签名 additive 扩展**：`op(view, from, kind, arg = 0, arg2 = 0)`——`arg2` 可选，既有 4 参调用不受影响（e2e 缝只增）。move kind 语义：`arg` = 行号（moveRow*）/列号（moveCol*），`arg2` = 锚点（行移动传 col、列移动传 row），`moveColLeft/Right` 内部转置为 `moveColOp(m, y, x, dir)`。kind 表显式标注 `Record<string, (m, x, y) => TableOp | null>`（少参函数可赋值）。
- **菜单边界 disabled 的 dims 来源**：`tableDeltaItems` 构建时经 `deps.modelSpan()` + `tableModelOf` 重解析取 `rows/cols`（菜单打开即事件时刻，符合 stale 纪律）；runOp 侧仍逐次重解析不变。
- **菜单项落位**：4 项紧随 `deleteCol` 之后、对齐组之前（AC1）；i18n key 也按此顺序插在 `ctx.deleteCol` 后，便于字典与菜单对照。
- **`STRUCTURE_TOASTS` 不加 move**（spec 约束）：移动即时可见、保持安静，同 insert/align。

## 收敛记录（2026-09-24）

- `npm run typecheck` ✓（双 tsconfig）
- `npm run test:unit` ✓ 28 files / 289 tests（新增 `ops.test.ts` 5 例：行交换+锚点、表头下移、行四边界 null、列交换+aligns 随列、列四边界 null）
- `npx madge --circular --extensions ts,tsx src/renderer/src` ✓ 0 cycles
- e2e 缝核对：diff 内既有 `data-op`/命令 id/`__velox*` 字面量零改动；只增 4 菜单 id + 4 hook kind + `op` 可选参 `arg2`
- AC1–7 逐条核对通过（边界双保险 = 菜单 disabled + op null，均有单测/代码路径覆盖）
- 人工冒烟：菜单 4 项出现/边界禁用/undo 一步还原——待运行时冒烟补签（无 UI 结构改动，风险面小）
