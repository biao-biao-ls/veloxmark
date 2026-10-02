# UI 复刻评审报告

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修项。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-01-FE-11 |
| 任务文件 | `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-01/FE-11.md` |
| 评审时间 | 2026-09-30 21:59 |
| 评审者 | frontend-replica-review subagent |
| 实现图 | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-11/IT-01-FE-11-impl.png` |
| 设计图 | 无 design.png（设计稿为 .html，按 skill 取稿表直接 Read 源取精确值；禁起浏览器渲染截图，故未产出 PNG） |
| 设计稿源 | `docs/requirements/ui-ux-redesign/ui/ui_07_global.html`（主稿）、`docs/requirements/ui-ux-redesign/ui/ui_02_table_edit.html`（交叉印证） |
| 页面路径 | 全局浮层（文案与样式基座） |

## 评审范围说明（无可比 UI 面声明）

本任务为 **i18n 冻结文案与样式 token 基座**，实现图是 proof.html 校样截图（双主题 key/zh/en 文案表 + token 色值清单 + token 消费演示件）。设计稿 ui_07/ui_02 是应用整页原型（菜单栏/标签栏/侧栏/场景带 A–D 等），与校样的「文案表 + token 样例」布局**不存在整体结构可比面**，故 ① 结构（区块数/顺序/栅格）不作对照、不计偏差。

本报告只列**可核对项**：④ 冻结文案逐字（对照 ac.md 冻结串 + 设计稿文案）、③ token 值（对照设计稿 CSS 变量）、② 页面元素表存在性、以及校样演示件与设计稿同名组件的可比样式/文案。

## 严重度分布（仅供参考，非通过门槛）

| 严重度 | 数量 | 含义 |
|---|---|---|
| Critical | 0 | 结构缺失 / 主功能元素缺失 / 关键样式严重偏离 / 文案错字 |
| Important | 3 | 次要元素缺失 / 样式明显偏离 / 间距对齐偏差 |
| Minor | 2 | 微小视觉差异 / 装饰元素细节偏差 |
| **合计** | **5** | — |

> 主 agent 逐条判断未对齐点的必修性，严重度仅作参考。

---

## 可核对项核对结果（无偏差，供主 agent 留档）

**④ 冻结文案逐字（21 个注册 key，中文串 vs ac.md 冻结串）——全部逐字一致，零偏差：**

| key | 校样 zh（样例插值） | 冻结基准（ac.md） | 结果 |
|---|---|---|---|
| toast.rowInsertedAbove | 已在上方插入行（Ctrl+Z 可撤销） | AC-OP-02 同串 | 一致 |
| toast.rowInsertedBelow | 已在下方插入行（Ctrl+Z 可撤销） | AC-OP-01 同串 | 一致 |
| toast.rowDeleted | 已删除第 3 行（Ctrl+Z 可撤销） | AC-OP-10「已删除第 i 行（Ctrl+Z 可撤销）」 | 一致（i=3 样例） |
| toast.colInsertedLeft | 已在左侧插入列（Ctrl+Z 可撤销） | AC-OP-04 同串 | 一致 |
| toast.colInsertedRight | 已在右侧插入列（Ctrl+Z 可撤销） | AC-OP-03 同串 | 一致 |
| toast.colDeleted | 已删除第 2 列（Ctrl+Z 可撤销） | AC-OP-10「已删除第 j 列（…）」 | 一致（j=2 样例） |
| toast.rowMovedUp / rowMovedDown | 已上移该行 / 已下移该行（Ctrl+Z 可撤销） | AC-OP-05 同串 | 一致 |
| toast.colMovedLeft / colMovedRight | 已左移该列 / 已右移该列（Ctrl+Z 可撤销） | AC-OP-06 同串 | 一致 |
| toast.colAlignLeft/Center/Right | 第 2 列对齐：左对齐/居中/右对齐（Ctrl+Z 可撤销） | AC-OP-08「第 j 列对齐：…」 | 一致（j=2 样例） |
| toast.tableResized | 表格缩放为 3×4（Ctrl+Z 可撤销） | AC-OP-07「表格缩放为 R×C（…）」 | 一致（3×4 样例） |
| toast.tableDeleted | 已删除表格（Ctrl+Z 可撤销） | AC-OP-09 同串 | 一致 |
| toast.undone | 已撤销 | AC-OP-12 / AC-ERR-04 同串 | 一致 |
| ctx.deleteTableConfirm | 删除后可用一步撤销还原，确认删除该表格 | AC-RULE-15 冻结串 | 逐字一致 |
| ctx.deleteTableConfirmOk | 确认删除 | 设计稿 btn「确认删除」 | 一致 |
| dialog.cancel | 取消 | 设计稿 btn「取消」 | 一致 |
| err.readonly | 文件为只读，无法修改，可另存后编辑 | AC-RULE-16 冻结串；ui_07 hint-bar 同串 | 逐字一致 |
| err.autosaveFailed | 自动保存失败，文档可另存副本 | AC-ERR-15 冻结串；ui_07 hint-bar 同串 | 逐字一致 |
| toast.undoBtn | 撤销 | ui_07 undo-btn「撤销」 | 一致 |

- en 列每个 key 均有对照值（AC-FN-28 双字典对齐的视觉面成立；集合差集以单测为准）。
- ③ token 值一致项：`--toast-bg` 浅 #1f2328 / 深 #0d1117、`--toast-fg` #e6edf3、`--toast-border` #30363d（= 设计稿 tooltip 三色，双主题口径与 ui_07 CSS 一致）；`--accent-soft-strong` 浅 rgba(9,105,218,0.22) / 深 rgba(88,166,255,0.26)（= ui_02 逐值一致）；`--grid-cell-size` 22px、`--grid-cell-gap` 2px（= ui_02 网格几何 22px/2px）。
- ② 页面元素表：toast.* key 族 / ctx.* / err.* / 新增 token 清单均在校样呈现，无缺项（`--fg-disabled` 属「已有或补齐」项，未在校样清单展示，见备注）。

---

## 未对齐点清单（按区域分组）

### Token 样例清单（token swatches 底部色值表，双主题）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 1 | Important | `--shadow-menu`（⋮ 菜单/浮层投影） | 设计稿浮层投影为 `--shadow-pop: 0 4px 16px rgba(0,0,0,0.18)`（ui_07 `.float-menu`/`.toast` 消费；深浅主题均不翻值） | 浅 `0 6px 24px rgba(0,0,0,0.12)`；深 `0 8px 24px rgba(0,0,0,0.45)` | 几何（6/24 vs 4/16）、透明度（0.12 vs 0.18）均偏离，且引入了设计稿不存在的深浅主题翻值 | 与设计稿口径对齐：菜单类浮层投影改回 `0 4px 16px rgba(0,0,0,0.18)` 双主题同值；若确需独立 `--shadow-menu`，先回设计稿补标注再定值 |

### 确认框演示件（token swatches · 删表确认）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 2 | Important | 确认框标题 | ui_07 `.confirm-modal h3` = 「删除表格」（正文上方 16px/700） | 校样确认框无标题行，仅正文 + 按钮 | 主功能元素缺失：标题「删除表格」未呈现，冻结 key 注册表亦无标题 key | 补确认框标题 key（如 `ctx.deleteTableTitle` = 「删除表格」，en 同步），校样与 FE-07 对话框按设计稿呈现标题行 |
| 3 | Minor | 确认框按钮行对齐 | `.confirm-actions` 右对齐（justify-content: flex-end） | 校样按钮行居中 | 按钮行对齐方式偏离 | 校样/组件按钮行改右对齐 |

### Toast 演示件（token swatches · 操作回执）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 4 | Important | toast「撤销」按钮样式 | ui_07 `.toast .undo-btn`：透明背景、accent 字色（#0969da/#58a6ff）、1px accent 边框、字重 600 | 实心 accent 填充块（蓝底白字/深字），无描边式形态 | 按钮形态明显偏离（描边 → 填充） | 按设计稿改为描边式（transparent 背景 + accent 字 + 1px accent 边框）；若 FE-07 组件将另定样式，需回设计稿更新标注保持口径唯一 |

### 菜单演示件（token swatches · 禁用态行）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 5 | Minor | 禁用项括注文案 | ui_07 `.disabled-item` = 「上移该行（表头保护）」 | 「上移该行（禁用灰显）」 | 括注 4 字不同（表头保护 → 禁用灰显）。主文案「上移该行」一致；「（禁用灰显）」疑为校样状态标注而非产品文案 | 若括注为产品展示文案，改为「（表头保护）」；若仅为校样状态注记，收报告备注即可（由主 agent 定性） |

---

## 取稿与读图备注

- 设计稿类型：html ×2（ui_07_global.html 主稿、ui_02_table_edit.html 交叉印证）
- 取稿方式：Read html 源直接读取精确样式值与文案（skill 取稿表 html 路径）；**未生成 design.png**——评审禁起浏览器渲染截图，html 的视觉口径以其内嵌 CSS 声明值为准
- 读图方式：Read PNG（impl.png 1240×1420，双主题并排校样）
- 备注：
  1. 校样为 proof.html 文案/token 基座证明面，非应用整页复刻，① 结构检查不适用（已在范围说明声明）。
  2. `--danger-soft` 设计稿无直接对应 token（仅有 `--danger` #d1242f / #f85149）；校样 rgba(209,36,47,0.08) / rgba(248,81,73,0.1) 的基色与 `--danger` 双主题一致，透明度为新增派生值——无对照基准，不计偏差，仅留档。
  3. `--toast-bg` 深色 #0d1117：与 ui_07 CSS `.theme-dark --tooltip-bg:#0d1117` 一致。设计稿 band-note「深底（#1f2328）…双主题一致」与 CSS 翻值存在内部口径张力，校样走 CSS 翻值路径，不计偏差。
  4. 菜单/网格演示件是 token 消费示范（禁用灰显、danger 红字 + danger-soft 底、网格 22px/2px），不是 ui_07 float-menu / ui_02 grid-pop 的结构复刻；网格 label「3 × 2 · 缩放整表」与设计稿「3 × 4 · 缩放整表」格式逐字同构（数字为样例状态），不计偏差。
  5. err.* 提示条右侧「另存为…」链接按钮未在校样呈现——属消费方 FE-07 提示条面，不在本任务「页面元素」表，不计偏差。
  6. 校样 key 表额外含 toast.copiedTable / tableFormatted / tableUnchanged（不在 implementation-notes 冻结注册表），属扩展 key，不计偏差。
  7. `--fg-disabled`（页面元素表「禁用/danger 态 token」行的「已有或补齐」项）未在校样 token 清单展示；未读实现源无法确认其在位状态，留待联调/单测（tokens.test.ts）口径覆盖。

---

## 评审者声明

本报告由独立 subagent（frontend-replica-review）基于双图视觉对比与任务「页面元素」表核对产出。评审者未读取实现源码、未启动浏览器、未修改任何文件（本报告除外）。冻结文案核对基准取自需求侧 `process-docs/ui-ux-redesign/requirement/ac.md`（非实现源）。
