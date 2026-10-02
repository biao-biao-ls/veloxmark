# 业务流评审汇总（Step 4 右轨）

> 协议：business-review 只读核验业务语义（与复刻评审的实现 vs 设计稿对比不重叠），不打分、无 PASS/FAIL。软门禁：未对齐点（首次）→ 自动派修 → 重审受影响路径；重审仍偏离 → 人工卡口。存在未对齐点时维护本文件；全部通过的路径不列。

## IT-01/PATH-01 表格评审改稿主链路（插/移行列与对齐 + toast 撤销）（happy）

**状态：2 未对齐点（P1×1 / P2×1）→ fix 完成（fix-biz-PATH01-undo-align，2026-10-02）→ 定向重审✅ 无未对齐点 → business-history verdict=fixed 已写**

- **P1｜undo 后活动格不回锚定单元格**（FE-07 主责，连带 FE-01 `setAlignOp` 的 nextActive 取值）
  - 期望：ac.md#AC-OP-12 判据 3「文档与操作前逐字节一致，**光标落回操作前状态所在的锚定单元格**，autosave 落盘还原后内容，随后的键盘输入可直接进入正文编辑」；tech-design.md#4「三入口等效一步还原」终态含选区/锚定格回位。
  - 实际：toast 撤销（ToastHost → runToastAction → store.runAction → undoAction.run）只做 `undo(view)` + `refocusAfterUndo`（useToast.ts:164-172），仅反转 doc 变更与 DOM 焦点；`tableEditField` 的 `setActiveCell`/`enterEditMode` **未注册 invertedEffects**（state.ts:97-111 仅反转 `setColWidth`），undo 后活动格保持 op 后的 `nextActive` 不回锚。且 `setAlignOp` 把 nextActive 定为 `{row: 0, col}`（ops.ts:254）——正文格（i,j）点「居中对齐」后活动格跳表头行，撤销后嵌套编辑器仍挂表头格而非 (i,j)。插行/移行 undo 同理。AC-ERR-04 判据 1（引用 AC-OP-12 三段断言）同样不满足。FE-07 frontmatter 标 AC-OP-12「已验证」、doc-drift 为空，change-log 无对应登记。
  - 建议：为 setActiveCell/enterEditMode 补 invertedEffects（undo 回放事务前 active/editFrom 快照），或在 undoWithAck/runAction 撤销路径按事务前锚点重设 setActiveCell。

- **P2｜插列写回 `---` 不在对齐标记词表**（FE-02 主责，连带 FE-01 `insertColOp`/`parse.formatTable` 写回形态）
  - 期望：ac.md#AC-OP-03 判据 2「冒号行对应位置新增一项为**左对齐标记**」；ac.md#AC-OP-08 判据 2 词表「`:---` / `:---:` / `---:` 三者之一」（左对齐 = `:---`）。
  - 实际：Ctrl+Shift+→ 走 `insertColRightOp → insertColOp` 对新列 `aligns.splice(idx, 0, '')`（ops.ts:107-108），`formatTable.delimiterText('')` 写出 **`---`**（parse.ts:214）而非词表内 `:---`。渲染经 CHANGE-14 `effectiveAlign('')→'left'` 语义达成，但字面量不在词表内，且与菜单「左对齐」`setAlignOp(…,'left')` 写回的 `:---` 形成同语义双字面形态；change-log 仅登记显示层归一（CHANGE-14），未登记插列写回取舍。
  - 主 agent 裁定（2026-10-02）：**新列写回口径 = 显式 `:---`（splice 'left'）**——AC-OP-08 词表 + 与菜单写回同形态。**红线：`formatTable` 对 `''`→`---` 的写回不得改动**（用户既有源零往返失真）；仅动插列新列路径。
  - 建议：insertColOp 向 aligns 插入 `'left'`；同步 op 单测期望。

**其余步骤语义核验通过**：Ctrl+Enter→insertRowBelow 锚定 i 行下一行 + toast「已在下方插入行（Ctrl+Z 可撤销）」四面同 key；Ctrl+Shift+→ 按 selection.empty 分流且冒号行列数同步；Alt+↓ `moveRowOp` 仅换行不动 aligns（列对齐不变）；⋮「居中对齐」→`setAlignOp(m,col,'center')` 冒号行写 `:---:` + toast「第 {j} 列对齐：居中（Ctrl+Z 可撤销）」j=col+1 与菜单/工具栏同源；撤销按钮一步还原对齐事务 + 回执「已撤销」文案与冻结面逐字一致。

## IT-01/PATH-02 删表确认与一步还原（happy）

**状态：2 未对齐点（P1×1 / P2×1）→ fix 完成（fix-biz-PATH01-undo-align，2026-10-02，同 undo 可逆性机制族）→ 定向重审✅ 无未对齐点 → business-history verdict=fixed 已写**

- **P1｜删表→undo 列宽丢失**（FE-08 主责，连带 FE-06 `colWidthRemapEffect` 只覆盖列结构 op）
  - 期望：ac.md#AC-OP-09「.md 源码无该表、autosave 落盘、字数统计同步，一次 Ctrl+Z 还原整表（**含对齐与列宽**）」；#AC-OP-12「表格行列结构、对齐冒号行、**列宽**全部还原至操作前状态」。
  - 实际：列宽显示态存 `tableEditField.colWidths`（Map 键=tableFrom，`editor/table/state.ts`），`deleteTableRange`（`editor/table/source.ts`）单事务只发 `changes + setActiveCell.of(null)`，不发 `setColWidth`；state.ts docChanged 分支一律 `tr.changes.mapPos(from, 1)` 重映射键位。CM6 语义下删除折叠键位（5→4），undo 回插时 assoc=1 把键推到回插段末尾（4→39），还原后表格 `tableFrom` 仍是 5，`colWidths.get(5)` 落空 → 还原表按默认列宽渲染，操作前列宽丢失（合成实验实测：键 [5]→[4]→[39]，`get(5)===undefined`；源码逐字节还原成功）。对齐冒号行随源码 undo 正常还原，唯列宽缺口。change-log 无登记。
  - 建议：删表事务内对 colWidths 做可逆处理（undo 后键位落回新表 tableFrom，或经 invertedEffects/显式快照在一步还原时重键位），补「删表→undo 列宽还原」单测。

- **P2｜undo 后编辑态会话不还原（与 PATH-01 P1 同根）**（FE-07 主责）
  - 期望：ac.md#AC-OP-12「光标落回操作前状态所在的锚定单元格…随后的键盘输入可直接进入正文编辑」；tech-design.md#4.1「三入口等效 → 一步还原」。
  - 实际：源码逐字节还原成立（`deleteTableRange` 单事务，undo 一步回插实测一致），但编辑态会话不还原：`setActiveCell.of(null)`（full-exit）无 history 逆效应——`invertColWidths` 只反演 `setColWidth`，`setActiveCell` 不在 invertedEffects 注册面内；`undoAction.run` 仅 `undo(view)`+`refocusAfterUndo(view)`（DOM 聚焦），不重建操作前 active cell。结果：还原表退出编辑态（active/editFrom 均 null），光标只回历史选区而非锚定单元格；若操作前主视图选区落在表内，还命中 `handlers-code.ts` enterTable 的 `!isEditing && blockTouched` 兜底转源码态。随后键盘输入不落回锚定格、不直接进该格编辑。
  - 建议：一步还原时按操作前锚定单元格重建 `setActiveCell`（快照挂 undoAction 或 invertedEffects 反演 setActiveCell），使三入口 undo 后回锚定格编辑态——与 PATH-01 P1 同一修复设计一并覆盖（含 `deleteTableRange` 的 full-exit 逆效应）。

（步骤①确认框文案/按钮 key、data-op deleteTable 接线，步骤②单事务删表 + toast「已删除表格（Ctrl+Z 可撤销）」+「撤销」按钮，步骤③源码逐字节一步还原与「已撤销」回执，均与基线一致；CHANGE-11 按钮次序偏离已登记 change-log，不计未对齐点。）

## IT-01/PATH-04 参差表与表头迁移边界链路（edge）

**状态：P0 未对齐点 ×1 → fix-biz-PATH04-05 修复完成 → r2 定向重审（2026-10-02）：注册 P0 面（首行上插/删行/对齐三族）闭合、**两处改钉裁定正当非掩盖**（commands.test 负对照=测试预期随缺陷向量真实形态校正：trimmedCell 全空白倒置区间→RangeError 被吞→文档级写回不可达，stash 向量真实可达且被钉；deleteRowOp 族文档级双历史向量另被钉；confirmDeleteTable.test=CHANGE-22 修正面正当改钉）、抑制窗时序假设成立（widget destroy 同步在 dispatch 栈内）、ops.ts nextActive 红线未动、步骤 2/3/4 无未对齐、CHANGE-20 与实现一致。**r2 发现同机制残余 1×P1**：handleTsvPaste（commands.ts:625-642）整表结构替换 dispatch 未裹 withHandoffSuppressed——1×1 TSV 任意格坐标碰撞（pasteTsvOp nextActive 恒等于激活格）→ pendingHandoff 微任务二次写回覆盖粘贴值 + 双历史；非注册覆盖面、非路径步骤面、非修复回归 → 按首触残余自动派 **fix-biz-IT01PATH04-tsvpaste**（2026-10-02）→ **修复已落地（handleTsvPaste 整表 rewrite dispatch 裹入 withHandoffSuppressed，commands.test 新增 5 用例含红绿负对照，15/15 定向 + 1051/1051 全量，CHANGE-25 登记）→ r3 定向重审 ✅ 无未对齐点（修复面逐条实证：向量任意格坐标无关堵住、opsTable/ops/widget/nestedSession 红线未动、viewWithDestroyOnPaste 对齐生产时序、15/15+typecheck 0 抽验属实、CHANGE-25 体例一致）→ ✅ closed（2026-10-02）；business-history verdict=fixed 已写 IT-01/FE-01.md、IT-01/FE-02.md**

- **P0｜激活格在第 0 列时结构 op 触发 handoff 误判：新表头文本污染 + undo 双历史**（FE-01/FE-02，根因 `nestedSession.ts` UX-P28 handoff 协议）
  - 期望：ac.md#AC-PEND-11「新插入**空行**升为表头行（表头身份迁移到新行）……一次 Ctrl+Z 还原结构与表头身份」；#AC-OP-02 判据 2「**新空行**插入到第 i 行位置……各列内容不变」；#AC-ERR-01 判据 3/4「既有内容不丢失、不错位……一次 Ctrl+Z 可还原至操作前逐字节一致（含参差形态）」；#AC-RULE-08「一次 Ctrl+Z 还原该操作引起的全部变化（含行列结构、对齐、列宽）」。
  - 实际：步骤 1 点击的首行单元格为**第 1 列**（row=0, col=0，含参差补空哨兵位）时，`insertRowAboveOp(m,0)` 纯 op 层正确、`runTableOp` 单事务正确，但 widget 重建时 `nestedSession.ts` `destroyHandoff` 坐标守卫失效：`isRetarget` 仅比对 `getTableEdit(view.state).active`（=nextActive）与旧 widget `spec.active` 的 row/col，而 `ops.ts` 的 `insertRowOp`/`deleteRowOp` 的 nextActive **恒 `{row: idx, col: 0}`**——旧激活格 (0,0) 与 nextActive (0,0) 同坐标 → `isRetarget=false` → 走「同格 pending 文本保全」分支：`pendingText`（旧表头首格文本如 `Name`）≠ 重解析新表头空格 `text:''` → `pendingHandoff` + `commitHandoff` 微任务用**独立事务**（`userEvent: 'input.table.cell'`）把 `Name` 写进新表头首格。终态双重破坏：① 新升表头**非空**且与已降级 body 首行重复（AC-PEND-11/AC-OP-02「新空行」失守、AC-ERR-01 判据 3 失守）；② undo 栈落两条历史，一次 Ctrl+Z 只撤微任务写回，表头迁移与参差还原需第二次（AC-RULE-08/AC-ERR-01 判据 4/AC-PEND-11 判据 3 失守）。`col≠0` 时 isRetarget=true 正常——触发面=激活格在第 0 列的结构 op（含 `deleteRowOp` nextActive col 恒 0、`setAlignOp` nextActive 恒 `{row:0,col}`），步骤 3「任一结构操作后内容不错位」一并波及。另：微任务第二条历史使 ops.test.ts 纯函数「one replace 逆操作逐字节还原」在真实 undo 链上不成立（单测不含 handoff 层，无覆盖）。
  - 建议：结构 op 路径显式抑制同坐标误判——`runTableOp` 事务 effects 携带 handoff-suppress 标记、`destroyHandoff` 见标记跳过保全/微任务；或将 retarget 判定改「`isRetarget` 或本次事务 userEvent 为 `input.table.*` 结构操作」；结构 op 后 pending 文本只经 `modelWithPendingText` 折叠进该单事务，不再产生第二条历史。**主 agent 裁定：guard 层修，不动 ops.ts nextActive**（与 fix-biz-PATH01 ops.ts 面隔离；nextActive 锚定不一致另记 FE-01 遗留）。

（其余三步核验对齐：步骤 1 点击进入编辑不提前改写参差源码（`activateCellAt` 无 pending 时 `changes: undefined`）；步骤 3 纯 op 层 `modelToGrid`/`formatTable` 按 colCount=max 补矩形、超宽行不截断；步骤 2 冒号行恒第 2 行由 formatTable 输出序结构性保证。注：本路径评审认为禁用面含「末行/列」移动，与 PATH-05 P2 对 AC-RULE-07 的解读相左——已按 mock 核验分叉裁定。）

## IT-01/PATH-05 禁用态与键族不劫持异常链路（error）

**状态：2 未对齐点（P1×1 / P2×1）→ fix-biz-PATH04-05 修复完成（2026-10-02）→ r2 定向重审✅ 全闭合（P1 四面写点收口/恰一条 err.readonly/Untitled 同步放行/copyCell 不设闸/fail-open 裁定合理；P2 Branch B 回退仅两项，ui_03 mock :933-943 佐证；两处改钉裁定正当——opsTable.test 灰显断言=方向性钉死 Branch B 非放松，confirmDeleteTable.test 旧断言锁死 stale-span 缺陷契约、CHANGE-22 有意变更）→ ✅ closed；business-history verdict=fixed 已写 FE-02.md（P1）/FE-04.md（P2）（2026-10-02）**

- **P1｜表格结构操作三入口全未接只读闸门**（缺陷面 FE-01/FE-02/FE-04 分发层；闸门本体 IT-03/FE-04 `readOnlyGuard.assertWritable`）
  - 期望：tech-design.md#10-异常处理「只读文件尝试修改/结构操作 | 拒绝执行 + toast |『文件为只读，无法修改，可另存后编辑』」；ac.md#AC-ERR-08 / AC-RULE-16「操作被拦截，不执行任何写入 / 文档内容逐字节不变，不产生半提交状态 / 显示提示『文件为只读，无法修改，可另存后编辑』」。
  - 实际：快捷键 `tryStructCmd`→`runTableOp`（editor/table/commands.ts）、⋮/右键 `opsTable.ts` 的 `runOp`/`confirmDeleteTable`/`formatTableSourceRange`/cutCell、工具栏 `toolbar.ts`→`runTableOp`，写前均无 `assertWritable()` 调用（全仓仅 imageEdit/linkEdit/listDrag/widgets-extended 4 处接线，CHANGE-8 登记范围「图片写回 + FE-05/FE-06」不含表格结构操作，亦无补登记）。只读文件上触发结构操作：内存文档照常改写并置 dirty、回执 toast 反显成功文案+撤销按钮（如「已在下方插入行（Ctrl+Z 可撤销）」）；冻结文案 `err.readonly`（zh.ts 与冻结面逐字一致）零触发；其后 autosave 失败另弹「自动保存失败（{reason}）」。PATH-05 第 4 步整步偏离（含 AC-ERR-08「不产生半提交」与假成功回执）。
  - 建议：在结构操作写前 dispatch 收口（`runTableOp` / opsTable `runOp` / `confirmDeleteTable` / `formatTableSourceRange`）统一接 `assertWritable()`，只读时拒绝 dispatch 并回冻结 toast（或补 change-log 登记豁免面）。

- **P2｜禁用集超出 AC-RULE-07「仅限两项」**（FE-04）
  - 期望：ac.md#AC-RULE-07「表头保护…禁用范围**仅限**『首行上移』与『首列左移』两项（快捷键与菜单路径同禁）」+ #AC-FN-24「『上插行』『左插列』等非禁用项为可点击态」；tech-design.md#5-领域模型「禁用规则仅两项：首行上移、首列左移（…末行禁删为唯一例外禁用，PEND-12）」；FE-04 交互#3 前置条件清单（首行/首列/行数=1/列数=1/表头为末行）不含末行下移/末列右移。
  - 实际：`opsTable.ts` `isTableOpDisabled` 在基线禁用集外，额外灰显末行「下移该行」（row≥rows-1）与末列「右移该列」（col≥cols-1），`opsTable.test.ts` 已钉住为契约；change-log CHANGE-1~16 无登记。后果：菜单可点性口径超出 AC-RULE-07「仅限两项」（点击 no-op 与灰显对 AC-OP-05 结果等价）。
  - 主 agent 裁定分叉（2026-10-02）：**先核 ui_03 mock 的末行/末列边界项渲染态**——mock 灰显 → 走 change-log 登记为 AC-RULE-07 禁用清单扩项（像素口径优先，AC 文档归 doc-reconcile 对齐）；mock 可点击 → 回退灰显（保留 op 边界 no-op，键盘路径不动），测试同步。

（步骤 1/2 禁用态与步骤 3 键族不劫持（AC-ERR-12 tryStructCmd fall-through、lifecycle 选区出表即清 active、工具栏随编辑态收拢）语义层未见偏离。材料勘误：ac.md 实际路径为 `process-docs/ui-ux-redesign/requirement/ac.md`（design/ac.md 缺失），后续派遣 prompt 已修正。）

## IT-01/PATH-06 删表取消与模态叠加异常链路（error）

**状态：3 未对齐点（P1×1 / P2×2）→ fix-biz-PATH06 修复 → PATH-06 定向重审 r1/r2 → ✅ closed（2026-10-02）**：行为面三线（代码/契约测试/浏览器证据）闭合；r2 残余 2 P2 均为登记口径（CHANGE-17 双菜单顺序+叠加态构造性取舍、CHANGE-18 漏列 GLB-global-patterns.md#3.3）——主 agent 已校正 CHANGE-17/18（process-docs 登记面），GLB/menu-tree 基线文本合并随 doc-reconcile。business-history verdict=fixed 已写 tasks/IT-01/FE-08.md（×1）与 FE-09.md（×2）。

- **P1｜双区编辑（math/code）面板/chip 未注册 hush 层，Esc 一次收拢遗漏**（FE-09）
  - 期望：ac.md#AC-FN-21「无模态确认框分支：全部浮层与编辑态在该一次操作内收拢（非逐个关闭）…界面回到零 chrome 静息态」，Given 明列「菜单、popover、表格工具栏、**双区编辑面板、chip** 中至少两种同时可见」；GLB-global-patterns.md §3.4 同口径；FE-09 任务分层表 chrome 层亦含「表格工具栏/双区编辑/chip」。
  - 实际：`hooks/useHushLayer.ts` 分层栈仅注册 dialog-modal / ctx-menu / grid-picker / menubar-menu / table-toolbar 五层 + hoverDiscipline/chromeState 外部 chrome；math/code 双区编辑态（mathEdit.ts `mathEditExitBindings` Escape keymap + edit-chip）未注册、未挂 collapseChrome。焦点不在编辑器时（如 MenuBar 下拉开着、选区仍落公式/代码块内，双区面板仍渲染）一次 Esc 只收已注册层并 focusBody，双区面板/chip 残留——「一次收拢全部」与 AC-RULE-05 无悬空态对该组合不成立。
  - 建议：双区编辑/chip 以 chrome 层注册（close=exitMathEdit/对应 code 退出），或并入 useHushLayer collapseChrome 统一收口；保持焦点在编辑器内时 Esc 先退编辑态的既有语义不变。

- **P2a｜grid-picker z-index 2400 压过确认框 2000**（FE-09）
  - 期望：GLB `glb-modal:stacking`「确认框开启时处于最上层」，分层表 ⋮/右键/⊞ 网格一律在确认框之下；GLB §3.3 并引「z-index 对齐 menu-tree §0.1 D 区=200」。
  - 实际：确认框对 ⋮ 最上（`.dialog-overlay` 2000 > `.editor-context-menu` 1000）成立；但 `.table-grid-picker` z-index 2400（overlays.css:283）高于 2000，⊞+确认框叠加时网格压在确认框上。另基线字面锚点自相矛盾：menu-tree §0.1 T 区 z=999 > D 区 200，照字面落实反被菜单压住；实现取 2000 系未登记 change-log 的取舍。
  - 建议：统一浮层 z 分层表（确认框恒最大，grid-picker 移其下），z 值取舍登记 change-log / 修订 GLB「D 区=200」措辞。

- **P2b｜删表确认+⋮ 叠加态用户手势不可构造**（FE-08 连带 FE-09）
  - 期望：路径步骤 2「再次弹确认框**并打开 ⋮ 菜单叠加**，核对确认框恒为最上层」；FE-09 交互 2 触发示例「确认框与菜单/popover 同开（如删表确认弹出时 ⋮ 仍开）」。
  - 实际：叠加态不可经手势构造——`EditorContextMenu.runItem` 先 `closeContextMenu()` 再执行 deleteTable（菜单路径确认框弹出时 ⋮ 已关）；工具栏 🗑 保持的是工具栏非 ⋮；确认框全屏遮罩接管后再点 ⋮/Shift+F10 落遮罩=关框。叠加语义本身（modal tier 最优先、z 2000>1000、MenuBar/⋮/gridPicker outside-close 遇 `isDialogOverlayTarget` 让位）在程序化构造或「确认框+工具栏」可及态下均正确；步骤 2 按原文手测无法复现。
  - 建议：登记「菜单项执行先关面板」取舍 + 验证口径改「确认框+工具栏」/程序化构造；或补程序化 e2e 缝。**主 agent 裁定**：z 分层不变量改契约式源扫描测试钉住（dialog z > grid-picker z > ctx-menu z，项目 contract.test 同法）；change-log 登记条目由修复批起草、主 agent 统一落（避免与 PATH-04-05 批撞 change-log）。

（步骤 1/3/4 本链路核验一致：Esc 仅关框不删除（Dialog 自消费+stopPropagation）；遮罩空白取消零副作用；无确认框时 Esc 一次收拢菜单/popover/表格工具栏+hover/chrome（useHushLayer.test 有钉）；toast 不入收拢面；冻结文案双字典一致，「取消左+确认右」CHANGE-11 已登记。）

**r2 定向重审（2026-10-02，业务面三线闭合）**：P1 闭合——blockEdit 探针（HushDeps.blockEdit?() + currentBlockEdit 单例，mathEdit/codeEdit 同构）+ 3 单测 + 浏览器证据 p1-before/after-esc（mathSrc 3→0）；P2a 行为面闭合——overlays.css z 1500/2000/1000 + overlayZOrder.test.ts 契约 + p2a-stacking.png hit-test topIsOverlay true；步骤 1/3/4 全闭（Dialog cancel→settle(false)+stopPropagation、opsTable confirmDeleteTable 仅 ok===true 删除）。验证口径=程序式构造/确认框+⊞ 工具栏（⋮+确认框同开手势不可构造——EditorContextMenu close-first + 遮罩拦截，构造性取舍已登记 CHANGE-17）。r2 残余 2 P2 登记口径主 agent 已校正：CHANGE-17 分菜单（MenuBar action-first / EditorContextMenu close-first）+ 叠加态取舍登记；CHANGE-18 涉及基线补 GLB-global-patterns.md#3.3（「D 区=200」→ 以 overlayZOrder 契约分层为准）。**裁定**：残余项属主 agent process-docs 登记面补完，不计修复轮（行为面已实证闭合、无新增语义级偏离）；GLB:84/menu-tree §0.1 文本合并归 doc-reconcile 基线合并卡口。


## IT-01/PATH-07 列宽吸收与去把手静息链路（happy）

**状态：1 未对齐点（P2）→ fix-biz-IT01PATH07-infra 补档（2026-10-02）→ r2 定向重审实质闭合（附录 A 对照表逐条复跑相符；残余 1×P2 形式登记口径——主 agent 已校正 INFRA-01.md :74/:83/:110 措辞与 grep 断言并登记 doc-drift，不计修复轮）→ ✅ closed；business-history verdict=fixed ×2 已写 INFRA-01.md**

- **P2｜INFRA-01 交付物登记缺口：探针断言迁移对照表与契约登记未落盘**（INFRA-01）
  - 期望：INFRA-01.md#交互操作3——「src/renderer/src/e2e/ seams 契约清单与 handles.d.ts 同步删4留1；探针断言变更清单落文档（含旧断言→新断言迁移对照表，design/adr/e2e-contract-delta.md 附录口径）；npm run test:smoke 验证」。
  - 实际：迁移对照表与 seams/handles 契约登记均未能实证落盘——e2e-contract-delta.md 仅 28 行决策记录（后果节一句「探针需同步下线 4 个把手断言」无对照表）；handles.d.ts 仅 window.__velox* JS handle 类型无 DOM 契约登记；reports/ 无 IT-01-INFRA-01 目录。DOM 契约语义本身已实证对齐（见下）。
  - 建议（已随派修）：ADR 附录补「旧 4 把手断言下线→新 data-op 断言上线」对照表；声明契约单源=editor/table/contract.ts（handles.d.ts 不承载 DOM 属性面）；reports/IT-01-INFRA-01/ 落迁移报告，test:smoke 不可复验限制（已登记）以 IT-04-FE-02 终态扫描为替代证据。

（四步语义层已对齐摘要：① 去把手+左缘 0px——widget.ts:205-215,389-397 仅 addColGrip、contract.test.ts:53-61 钉 4 字面量零残留、markdown.css:893-900 margin 0/--editor-gutter、FE-03 自测 deletedBtns=0；② 中列右邻吸收对和不变——colWidth.ts:63-86 + colWidth.test.ts:45-84 + 自测 110/91→140/61 总宽 330 不变 + undo 一次还原（state.ts:104-118）；③ 末列总宽增减钳制正文列——colWidth.ts:55-61 末列例外 + colWidth.test.ts:86-116 + 自测 +40 钳到 130；④ data-table-handle={col-grip}+data-op 19 项——contract.ts:14,18-38 单源、contract.test.ts:64-74 逐项、EditorContextMenu.tsx:81/toolbar.ts:62 挂载、IT-04-FE-02 终态扫描存证（菜单 19+工具栏 6）。工具栏 6≠19 差集（resizeTable/TBL-MOR-OPN）=CHANGE-3 已登记演进+AC-RULE-17 修订文本，非偏离。在途批 fix-biz-PATH04-05 触面无中间态断裂，其已知红不入本路径判据。）


## IT-01/PATH-08 toast 驻留/防抖/i18n 全局链路（edge）

**状态：2 未对齐点（P2×2：i18n 切换确认框/key 面 + toast 驻留期语言）→ fix-biz-IT01PATH08-i18n 修复已落地（confirmDeleteTable/Dialog 确认框改 key-based live-relabel + CHANGE-24 A/B 登记取舍，CDP 21/21 双语冒烟落 reports/IT-01-PATH-08/，31/31 定向 + 1051/1051 全量）→ r2 定向重审 ✅ 无未对齐点（key 四件套字典双语逐字、zh→en→zh 打开中即时换字链真实、预烘焙调用点零回归（label string 优先未翻转）、CHANGE-24A/B 与实现逐字段一致、CDP 21/21 证据真伪抽查相符、17/17+typecheck 0 抽验）→ ✅ closed（2026-10-02）；business-history verdict=fixed 已写 IT-01/FE-11.md、FE-08.md、FE-07.md**

- **P2｜步骤 5 中英切换渲染冒烟证据缺档**（FE-11 主责，FE-07/08 联调面）
  - 期望：AC-FN-28 判据 1「两种语言下全部新增文案显示对应语言文本，无原始 key 裸露」（When=切换界面语言 en→zh→en）。
  - 实际：静态层可证无缺 key（i18n.test.ts:52 EN/ZH key 全等、frozenCopy.test.ts:95-161、confirmDeleteTable.test.ts:73-75）；但运行时切换渲染取证 reports/ 下不存在——FE-11 self-test:87 搁置给 FE-07/08（「当前无 toast/确认框 UI 可冒烟」），FE-07 cdp 22/22 无语言切换场景。缺：en→zh→en 切换后触发结构回执 toast + 删表确认框的渲染取证（双语文案完整、无裸 key）。
  - 建议（已随派修排后）：CDP/手动冒烟落 reports/IT-01-PATH-08/，覆盖 toast 回执/撤销钮/删表确认框。

- **P2｜切换语言后在途 toast/打开中确认框保持旧语言（预烘焙串，未走 key-based live-relabel）**（FE-08 联调面）
  - 期望：AC-FN-28 判据 1「全部新增文案显示对应语言文本」；Dialog.tsx:15-18 自身契约「*Key 字段渲染期 t() 解析，open dialog 随语言切换 live-relabel」。
  - 实际：confirmDeleteTable（opsTable.ts:399-405）传 message/confirmLabel/cancelLabel 预烘焙串，messageKey 通路对本确认框不生效；ConfirmOptions 无 confirmLabelKey/cancelLabelKey（Dialog.tsx:32-39）；toast 链路 useToast.ts:88-98 存 string、ToastHost.tsx:17-18 直渲无 useTranslation——5s 驻留期内切语言保持旧语言。边界：确认框模态下切语言不可达（遮罩）；toast 驻留期开偏好切换可达。
  - 主 agent 裁定：确认框改 messageKey+ConfirmOptions 补 label key 字段=必修（Dialog 契约违背，FE-08 域）；toast「驻留期保持旧语言」=边界取舍 change-log 登记（5s 短窗，渲染时语言正确、无裸 key），doc-reconcile 视需要对齐 AC 措辞。

（步骤 1/2 对齐：5s 驻留 TOAST_DWELL_MS=5000 精确钉死+顶替重置（useToast.test.ts:52-78、FE-07 cdp s1/s2/s5）、{i}=活动格所在行两面一致（commands.ts:406-418/opsTable.ts:243-249）；无激活格 {i} 不替换=批 D 已登记。步骤 3/4 与 IT-03-FE-03 基座一致不重复立案：HOVER_DELAY_MS=150 单源、FE-10 cdp 47/47 rapidPass 闪烁 0/slowHover 165.2ms/零位移；表后段 +1.28px 亚像素=FE-10#7 已登记。tech-design「防抖 100ms 级」vs AC-NF-04「≥150ms」措辞张力→doc-reconcile（实现取 150ms 与 AC 裁决一致）。）


### PATH-07 r2 定向重审裁定（2026-10-02）

落点 1（ADR 附录 A 迁移对照表）/落点 2（e2e 头注释契约单源声明）/交付物 3-2（对照表落盘）/3-3（test:smoke 限制说明）全部闭合，复跑证据与表体逐条相符（widget.ts:214 唯一写点、contract.ts:14 单源、DELETED_HANDLES:23 守护、toolbar.ts:62/EditorContextMenu.tsx:81、工具栏 6≠19 差集=CHANGE-3）。残余 1×P2 为**形式登记口径**：登记实质落 contract.ts 单源（ADR A.3 口径）而 INFRA-01.md 交付物措辞/阶段 1 grep 断言未回指取代关系，且该取代未登记 doc-drift。裁定：沿 PATH-06 先例「主 agent process-docs 登记面补完，不计修复轮」——取审建议二选一中的①（保留 contract.ts 单源原则，不为过旧 grep 而向 e2e/ 回填 DOM 字面量）：INFRA-01.md :74/:83/:110 修订 + doc-drift 登记位置口径取代关系。


## IT-02/PATH-01 菜单快捷键发现与执行（happy）

**状态：1 未对齐点（P2）→ fix-biz-IT02PATH01-keys 修复完成（2026-10-02）→ r2 定向重审✅ 闭合、无未对齐点（恒挂面 keymap.ts:57-58+index.ts:22 实读生效、关断态 wrapSelectionWith 可触发、typing 五键/paste 门控语义不变、默认态 8 键等价、双偏好态回显-触发一致、步骤 3/4/5 无回归、i18n/e2e 缝/并发面零变更；断言盲区 1 条加固建议入收口批候选不立案）→ ✅ closed；business-history verdict=fixed 已写 IT-02/FE-02.md、FE-03.md（2026-10-02）**

- **P2｜输入辅助偏好关断后格式快捷键失效但回显仍在（发现→执行闭环断裂）**（FE-02 回显面，连带 FE-03 键位面；根因=编辑辅助键位挂载）
  - 期望：ac.md#AC-FN-07 判据 2「提示文本与该命令实际触发键位逐键一致」+ ac.md#AC-NF-06「一致率 100%」；MENU-menubar §3.2 零例外口径前提「bold/italic/inlineCode 有 CM6 键位，回显取 Command.shortcut」。
  - 实际：Mod-b/i/e 唯一键位通道挂在 editingAssistsExtension 的 `config.enabled ? [behavior] : []` 门内（assists/index.ts:27-29,42）——「输入辅助」关断（View▸输入辅助/偏好，store.ts:160 默认 true）后键位表整体卸载；菜单回显由 commandItem 无条件派生（menuLayout.ts:170），仍显示 Ctrl+B/I/E，按键无动作（点击菜单项仍执行 wrapSelectionWith——run 闭包不走 assists 门）。默认态无此问题。
  - 主 agent 裁定：必修——格式快捷键不属于「输入辅助」行为面，Mod-b/i/e 移出 config.enabled 门控恒挂（其余 typing-assist 行为保持门控），补「assists 关断后格式键仍触发」断言；不采用「回显随偏好隐藏」方向（违背发现性承诺）。

（步骤覆盖：①视图 6 组分组/组内项序与 menu-tree §3.3 逐项一致（menuLayout.ts:69-83，15 项计数吻合，menuLayout.test.ts 钉住）；②回显单源派生成立，全局键位/CM6 通道逐条可触发；③Ctrl+Shift+T 唯一归属 reopenClosedTab（AC-PEND-01/Q6 全落地，shortcutSync.test.ts:149-160 owners 恰 ['reopenClosedTab']）；④Ctrl+=/Ctrl+-/Ctrl+0/F12 四键 bindGlobal + windowZoom/windowToggleDevTools 动作通道全链在案（AC-PEND-02/Q7），before-input 仅拦 Ctrl/Cmd+W 不劫持；⑤insert-dedupe in-app 菜单面唯一份（menuLayout.ts:86-91）。CHANGE-1~18 对账一致。

标注（登记候选/在途合流态，不立案）：A. menu-tree §6/§8-1 矩阵 toggleTheme=Ctrl+Shift+T「冲突待裁决」未回写（实现已按 Q6 撤键留空）——doc-reconcile 登记候选；B. §8-2 矩阵 zoom 四键「待定」未回写（实现已按 Q7 补注册）——同上；C. 本 worktree darwin 侧为合流前快照（commandAccelerators.ts toggleTheme 残留/darwin.ts 手写 accelerator/插入菜单双挂），BE-01/BE-02 已在主检出 feature-zhanghuanbiao 落地（BE-01 自测报告在案）——FE/BE 分 worktree 合流差，非缺陷；D. shortcutSync.test 过渡机制（pending 例外 + BE-01 标记自升格）=收口批必修-低已登记。

未能实证（如实登记）：AC-FN-09 cdp 探针扫描（探针外置不随仓，联调补跑；menuLayout.test.ts 48-id 基线+唯一性断言替代在案）；macOS 原生菜单实显（本机 Windows，BE-01 自测已标注）；运行态按键实测沿用 reports/IT-02-FE-03/IT-02-FE-03-selftest.md §4 在案证据。）


## IT-02/PATH-02 键盘走菜单与子菜单（happy）

**状态：1 未对齐点（P2 登记缺口）→ 主 agent 登记面补完 CHANGE-23（2026-10-02，沿 PATH-06/07 先例不计修复轮）→ ✅ closed；business-history verdict=fixed 已写 FE-05.md**

- **P2｜外点关闭焦点归宿偏离 AC-FN-10 判据 2 字面且未登记**（FE-05）
  - 期望：ac.md#AC-FN-10 判据 2「Esc/外点/超界滚动选择路径下焦点回到编辑器正文」。
  - 实际：MenuBar.tsx:126-138 closeIfOutside 对落在 button,input,textarea,select,a,[contenteditable],[tabindex] 的外点目标 closeAll({refocus:false})，焦点留该可聚焦目标（popup.ts:192-194 注释自证「点到对话框等真焦点持有者时不抢焦点」）；取舍仅存代码注释，change-log 无登记（FE-04 code-review Minor 早要求补注记未落）。
  - 主 agent 裁定：行为面正确（点击意图=聚焦该目标，抢回正文违背指哪打哪），缺陷=未登记偏离 → CHANGE-23 按 CHANGE-6 体例登记取舍（「焦点回正文」判据适用面收窄为非聚焦面外点+Esc+超界滚动选择），行为零变更；AC 文义例外措辞归 doc-reconcile。登记面补完不计修复轮；IT-02/PATH-05 评审顺带核 CHANGE-23 与实现一致（闭环交叉核）。

（步骤 1–4 语义一致性全过：① Tab 聚焦菜单栏 ←/→ switchRoot 开合、handler 挂 .menubar 容器作用域契约（正文方向键不进菜单）、Tab 同帧 rootIndex 校正——复跑口径备注 Tab 首站「文件」← 邻根绕回属 FE-05 钉死语义非偏离不立案；② ↑/↓ 循环跳过 separator/groupTitle/disabled、→/Enter 进「打开最近」落首子项、← 收拢回一级还父行、空子菜单不展开——AC-RULE-02 子菜单态链全对齐；③ Enter 与点击同一 runItem 入口 action→close 同源（CHANGE-17 已登记）、禁用项 no-op、toast/禁用规则四面一致；④ Esc 经 hush 总线一键全关含子菜单、collapseAll focusBody→.cm-content、后续输入直达正文（AC-FN-10 判据 1/2 Esc 分支）。CHANGE-1~22 对账一致。）


## IT-02/PATH-03 左导航键盘阅读链路（happy）

**状态：1 未对齐点（P2）→ fix-biz-IT02PATH03-foldsig 修复完成（修法 a：hooks/syncGate.ts createSigGate 布尔 force，三 hook 统一）→ r2 定向重审✅ 闭合、无未对齐点（主序列空集强制再同步链路完整实证、防写抖动不回归、同族真接线、10/10+typecheck 0 抽验一致、AC-FN-30/25 无行为差异引入）→ ✅ closed；business-history verdict=fixed 已写 IT-02/FE-09.md（2026-10-02）**

- **P2｜切标签后折叠态镜像残留（sig 强制哨兵与空集签名撞车）**（FE-09 主责 useFoldSync，连带 FE-08 显示一致性；同族 useQuoteFold/useTableWidthSync）
  - 期望：ac.md#AC-FN-30-1 双向同步 + #AC-FN-25-1 切标签后折叠态保持——切标签后大纲折叠态镜像须与目标文档正文折叠态一致（步骤 5 切标签为必经环节）。
  - 实际：restoreFoldsFor 用 `foldSigRef.current=''` 充当强制再同步哨兵（useFoldSync.ts:108），syncFoldedKeys 签门 `sig === foldSigRef.current` 提前 return（:76-77）——目标文档有效 fold 集合为空时 sig==='' 与哨兵相等 → setFoldedKeys 不执行 → React 镜像残留旧文档折叠集。可复现：A 折叠 `2:X` → 切无折叠记忆的 B → 哨兵 '' + restoreFolds(∅) → 提前返回 → 镜像仍 `{2:X}`；B 恰含同 `level:text` 标题时大纲幽灵折叠（Outline.tsx:133）且 ←/→ 方向反转（outlineKeys.ts:85/93/120）。切回 A 可自愈（sig 非空），步骤 5 主断言通过；偏离在切标签中间态镜像一致性。同族同型：useQuoteFold.ts:80、useTableWidthSync.ts:92。
  - 建议（已随派修）：强制哨兵换不可能与合法 sig 撞车的值（或布尔 force 标志），或 restoreFoldsFor 直接 setFoldedKeys(valid) 置镜像；useQuoteFold/useTableWidthSync 同族同修。

（步骤 1–4 语义全对齐：①文件树 Tab/↑↓/Enter 走 tab 层文件 IO，焦点移动不打开（NAV-sidebar §3.1/AC-FN-13）；②大纲 Enter 与点击同走 onSelect→jumpToHeading，焦点移动不跳正文，空大纲不绑键；③平滑居中跳转+pin/release 冻结 active+滚动中心探针跟随（AC-FN-11 两判据）；④←/→ toggleFold 与正文 foldField 双向同步+写 headingFolds+.md 零字节（AC-FN-30 三判据）；步骤 5 主断言（setState+restoreFolds 保持、localStorage 跨重启、纯显示态不置 dirty）成立。已登记取舍（foldKey 同级同文/liveKeys 树进度/「·」幻影 caret/pathKey 双源等）未重复立案。）

## IT-02/PATH-06 折叠记忆失效清洗与取舍对账（edge）

**状态：1 未对齐点（P2 纯登记面：折叠记忆口径半同步残留 + 三副本全同不变式破口）→ 主 agent 登记面补完回灌（2026-10-02，沿 PATH-06/07 先例不计修复轮）→ 复验 function-tree 三副本 / ui_06 wt==main 规范化行尾全文一致 → ✅ closed；business-history verdict=fixed 已写 IT-02/FE-09.md、IT-02/FE-11.md**

- **P2｜折叠记忆口径半同步残留（登记面，连带三副本全同不变式破口）**（FE-09 主责口径修订，连带 FE-11 副本不变式）
  - 期望：worktree 已修正的 NAV-FOLD-KEEP 表述（「折叠状态跨重启持久保持（AC-RULE-14 口径）且不写入文档正文」）与 ui_06 旁注同步生效于主仓 docs 与 process-docs 副本；FE-11「三副本全同（除行尾）」不变式成立。
  - 实际：主仓 + process-docs 的 `function-tree.md:48` 与主仓 `ui_06_render_zone.html:1253` 仍留旧口径「会话内（最好跨重启）」——同一 diff 只改 worktree 副本，三副本全同不变式破口。
  - 处置：主 agent 登记面补完（worktree 已修正表述原样回灌，保 LF 行尾），规范化行尾后 function-tree 三副本全文一致、ui_06 wt==main 复验通过。不计修复轮。

（步骤 1–4 语义全对齐：①折叠二级章节后删除该标题，失效 foldKey 被 useFoldSync 清洗（live-foldable 过滤）；②重启后剩余折叠保持且 .md 逐字节不变（AC-FN-25）；③深浅主题各一遍侧栏焦点环/三态 token 与 mock 一致（AC-FN-12）；④NAV-GAPS-SORT/MSLT 标注不实现、KBRD 已落地，与 gap-tradeoffs 取舍清单逐字对账（AC-FN-13）。已登记取舍未重复立案。）

## IT-04/PATH-01 验收基线修订闭环（happy）

**状态：1 未对齐点（P2 纯登记面：总看板双份同步声明与现状不符）→ 主 agent 登记面补完（worktree 3 处 Q9 措辞回灌 main 2026-10-01 打磨版，2026-10-02，沿 PATH-06/07 先例不计修复轮）→ 复验 ui-redesign-tasks/refactor-tasks/markdown-ux-optimization 双份规范化行尾全文一致 → ✅ closed；business-history verdict=fixed 已写 IT-04/FE-01.md**

- **P2｜总看板双份内容不同步（FE-01 implementation-notes #6「双份」声明破口）**
  - 期望：main + worktree 双份看板内容一致（对齐 ac.md 三副本「全同、仅换行差异」惯例）。
  - 实际：worktree 两份看板 3 处 Q9 措辞为旧版（ui-redesign-tasks.md 迭代池 2 处「与 Q9 拖拽大纲排序不实现非同一特性」「大纲拖拽排序、文件树节点多选」、refactor-tasks.md 6.15 去向注 1 处），main 已于 2026-10-01 打磨为 Q9 原文引用「与 Q9『大纲排序=不实现（拖拽章节顺序）』非同一特性」「大纲排序、文件树节点多选」；语义等价但双份声明与现状不符，该措辞打磨未见 change-log 登记（CHANGE-10 只登记新建+收敛标注）。
  - 处置：主 agent 登记面补完（main → worktree 回灌 3 行，保 CRLF），规范化行尾后双份全文一致复验通过。不计修复轮。

（步骤 1/2/3 主体面全对齐：AC-PEND-01..16 逐条转正 + entry 级 [PENDING] 清零（16 条裁决映射逐条核对、4 处措辞对齐落位、冻结文案面在位）；附录 A 恰 22 行双向对账 30 正式 id 无悬空、30/30 被任务承载；ui-redesign-tasks.md 总看板期 1~5 指针与 task-list.json 一一对应、两既有看板收敛完整性（26 项+阶段 0~6 全部入表）+ AC-FN-26/27 门禁留档在位。排除面未重复立案。）

## IT-04/PATH-02 深浅主题全界面对照走查（happy）

**状态：✅ 已闭合（2026-10-02）——原 3×P2 证据链 + #5/#6 产品缺陷全 fixed 并经合并 r2 逐条独立实证（产品面无未对齐点）；r2 余 4×P2 证据/登记面留档问题按 PATH-06/07 先例主 agent 登记面补完（不计修复轮、不需 r3）；business-history 已落（FE-02(IT-04) 8 案 + FE-02(IT-01) 1 案 + FE-05(IT-01) 1 案 + FE-04(IT-03) 1 案，verdict=fixed）**

- **P2｜⊞ 网格「单元格边界可辨」证据链不成立（AC-ERR-14 判据 3 / UI-ELEM-02）**（FE-02）
  - 实际：批次③ 3.4a/3.4b 探针 selector `[class*="grid"] [class*="cell"]` + `cells.find(width>4)` 命中容器 `.table-grid-picker-cells`（非格点），留档值 cellBg=transparent/borderW=0/cellBorder=currentColor 与真格点样式（overlays.css:316-324 `.table-grid-cell` bg+1px border，与 ui_02 `.gcell` 1:1）不符；断言仅 found:true 无边界可辨度量；清单 3.4 的对比描述对象是无边框容器。产品实现疑无缺陷，判据核对证据链不成立（顺带解释「⊞ 241 vs 240」计数差根因=240 格+1 容器，计数项本身不重立）。
  - 建议（已随派修）：探针改 `[data-testid="grid-cell"]`（gridPicker.ts:191）实测格点 border/bg vs 弹层表面，复测留档后重判。

- **P2｜控件文字对比度探针覆盖面缺口（AC-NF-09 / AC-ERR-14 判据 1）**（FE-02）
  - 实际：双主题对比度证据仅 7 探针（正文/表格单元格/表头/引用/代码块/状态栏/链接），菜单项/菜单栏/⋮右键菜单/对话框按钮/toast/网格读数/浮层按钮等控件文字零探针；清单 3.1/3.2 执行方式列声称已测菜单——声称面大于证据面（与已立案「对比度引数不同源」数值转录轴不同）。
  - 建议（已随派修）：补控件文字探针复测留档（实测 <4.5:1 如实上报），或将执行方式列收窄为如实采样口径。

- **P2｜硬编码浅色块扫描面窄于判据全称口径（AC-ERR-14 判据 2）**（FE-02）
  - 实际：批次③ 3.3 offenders=[] 的扫描面为固定 8 选择器（表格/公式/图/dialog/toast/两工具栏），菜单下拉/右键⋮菜单/⊞ 网格弹层/侧栏/链接图片浮层等弹层族未入面，清单 3.3 却写「弹层背景采样」——结论范围窄于「弹层均…」全称口径（另有 tokens.test 零补丁+各期静态佐证，产品疑无实际浅色块）。
  - 建议（已随派修）：扫描选择器补弹层族复扫留档，或 3.3 结论收窄为「已扫 8 族+静态 token 纪律佐证」并注明覆盖口径。

（步骤 1/2 深浅两遍 ui_01..07 逐页对照留档齐备两遍均「通过」；步骤 3 的 7 探针对比度 WCAG 复算全吻合（最低浅 5.11/深 5.44）、四副本 palette 单源+守护测试口径吻合、CHANGE-12 三方一致。排除面未重复立案。）

**batch9 证据补测回执（2026-10-02，fix-biz-IT04PATH02-evidence，零产品改动）**：原 3×P2 证据链已修复——9.1 ⊞ 网格改真格点 `[data-testid="grid-cell"]` 20×12=**240 格**双主题 PASS（旧 241 证据作废；根因=240 格+1 容器 `.table-grid-picker-cells` 被 `[class*="grid"] [class*="cell"]` 误中+width>4 放行，留档不另立）；9.2 对比度 **22 控件族**采样 dark 22/22（最低 5.44）；9.3 硬编码浅色块 **9 弹层族含子孙深扫**。门禁：typecheck 0 Error + test:unit 1066/1066（76 files）零 src 改动。报告回填完成（checklist 3.1-3.4/5.4/批次⑦⑨ + self-test-report）。**校准重测暴露真实产品缺陷 2 项（如实上报、零产品改动授权未修）**：

- **P2 #5｜toast 撤销按钮浅色主题对比度不足（AC-NF-09）**（FE-02(IT-01) toast 面）
  - 期望：控件文字对比度 ≥4.5:1（WCAG 1.4.3）。
  - 实际：`.toast-undo-btn` 浅色 `--accent:#0969da` on `--toast-bg:#1f2328` = **3.04:1**；toast 正文 13.37 过、深色撤销钮 6.25 过。7 探针旧证据未覆盖 toast 内按钮故未暴露。
  - 建议（已随派修）：专用 token 调亮（勿动全局 `--accent`）；双主题 ≥4.5 且不降 toast 正文。

- **P2 #6｜弹层族 UA 原生 chrome 浅色块未适配深色（AC-ERR-14 判据 2）**（FE-05(IT-01) ⊞ 对话框 + FE-04(IT-03) 图片工具栏）
  - 期望：深色主题弹层无未适配浅色块。**主 agent 裁定（三.3）：AC 层不豁免原生控件**——判据词「未适配」正中此面，且均为自研对话框/浮层内部控件，可接 token 皮肤。
  - 实际：TableInsertDialog 裸 `input[type=number]`×2（rgb(255,255,255)）+ 裸 `button`×2（rgb(240,240,240)，`.primary` 为死类无 CSS 规则）+ 图片工具栏裸 `input[type=range]`（rgb(255,255,255)）。旧 batch3 只扫 8 根元素自身 background 漏检子孙，机制自洽。
  - 建议（已随派修）：接 token 皮肤；`.primary` 死类并入 `.dialog-btn-primary`；复测 9.3 探针归零。

**合并 r2 定向重审（2026-10-02，batch9/batch10 修复面 + PATH-04 9.4，business-review-IT04PATH0204-r2）**：**产品面无未对齐点**——#5/#6 修复实现、回归面 a–d（buttons.css 三态波及面/prefs-input 跨区复用/range 浅色观感/--toast-accent token-split 纪律）、CHANGE-27 与实现一致性、PATH-04 等值性主张（copyRichText.ts 同函数组合、样张色值/角色/token 抽验、elide 不影响比对）逐条独立实证成立；数字抽验 typecheck 0 Error + test:unit 1066/1066（76 files）。batch9 证据链四组亦逐数对账成立（240 真格点根因引用精确、22 族声称面=证据面、9 族含子孙扫描自洽、batch1-8 只增不改 mtime 佐证）。**余 4×P2（证据面/登记面，可延后）→ 按 PATH-06/07 先例主 agent 登记面补完（不计修复轮）**：

- **① 证据面｜batch10 rangeTrack 字段为宿主回退值**（已补注：不作伪元素证据采信，range 皮肤证据由实拍截图 + markdown.css 静态引用承担）
- **② 登记面｜batch10 改 src 后缺收敛门禁留档**（已补记 CHANGE-27 验收数字行：0 Error + 1066/1066 76 files）
- **③ 登记面｜self-test-report 总判定与三-5/6 矛盾**（已 append-only 补批次⑩ 收口注记 + 批次表行）
- **④ 证据面（轻微）｜checklist 3.1 族名枚举 21/22**（已补「⊞ 网格读数（正文项）」）

## IT-03/PATH-08 块级审计非回归与导出联动（edge）

**状态：✅ 已闭合（2026-10-02）——3 未对齐点（P2×3）全修复并经 r2/r3 实证 + 证据类①补断言闭合（主 agent 定向实测 errMemory 11/11）；②可选 CDP 观察登记不立案（收口批/Phase 2 候选）；business-history 已落 FE-10（4 案 verdict=fixed）**

- **P2｜导出任务勾选态 `[X]` 大小写口径差（AC-OP-18 判据 2）**（FE-10 导出联动面；口径源头 FE-06）
  - 期望：导出物任务勾选态与编辑视图一致（含大写完成态 `[X]`）。
  - 实际：编辑侧大小写不敏感（handlers-tree.ts:316-318 `isTaskDoneText=/\[x\]/i`，build.test.ts:376-387 已钉）；导出侧 renderDoc/listTable.ts:42 `textOf(ctx,marker).includes('x')` 大小写敏感——`[X]` 导出三通道（HTML/PDF/富文本共用管线）均渲染未勾选。listTable.test.ts 无 checkbox 用例，无测试拦截。
  - 建议（已随派修）：导出侧与编辑侧同源判定（`/\[x\]/i`），补 `[X]` 导出勾选态单测。

- **P2｜mermaid last-good 位置键失效边界（AC-ERR-11 判据 1）**（FE-10 / P16 既有通道设计，非本任务引入）
  - 期望：语法修复前的窗口内渲染区保留上一次成功渲染的图（last-good）。
  - 实际：errMemory 按 fence 文档位置作键（errMemory.ts:17-29 `Map<number,…>`，renderHost.ts:65 `getMermaidLastGood(sourceFrom)`），fence 前任意编辑致位置漂移 → miss → showPlaceholder「failed」占位而非旧图（renderHost.ts:66-72,115-124）。主场景（fence 内改语法）不受影响（S3 已验）。
  - 建议（已随派修）：last-good 键随 Changes 重映射或稳定身份键（防不同 fence 串图）；主场景行为不变 + 单测。

（步骤 1/2/4 主体面核验对齐：块级四态 chrome + `--errbar-*` theme-split 深浅两遍、公式错误态 KaTeX 结构化标记+跳源码 stale 纪律、导出图片尺寸/对齐/链接/列表序/表格显示态零写入与编辑视图一致（S5 三通道 30 项实测）；AC-ERR-10 双态口径已立案 doc-reconcile 候选未重立。附注：FE-06.md:150「导出列表顺序与任务勾选态一致」checkbox 未勾销与 FE-10 阶段 3 勾口径存在任务台账差——收口批登记面统一回填，不立案。）

**r2 定向重审（2026-10-02，对 fix-biz-IT03PATH08-p2 修复面）**：原 2×P2 逐条实证已修——① TASK_DONE_RE= `/\[x\]/i` 恢复、注释双侧互指、三通道共用管线无残留 `includes('x')`、listTable.test.ts +4；② remap 主向量封堵（mapPos(pos,1) / 防串图丢弃+碰撞守卫+try/catch / errMemory.test.ts 8 用例 / StateField 时序理由成立 / 嵌套单元格隔离属实 / renderHost 仅注释）；③ CHANGE-26 与实现逐项吻合。数字抽验（重审实测）：定向 vitest 16 passed、typecheck 双 tsconfig 零错、全量 1063/1063（76 files）与修复声明一致。**新增 1×P2（修复引入面）**：

- **P2｜mermaid last-good 跨标签键漂移（AC-ERR-11 判据 1 再入向量）**（FE-10）
  - 期望：CHANGE-26 防串图口径下多标签互不干扰——各文档 last-good 与嵌套单元格编辑器隔离同标准收口。
  - 实际：mermaidLastGood 为模块级全局 Map（errMemory.ts），mermaidLastGoodRemap 随每 DocTab 状态注册（App.tsx:512-513「one extensions array serves the initial state AND every DocTab state」；useTabStore.ts:257 `view.setState`）——标签 B 的 ChangeDesc 对标签 A 的位置键跨文档 `mapPos` → A 的键漂移；切回 A 若 fence 处于 failed 态，widget 以新 sourceFrom 查询 miss → `showPlaceholder()` failed 占位而非 dim 旧图——AC-ERR-11 违约经「跨标签键漂移」门再入。嵌套编辑器隔离属实（nestedSession.ts:235-255 自建扩展表不含该 field），多标签维度未隔离（map 无文档身份键）；同位置跨标签串图（A 的 SVG 挂 B 的 fence）为修复前既有缺陷，本次 remap 另增「漂移致 miss」新面。
  - 建议（已随派修）：last-good 键加文档身份（tabId/doc 级 Map 命名空间，或 remap 仅当 `tr.state` 为持图文档时执行），与既有嵌套编辑器隔离同标准收口。

**r3 定向重审（2026-10-02，对 fix-biz-IT03PATH08-r3 修复面）**：实现语义面**无未对齐点**——8 条修复声明独立实证全对齐（WeakMap<MermaidDocId,Map> 命名空间；token 生命周期闭合：makeState 每链一枚、activateTab 存链不重铸、无临时 state 错位；异步 remember/get 闭包绑定无遗漏调用点；unkeyed 兜底嵌套隔离不降级反而更严；同位置跨标签串图收口；S3 主场景 dim/placeholder 分支逐行不变；每文档 64 上限保持；CHANGE-26 (B-r2) 与实现一致）。实测 typecheck 双 tsconfig 零错 + test:unit 1066/1066（76 files）。**证据类 2 项（非产品缺陷）**：

- **P2（证据类·覆盖陈述夸大）**：errMemory.test.ts「验收1」标题与回执/CHANGE-26 (B-r2) 称「B 插/删/替换不漂移 A 键」，正文仅实测插入向量（删除/替换未测）——产品语义上隔离为结构性（B 的 ChangeDesc 触不到 A 的 Map），非缺陷。→ 续派 fix-biz-IT03PATH08-r3 补 B 删/替换两行断言使陈述为真（first-touch，不改产品代码）。
- **P2（证据类·动态证据缺口，可选）**：异步跨标签写回（A 发起渲染→切 B→回调落 A 命名空间）无 CDP 动态用例；重审判定代码级实证+单测足以支撑修复面结论，**不要求补 CDP 才能收口**——登记为可选观察（收口批/Phase 2 候选：CDP 双标签脚本钉 r2 原始用户向量「A failed→切 B 编辑→切回 A 仍 dim 旧图」），不立案、不落 business-history。

## IT-04/PATH-04 平台×主题×分辨率组合冒烟与落盘对账（edge）

**状态：✅ 已闭合（2026-10-02）——1×P2 富文本证据链 batch9 9.4 补证 PASS，并经合并 r2 等值性主张逐条实证成立（copyRichText 同函数组合、色值 unknown=0、角色 8/8、token 12/12、elide 不影响比对）；business-history 已落 FE-02(IT-04)（verdict=fixed）**

- **P2｜AC-OP-17 判据 3 富文本通道无据（导出物与编辑视图观感一致「无色差」）**（FE-02）
  - 期望：判据 3 对 HTML/PDF/富文本三通道各有据（checklist 批次⑤ 5.4 自述「三通道 var 全一致」为通过依据）。
  - 实际：batch5-data.json 5.4 明细 `rich: []`，断言仅 html↔pdf 集合相等（batch5-export.mjs:214-227）——富文本走 inlineStyles.ts 内联 style 字面色值，与 CSS var 探针形态天然不兼容，未参与断言；retry2 未重跑 5.4；checklist 叙述与自身数据矛盾（声称面大于证据面）。
  - 建议（已随证据批）：补富文本 inline style 色值与 palette/编辑 token 比对留档，或将 5.4 叙述收敛为「html↔pdf var 抽样一致 + 富文本由 palette.test.ts/inlineStyles 静态守护」。

**batch9 9.4 修复回执（PATH-04 P2）**：方案 a 补证据——OS 剪贴板锁死（环境问题非产品缺陷，PowerShell 同报错）fallback 经 Vite 动态 import 复现 `writeRichText` 同一函数组合（与 clipboardWriteHtml 载荷严格等值，capturePath 如实记录）：htmlLen 585749/585750、双主题 unique 色值 8–9 个 **unknown=0** 全 ⊆ palette.ts、角色 8/8 对、编辑 token 逐值 **12/12**；样张 `-rich-{light,dark}.html` 留档（1 处 data URI elided 注记）。checklist 5.4 已改写与最终数据一致。

（三步主体面对齐：AC-NF-10 Win10×深浅+theme=system 跟随有据（Win11 推定已登记）；AC-NF-11 四档分辨率冒烟 5/5 clipped=0 无裁切；AC-NF-01 batch1-retry 6/6 ≤100ms、AC-OP-17 判据 2 三通道逐项一致（CHANGE-12 面）、AC-OP-19 落盘对账+debounce autosave 同写盘链、AC-NF-13 数据层零迁移（双键+normalizeSession+迁移一次性导入语义）、AC-RULE-18 四旅程+权限静态半环（本人复核 renderer 无 rbac 分支）全对齐。附注（不立案）：batch7 run.log 4/4 vs checklist 5/5 系 7.5 静态半环计为汇总行的留档形态说明，叙述自洽。）
