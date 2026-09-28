# TBL 表格结构操作契约（tbl-ops）

## 1. 概述

| 项 | 内容 |
|---|---|
| 接口域职责 | 表格结构操作全语义：op id 契约面（⋮ 菜单 / 单元格右键 / 工具栏 / 快捷键四面同源）、键位语义、禁用规则、toast 回执、undo 事务边界、data-op 契约集演进 |
| 通道类型 | op id（`data-op`）/ keymap（STRUCT_KEYS）/ 工具栏 DOM / toast / 确认框（仅删表） |
| 类型 | **修改**（把手移除、Shift 升档键位新增、toast 回执改造、表头身份迁移、列宽吸收规则）+ **复用**（`editor/table/ops.ts` 纯 op、单事务 dispatch、`contextMenu/*` 拼装）+ **删除**（4 个 `data-table-handle` 契约，见 §5.10） |
| 裁决来源 | Q2（e2e 契约 delta 删4留1）、Q3（仅删表确认）、Q4（Ctrl+Shift+←/→ 上下文分流）、Q5（首行上插表头身份迁移）、PEND-07（参差补齐矩形）、PEND-10（列宽右邻列吸收）、PEND-12（删表头行身份下移）、PEND-13（Ctrl+Enter 专职插行）、Q8（键盘通道走菜单兜底，不补专键） |
| 代码真源（现状） | `src/renderer/src/editor/contextMenu/opsTable.ts`（19 个 data-op）、`src/renderer/src/editor/table/ops.ts`（纯 op）、`src/renderer/src/editor/table/keymap.ts`（STRUCT_KEYS）、`src/renderer/src/editor/table/toolbar.ts`、`src/renderer/src/editor/table/gridPicker.ts`、`src/renderer/src/editor/table/widget.ts`（把手带 + col-grip） |

> 计数口径核对：接口清单标注「op id ×16」= **单元格级 op 16 项**（结构操作 13 + 单元格剪贴板 3）；`opsTable.ts` 另有 **3 个文档级动作**（copyTable / formatTableSource / deleteTable），合计 **19 个 data-op id**，与 menu-tree §4「⋮ 菜单 19 项」及 §9 data-op 契约清单（19 个）逐一对应。本文件 §5.1 给出全部 19 项全表，16+3 分组在表中标注。

---

## 2. 契约清单

| 契约标识 | 通道类型 | 类型 | 说明 | PRD 来源章节 | AC 条目 | 裁决来源 |
|---|---|---|---|---|---|---|
| `data-op:insertRowAbove` | op id | 修改 | 激活单元格上方插空行（i=1 走表头身份迁移） | PRD 6.1 | AC-OP-02, AC-RULE-07 | Q5 |
| `data-op:insertRowBelow` | op id | 修改 | 激活单元格下方插空行；键位 Ctrl+Enter | PRD 6.1 | AC-OP-01 | PEND-13 |
| `data-op:deleteRow` | op id | 修改 | 删行改为无确认直接执行 + toast+undo（原 AC 确认流撤销） | PRD 6.1 | AC-OP-10, AC-ERR-02 | Q3 |
| `data-op:insertColLeft` | op id | 修改 | 锚定单元格左侧插空列（默认左对齐） | PRD 6.1 | AC-OP-04, AC-RULE-07 | Q4 |
| `data-op:insertColRight` | op id | 修改 | 锚定单元格右侧插空列（默认左对齐） | PRD 6.1 | AC-OP-03 | Q4 |
| `data-op:deleteCol` | op id | 修改 | 删列改为无确认直接执行 + toast+undo | PRD 6.1 | AC-OP-10, AC-ERR-02 | Q3 |
| `data-op:moveRowUp` | op id | 复用 | 上移该行；首行禁用（表头保护） | PRD 6.1 | AC-OP-05, AC-ERR-05, AC-FN-24 | —（PRD 冻结） |
| `data-op:moveRowDown` | op id | 复用 | 下移该行；末行禁用 | PRD 6.1 | AC-OP-05 | — |
| `data-op:moveColLeft` | op id | 复用 | 左移该列；首列禁用（表头保护） | PRD 6.1 | AC-OP-06, AC-ERR-06 | — |
| `data-op:moveColRight` | op id | 复用 | 右移该列；末列禁用 | PRD 6.1 | AC-OP-06 | — |
| `data-op:alignLeft` / `alignCenter` / `alignRight` | op id ×3 | 复用 | 对齐写冒号行并即时回显（工具栏三键同 op） | PRD 6.1 | AC-OP-08 | — |
| `data-op:cutCell` / `copyCell` / `pasteCell` | op id ×3 | 复用 | 单元格剪贴板三项 | PRD 6.1 | AC-FN-06（同源面） | — |
| `data-op:copyTable` | op id | 复用 | 拷贝整表 Markdown | PRD 6.1 | AC-FN-06 | — |
| `data-op:formatTableSource` | op id | 复用 | 格式化表格源码（两态 toast） | PRD 6.1 | AC-FN-06 | — |
| `data-op:deleteTable` | op id | 修改 | 唯一确认流：删表确认框（文案冻结见 §5.9） | PRD 6.1、PRD M11 | AC-OP-09, AC-ERR-07 | Q3 |
| keymap `STRUCT_KEYS` | keymap | 修改 | 冻结 5 组键位：Ctrl+Enter / Ctrl+Shift+Enter / Ctrl+Shift+← / Ctrl+Shift+→ / Alt+↑↓←→（Shift 升档新增 3 键入库） | PRD 6.1、PRD 12 #7 | AC-RULE-06, AC-OP-01~06 | Q4 |
| `keymap:context-split` | keymap | 新增 | Ctrl+Shift+←/→ 按 `selection.empty` 上下文分流（词选扩展优先） | PRD 12 #7 | AC-RULE-06, AC-OP-03/04 前置 | Q4 |
| `rule:header-migrate-up` | op 语义 | 新增 | 首行上插：空行升表头、原表头降 body 首行、冒号行仍第 2 行 | PRD 6.1（回填） | AC-OP-02 i=1 分支, AC-RULE-07 尾句 | Q5 |
| `rule:header-migrate-down` | op 语义 | 新增 | 删首行：首条 body 行升表头；表头为末行时「删除行」禁用灰显 | PRD 6.1（回填） | AC-OP-10, AC-ERR-02 | PEND-12 |
| `rule:ragged-rectify` | op 语义 | 新增 | 结构操作单事务内全表补齐矩形（空缺补空单元格、冒号行同步），undo 一并还原参差态 | PRD 8 | AC-ERR-01 + 独立 AC-ERR 条目（PEND-07 转正） | PEND-07 |
| `rule:colwidth-neighbor` | 显示态语义 | 修改 | 拖边界=移动边界：总宽不变、差额右邻列吸收；仅最右列边界可增减总宽（钳制正文列内） | PRD 6.1（回填） | AC-OP-11 Then2, AC-ERR-03 | PEND-10 |
| `rule:ctrl-enter-dedicated` | keymap 语义 | 新增 | Ctrl+Enter 专职插行不承担换行；换行维持 Shift+Enter（`<br>`）、Tab 跳格不受影响 | PRD 6.1（回填） | AC-OP-01 + 非回归断言 | PEND-13 |
| `rule:delete-table-only-confirm` | 确认框 | 修改 | 确认流仅保留删表；删行/删列不弹确认（toast+undo 承载误触恢复） | PRD 6.1、PRD 6.5、PRD 8 | AC-RULE-15, AC-OP-10 | Q3 |
| `data-table-handle` delta | e2e 契约 | 修改 | 删 4 留 1：删 row-insert / row-delete / col-insert-left / col-delete，留 col-grip；工具栏/⋮ 改挂统一 data-op | PRD 6 导语 | AC-RULE-17（修订后） | Q2（ADR `e2e-contract-delta.md`） |
| `key:struct-echo` | 菜单回显 | 修改 | ⋮/右键菜单有键项 100% 回显（由 STRUCT_KEYS 单源派生 `fmtShortcut`），无键项右侧留空 | PRD 6.2 | AC-FN-06, AC-FN-07, AC-RULE-11 | — |
| `key:menu-fallback` | 键盘通道 | 新增 | 删除行/列、对齐、⊞ 缩放、删表不补专键：Shift+F10 / Menu 键唤出 ⋮=右键同源菜单 → 方向键遍历 → Enter 执行，禁用态同步灰显 | PRD 12 #10 | AC-RULE-09 | Q8 |
| `grid:resize-range` | op 语义 | 修改 | ⊞ 可选范围逐维 max(20,R0)×max(12,C0)，不主动缩减既有结构 | PRD 6.1 | AC-RULE-12, AC-OP-07, AC-ERR-13 | —（AC 冻结） |

---

## 3. 行为语义明细

### 3.1 结构操作 op 全表（19 项：单元格级 16 + 文档级 3）

> 四面同源总则（PRD 6.1 / AC-RULE-09）：同一 op id 在快捷键 / 表格工具栏 / ⋮ 菜单 / 单元格右键菜单四面的行为结果、toast 文案、禁用规则完全一致。toast 文案逐字引用 ac.md 冻结文案；AC-FN-06 口径：回执统一含「（Ctrl+Z 可撤销）」后缀，undo 回执为「已撤销」。

| # | op id | 菜单分组 | 键位 | 禁用规则 | toast 文案（冻结） | undo 事务边界 |
|---|---|---|---|---|---|---|
| 1 | `insertRowAbove` | 行操作 | Ctrl+Shift+Enter | 无（任意单元格可执行，含 i=1；表头身份迁移见 §3.4） | 「已在上方插入行（Ctrl+Z 可撤销）」 | 单事务：整表 replace 一次 dispatch，含表头身份迁移与冒号行；一次 Ctrl+Z 逐字节还原 |
| 2 | `insertRowBelow` | 行操作 | Ctrl+Enter | 无（含末行） | 「已在下方插入行（Ctrl+Z 可撤销）」 | 单事务同上 |
| 3 | `deleteRow` | 行操作 | 无（Q8 菜单兜底） | 行数=1 禁用；表头为末行时禁用（PEND-12） | 「已删除第 i 行（Ctrl+Z 可撤销）」 | 单事务；无确认框（Q3）；一次 Ctrl+Z 还原行结构 |
| 4 | `insertColLeft` | 列操作 | Ctrl+Shift+←（Q4 分流后） | 无（首列左插允许，AC-RULE-07） | 「已在左侧插入列（Ctrl+Z 可撤销）」 | 单事务：含冒号行新增左对齐项；一次 Ctrl+Z 含对齐项还原 |
| 5 | `insertColRight` | 列操作 | Ctrl+Shift+→（Q4 分流后） | 无 | 「已在右侧插入列（Ctrl+Z 可撤销）」 | 单事务同上 |
| 6 | `deleteCol` | 列操作 | 无（Q8 菜单兜底） | 列数=1 禁用 | 「已删除第 j 列（Ctrl+Z 可撤销）」 | 单事务；无确认框（Q3）；冒号行对齐项同步移除 |
| 7 | `moveRowUp` | 行操作 | Alt+↑ | 首行（表头）禁用灰显（AC-RULE-07 / AC-ERR-05） | 「已上移该行（Ctrl+Z 可撤销）」 | 单事务；移行时列对齐不变（PRD 6.1 v1.2 口径） |
| 8 | `moveRowDown` | 行操作 | Alt+↓ | 末行禁用 | 「已下移该行（Ctrl+Z 可撤销）」 | 单事务同上 |
| 9 | `moveColLeft` | 列操作 | Alt+← | 首列禁用灰显（AC-ERR-06） | 「已左移该列（Ctrl+Z 可撤销）」 | 单事务；冒号行对齐项随列同步交换 |
| 10 | `moveColRight` | 列操作 | Alt+→ | 末列禁用 | 「已右移该列（Ctrl+Z 可撤销）」 | 单事务同上 |
| 11 | `alignLeft` | 对齐 | 无（工具栏 ◧ 同 op） | 无（当前已左对齐时仍可点，结果幂等） | 「第 j 列对齐：左对齐（Ctrl+Z 可撤销）」 | 单事务：冒号行第 j 项改写 + 显示即时回显 |
| 12 | `alignCenter` | 对齐 | 无（工具栏 ▣ 同 op） | 同上 | 「第 j 列对齐：居中（Ctrl+Z 可撤销）」 | 单事务同上 |
| 13 | `alignRight` | 对齐 | 无（工具栏 ◨ 同 op） | 同上 | 「第 j 列对齐：右对齐（Ctrl+Z 可撤销）」 | 单事务同上 |
| 14 | `cutCell` | 单元格 | 无 | 无 | 无 toast（剪贴板动作沿用轻量口径，PEND-15：非结构/破坏性/可撤销类） | 单元格文本清空为独立事务；一步 undo 还原 |
| 15 | `copyCell` | 单元格 | 无 | 无 | 无 toast（拷贝为安全动作） | 无文档变更，不进 undo 栈 |
| 16 | `pasteCell` | 单元格 | 无 | 剪贴板为空：无事发生 | 无 toast（成功/失败均静默无事发生）——剪贴板族（14/15/16）失败与成功口径统一为轻量静默（PEND-15 家族），**不新增 ac.md 冻结面外文案**；若未来要失败回执，文案（如「粘贴失败」）须先登记 ac.md 冻结面 + en/zh 双字典再启用 | 单元格覆写为独立事务；一步 undo |
| 17 | `copyTable` | 结构删除组（文档级） | 无 | 表格范围解析失败时无事发生 | 「表格已复制」 | 无文档变更，不进 undo 栈 |
| 18 | `formatTableSource` | 结构删除组（文档级） | 无 | 无 | 有变更「表格源码已格式化」；无变更「表格无需格式化」 | 格式化为单事务；一步 undo |
| 19 | `deleteTable` | 结构删除组（文档级） | 无（Q8 菜单兜底；工具栏 🗑 同流） | 无（走确认框） | 确认后「已删除表格（Ctrl+Z 可撤销）」 | 确认框确认后整表移除为单事务（含对齐与列宽还原）；取消则文档逐字节不变 |

**触发路径**：快捷键（仅表格单元格激活态生效，AC-ERR-12：正文段落按下全键族不产生结构变化、不弹工具栏）/ 表格工具栏（⊞、对齐三键、⋮、🗑）/ ⋮ 更多操作菜单 / 单元格右键菜单。⋮ 与右键为**同一菜单面**（同 id / 同分组 / 同禁用 / 同回显），menu-tree §4 分组：行操作 / 列操作 / 对齐 / 单元格 / 结构删除。

**e2e 缝影响**：19 个 `data-op` id 字面量全部保持不变（cdp-p10/cdp-p27 契约）；菜单重排只动呈现层分组，不动 id。

### 3.2 冻结键位表（5 组，Shift 升档语义）

| 组 | 键位 | 语义 | STRUCT_KEYS 现状 | 变更 |
|---|---|---|---|---|
| ① 基础档 | Ctrl+Enter | 当前激活单元格下方插行（专职插行，PEND-13） | 已有 | 语义收口：不再承担任何换行语义 |
| ② Shift 升档 | Ctrl+Shift+Enter | 上方插行（反向） | 无 | **新增** |
| ③ Shift 升档 | Ctrl+Shift+→ | 右侧插列（无文本选区时，Q4） | 无 | **新增** |
| ④ Shift 升档 | Ctrl+Shift+← | 左侧插列（无文本选区时，Q4） | 无 | **新增** |
| ⑤ 移动族 | Alt+↑ / Alt+↓ / Alt+← / Alt+→ | 上/下移行、左/右移列 | 已有 | 不变 |

- 键位单源：`editor/table/keymap.ts` 的 `STRUCT_KEYS`（键字面量唯一声明点）；⋮/右键回显经 `cmKeyToDisplay` → `fmtShortcut` 派生（AC-RULE-11 零例外）。
- 锚定规则（AC-RULE-06）：全部操作锚定当前激活单元格，插入位置为该单元格上/下/左/右相邻位，非表尾/表边固定位。
- 非回归断言（PEND-13）：单元格换行维持 Shift+Enter（插入 `<br>`）、Tab / Shift+Tab 跳格、Enter 下移单元格均不受影响。
- **裁决来源**：PEND-13（①）、Q4（③④）、AC-RULE-06 冻结键位表（全组）。

### 3.3 Ctrl+Shift+←/→ 上下文分流（Q4）

| 项 | 规则 |
|---|---|
| 判定时机 | keydown 时刻读取单元格内嵌编辑器选区 |
| 分流规则 | `selection.empty = true`（无文本选区）→ 触发左/右插列；`selection.empty = false`（已有文本选区）→ 词选扩展优先，不触发插列 |
| 语义收口 | AC-OP-03/04 的「单元格内无文本选区」前置由 [PENDING] 收口为正式语义（AC-PEND-03 → Q4 转正） |
| 菜单回显 | 保留冻结键位 Ctrl+Shift+←/→ 的回显不变（AC-RULE-06 键位表） |
| e2e 缝 | 分流逻辑不新增 DOM 契约；探针对无选区路径按 AC-OP-03/04 断言 |

### 3.4 首行上插表头身份迁移（Q5）

触发：光标位于第 1 行（表头行）激活单元格，执行 `insertRowAbove`（Ctrl+Shift+Enter 或菜单）。

1. 新空行插入原表头位置并**升为表头**；
2. 原表头行**降级为 body 首行**（内容不变，现位于 UI 第 2 行）；
3. 冒号行自动仍为源码第 2 行（分隔行位置不变，对齐标记逐列不变）；
4. 零特例分支：与 i>1 上插共用同一 op 路径（表头身份是数据迁移结果，不是分支判断）；
5. undo：一次 Ctrl+Z 还原表头身份与行序，逐字节回到操作前；
6. 回填 PRD 6.1；收口 AC-OP-02 i=1 分支与 AC-RULE-07 尾句。

**现状差异**：`ops.ts` `insertRowOp` 当前对 `at===0` 强制落 index 1（表头下插一行 body），无身份迁移——见 §4。

### 3.5 删表头行身份下移 + 末行禁删（PEND-12）

| 场景 | 行为 |
|---|---|
| 删除首行（i=1，表头行），存在 body 行 | 执行删除；原首条 body 行**升为表头**（对称于 Q5）；冒号行仍第 2 行；一次 undo 还原 |
| 表头为最后一行（无 body 接替） | 「删除行」灰显禁用，点击不执行（禁用即语义，无 toast 报错） |
| 行数=1（含 1×1） | 禁用规则同 AC-ERR-02：行数=1 时「删除行」禁用，不产生空表/空表格语法残留 |

解除 AC-OP-10 的 i>1 前置限制（原 Given「验证删除该行时 i>1」收口）。

### 3.6 参差表格补齐矩形（PEND-07）

| 项 | 规则 |
|---|---|
| 触发 | 任一表格结构操作（插/删/移行列、⊞ 缩放）作用于参差表（存在单元格数不等的行） |
| 行为 | 操作单事务内**全表补齐**为矩形：每行等列数（空缺补空单元格）；冒号行列数同步；各行既有内容不丢失、不错位 |
| undo | 一次 Ctrl+Z 一并还原参差态（还原前源码逐字节一致） |
| 异常底线 | 不崩溃、不抛未捕获异常、插入位置与锚定单元格语义一致（AC-ERR-01 第 1/2/4 项保留） |
| 验收 | 独立 AC-ERR 条目落盘（AC-PEND-07 转正），替换 AC-ERR-01 第 3 项「是否补齐为矩形不作判据」 |

### 3.7 列宽总宽不变、右邻列吸收（PEND-10）

| 项 | 规则 |
|---|---|
| 语义 | 拖列边界 = 移动边界（Excel 同款）：拖宽/拖窄后**表格总宽不变**，宽度差额由**右邻列吸收** |
| 例外 | 仅**最右列**边界拖动可增减总宽；总宽钳制正文列内（不越过正文列宽） |
| 结构变化 | 行/列结构变化后旧列宽钳制到新结构对应列，失效/超界列宽重置为默认宽（AC-ERR-03 保留） |
| 存储 | 列宽为显示态，写入 `veloxmark.session` 的 `tableColWidths`（复用，不写 .md、不参与导出，AC-OP-18） |
| undo | 一次 Ctrl+Z 还原列宽（AC-OP-11 终态） |
| 回填 | PRD 6.1；收口 AC-OP-11 Then2 |

### 3.8 Ctrl+Enter 专职插行（PEND-13）

- Ctrl+Enter **不承担换行**：单元格内按下即执行下方插行；
- 单元格内换行维持 Shift+Enter（写入 `<br>`）；Tab 跳格、Enter 下移不受影响；
- 补非回归断言：Shift+Enter / Tab / Enter 三键行为在本次改造前后一致。

### 3.9 仅删表确认（Q3）

| 操作 | 确认流 | 反馈与恢复 |
|---|---|---|
| 删除表格（`deleteTable`，工具栏 🗑 / 菜单同流） | 弹确认框，文案固定「删除后可用一步撤销还原，确认删除该表格」（AC-RULE-15）；按钮「确认删除」/「取消」 | 确认：toast「已删除表格（Ctrl+Z 可撤销）」，一步 undo 还原整表；取消：文档逐字节不变（AC-ERR-07） |
| 删除行 / 删除列 | **不弹确认**（可逆操作，toast+undo 承载） | toast「已删除第 i 行（Ctrl+Z 可撤销）」/「已删除第 j 列（Ctrl+Z 可撤销）」；一步 undo 还原 |
| 模态叠加 | 确认框开启时 Esc / 点正文空白**仅关确认框**（最上层）；再 Esc 才全收拢（PEND-04，详见 GLB-global-patterns.md） | — |

> ac.md 修订登记：AC-RULE-15 的「破坏性删除（删表/删行/删列）执行前弹确认框」与 AC-OP-10 的确认流分支按 Q3 修订为「仅删表确认」；AC-PEND-16（删行/删列确认文案回填）随确认流移除而关闭。本契约文档不改裁决，仅如实登记（见 §4）。

### 3.10 data-op 契约集演进：删 4 留 1（Q2）

依据 ADR `design/adr/e2e-contract-delta.md`（状态：已确认）：

| 变更 | 契约 | 承载 UI |
|---|---|---|
| **删除** | `data-table-handle="row-insert"` / `"row-delete"` / `"col-insert-left"` / `"col-delete"` | 随常驻 +/− 增删把手 UI 一并移除（G-2 缺陷清零） |
| **保留** | `data-table-handle="col-grip"` | 列宽拖拽抓手仍有 UI，契约延续 |
| **改挂** | 工具栏 / ⋮ 菜单控件挂统一 `data-op` id（与 opsTable 19 项同源） | 四处入口承载行列增删 |

- AC-RULE-17 修订为：「已登记的契约集演进（删 4 留 1）为准入变更；此后契约集变更须走登记流程，禁止静默破坏」。
- 外部 cdp 探针与本仓 `cdp-*.mjs` 同批更新：下线 4 个把手断言，改断言工具栏/⋮ 的 `data-op` id。

### 3.11 ⊞ 网格选择器（AC-RULE-12）

- 可选范围逐维 `max(20 行, 既有行数) × max(12 列, 既有列数)`（25 行×10 列表 → 25×12 可选）；20×12 为常规上限，超限维度扩至现有值，网格不主动缩减既有结构；
- 拖选松开瞬间执行缩放：R>R0 表尾新增（默认左对齐）、R<R0 从尾部移除；保留区域内容与对齐不变；
- toast「表格缩放为 R×C（Ctrl+Z 可撤销）」；一次 undo 还原缩放前结构（含对齐/列宽）；
- 网格单元格与弹层表面可辨（UI-ELEM-02），边缘翻转 + 限高滚动保证可达（AC-RULE-10）。

### 3.12 键盘通道兜底（Q8）

- 删除行/列、对齐三键、⊞ 缩放、删表**不补专用快捷键**（键位表维持冻结 5 组）；
- 键盘通道 = Shift+F10 / 菜单键唤出 ⋮=右键同源菜单 → 方向键遍历 → Enter 执行；禁用态同步灰显不可达；
- 前置能力：ctxMenu 键盘遍历（现状已具备，见 §4 核对）；触点为表格单元格激活态下唤出 table-cell 菜单面。

---

## 4. 与现有实现差异（现状 → 目标）

| # | 现状 | 目标 | 涉及文件 |
|---|---|---|---|
| 1 | 常驻 +/− 增删把手 + `data-table-handle` 4 契约存在（row-insert/row-delete/col-insert-left/col-delete），带 28px 左侧把手带 | 把手 UI 删除、契约删 4 留 1（仅留 col-grip）；行列增删仅工具栏/⋮/右键/快捷键四处（AC-FN-02） | `src/renderer/src/editor/table/widget.ts`（addRowHandles/addColHandles）、`src/renderer/src/styles/markdown.css`（28px 把手带/左侧留白） |
| 2 | `STRUCT_KEYS` 仅 5 键（Ctrl+Enter + Alt 四向）；无 Ctrl+Shift+Enter / Ctrl+Shift+← / Ctrl+Shift+→ | 冻结 5 组键位全量入库（Shift 升档 3 键新增），回显由 STRUCT_KEYS 单源派生 | `src/renderer/src/editor/table/keymap.ts`、`editor/contextMenu/opsTable.ts`（structShortcut）、`editor/table/commands.ts` |
| 3 | Ctrl+Shift+←/→ 无绑定；单元格词选扩展由 CM6 默认处理 | Q4 上下文分流：keydown 判 `selection.empty`，无选区插列、有选区词选扩展 | `src/renderer/src/editor/table/keymap.ts`、`editor/table/nestedSession.ts` |
| 4 | `insertRowOp` 对 `at===0` 强制落 index 1（表头下插 body 行），无表头身份迁移 | Q5：首行上插空行升表头、原表头降 body 首行、冒号行仍第 2 行 | `src/renderer/src/editor/table/ops.ts` `insertRowOp` |
| 5 | 删首行无身份下移逻辑；表头为末行时 deleteRow 仍可执行（仅行数>1 判断） | PEND-12：删首行 body 首行升表头；表头为末行禁用「删除行」 | `src/renderer/src/editor/table/ops.ts` `deleteRowOp`、`editor/contextMenu/opsTable.ts`（disabled 规则） |
| 6 | 参差表补齐依赖 `modelToGrid` 逐 op 隐式补齐，无「单事务全表补齐 + 冒号行同步」契约声明，AC 判据悬空 | PEND-07 契约化：单事务全表补齐矩形 + undo 还原参差态 + 独立 AC-ERR 条目 | `src/renderer/src/editor/table/ops.ts`（modelToGrid/opFrom）、`parse.ts` |
| 7 | col-grip 拖拽仅 `next[col] = w` 单列赋值，无右邻列吸收、无总宽不变约束 | PEND-10：总宽不变右邻列吸收；仅最右列边界可增减总宽（钳制正文列内） | `src/renderer/src/editor/table/widget.ts`（col-grip onUp）、`preferences/store.ts`（normalizeColWidths 消费侧） |
| 8 | 删除行/列直接执行 + toast 短文案「行已删除」/「列已删除」（无确认——与 Q3 目标一致），toast 无「（Ctrl+Z 可撤销）」后缀 | Q3 口径固化 + 回执文案改 AC 冻结全文「已删除第 i 行（Ctrl+Z 可撤销）」/「已删除第 j 列（Ctrl+Z 可撤销）」 | `src/renderer/src/editor/contextMenu/opsTable.ts`、`i18n/zh.ts`/`en.ts`（toast.rowDeleted/colDeleted 改写） |
| 9 | 插行/插列/移行列/对齐/缩放**无 toast 回执**（wave③ 口径「插入/对齐保持安静」） | 全部结构操作回执 toast（AC-OP-01~08 冻结文案 + undo 后缀） | `editor/contextMenu/opsTable.ts`、`editor/table/toolbar.ts`、`editor/table/commands.ts`、i18n 双字典新增回执键 |
| 10 | 删表确认文案「确定删除该表格？此操作无法撤销。」（`ctx.deleteTableConfirm`） | 冻结文案「删除后可用一步撤销还原，确认删除该表格」 | `i18n/zh.ts`、`i18n/en.ts`、menu-tree §8-3 联动 |
| 11 | 删表 toast「表格已删除」 | AC-OP-09 冻结「已删除表格（Ctrl+Z 可撤销）」 | i18n 双字典 |
| 12 | `gridPicker.ts` `GRID_MAX_ROW=20`/`GRID_MAX_COL=12` 固定上限 | AC-RULE-12：逐维 max(20,R0)×max(12,C0)，超限维度扩至现有值 | `src/renderer/src/editor/table/gridPicker.ts` |
| 13 | menu-tree §4 描述的 toast 短文案（「行已删除」/「列已删除」/「表格已删除」）与 ac.md 冻结长文案并存 | 以 ac.md 为准（AC-FN-06：文案以对应 AC-OP 条目为准）；menu-tree 联动修订文案列 | `docs/requirements/ui-ux-redesign/prd/menu-tree.md` §4（文档侧）、i18n |
| 14 | AC-RULE-15 / AC-OP-10 仍载「删行/删列确认框」流程 | 按 Q3 修订 ac.md 两处（删行/列确认流移除）；本域差异登记不改裁决 | `docs/requirements/ui-ux-redesign/ac.md`（修订登记） |
| 15 | ctxMenu 键盘遍历（方向键/Enter/Esc）**已存在** | Q8 前置条件已满足：复用现状，仅补 Shift+F10/Menu 键唤出 table-cell 菜单的接线（若未挂） | `src/renderer/src/components/EditorContextMenu.tsx`（现状 ~L176-220 已有 onKeyDown） |
| 16 | `STRUCT_KEYS` 注释仅覆盖「Ctrl+Enter / Alt+arrows」5 键 | 注释与快捷键总表同步 5 组冻结键口径；`shortcutSync`/keymap 单测同步新增 3 键断言 | `editor/table/keymap.ts`、`editor/table/keymap.test.ts` |
| 17 | 分组口径分歧：AC-FN-05/PRD 6.1 点名四组（行操作/列操作/对齐/结构删除），menu-tree §4 冻结五组（+「单元格」组承载剪贴板三项），现状 opsTable.ts 为平铺+分隔线 | **已裁决：menu-tree §4 五组为目标**（沿用既定「原型/菜单树为 UI 真值」裁决派生，登记于 grill-rulings.md 生成期差异 §17）；ac.md 修订时把 AC-FN-05 的「四组」措辞对齐五组口径；id 不变，AC-FN-09 不受影响 | `src/renderer/src/editor/contextMenu/opsTable.ts`（分组呈现层）、`docs/requirements/ui-ux-redesign/ac.md`（口径修订登记） |

---

## 5. 验收映射（AC 条目 → 本域判据）

| AC 条目 | 本域判据 |
|---|---|
| AC-RULE-06 | §3.2 冻结 5 组键位表逐键核对；锚定激活单元格相邻位；Q4 分流前置收口 |
| AC-RULE-07 | 表头保护禁用集仅「首行上移/首列左移」两项；上插/左插任意单元格可用；Q5 表头迁移后 i=1 上插仍可用 |
| AC-RULE-08 | §3.1 每 op 单事务一次完成；一次 Ctrl+Z 还原行列结构+对齐+列宽 |
| AC-RULE-09 | 四面同源（同 op id、同 toast、同禁用）；无键项键盘通道走 Q8 菜单兜底 |
| AC-RULE-11 | 回显由 STRUCT_KEYS 单源派生，无手工双源 |
| AC-RULE-12 | §3.11 ⊞ 可选范围 max(20,R0)×max(12,C0) |
| AC-RULE-15 | §3.9 仅删表确认（Q3 修订后口径） |
| AC-RULE-17 | §3.10 删4留1 后契约集与登记一致，此后演进须登记 |
| AC-FN-01 | 把手带/左侧留白删除后表格左缘偏移 0px（随把手 delta 一并验收） |
| AC-FN-02 | 无 +/− 把手；增删入口仅四处 |
| AC-FN-04 | ⊞ 网格拖选「R×C」回显、未松开不变结构 |
| AC-FN-05 | ⋮ 菜单 19 项限高滚动+边缘翻转全项可达、按 5 组分组 |
| AC-FN-06 | toast 回执含 undo 后缀、同 op 四面文案一致、菜单回显一致、右键=⋮ 镜像 |
| AC-FN-24 | 首行时「上移该行」灰显禁用；「上插行」「左插列」可点 |
| AC-FN-33 | hover 态无工具栏/把手，可安全选中复制 |
| AC-OP-01 | §3.1 #2：Ctrl+Enter 下插 +「已在下方插入行（Ctrl+Z 可撤销）」+ 单事务 undo |
| AC-OP-02 | §3.1 #1 + §3.4：上插 + i=1 表头身份迁移 +「已在上方插入行（Ctrl+Z 可撤销）」 |
| AC-OP-03 | §3.1 #5 + §3.3：右插列 + 冒号行左对齐项 + Q4 无选区前置 |
| AC-OP-04 | §3.1 #4 + §3.3：左插列，同上 |
| AC-OP-05 | §3.1 #7/#8：移行 + 列对齐不变 +「已上移/已下移该行（Ctrl+Z 可撤销）」 |
| AC-OP-06 | §3.1 #9/#10：移列 + 冒号行随列交换 +「已左移/已右移该列（Ctrl+Z 可撤销）」 |
| AC-OP-07 | §3.11：缩放 +「表格缩放为 R×C（Ctrl+Z 可撤销）」 |
| AC-OP-08 | §3.1 #11~13：对齐三键 +「第 j 列对齐：…（Ctrl+Z 可撤销）」 |
| AC-OP-09 | §3.9：删表确认两分支 +「已删除表格（Ctrl+Z 可撤销）」 |
| AC-OP-10 | §3.1 #3/#6 + §3.5：删行/删列无确认 + 冻结 toast + 表头下移/末行禁删（Q3/PEND-12 修订后） |
| AC-OP-11 | §3.7：列宽拖拽指示线 + 右邻列吸收 + 存储 + undo |
| AC-OP-12 | 单事务一步 undo（三入口等效语义详见 GLB 域）；光标落回锚定单元格 |
| AC-ERR-01 | §3.6：不崩溃 + 锚定语义 + 矩形补齐（PEND-07 转正后为判据） |
| AC-ERR-02 | §3.1 禁用规则列：行数=1/列数=1 灰显，不产生空表 |
| AC-ERR-03 | §3.7 结构变化列宽钳制/重置 |
| AC-ERR-04 | 误触结构操作一步 undo，toast「已撤销」 |
| AC-ERR-05/06 | §3.1 #7/#9 首行上移/首列左移禁用，无 toast 报错 |
| AC-ERR-07 | §3.9 删表确认框两分支 + 固定文案 |
| AC-ERR-08 | 只读拦截（全局规则，本域入口同禁；文案见 GLB 域冻结文案表） |
| AC-ERR-12 | 表格键族仅单元格激活态生效，正文段落不劫持 |
| AC-ERR-13 | §3.11 超限表可选范围与缩放不裁切 |
| UI-IXD-01~05、UI-IXD-16 | 工具栏/⊞/⋮/对齐三键/🗑/列边界拖拽区交互规格随 §3.1/§3.7/§3.11 验收 |
| UI-ELEM-02/04 | 网格可辨、禁用灰显 |
