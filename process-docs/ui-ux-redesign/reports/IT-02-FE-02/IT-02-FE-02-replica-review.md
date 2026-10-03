# UI 复刻评审报告

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修项。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-02-FE-02 |
| 任务文件 | D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-02/FE-02.md |
| 评审时间 | 2026-09-30 22:03 |
| 评审者 | frontend-replica-review subagent |
| 实现图 | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-02-FE-02/IT-02-FE-02-impl.png`（主图，取证不符，见未对齐点 #1） |
| 实现图（补充） | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-02-FE-02/IT-02-FE-02-impl-table.png`（编辑菜单展开，实际可比证据来源） |
| 设计图 | 无 PNG 渲染产物（设计稿源为 `.html`，按 skill 取稿方式直接 Read HTML+CSS 源；本评审禁止启动浏览器，无法渲染 design.png） |
| 设计稿源 | `D:/code/typora/docs/requirements/ui-ux-redesign/ui/ui_04_menubar.html` |
| 页面路径 | 顶部菜单栏快捷键回显列（ui_04_menubar.html mi-key 列） |

## 任务性质与可比面说明

本任务（fmtShortcut 回显单源派生 + shortcutSync 双源守护）为**逻辑层任务**，页面元素表仅 4 行，其中可视 UI 面只有「菜单项快捷键列 `mi-key`」与「无键菜单项右端 Empty」两行；`STRUCT_KEYS` 表格菜单回显与 `DERIVATION_EXCEPTIONS` 登记表分别属右键菜单交互面与纯测试数据，本次实现图未覆盖/非视觉面。

经设计稿对照，**可比 UI 面仅为菜单 kbd 回显列**（实现图中实际展开的是「编辑」菜单）。下文只列可核对项；不可核对项集中列于「取稿与读图备注」。

## 严重度分布（仅供参考，非通过门槛）

| 严重度 | 数量 | 含义 |
|---|---|---|
| Critical | 1 | 结构缺失 / 主功能元素缺失 / 关键样式严重偏离 / 文案错字 |
| Important | 0 | 次要元素缺失 / 样式明显偏离 / 间距对齐偏差 |
| Minor | 0 | 微小视觉差异 / 装饰元素细节偏差 |
| **合计** | **1** | — |

> 主 agent 逐条判断未对齐点的必修性，严重度仅作参考。

---

## 未对齐点清单（按区域分组）

### 实现图取证（主实现图）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 1 | C | `IT-02-FE-02-impl.png` 主实现图画面 | 展开顶部菜单、显示 `mi-key` 快捷键回显列（任务阶段 1 验收要求：「展开『视图』菜单显示回显列」） | Chrome DevTools Application 面板（Manifest / Service workers / Storage 树 + "No manifest detected"），画面左 1/3 纯白、无任何应用菜单 UI（1600×1000，像素探针确认左三分区非白采样为 0） | 主实现图与任务约定的取证画面完全不符，「视图」菜单回显列（F8 / F9 / Ctrl+/ / Ctrl+Shift+F / 待定 / 冲突项等）无任何视觉证据；可比证据仅来自补充图 `impl-table.png`（覆盖编辑菜单） | 重新截取主实现图：展开「视图」菜单（含回显列）后落盘 `IT-02-FE-02-impl.png`；DevTools 截图如需保留应另命名，不占用主实现图位 |

### 编辑菜单 kbd 回显列（impl-table.png 对照设计稿「编辑 · 下拉」面板）

无未对齐项。核对明细如下（供主 agent 复核）：

| 核对项 | 设计稿值（ui_04_menubar.html 精确值） | 实现值（视觉读图 + 像素探针） | 结论 |
|---|---|---|---|
| 有键项回显 9 条 | 撤销 `Ctrl+Z` / 重做 `Ctrl+Y` / 剪切 `Ctrl+X` / 复制 `Ctrl+C` / 粘贴 `Ctrl+V` / 复制为富文本 `Ctrl+Shift+C` / 全选 `Ctrl+A` / 查找 `Ctrl+F` / 格式化文档 `Shift+Alt+F` | 9 条全部右侧回显，文本逐字符一致（Windows `Ctrl+N` 形态，与设计 Windows/Linux 形态同口径） | 一致 |
| 无键项右端 Empty | 复制为 HTML、格式（▸ 子菜单箭头位）、导出选区为 HTML…（禁用）右端留空，无占位符/省略号/空框 | 右端留空；像素探针确认标签右侧（x>200 区）无任何文本/框线残留 | 一致 |
| 回显列样式 | `.mi-key`：11px / `--fg-dim`(#6b6b6b) / letter-spacing 0.2px / 右端对齐 | 小号灰字、右端对齐，视觉一致；右缘留白 ≈15px（设计 `.mi` padding 11px + 边框），差 ≤5px 属视觉噪声不计 | 一致 |
| 键位右缘对齐 | 右对齐、不截断 | 像素探针：各行键位文本右缘齐平于 x≈285–286（面板右边框 x=301），无截断（`Ctrl+Shift+C`、`Shift+Alt+F` 均完整） | 一致 |
| 结构（回显列所依附） | 编辑下拉 5 组 · 12 项 + 格式 ▸ 5 项 | 5 组（历史/剪贴板/查找与整理/格式/选区导出，组名在位）· 12 项顺序一致；禁用项「导出选区为 HTML…」灰显 | 一致 |
| 文案逐字 | 键位串 9 条 + 空键 3 处 | 逐字符比对 0 差异 | 一致 |

---

## 取稿与读图备注

- 设计稿类型：`html`（ui_04_menubar.html）
- 取稿方式：Read HTML+CSS 源（skill 对 `.html` 类型的规定取稿方式；精确样式值直接取自 CSS 源，如 `.mi-key { font-size: 11px; color: var(--fg-dim); letter-spacing: 0.2px }`、`--fg-dim: #6b6b6b`）。因任务禁令「不启动浏览器」，未渲染 `design.png`——html 类型取稿以源码为准，不构成 fail-closed 的「设计稿取稿失败」。
- 读图方式：Read PNG（`IT-02-FE-02-impl.png`、`IT-02-FE-02-impl-table.png`）+ 像素探针（PIL 只读采样：面板边框定位、各行键位文本右缘、空键区无残留），未写入任何中间文件。
- **不可核对项（不列入未对齐点，按调用方约定仅列可核对项）**：
  1. **表格 ⋮/右键菜单结构操作 `mi-key`（STRUCT_KEYS 派生）**——实现图未展开表格上下文菜单（impl-table.png 背景仅有表格 B/2 单元格），视觉不可核对；属 TBL 域派生逻辑，由测试面覆盖。
  2. **macOS `⌘N`/`⇧`/`⌥` 显示形态**——实现图取自 Windows 平台（窗口控件与 `Ctrl+` 形态可证）；任务 implementation-notes 已注明 macOS 形态由 fmtShortcut 单测覆盖，非本图可核对面。
  3. **`DERIVATION_EXCEPTIONS` 登记表**——纯测试数据（`shortcutSync.test.ts` 内），非 UI 面。
  4. **格式 ▸ 子菜单内回显**（设计：加粗 `Ctrl+B` / 斜体 `Ctrl+I` / 行内代码 `Ctrl+E` / 删除线、高亮空）——实现图未展开子菜单，不可核对。
  5. **视图菜单「待定」/「冲突待裁决」回显态**——随未对齐点 #1 一并缺失证据；且 Q6/Q7 冲突清理归 FE-03（见任务 implementation-notes 6）。
- 顺带观察（不属本任务页面元素，不列未对齐点）：实现下拉面板宽约 222px，设计 `.menu-panel` 为 260px（菜单面板 chrome 归属其他任务的对照面）。
- 设计稿侧 `ui_04_menubar.html` 右栏「快捷键回显一致性 100% / 双源漂移 0」为设计标注卡（非应用渲染面），不可比。

---

## 评审者声明

本报告由独立 subagent（frontend-replica-review）基于双图视觉对比与任务「页面元素」表核对产出。评审者未读取实现源码、未启动浏览器、未修改任何文件（本评审报告除外）。
