# grill-me 裁决记录（Phase 3 · 2026-09-28）

> 来源：`/zcode:architect ui-ux-redesign` Phase 3 grill-me 逐题裁决，全部经用户确认。
> 用途：技术方案（tech-design.md）与 ac.md 修订（AC-PEND-xx → 正式条目）的唯一裁决真源。

## 扩展性与范围（Q0–Q2）

| # | 决策点 | 裁决 | 要点 |
|---|--------|------|------|
| Q0 | 扩展性定性 | **通用能力** | 菜单框架/弹层可达/toast/确认/块级 chrome 显隐为横向能力，表格为首个实施对象；已落 `extensibility.md` |
| Q1 | 方案覆盖范围 | **一次设计期 2-4，任务按期拆** | tech-design 覆盖全量；breakdown-task 按期 2/3/4 分期拆任务 |
| Q2 | e2e 缝冲突（AC-RULE-17 vs G-2） | **登记契约 delta：删 4 留 1** | 删 `data-table-handle` 值 `row-insert`/`row-delete`/`col-insert-left`/`col-delete`，留 `col-grip`；工具栏/⋮ 挂统一 `data-op` id；AC-RULE-17 修订为「有登记的契约集演进」；外部 cdp 探针同步（见 ADR `e2e-contract-delta.md`） |

## 表格交互（Q3、Q5 + PEND-04/05/07/10/12/13）

| # | 决策点 | 裁决 | 要点 |
|---|--------|------|------|
| Q3 | 删行/列确认口径（PEND-16 核心） | **仅删表确认，行/列 toast+undo** | 需修订 ac.md AC-RULE-15/AC-OP-10；删除行/列为可逆操作不弹确认 |
| Q4 | Ctrl+Shift+←/→ 键位冲突（PEND-03） | **上下文分流** | 单元格内已有文本选区 → 词选扩展优先；无选区 → 左/右插列。保留冻结键位与菜单回显；keydown 判 `selection.empty` 分流；AC-OP-03/04「无文本选区」前置收口为正式语义 |
| Q5 | 首行上插表头归属（PEND-11） | **表头身份迁移** | i=1 上插：空行升表头，原表头降 body 首行，冒号行自动仍为第 2 行；零特例分支，undo 还原表头身份；回填 PRD 6.1，收口 AC-OP-02 i=1 分支与 AC-RULE-07 尾句 |
| — | 删表头行组合（PEND-12） | **表头身份下移（对称）** | 删首行后原首条 body 行升表头；表头是最后一行（无 body 接替）时禁用删除灰显；解除 AC-OP-10 的 i>1 前置限制 |
| — | 参差表格（PEND-07） | **补齐为矩形** | 结构操作单事务内全表补齐每行等列数（空缺补空单元格），冒号行列数同步；undo 一并还原参差态；独立 AC-ERR 条目落盘 |
| — | 列宽布局分配（PEND-10） | **总宽不变，右邻列吸收** | 拖边界=移动边界（Excel 同款）；差额由右邻列吸收；仅最右列边界拖动可增减总宽，钳制正文列内；回填 PRD 6.1，收口 AC-OP-11 Then2 |
| — | Ctrl+Enter 换行语义（PEND-13） | **专职插行** | 不承担换行；单元格换行维持 Shift+Enter（`<br>`）、Tab 跳格不受影响；补非回归断言 |
| — | toast 驻留（PEND-05） | **5 秒驻留** | toast 含撤销按钮 5s 自动消失；超时后 undo 仍由 Ctrl+Z/编辑菜单承载（undo 三入口不减一） |
| — | 模态叠加（PEND-04） | **Esc/空白仅关确认框** | 模态优先层：Esc/点正文空白只关最上层确认框；再 Esc 才全收拢；补 AC-FN-21 模态叠加分支断言 |

## 菜单/快捷键/键盘通道（Q6–Q8 + PEND-01/02/06）

| # | 决策点 | 裁决 | 要点 |
|---|--------|------|------|
| Q6 | Ctrl+Shift+T 归属（PEND-01） | **归重开标签页；切换主题撤键** | 行业肌肉记忆（Chrome/VSCode）；切换主题仅 Titlebar 按钮+菜单入口。清理三处：`viewCmds` 删 shortcut、`DARWIN_COMMAND_ACCELERATORS` 删 `toggleTheme`、i18n `tb.theme` 提示去键位文案；shortcutSync 测试同步 |
| Q7 | 缩放/DevTools 双源（PEND-02） | **全量补注册进单源** | zoomIn `Ctrl+=` / zoomOut `Ctrl+-` / zoomReset `Ctrl+0` / toggleDevTools `F12`；darwin 侧 `Cmd+Plus`/`Cmd+-`/`Cmd+0`/`Cmd+Alt+I` 迁入 `DARWIN_COMMAND_ACCELERATORS`，darwin.ts 手写加速键改走单源；MenuBar 回显自动齐；AC-RULE-11 零例外 |
| Q8 | 表格项键盘直键（PEND-06） | **不补专键；菜单键盘化兜底** | 键位表维持冻结 5 组；键盘通道 = Shift+F10/菜单键唤出 ⋮=右键同源菜单 → 方向键遍历 → Enter 执行，禁用态同步灰显。前置：ctxMenu 键盘遍历（现无则作为期 2 附属小项落地） |

## 左导航与存储（Q9–Q10 + PEND-08/09/14/15）

| # | 决策点 | 裁决 | 要点 |
|---|--------|------|------|
| Q9 | 左导航三候选（PEND-08） | **仅键盘导航=实现** | 大纲排序=不实现（文档结构重写风险大，剪切/粘贴替代）；节点多选=不实现（批量文件安全语义成本过高）；取舍清单随规范定稿入库，解除 AC-FN-13 pending |
| Q10 | 新增持久化态落位 | **双键平铺追加** | 新态平铺进 `veloxmark.preferences`/`veloxmark.session`（如 `quoteFolds` 进 SessionState，camelCase）；不改既有字段形状；sanitizer 白名单逐字段扩展 + store.test 同步；折叠态继续用 `headingFolds`（localStorage 天然跨重启） |
| — | 长引用折叠阈值（PEND-09） | **行数阈值 >5 行** | 折叠为摘要行（首行文本截断 + 「N 行」尾标，点击展开还原）；阈值常量集中一处便于调参；收口 AC-FN-16 Given |
| — | 视觉微调幅度（PEND-14） | **显式豁免** | 以《UI/UX 设计规范》+ 7 页高保真原型为唯一判据；验收走人工对照走查（深浅主题各一遍）；不设数值化幅度断言 |
| — | 轻量操作 toast（PEND-15） | **轻量不回 toast，登记差异声明** | 结构/破坏性/可撤销类回 toast；轻量态切换（任务项勾选、标题/引用折叠、大纲同步等）不回 toast；AC-OP-15 等以显式豁免收口 |

## 生成期差异登记（接口文档生成阶段发现，按已裁决先例派生处置）

1. **⋮ 菜单分组口径**：AC-FN-05/PRD 6.1「四组」vs menu-tree §4「五组（+单元格组）」→ 按既定「原型/菜单树为 UI 真值」裁决派生：**五组为目标**；ac.md 修订时对齐 AC-FN-05 措辞。id 不变，零行为影响。（api/TBL-table-ops.md §4-17）
2. **toast/确认文案双版本**：menu-tree §4 短文案（「行已删除」等）与 ac.md 冻结长文案并存 → 以 **ac.md 为准**（AC-FN-06 原文即声明文案以 AC-OP 为准），menu-tree 联动修订文案列。
3. **Q8 前置已满足**：`EditorContextMenu.tsx` 已有方向键/Enter/Esc 键盘遍历，仅需补 Shift+F10/Menu 键唤出接线。
4. **现状-目标差异 11 项**（删表确认文案冲突、toast 缺撤销按钮、insertRowOp 表头强制落 index 1、列宽无右邻吸收、gridPicker 固定 20×12 等）已逐项登记于各 api 文档「与现有实现差异」，均为期 2-4 实现任务的改造点，无新增决策。

## PEND 闭合状态

AC-PEND-01..16 **全部闭合**（16/16）：01→Q6，02→Q7，03→Q4，04→模态叠加，05→toast 5s，06→Q8，07→补齐矩形，08→Q9，09→行数阈值，10→右邻列吸收，11→Q5，12→表头下移，13→专职插行，14→显式豁免，15→差异声明，16→Q3。
后续修订 ac.md 时逐项把 `[PENDING]` 转正式条目并按上表改写判据。
