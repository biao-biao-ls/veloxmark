# IT-02-FE-11 自测报告 — 功能缺口取舍清单登记（Q9：大纲排序/节点多选登记不实现，功能树联动标注）

- 任务：`process-docs/ui-ux-redesign/tasks/IT-02/FE-11.md`（ui-ux-redesign/IT-02/FE-11「功能缺口取舍清单登记（Q9）」）
- 性质：**登记/标注类**（文档登记物，无运行时行为变化、无 i18n/代码改动）
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`（worktree `feature-ui-ux-redesign-frontend`）
- 日期：2026-09-30
- 实现图：`IT-02-FE-11-impl.png`（annotated ui_05_sidebar.html 全页：两处差异注记 + Q9 校正后的 Need Gate 取舍清单卡 + 标注面板 Q9 差异注记行）

## 1. 交付物

| 文件（docs/requirements/ui-ux-redesign/ 下） | 变更 | 副本落位 |
|---|---|---|
| `prd/gap-tradeoffs.md`（**新增**，规范取舍清单登记区） | Q9 三候选取舍清单落盘：清单头入库位置登记 + 三候选取舍表（候选/裁决/理由（Need Gate）/替代路径）+ grill-rulings Q9 逐字对账 + FE-06/FE-08 converge 对账 + 不实现项留档 + 联动标注索引 | 主仓 docs/、worktree docs/、process-docs/requirement/prd/ 三份全同步 |
| `prd/function-tree.md` | NAV-GAPS 三节点联动标注：KBRD→「实现（FE-06/FE-08 落地）」、MSLT→「不实现（Q9）」、SORT→「不实现（Q9）」，各附理由/替代路径与清单互链 | 同上三份全同步 |
| `ui/ui_05_sidebar.html` | batch-bar / checkbox / 拖拽排序三处「不实现（Q9）」差异注记（HTML 注记 + 可视 `.diff-note` 注记条）；Need Gate 取舍清单卡按 Q9 校正（做→实现/不实现 + 替代路径）；标注面板补 Q9 差异注记行；场景横幅补注记 | 主仓 docs/、worktree docs/ 两份全同步（process-docs/requirement 无 ui/ 目录） |
| `process-docs/ui-ux-redesign/requirement/ac.md` | **不修改**——AC-FN-13 Given pending 注（AC-PEND-08）解除记录随修订走 doc-reconcile（任务涉及文件表口径） | — |

## 2. 取舍清单落盘（阶段 1-1）

三候选逐条含「候选/裁决/理由/替代路径」四字段、无空值（`gap-tradeoffs.md` §1）：

| 候选 | 裁决 | 理由（Need Gate） | 替代路径 |
|---|---|---|---|
| 大纲排序（拖拽大纲节点调整章节顺序） | **不实现** | 文档结构重写风险大（标题块整段搬运易错位、与折叠态/锚点联动复杂）；去掉后核心用户仍能完成核心任务 | 剪切/粘贴正文段落调整章节顺序 |
| 文件树节点多选 + 批量操作 | **不实现** | 批量文件安全语义成本过高（误删/误移多文件的确认与恢复语义不成比例） | 单节点操作循环执行 |
| 文件树/大纲键盘导航 | **实现** | 键鼠双通道可达是可发现性与可达性基线（AC-FN-13 实现项） | — |

清单头已登记**入库位置**：《UI/UX 设计规范》· 信息架构 · 功能缺口取舍清单（随规范定稿并入）——AC-FN-13「取舍清单随《UI/UX 设计规范》定稿入库」的清单本体。

## 3. 功能树三节点标注（阶段 1-2，grep 断言）

`prd/function-tree.md`（三副本全数通过）：

| 节点 | 标注文本 | grep 断言 |
|---|---|---|
| NAV-GAPS-KBRD | 实现（FE-06/FE-08 落地）——Q9 取舍裁决，取舍清单见 gap-tradeoffs.md | `实现（FE-06/FE-08 落地）` 计数 ≥1 ✓ |
| NAV-GAPS-MSLT | 不实现（Q9）——批量文件安全语义成本过高，替代=单节点操作循环执行 | `不实现（Q9）` 计数 ≥2 ✓ |
| NAV-GAPS-SORT | 不实现（Q9）——文档结构重写风险大，替代=剪切/粘贴正文段落 | 同上 ✓ |

自动化 grep 断言汇总：**34 项断言 0 失败**（function-tree ×3 副本 ×4 项 + ui_05 ×2 副本 ×5 项 + gap-tradeoffs ×3 副本 ×4 项）。

## 4. 与 grill-rulings Q9 逐字对账（阶段 1-3）

真源：`design/adr/grill-rulings.md`「左导航与存储（Q9–Q10 + PEND-08/09/14/15）」+ `design/api/NAV-sidebar.md` §3.6。逐条对账表见 `gap-tradeoffs.md` §2，结论：**无与裁决冲突的表述、无悬空项**（AC-FN-13-1）。

| 裁决原文 | 清单对应 | 结论 |
|---|---|---|
| 仅键盘导航=实现 | 键盘导航=**实现** | 无冲突 |
| 大纲排序=不实现（文档结构重写风险大，剪切/粘贴替代） | 大纲排序=**不实现** + 同理由 + 剪切/粘贴正文段落 | 无冲突 |
| 节点多选=不实现（批量文件安全语义成本过高） | 节点多选=**不实现** + 同理由 + 单节点操作循环执行 | 无冲突 |
| 取舍清单随规范定稿入库，解除 AC-FN-13 pending | 清单头入库位置登记 + 登记效力段 | 无冲突 |

## 5. 原型 ui_05 差异注记（阶段 2）

| 注记点 | 载体 | 内容 |
|---|---|---|
| batch-bar 多选批量操作条 | HTML 注记 + 可视 `.diff-note` | 「多选 + 批量操作**不实现**——批量文件安全语义成本过高（误删/误移多文件的确认与恢复语义不成比例），替代=单节点操作循环执行。batch-bar/checkbox 为原型示意（原型早于 Q9 裁决），不作需求」 |
| checkbox/selected 多选行 | HTML 注记 | 「checkbox/selected 多选行为为原型示意（原型早于 Q9 裁决）——节点多选「不实现（Q9）」，文件树仅单节点操作」 |
| drag-handle / 拖拽抬起 / drop-line | HTML 注记 + 可视 `.diff-note` | 「大纲拖拽排序**不实现**——文档结构重写风险大（标题块整段搬运易错位、与折叠态/锚点联动复杂），替代=剪切/粘贴正文段落。drag-handle/放置线为原型示意（原型早于 Q9 裁决），不作需求」 |
| Need Gate 取舍清单卡 | 卡片校正 | badge 改「Q9 已裁决 · 清单定稿」；三行状态 做→实现/不实现（Q9）/不实现（Q9），hint 改替代路径；card-sub 改 Q9 取舍口径 + 清单互链 |
| 标注面板 | annotation-list 新增行 | 「Q9 差异注记：batch-bar / checkbox / 拖拽排序为原型示意（原型早于裁决）——节点多选与大纲排序**不实现（Q9）**，仅键盘导航落地」 |
| 场景横幅（措辞含 多选·拖拽排序） | HTML 注记 | 声明为原型措辞（原型早于 Q9 裁决），两项均不实现 |

异常场景覆盖：「原型 ui_05 的多选/排序示意被误当需求」→ 全部示意位附差异注记声明不实现 ✓；「清单项与功能树标注不一致」→ 以 Q9 为真源校正原型 Need Gate 卡与功能树两处 ✓（一致性核对规则已写入 gap-tradeoffs.md §5）。

## 6. 实现项 converge 对账（阶段 3，AC-FN-13-2）

FE-06/FE-08 产出已在 worktree 落地，converge 门禁于 2026-09-30 实测：

| 门禁 | 结果 | 备注 |
|---|---|---|
| `npm run typecheck` | **0 Error**（双 tsconfig） | 全 worktree 含 FE-06/FE-08 改动 |
| `npm run test:unit` | **692/692 通过**（56 文件） | 含 `filetreeKeys.test.ts`（FE-06）与 `useOutlineNav.test.ts`（FE-08） |
| cdp 冒烟 | 随 IT-02 联调补跑 | 本任务无运行时改动，不单独起 Electron |

实现项 ↔ 清单「实现」列一一对应（`gap-tradeoffs.md` §3 已回填）：键盘导航·文件树=FE-06（`filetreeKeys.ts` + `FileTree.tsx` roving tabindex）、键盘导航·大纲=FE-08（`useOutlineNav.ts` + `Outline.tsx` roving tabindex + ↑/↓/←/→/Enter）。无悬空实现项。

## 7. 清单与功能树标注一致性核对（阶段 2）

| 核对项 | 清单（gap-tradeoffs.md §1） | 功能树（function-tree.md） | 一致 |
|---|---|---|---|
| NAV-GAPS-KBRD | 实现 | 实现（FE-06/FE-08 落地） | ✓ |
| NAV-GAPS-MSLT | 不实现（Q9） | 不实现（Q9） | ✓ |
| NAV-GAPS-SORT | 不实现（Q9） | 不实现（Q9） | ✓ |
| 原型 Need Gate 卡 | 实现/不实现/不实现（Q9） | 同左 | ✓（已按 Q9 校正） |

## 8. 验收标准对照

| 阶段 | 判据 | 结果 |
|---|---|---|
| 1 | 取舍清单落盘：三候选四字段无空值 | ✅ §2 |
| 1 | 功能树三节点标注 grep 断言 | ✅ §3（34 断言 0 失败） |
| 1 | 与 grill-rulings Q9 逐字对账无冲突 | ✅ §4 |
| 2 | AC-FN-13-1 三项逐项有明确裁决、无悬空项 | ✅ §2/§4 |
| 2 | AC-FN-13-3 不实现两项在取舍清单有裁决记录 | ✅ gap-tradeoffs.md §4 留档 |
| 2 | 原型 ui_05 多选/排序示意附「不实现」差异注记 | ✅ §5 |
| 2 | 清单与功能树标注一致性核对 | ✅ §7 |
| 3 | AC-FN-13-2 FE-06/FE-08 converge 通过并回填「实现」列 | ✅ §6（typecheck 0 Error + 692/692；cdp 冒烟随联调） |
| 3 | 取舍清单入库位置登记于清单头 | ✅ gap-tradeoffs.md 头部 |
| 4 | AC-FN-13 Given pending 注（AC-PEND-08）解除依据齐备 | ✅ 清单定稿即验收前提达成；ac.md 修订走 doc-reconcile |
| 4 | AC-PEND-08 取舍清单定稿时点确认，登记效力成立 | ✅ 清单头登记时点 2026-09-30 + 登记效力段 |

## 9. 边界与说明

- **无代码/i18n 改动**：冻结文案契约（toast.*/ctx.*/err.*）零触碰；本任务不新增文案 key。
- **三副本同步**：function-tree.md 与 gap-tradeoffs.md 同步落 main docs/、worktree docs/、process-docs/requirement/ 三处（历史上三处 menu-tree/function-tree 保持全同口径）；ui_05_sidebar.html 同步 main docs/ 与 worktree docs/（process-docs/requirement 无 ui/ 目录）。
- **ac.md 不动**：AC-FN-13 Given 的 pending 注解除记录随 doc-reconcile 修订（任务涉及文件表明示）。
- **不 commit/push**：git 提交由主 agent 统一处理（调度禁令）。
