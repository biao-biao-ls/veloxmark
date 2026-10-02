# UI 复刻评审报告

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修项。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-01-FE-04 |
| 任务文件 | D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-01/FE-04.md |
| 评审时间 | 2026-09-30 21:44 |
| 评审者 | frontend-replica-review subagent |
| 实现图 | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-04/IT-01-FE-04-impl.png`（主图）；辅证 `IT-01-FE-04-menu-groups.png` / `IT-01-FE-04-disable-rules.png` / `IT-01-FE-04-align-checked.png` / `IT-01-FE-04-shift-f10.png` |
| 设计图 | 未生成 design.png——设计稿为 `.html`，按 skill 规则直接 Read 取稿（会话禁写约束仅允许写本报告，未复制生成 PNG） |
| 设计稿源 | `D:/code/typora/docs/requirements/ui-ux-redesign/ui/ui_02_table_edit.html`（工具栏）、`D:/code/typora/docs/requirements/ui-ux-redesign/ui/ui_03_table_menu.html`（菜单面，交叉印证） |
| 页面路径 | 表格编辑视图（工具栏 + ⋮/右键菜单面） |

## 严重度分布（仅供参考，非通过门槛）

| 严重度 | 数量 | 含义 |
|---|---|---|
| Critical | 0 | 结构缺失 / 主功能元素缺失 / 关键样式严重偏离 / 文案错字 |
| Important | 7 | 次要元素缺失 / 样式明显偏离 / 间距对齐偏差 |
| Minor | 3 | 微小视觉差异 / 装饰元素细节偏差 |
| **合计** | **10** | — |

> 主 agent 逐条判断未对齐点的必修性，严重度仅作参考。

---

## 未对齐点清单（按区域分组）

### 表格工具栏

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 1 | Important | 工具栏整体布局（ui_02/ui_03 共同） | 单一紧凑按钮簇：⊞ ◧ ▣ ◨ ⋮ 🗑 6 键连续排列（gap 2-4px），整条浮于表格右上（ui_02 `top:-40px; right:0`） | 按钮拆为两端两簇横跨表格全宽：左簇 ⊞+对齐三键（x≈387-483）+ 右簇 ⋮+🗑（x≈1106-1152），中间约 620px 空隙 | 簇内相对顺序保留，但整体从「紧凑一簇」变为「两端分布」，横向占位由约 200px 拉开到约 765px（=表宽） | 将 6 键合并为一个紧凑 flex 簇（gap 4px），整体定位到表格上方右侧（ui_02）或表格上方（ui_03），删除两端分布布局 |
| 2 | Important | 工具栏容器 chrome | `.table-toolbar`：height 32px、bg `--widget-surface`、border 1px `--border`、radius `--radius-md`(8px)、`--shadow-pop` 阴影的胶囊容器 | 无可见容器：按钮间及两簇之间均为编辑器底色 (30,30,30)，无容器底/边框/圆角/阴影；各键仅自带浅灰 chip 底 (39,39,40) | 容器四件套（底/边框/圆角/阴影）整体缺失，按钮呈散落 chip 而非胶囊工具条 | 按 ui_02 `.table-toolbar` 补齐 32px 高胶囊容器（widget-surface 底 + 1px 边框 + 8px 圆角 + shadow-pop），按钮置于容器内 |
| 3 | Important | 工具栏按钮尺寸 | ui_02 `.tbtn` 28×28px（ui_03 28×26px），条高 32px，图标 14px | 各键 chip 实测约 22×19px（宽 22px / 高 19px），整行可视高约 19-20px | 按钮约为设计的 60-75% 缩放，触点偏小、整条偏矮 | 按钮恢复 28×28（或 28×26）px，图标 14px，容器高 32px |
| 4 | Important | 🗑 删除按钮（danger） | ui_02 `.tbtn.danger { color: var(--danger) }`：静息即为 danger 红图标（dark `#f85149`）；任务元素表「红色删除图标」 | 图标为中性灰（实测亮像素≈(148,148,148) 无红通道偏移；菜单截图中同键亦无红相） | danger 红色完全缺失，🗑 与普通图标同色 | 给 🗑 钮加 danger 色（`color: var(--danger)`），hover 保留红底反白（ui_02/03 已有 hover 态） |
| 5 | Important | 对齐三键按下/激活态（UI-IXD-04） | ui_02 `.tbtn.active`：bg `--accent-soft`（rgba(88,166,255,0.12/0.14) 浅蓝晕底）+ 图标 `--accent` (#58a6ff) | align-checked.png 中居中键按下态为纯 `--accent` 实底（剥除弹窗遮罩衰减后实测 (88,166,255)）+ 浅灰图标；且主图 impl.png 里表格 A/B/C 三列分别为左/中/右对齐时三键均无任何按下态（该图亦无活动单元格轮廓） | 按下态「浅晕底+accent 图标」被做成「accent 实底+浅图标」；impl.png 场景下按下态未呈现 | 按下态改为 `background: var(--accent-soft); color: var(--accent)`；补 impl.png 同类场景（列对齐已设置）下当前列对齐键的按下态回显 |
| 6 | Important | ⋮ 按钮菜单展开源激活态 | ui_03 `.tool-btn.source`：菜单展开时 ⋮ 为 accent 实底 + `--on-accent` 图标（样张标注「⋮ 已激活 · 菜单展开源」） | menu-groups.png 中 ⋮ 菜单已展开，但 ⋮ 键底色与其余键同为 (25,25,26) 遮罩换算后≈(38,38,40) 常规 chip，无 accent 高亮 | 菜单展开源的激活高亮缺失 | ⋮ 展开菜单期间加 `.source` 态（accent 实底 + on-accent 图标），关闭后复原 |

### ⋮/右键菜单面

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 7 | Important | 「删除行」「删除列」文字色 | 设计中两 item 均为普通 `.menu-item`（`--fg` 常规字色）；danger 红（`.is-danger`）仅「删除表格」一项；ui_03 设计标注亦写明「『删除表格』文字 --danger」 | 「删除行」「删除列」文字为 danger 红（实测剥离遮罩后≈(246,78,68)≈`#f85149`），是可见区仅有的两处红字 | danger 红字被扩散到删除行/删除列，超出设计的危险语义范围 | 去掉 deleteRow/deleteCol 的 danger 字色，仅保留 deleteTable 的 `.is-danger`（红字 + 500 字重） |
| 8 | Minor | 菜单容器宽度 | `.menu { width: 248px }`（border-box 含边框） | 两处菜单实测同为 225px（左框 x1047→右框 x1271；shift-f10 菜单 x370→x594，同宽） | 窄约 23px（约 9%） | 菜单宽度改为 248px |
| 9 | Minor | 菜单滚动条 | 设计定制细滚动条：`::-webkit-scrollbar` 宽 5px，track `--bg-inset`，thumb `--fg-disabled` 深色细条 | 实测约 18px 宽的系统浅灰滚动条（(157,157,157) 轨/带上下箭头观感），贴在菜单右侧 | 滚动条粗细与配色均未按设计样式化 | 按 ui_03 的 webkit 滚动条样式覆盖（5px、深色 track/thumb） |

---

## 取稿与读图备注

- **设计稿类型**：html（2 份）；**取稿方式**：Read HTML 源（样式值取自 CSS，深色主题值按 `.theme-dark` token 对照）；**读图方式**：Read PNG + PIL 像素采样（测色/测边界，未读任何实现源码）。
- **遮罩补偿**：4 张菜单截图均带「恢复未保存的草稿」模态弹窗（非 FE-04 页面元素，疑似草稿恢复流程弹出），其遮罩使全屏颜色约衰减至 0.65 倍（例：菜单项字色实测 (138,138,138) ÷0.65≈(212,212,212)=`#d4d4d4`）。本报告颜色结论均已按该系数折算到无遮罩值后再与设计 token 对比；弹窗同时遮挡表格中部，活动单元格判读以单元格底色/描边像素为准。
- **已核验一致（不列为未对齐点）**：
  - 分组结构与顺序：行操作 → 列操作 → 对齐（组间 1px 分隔线，`--border` 色）与设计一致；组名小号 `--fg-dim` 档次一致。
  - 文案逐字（滚动首屏 13 项）：在上方插入行/在下方插入行/上移该行/下移该行/删除行/在左侧插入列/在右侧插入列/左移该列/右移该列/删除列/左对齐/居中对齐/右对齐 —— 与设计零差异。
  - 快捷键回显 8 项有键串逐字一致（Ctrl+Shift+Enter / Ctrl+Enter / Alt+↑ / Alt+↓ / Ctrl+Shift+← / Ctrl+Shift+→ / Alt+← / Alt+→）；无键项（删除行/删除列/对齐三项）右侧留空；回显色 `--fg-dim` 档次一致。
  - 禁用规则：disable-rules.png（活动单元格=表头 A 列）「上移该行」「左移该列」灰显（≈`--fg-disabled`）而「下移该行」「右移该列」可点，与设计样张（首行/首列锚定）逐项吻合；align-checked.png（表头 B 列）仅「上移该行」灰显，正确。
  - 对齐 check 回显：居中对齐项 ✓ 为 accent 蓝、14px check 槽位布局正确，与当前列对齐一致。
  - 菜单容器：高 480px（top y96→bottom y575）、`overflow` 内滚动、行高 30px、菜单底色=页面 `--bg`、1px `--border` 边框，均与设计一致；⋮ 菜单与键盘唤出菜单（shift-f10.png）项集/顺序/回显/禁用规则一致（可见部分镜像全同）。
  - 色彩层级换算后与 `.theme-dark` token 对齐：项字色 `--fg`、禁用 `--fg-disabled`、组名/回显 `--fg-dim`、红字 `--danger`。
- **无法核验项（证据缺口，非未对齐点，建议主 agent 要求补图）**：
  1. 菜单滚动折叠线以下的第 4-5 组共 6 项（剪切/拷贝/粘贴单元格、拷贝表格/格式化表格源码/删除表格）在 4 张菜单截图中均不可见——其文案、无键留空、「删除表格」danger 红字、组名「结构删除」+「危险组」pill 均无法视觉核验；自测清单要求的「19 项分组/回显/禁用矩阵截图」未随图提供。
  2. 窗口边缘翻转（贴底上翻/贴右左翻）、限高滚动逐项可达的后半段，无截图。
  3. toast 回执文案（含 undo 后缀、三入口同串）无截图。
  4. shift-f10.png 仅能证明「单元格旁唤出同源菜单」的静态结果，无法从静态图区分 Shift+F10/Menu 键与右键触发。
  5. 带弹窗的截图存在「恢复未保存的草稿」对话框干扰（属其他流程），建议补图时先处理该弹窗，避免遮罩影响观感判读。

---

## 评审者声明

本报告由独立 subagent（frontend-replica-review）基于双图视觉对比与任务「页面元素」表核对产出。评审者未读取实现源码、未启动浏览器、未修改任何文件（本报告除外）。
