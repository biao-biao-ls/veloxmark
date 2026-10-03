# 左导航功能缺口取舍清单（Q9）

> **入库位置**：《UI/UX 设计规范》· 信息架构 · 功能缺口取舍清单（随规范定稿并入）——本文件为规范定稿前的登记物落盘载体，即 AC-FN-13「取舍清单随《UI/UX 设计规范》定稿入库」的清单本体。
> **真源**：[grill-rulings.md Q9](../../../process-docs/ui-ux-redesign/design/adr/grill-rulings.md#左导航与存储q9q10--pend-08091415)（2026-09-28 用户全锁）/ [NAV-sidebar.md §3.6](../../../process-docs/ui-ux-redesign/design/api/NAV-sidebar.md#36-功能缺口取舍记录q9不实现登记)；登记内容与裁决冲突时以 grill-rulings.md 为唯一真源。
> **登记效力**：三项均有明确裁决、无悬空项——AC-FN-13 Given 的 pending 注（AC-PEND-08）解除依据齐备；标注不实现的两项在本清单留档即满足 AC-FN-13-3。
> **登记时点**：2026-09-30（Q9 裁决 2026-09-28 锁定后落盘；AC-PEND-08「清单定稿时点」由此清单定稿成立）
> **登记任务**：ui-ux-redesign/IT-02/FE-11

## 1. 三候选取舍表（Need Gate 口径）

| 候选 | 裁决 | 理由（Need Gate） | 替代路径 | 功能树标注 |
|---|---|---|---|---|
| 大纲排序（拖拽大纲节点调整章节顺序） | **不实现** | 文档结构重写风险大（标题块整段搬运易错位、与折叠态/锚点联动复杂）；去掉后核心用户仍能完成核心任务 | 剪切/粘贴正文段落调整章节顺序 | `NAV-GAPS-SORT` → 不实现（Q9） |
| 文件树节点多选 + 批量操作 | **不实现** | 批量文件安全语义成本过高（误删/误移多文件的确认与恢复语义不成比例） | 单节点操作循环执行 | `NAV-GAPS-MSLT` → 不实现（Q9） |
| 文件树/大纲键盘导航 | **实现** | 键鼠双通道可达是可发现性与可达性基线（AC-FN-13 实现项） | —（无替代，本项落地） | `NAV-GAPS-KBRD` → 实现（FE-06/FE-08 落地） |

## 2. 与 grill-rulings Q9 逐字对账

| 本清单表述 | grill-rulings Q9 / NAV-sidebar §3.6 对应原文 | 一致性 |
|---|---|---|
| 仅键盘导航 = 实现 | 「**仅键盘导航=实现**」 | 无冲突 |
| 大纲排序 = 不实现；理由「文档结构重写风险大」 | 「大纲排序=不实现（文档结构重写风险大，剪切/粘贴替代）」 | 无冲突 |
| 大纲排序替代 = 剪切/粘贴正文段落 | NAV-sidebar §3.6「剪切/粘贴正文段落调整章节顺序」 | 无冲突 |
| 节点多选 = 不实现；理由「批量文件安全语义成本过高」 | 「节点多选=不实现（批量文件安全语义成本过高）」 | 无冲突 |
| 节点多选替代 = 单节点操作循环执行 | NAV-sidebar §3.6「单节点操作循环执行」 | 无冲突 |
| 取舍清单随《UI/UX 设计规范》定稿入库；解除 AC-FN-13 pending | 「取舍清单随规范定稿入库，解除 AC-FN-13 pending」 | 无冲突 |

结论：三候选取舍表与 Q9 裁决逐条对账，无冲突表述、无悬空项（AC-FN-13-1）。

## 3. 实现项 converge 对账（AC-FN-13-2）

| 实现项 | 任务产出 | converge 状态 |
|---|---|---|
| 键盘导航 · 文件树 | FE-06：`src/renderer/src/components/filetreeKeys.ts` 纯逻辑模块 + `FileTree.tsx` roving tabindex + `filetreeKeys.test.ts` / `filetreeRows.test.ts` | `npm run typecheck` 0 Error；`npm run test:unit` **692/692 通过**（含 filetreeKeys 用例）；cdp 冒烟随 IT-02 联调补跑 |
| 键盘导航 · 大纲 | FE-08：`src/renderer/src/hooks/useOutlineNav.ts` + `Outline.tsx` roving tabindex + ↑/↓/←/→/Enter + `useOutlineNav.test.ts` | `npm run typecheck` 0 Error；`npm run test:unit` **692/692 通过**（含 useOutlineNav 用例）；cdp 冒烟随 IT-02 联调补跑 |

> 采集时点：2026-09-30，worktree `projects/.worktrees/typora/ui-ux-redesign/frontend`（feature-ui-ux-redesign-frontend）。实现项与「实现」列一一对应，无悬空实现项。

## 4. 不实现项留档（AC-FN-13-3）

| 候选 | 裁决 | 留档位置 |
|---|---|---|
| 大纲排序（拖拽调整章节顺序） | 不实现（Q9） | 本清单 §1 + 功能树 `NAV-GAPS-SORT` 标注（prd/function-tree.md）+ ui_05 差异注记（ui/ui_05_sidebar.html） |
| 文件树节点多选 + 批量操作 | 不实现（Q9） | 本清单 §1 + 功能树 `NAV-GAPS-MSLT` 标注（prd/function-tree.md）+ ui_05 差异注记（ui/ui_05_sidebar.html） |

## 5. 联动标注索引

| 标注点 | 位置 | 标注文本 |
|---|---|---|
| 功能树 NAV-GAPS-KBRD | `prd/function-tree.md` | 实现（FE-06/FE-08 落地） |
| 功能树 NAV-GAPS-MSLT | `prd/function-tree.md` | 不实现（Q9） |
| 功能树 NAV-GAPS-SORT | `prd/function-tree.md` | 不实现（Q9） |
| UI 原型差异注记 | `ui/ui_05_sidebar.html` | batch-bar / checkbox / 拖拽排序示意附「不实现（Q9）」差异注记（原型早于裁决） |

一致性核对规则：清单与功能树标注不一致时，以 grill-rulings Q9 为真源校正两处（异常场景表口径）。

## 6. 功能缺口候选（本清单外挂登记 · CHANGE-37）

> 体例同 §1（Need Gate 口径）；本节登记「设计稿有/任务无」的未列名功能入口，防终验走查误判为复刻缺失。

| 候选 | 裁决 | 理由（Need Gate） | 替代路径 | 功能树标注 |
|---|---|---|---|---|
| ui_02 快捷键卡片（key-card，workspace 主列侧栏卡，ui_02_table_edit.html:709-721） | **不实现（本期）** | 不在任何 FE 任务元素表（未列名功能入口=分流登记判例）；快捷键可发现性已由菜单 kbd 回显（AC-NF-06/AC-RULE-11）部分满足 | 菜单浏览发现快捷键（AC-FN-35 旅程锚点）；如需专职面板随期 5/后续需求立项 | 建议挂功能树 NAV 侧栏卡族标注「不实现（本期，CHANGE-37）」 |

登记时点：2026-10-03（doc-reconcile Step 4 合并，CHANGE-37）。去留/立项随产品终裁，与 AC-FN-13 取舍清单同型处置。
