# UI 复刻评审报告（R2 · 修复后重评）

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修项。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-01-FE-01 |
| 任务文件 | `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-01/FE-01.md` |
| 评审轮次 | 第 2 轮（修复批 A 后重评；第 1 轮报告 `IT-01-FE-01-replica-review.md`） |
| 评审时间 | 2026-10-01 |
| 评审者 | frontend-replica-review subagent |
| 实现图 | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-01/IT-01-FE-01-impl.png`（修复批 A 后终态，12:17 重截） |
| 设计图 | 无 PNG（html 型设计稿；取稿方式为 Read html 精确值，同 R1） |
| 设计稿源 | `D:/code/typora/docs/requirements/ui-ux-redesign/ui/ui_02_table_edit.html`（主稿）；`ui_03_table_menu.html`（菜单 19 项 DOM / 248px / 5px 滚动条口径交叉印证） |
| 辅证图 | `shots/fe01-toolbar-pill-edit.png`、`fe01-edit-outline-on.png`、`fe01-align-pressed-default-left.png`、`fe01-danger-trash-light.png`、`fe01-danger-trash-dark.png`、`fe01-grid-picker-anchor.png`、`fe01-menu-19-items-bottom.png`、`fe01-minstruct-header-only-menu.png`、`fe01-minstruct-1x1-menu.png` |
| 页面路径 | 表格编辑视图（editor/table 纯 op 层 + 表格编辑态 UI 面） |

---

## R1 未对齐点收敛状态总览（16 点逐条对照）

| R1 # | 区域/元素 | R1 判定 | R2 状态 | 依据（本轮证据） |
|---|---|---|---|---|
| 1 | 工具栏布局/锚定 | Important | **旧点已收敛确认** | 右上浮动紧凑 pill，⊞ ◧ ▣ ◨ + `.tsep` + ⋮ 🗑 单组连续，右缘与表右缘对齐（实测容器 ≈x878–1098，表右缘 ≈x1096） |
| 2 | 工具栏容器样式 | Minor | **旧点已收敛确认** | 底色 (250,250,250)=`--widget-surface`、1px (229,229,229)=`--border`、外扩阴影渐变（上缘 253→242）均在 |
| 3 | 🗑 danger 红 | Minor | **旧点已收敛确认** | 亮色主题垃圾桶红系着色（ClearType 边缘混色，核心红向）；暗色主题实测 (195,42,38)/(168,54,46) 红系，对齐 `--danger #f85149` |
| 4 | 编辑态整表蓝色外框 | Important | **旧点未收敛** | 见未对齐点 U1（`fe01-edit-outline-on.png` 四边实测仍 (229,229,229)） |
| 5 | 状态列 pill 胶囊 | Minor（R1 豁免待定） | 维持豁免，不重开 | 样例内容装饰性呈现，实现样张无状态列数据，不作比对基准 |
| 6 | 删除行/删除列 danger 着色 | Important | **旧点已收敛确认** | header-only 表「删除列」启用态实测 DARK 非红（red=0）；删除行/删除列禁用态为 `--fg-disabled` 灰；危险红仅「删除表格」+「危险组」徽标（red 像素集中于 y383–398 徽标 / y471–482 删除表格） |
| 7 | 删除行禁用态核验缺口 | Important | **旧点已收敛确认** | `fe01-minstruct-header-only-menu.png`（仅表头 2 列）：删除行 GRAY 禁用、删除列 DARK 可点；`fe01-minstruct-1x1-menu.png`（1×1）：删除行+删除列均 GRAY。且矩阵语义正确——header-only 下左移该列（第 2 列）DARK 可点、右移该列 GRAY，与「首列左移灰显/末列右移不可」一致 |
| 8 | 菜单分组完整性（后 2 组缺口） | Minor | **旧点未收敛（原缺口→补图暴露新偏差）** | 单元格 3 项 + 结构删除 3 项 + 「危险组」徽标已补截可见 ✓；但 19 项之后另有设计外条目 → U3 |
| 9 | ⊞ 网格弹层核验缺口 | Minor | **旧点未收敛（原缺口→补图确认偏差）** | 弹层已补截（`fe01-grid-picker-anchor.png`），核出 U4–U7 |
| 10 | 快捷键卡片 | Important（若判产品 UI 则升 Critical） | **旧点未收敛（未处理）** | 终态图与全部 shots 仍无右侧 `side-col`/`key-card`；修复批 A 未覆盖该项 → U2 |
| 11–16 | 页面骨架 6 项（范围外观察） | Important/Minor | 无新回归，不展开 | 状态栏/侧栏/标题栏/标签页/行号槽/标题标记形态与 R1 相同（样张数字随内容变化除外） |

R1 已核对一致、本轮复核无回归的面（不展开）：菜单 13 项文案与 kbd 提示逐字一致、表头保护灰显、菜单组结构/分隔线/✓ 回显列、表格基础样式（表头浅灰底加粗/单元格浅灰描边/40px 行高/斑马纹/激活单元格 2px accent outline）、菜单宽度与滚动条（实测面板 ≈x944–1191 ≈ 247px ≈ 设计 248px；内滚动条 5px：x1186–1190，thumb (176,176,176)/track (242,242,242)）。

---

## 严重度分布（仅供参考，非通过门槛）

| 严重度 | 数量 | 含义 |
|---|---|---|
| Critical | 1 | 文案错字/缺失（网格弹层 label 缺「· 缩放整表」） |
| Important | 4 | 样式明显偏离 / 次要元素缺失 / 超设计条目 |
| Minor | 2 | 微小视觉差异 / 装饰细节偏差 |
| **合计** | **7** | — |

> 状态列 pill（R1 #5）豁免维持，不计入。#U2（快捷键卡片）若主 agent 判定为产品 UI 载体则升 Critical（沿 R1 注记）。

---

## 未对齐点清单（按区域分组；每点标注收敛状态）

### GFM 表格（编辑态渲染）

| # | 收敛状态 | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|---|
| U1 | 旧点未收敛（R1 #4） | Important | 编辑态整表容器外框 | `table.gfm { border: 1px solid var(--accent) }`，亮色 `#0969da`（ui_02 注释即「edit-state container outline」），编辑态整表 1px 蓝框 | 四边外框实测 1px (229,229,229)=`--border` 灰（`fe01-edit-outline-on.png`：上 y245 / 右 x1096 / 下 y370 / 左 x329 非激活行处全灰）；仅激活单元格 2px `#0969da` outline（R1 既有 `td.active-cell` 行为） | 编辑态整表蓝色外框仍缺失。**注**：1×1 表（`fe01-minstruct-1x1-menu.png` 的 one 表）因单元格即全表，激活单元格 outline 视觉上似"整表蓝框"（实测外缘 y403 仍灰、内侧 y404–405 蓝 2px = 单元格 outline），易被误判为已修 | 给编辑态 `table.gfm`（或 table widget 根）加 1px solid `--accent` 外框（外缘像素应为 (9,105,218)），退出编辑态移除；修后须在 3 列以上多单元格表上重截验证（勿以 1×1 表截图充当证据）。归属表格渲染 UI 任务 |

### ⋮ / 右键菜单（FE-01 禁用面核心区域）

| # | 收敛状态 | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|---|
| U2 | 旧点未收敛（R1 #10，修复批 A 未覆盖） | Important（若判产品 UI 则升 Critical） | 快捷键卡片（side-col key-card） | `side-col` 320px 内 key-card：标题「表格结构操作 · Shift 升档键位」+ 6 行键位 + 备注行「仅单元格激活态生效…表头保护：首行上移/首列左移灰显」 | 全部终态图/shots 无右侧卡片栏，文档区单列 | 快捷键卡片载体整体缺失（键位文案本身已与菜单/kbd 提示一致，R1 已核） | 同 R1：先定性——产品 UI（编辑态快捷键发现面板）→ 补实现（标题/6 键位行/备注逐字对齐 ui_02）；设计说明性标注 → 主 agent 豁免留档 |
| U3 | 旧点未收敛（R1 #8 原核验缺口，补图后暴露） | Important | 菜单尾部条目集（19 项之外） | ui_03 菜单 DOM 止于 5 组 19 项，末项「删除表格」（`is-danger`）；其后无条目 | 「删除表格」之后另有：剪切 / 复制 / 粘贴（三项灰显禁用）+ 复制为 ▸ / 段落 ▸ / 格式 ▸ / 插入 ▸（4 个带子菜单项，见 `fe01-menu-19-items-bottom.png` y500–715） | 菜单内容超出设计 19 项矩阵：多 2 个无名分组约 7 项通用右键条目 | 定性后二选一：若 ⋮ 菜单应纯表格操作 → 移除尾部通用组（右键可另挂）；若产品要求右键共享完整上下文菜单 → 请设计补录该组规格后主 agent 豁免留档 |

### ⊞ 网格选择器弹层（R1 #9 核验缺口，补图核验）

| # | 收敛状态 | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|---|
| U4 | 旧点未收敛（原缺口→确认偏差） | Critical（文案规则） | 弹层底部 label 文案 | `<b>3 × 4</b> · 缩放整表`——维度数字加「· 缩放整表」后缀（ui_02 `.grid-pop-label`） | 实测 label 仅约 24px 灰字（y≈548，x≈1021–1044），为「N × M」短式，**无「· 缩放整表」后缀** | UI 构件文案缺失 5 字（差 1 字即 Critical，按 checklist ④）；另维度数字色 (140–148 灰) 而非设计 `--accent` + 600 粗 | label 补「· 缩放整表」逐字；`N × M` 用 `--accent` 600 粗体（ui_02 `.grid-pop-label b`） |
| U5 | 旧点未收敛（原缺口→确认偏差） | Important | 弹层快捷钮排 | 设计 grid-pop 仅 `.grid-cells` + `.grid-pop-label` 两块，无按钮 | label 上/下方多出一排钮：`1×1` / `2×2` / `3×3` / `自动适应窗口`（y≈565–590，带 (229) 描边 pill；「自动适应窗口」文案 ui_02/ui_03 均无） | 超设计新增元素 + 新增文案 | 产品要快捷预设则请设计补录规格；否则移除该排钮 |
| U6 | 旧点未收敛（原缺口→确认偏差） | Minor | 网格规格 | 8×8 格（`grid-template-columns: repeat(8, 22px)`，gap 2px，64 格全显无滚动） | 实测 12 列 × ≈15 行带纵向滚动条（格宽 22px、gap 2px ✓，选中格 `#c5daf3` 底+accent 边 ✓） | 网格长宽超出样张 8×8（疑为 20×12 钳制的动态化，ui_02 design-notes 有「缩放上限 20×12 钳制」口径） | 若动态网格为钳制所需，请设计确认滚动口径；否则收敛为 8×8 静态网格 |
| U7 | 旧点未收敛（原缺口→确认偏差） | Minor | 弹层容器描边 | `.grid-pop { border: 1px solid var(--border) }` 仅灰描边 | 面板外缘多一圈 1px accent 蓝线（x=870 / x=1192 实测 (9,105,218)，其内侧才是 (229,229,229) 边） | 多一圈蓝描边（疑似 focus-visible 默认环或"编辑态蓝框"错挂到弹层） | 去掉弹层外缘 accent 环，或明确为焦点环并改用设计内 token；与 U1 一并核对是否蓝框样式挂错目标元素 |

---

## 取稿与读图备注

- **设计稿类型/取稿**：html（同 R1）。`ui_02_table_edit.html` 主稿；`ui_03_table_menu.html` 菜单 DOM 交叉印证（19 项清单、`.menu` width 248px、`::-webkit-scrollbar` width 5px、`.is-danger` 仅 deleteTable、`.hz` 危险组徽标）。
- **读图方式**：Read PNG + 只读像素采样（PIL，不落盘、不启浏览器、不读实现源码）。实现侧关键值以像素实测为准（外框色/描边宽/面板宽/滚动条宽/文本色分箱），避免缩略图目视误判。
- **辅证图去重**：`fe01-toolbar-pill-edit.png` ≡ `IT-01-FE-01-impl.png` ≡ `final-impl-check.png`；`fe01-edit-outline-on.png` ≡ `fe01-align-pressed-default-left.png`（md5 相同，一张图承载两个命名状态——激活第 1 列单元格时 ◧ 左对齐钮按下回显与编辑态同帧，内容可互证，非缺失）；`fe01-grid-picker-anchor.png` ≡ `final-grid-check.png`。
- **样例内容基准声明**（沿 R1）：表格正文样例数据不作 UI 文案比对基准；文案比对仅限 UI 构件（菜单项、工具栏、弹层 label、按钮、状态栏、卡片）。
- **删除行启用态非红的证据强度**：本轮 shots 中「删除行」仅在禁用态（灰）出镜；其 danger 去除由同款「删除列」启用态非红（header-only 表，red=0）间接佐证，判定按已收敛。若主 agent 要求完备可补一张常规表（多行）菜单顶截图。
- **FE-01 纯 op 语义不可视部分**（沿 R1）：表头身份迁移、删首行下移、参差补齐矩形、单事务 undo 逐字节还原、冒号行恒第 2 行——渲染截图无法核验，以 `ops.test.ts` 单测与 QA 冒烟为准。本轮仅覆盖「最小结构禁用判定」这一可视面（已收敛）。
- **分辨率/渲染限制**：工具栏 ⊞/◧/▣/◨ 字形仍以轮廓推断（与设计字形序一致）；文本色含 ClearType 边缘混色，本报告颜色结论按核心像素分箱（红/灰/暗）给出。

---

## 评审者声明

本报告由独立 subagent（frontend-replica-review）基于双图视觉对比（辅以只读像素采样）与任务「页面元素」表、R1 报告逐点对照产出。评审者未读取实现源码、未启动浏览器、未连接 dev server、未修改任何文件（本评审报告除外）。不打总分、不出 PASS/FAIL；每点已标注「旧点未收敛 / 旧点已收敛确认 / 新回归」（本轮无新回归项，U3/U4–U7 为 R1 核验缺口经补图转正的未收敛项）。
