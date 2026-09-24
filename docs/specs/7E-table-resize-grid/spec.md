# 7E spec — 已有表格的行列规模网格选择器

> 看板任务：⑤ 7.5（`docs/markdown-ux-optimization.md` 实施优先级 P0）。⑥（7C 工具栏）依赖本项的 ⊞ 语义；本项的 ⊞ 入口在过渡期挂 hover 块工具栏，⑥ 落地时移交（见「过渡期入口」）。

## 背景 / 差距（what & why）

对照基准截图 `temp/typora/table-btn-1.png`：Typora 编辑态工具栏第 1 按钮是 Excel 式 **N×M 网格选择器**——拖选即定目标行列数，底部「R × C」读数，一拖一次完成整表扩/缩。

VeloxMark 现状：已有表格只能靠左/顶槽 +/− 把手**逐次**增删行列（点 N 次加 N 行）；20×12 网格交互只存在于**新建**对话框（`TableInsertDialog`，P22），已有表格无规模总览、无一次性调整。这是表格操作效率缺口（对标 Typora 做不到的操作）。

**What**：已有表格提供 ⊞ 网格选择器 popover——向右/下拖 = 加行/列，向左/上拖 = 删行/列，底部「R × C」读数，确认后**一次 transaction**（undo 一步）把表格调到目标规模。

**Why**：补齐与 Typora 的操作能力差距；规模调整从 O(N 次点击) 变 O(1 次拖选)；为 ⑥ 工具栏 ⊞ 按钮提供语义与组件。

## AC（可测试）

1. **一次完成**：网格确认后整表一次性扩/缩到目标 R×C；单一 transaction，undo 一步还原（`runTableOp` 既有分发层：pending 单元格文本照常折叠、nextActive 照常接管）。
2. **边界**：缩到 **1×1**（单表头行 × 单列）后不再缩——网格 hover 不低于 1×1，op 层对非法目标（<1）no-op 语义（7A 双保险同款：UI 钳制 + op 拒绝）。
3. **对齐数组随列伸缩**：加列补 `''` 对齐、删列截尾，与 `insertColOp`/`deleteColOp` 语义一致（ragged aligns 先补平再伸缩）。
4. **键盘可达**：popover 打开即聚焦；方向键移动选择、Enter 确认、Escape 关闭（与 `TableInsertDialog` 网格同键位语义）。
5. **读数**：选择过程中底部实时显示「R × C」目标规模（数字 + `×`，与 Typora `3 × 4` 同形）。
6. **缩容语义显式**：扩容在底部/右侧补空行/空列；缩容**从底部丢行、从右侧丢列**（Excel 式网格锚定左上角的选择语义，被丢单元格内容不保留）——表头恒为第 0 行不动。
7. **确认即关闭**：点选/Enter 后 popover 关闭；Escape/点击外部关闭且**零改动**；目标 = 当前规模时 no-op（不产生空 transaction）。
8. **过渡期入口**：⊞ 按钮暂挂表格 hover 块工具栏（「⊞」「复制」序首），仅表格局块工具栏内可见；点击打开 popover（锚 = 按钮）。⑥ 落地时按钮移交统一工具栏，popover 语义不变。
9. **e2e 缝零触碰**：既有字面量（`data-table-handle` 既有值族/`data-op`/命令 id/`__velox*`）零改动；新 DOM class 为 add-only。

## Out of scope（明确不做）

- ⑥ 7C 统一工具栏（⊞ 的最终落位、对齐三键、⋮ 菜单、🗑 删除——另立 spec）。
- +/− 把手去留（⑥ plan 决策项）。
- 非等比/局部行列增删（插入到指定位置）——既有 +/− 把手与右键菜单继续承担。
- 列宽联动（缩列后 colWidths 的陈旧项处理归 ⑫ 7.7 决策，本项不碰 `state.ts` 列宽存储）。

## 约束引用（红线逐条对应）

1（e2e 缝）→ AC9；2（Markdown 唯一数据源）→ 规模是源码的整表替换（`TableOp` 既有形态），无第二模型；3（Decoration/Widget 纪律）→ 不新增 widget（popover 是 DOM 浮层，同 ctxMenu 模式）；4（stale-instance）→ 按钮/pick 回调**事件时** `resolveTableModel`/`getTableEdit` 重解析，不捕获 build 时刻偏移；5（i18n）→ 新 key 同落 en.ts + zh.ts；6（不新增平行按钮皮肤）→ 网格 cell 复用 `table-insert-cell` 族 class（P22 同观感）；9（单测纯函数）→ `resizeTableOp` + 网格键盘纯函数有测，popover DOM 不测。
