# MENU 菜单栏契约（menu-*）

## 1. 概述

| 项 | 内容 |
|---|---|
| 接口域职责 | 顶部菜单栏信息架构重排（分组/命名/层级，命令 id 不变）、快捷键回显单源派生、键位归属裁决落地（Ctrl+Shift+T、缩放/DevTools 双源收敛）、弹层限高滚动 + 边缘翻转可达 |
| 通道类型 | 命令 id（e2e 缝硬契约，字面量不变）/ 菜单呈现层（menuLayout）/ keymap 注册（Command.shortcut）/ IPC（`window:zoom`、`window:toggleDevTools` 复用）/ darwin 原生菜单加速键（`DARWIN_COMMAND_ACCELERATORS`） |
| 类型 | **修改**（信息架构重排、回显补全、Ctrl+Shift+T 归属清理、zoom/DevTools 补注册）+ **复用**（命令注册表 build、fmtShortcut、windowZoom / windowToggleDevTools IPC、NATIVE_MENU_STRINGS） |
| 裁决来源 | Q6（Ctrl+Shift+T 归重开标签页，切换主题撤键）、Q7（缩放/DevTools 全量补注册进单源）、AC-RULE-10/11（弹层可达、回显单源零例外）；menu-tree §2/§3 信息架构重排为 PRD 呈现层真源 |
| 代码真源（现状） | `src/renderer/src/commands/menuLayout.ts`（MENU_LAYOUT + buildMenus）、`commands/viewCmds.ts`、`commands/tabsCmds.ts`、`commands/shortcutDisplay.ts`、`commands/shortcutSync.test.ts`、`electron/shared/commandAccelerators.ts`、`electron/menu/darwin.ts`、`src/renderer/src/components/Titlebar.tsx`、`src/renderer/src/components/MenuBar.tsx` |

---

## 2. 契约清单

| 契约标识 | 通道类型 | 类型 | 说明 | PRD 来源章节 | AC 条目 | 裁决来源 |
|---|---|---|---|---|---|---|
| `menu:ia-reorder` | 菜单呈现层 | 修改 | 文件/编辑/视图/插入/帮助 五根菜单分组重排（menu-tree §2/§3 对照），全部命令 id 不变 | PRD 6.2 | AC-FN-09, AC-FN-35 | menu-tree（PRD 呈现层真源） |
| `menu:insert-dedupe` | 菜单呈现层 | 修改 | `insertTable`/`convertToTable` 迁出编辑菜单入插入域；插入域去重后「插入表格…」只此一份 | PRD 6.2 | AC-FN-09 | menu-tree §2 |
| `menu:rename-consistency` | 命名 | 修改 | 「文件夹内搜索…」命名与 `globalSearch` 语义统一（id 不变） | PRD 6.2 | AC-FN-35 | menu-tree §2 |
| `menu:echo-single-source` | 菜单回显 | 修改 | 有快捷键命令 100% 回显，提示由快捷键总表单源派生（`Command.shortcut` + 表格 `STRUCT_KEYS` → `fmtShortcut`），一致率 100% | PRD 6.2、PRD 10 | AC-RULE-11, AC-FN-07, AC-NF-06 | PRD 冻结（零例外） |
| `menu:echo-empty` | 菜单回显 | 修改 | 无快捷键命令右侧留空，不显示占位符 | PRD 6.2 | AC-FN-07 | PRD 冻结 |
| `key:reopen-tab-owns-chord` | keymap | 修改 | Ctrl+Shift+T 唯一归属 `reopenClosedTab`（重开已关标签） | PRD 12 #4 | AC-PEND-01 → 转正条目 | Q6 |
| `key:toggleTheme-drop-chord` | keymap/加速键/i18n | 修改 | 切换主题撤键：仅保留 Titlebar 按钮 + 菜单入口（无快捷键、回显留空） | PRD 12 #4 | 同上 | Q6 |
| `key:zoomIn` | keymap | 修改 | zoomIn 补注册 `Ctrl+=`；darwin `Cmd+Plus` | PRD 12 #5 | AC-RULE-11, AC-NF-06 | Q7 |
| `key:zoomOut` | keymap | 修改 | zoomOut 补注册 `Ctrl+-`；darwin `Cmd+-` | PRD 12 #5 | 同上 | Q7 |
| `key:zoomReset` | keymap | 修改 | zoomReset 补注册 `Ctrl+0`；darwin `Cmd+0` | PRD 12 #5 | 同上 | Q7 |
| `key:toggleDevTools` | keymap | 修改 | toggleDevTools 补注册 `F12`；darwin `Cmd+Alt+I` | PRD 12 #5 | 同上 | Q7 |
| `accel:single-source` | 加速键单源 | 修改 | darwin.ts 手写加速键迁入 `DARWIN_COMMAND_ACCELERATORS`（含 zoom×3/DevTools/toggleTheme 删除），darwin 菜单构建改走单源 | PRD 6.2、PRD M10 | AC-RULE-11 | Q7 |
| `menu:popup-overflow` | 弹层行为 | 修改 | 全部下拉/子菜单限高滚动 + 边缘翻转，窗口任意位置全项完整可达可点 | PRD 2 可达性、PRD 6.2、PRD 8 | AC-RULE-10, AC-FN-05, AC-FN-08, AC-NF-08 | PRD 冻结 |
| `menu:state-machine` | 状态机 | 复用 | 关闭→一级展开→（子菜单展开）→关闭；Esc/外点/选中项/超界滚动选择终态必关闭；子菜单移回收拢回一级（不关菜单） | PRD 5.5 | AC-RULE-02, AC-FN-10 | PRD 冻结 |
| `menu:native-parity` | darwin 原生菜单 | 修改 | 原生菜单分组与 menu-tree 对齐；label 走 NATIVE_MENU_STRINGS；命令 id 契约不变 | PRD M10 | AC-FN-28 | menu-tree 附录 A |
| `ipc:windowZoom` | IPC 复用 | 复用 | `window:zoom`（in/out/reset），zoom 三命令补键后直达此通道零改动 | PRD 6.2 | AC-NF-16 | — |
| `ipc:windowToggleDevTools` | IPC 复用 | 复用 | `window:toggleDevTools`，F12 补键后直达此通道零改动 | PRD 6.2 | AC-NF-16 | — |

---

## 3. 行为语义明细

### 3.1 菜单信息架构重排（menu-tree 对照，命令标识不变）

**总则**：命令 id / data-op 为 e2e 缝硬契约全部保持不变；菜单位次、所属菜单、分组、命名文案为呈现层可重排（menu-tree §0.4）。cdp 探针扫描的命令 id 集合与重排前完全一致（AC-FN-09）。

**分组对照（现状 `menuLayout.ts` → 目标 menu-tree §3）**：

| 菜单 | 现状结构 | 目标分组 | 关键变更 |
|---|---|---|---|
| 文件（12 项） | 新建与打开平铺 + 保存 + 标签页三项裸列 + 导出 + 设置，仅分隔线 | 新建与打开 / 保存 / **标签页** / 导出 / 设置 | 标签页三项成组；分隔线升级语义分组，按「打开→保存→导出→设置」任务序 |
| 编辑（12 项） | 历史/剪贴板/查找整理/格式/选区导出 + **尾部混入 insertTable、convertToTable** | 历史 / 剪贴板 / 查找与整理 / 格式（与格式化文档同组相邻）/ 选区导出 | 插入类命令迁出至插入域（menu-tree §2） |
| 视图（15 项） | 7 条分隔线切碎，折叠项插在大纲与搜索之间 | 侧栏与搜索 / 折叠 / 模式 / 输入辅助 / 缩放 / 开发与主题（6 组，组内频次降序） | 语义分组；缩放/DevTools 回显随 Q7 补全；toggleTheme 无键回显留空（Q6） |
| 插入（4 项） | insertMermaidDiagram / insertCallout / insertTable（与编辑菜单重复） | 表格（insertTable、convertToTable）/ 图表与容器（insertMermaidDiagram、insertCallout） | 迁入「选区转表格…」；去重后 insertTable 单份 |
| 帮助（1 项） | showHelp | 保持单项 | 不过度设计 |

**命名**：「文件夹内搜索…」与命令 id `globalSearch` 语义统一（搜索范围是文件夹）；根菜单名（文件/编辑/视图/插入/帮助）本次不改（行业习惯对齐，AC-FN-35）。

**触发路径**：Titlebar 菜单按钮 / 键盘（菜单栏聚焦后方向键）/ macOS 原生菜单（`menu:<id>` 转发同一命令注册表）。

**禁用规则**（menu-tree §0.5 通则）：`precondition` 不满足灰显（如 `reopenClosedTab` 无可恢复标签、`nextTab` 标签数 <2、`convertToTable`/`exportSelectionHtml` 无选区、`insertMermaidDiagram` 光标在代码围栏内）；灰显即语义，点击不执行。

**e2e 缝影响**：命令 id 集合（menu-tree §9 48 个菜单栏 id）与 data-op 集合不变；重排只动 `MENU_LAYOUT` 呈现层。

### 3.2 快捷键回显单源派生（AC-RULE-11 零例外）

| 项 | 规则 |
|---|---|
| 派生源 | 快捷键总表 = 渲染端命令注册表 `Command.shortcut` + 表格 `STRUCT_KEYS`（TBL §3.2） |
| 派生函数 | `fmtShortcut`（Windows/Linux `Ctrl+N`；macOS `⌘N` 统一转换） |
| 回显率 | 有快捷键命令 100% 右侧回显；无快捷键命令右侧留空（无占位符）（AC-FN-07） |
| 一致率 | 提示文本与实际触发键位逐键一致率 100%（AC-NF-06）；禁止菜单侧硬编码键位文案 |
| 适用面 | 顶部菜单栏全部菜单项 + 表格 ⋮/右键结构操作菜单（STRUCT_KEYS 派生，同规则） |
| 零例外 | Q7 裁决后缩放/DevTools 不再是例外（原「注册表无 shortcut 字段」双源漂移消除）；bold/italic/inlineCode 无原生加速键但有 CM6 键位，回显取 `Command.shortcut`（既有口径不变） |

### 3.3 Ctrl+Shift+T 归属裁决与清理清单（Q6）

**裁决**：Ctrl+Shift+T 唯一归属 **`reopenClosedTab`（重新打开已关标签）**——行业肌肉记忆（Chrome/VSCode）；**切换主题撤键**，仅保留 Titlebar 按钮 + 「视图▸切换主题」菜单入口（右侧回显留空）。

**清理清单**（生产 3 处 + 测试同步 1 处）：

| # | 清理项 | 现状 | 目标 | 涉及文件 |
|---|---|---|---|---|
| 1 | `viewCmds` 删 shortcut | `toggleTheme` 注册 `shortcut: 'Ctrl+Shift+T'`（bindGlobal 双占） | 删除该 `shortcut` 字段（id/run 不变） | `src/renderer/src/commands/viewCmds.ts` |
| 2 | `DARWIN_COMMAND_ACCELERATORS` 删 `toggleTheme` | `toggleTheme: 'Cmd+Shift+T'` | 删除该 entry（原生菜单不再挂加速键） | `electron/shared/commandAccelerators.ts` |
| 3 | i18n `tb.theme` 去键位文案 | 「切换主题（Ctrl+Shift+T）」/「Toggle theme (Ctrl+Shift+T)」 | 「切换主题」/「Toggle theme」（Titlebar 按钮 tooltip） | `src/renderer/src/i18n/zh.ts`、`i18n/en.ts` |
| 4 | `shortcutSync.test` 同步 | 测试按双源派生规则守护 | 用例同步：`toggleTheme` 无 shortcut/无加速键并入反向钉住清单；`reopenClosedTab` 键位唯一归属断言 | `src/renderer/src/commands/shortcutSync.test.ts` |

**e2e 缝影响**：`toggleTheme` / `reopenClosedTab` 命令 id 字面量不变；变化仅键位绑定与回显。

### 3.4 缩放/DevTools 补注册键位表（Q7）

| 命令 id | Windows/Linux（注册表 `shortcut`） | macOS（`DARWIN_COMMAND_ACCELERATORS`） | 动作通道 | 菜单回显 |
|---|---|---|---|---|
| `zoomIn` | `Ctrl+=` | `Cmd+Plus` | `window.api.windowZoom('in')`（复用，零改动） | 放大 ▸ `Ctrl+=` |
| `zoomOut` | `Ctrl+-` | `Cmd+-` | `window.api.windowZoom('out')`（复用） | 缩小 ▸ `Ctrl+-` |
| `zoomReset` | `Ctrl+0` | `Cmd+0` | `window.api.windowZoom('reset')`（复用） | 重置缩放 ▸ `Ctrl+0` |
| `toggleDevTools` | `F12` | `Cmd+Alt+I` | `window.api.windowToggleDevTools()`（复用） | 开发者工具 ▸ `F12` |

- **单源收敛**：darwin.ts 现手写 accelerator（`Cmd+Plus`/`Cmd+-`/`Cmd+0`/`Alt+Cmd+I`）迁入 `DARWIN_COMMAND_ACCELERATORS`，darwin 菜单构建改读单源映射（Q7：darwin.ts 手写加速键改走单源）；
- 双源同步规则：注册表 `shortcut` 与加速键映射按 `shortcutSync.test` 派生规则守护（`Ctrl+`→`Cmd+` 惯例），例外登记 `DERIVATION_EXCEPTIONS` 并注明原因（永久例外两条：zoomIn 的 `Ctrl+=` ↔ `Cmd+Plus` 为惯例写法差异；toggleDevTools 的 `F12` ↔ `Cmd+Alt+I` 为平台原生键差异、派生不可一致——均需登记，CHANGE-7）；
- AC-RULE-11 零例外：补注册后菜单回显自动齐（回显派生自注册表）。

### 3.5 弹层限高滚动 + 边缘翻转可达（AC-RULE-10）

| # | 约束 | 适用面 | 判据 |
|---|---|---|---|
| 1 | 限高滚动：最大高度 = 窗口可视高 − 菜单栏高 − 边距，超出内滚动 | 全部下拉/子菜单（视图 15 项、表格 ⋮ 19 项为最高风险面） | AC-FN-05, AC-FN-08 |
| 2 | 边缘翻转：靠窗口下缘整菜单上翻、靠右缘子菜单左翻 | 全部下拉与子菜单 | AC-FN-08 |
| 3 | 子菜单 hover 延展不丢失：移入路径不因翻转/滚动断链；移回父项收拢子菜单、一级保持展开不关闭 | 打开最近 / 导出 / 格式 | AC-FN-08, AC-RULE-02 |
| 4 | 窗口极窄/极小（min 640×400）：自适应收紧/滚动，不裁切不可达 | 全部菜单 | AC-ERR-09, AC-NF-11 |
| 5 | 展开响应 ≤200ms；菜单内滚动不重排父级位置 | 全部下拉 | AC-NF-02 |
| 6 | 深浅主题下菜单文字/快捷键列对比度 ≥ 4.5:1 | 全部下拉 | AC-ERR-14, AC-NF-09 |

**关闭路径**（AC-FN-10，四条触发每次验证单一路径）：选择菜单项 / Esc / 点击菜单外区域 / 限高滚动下的超界滚动选择 → 均收拢至关闭态（含子菜单）；Esc/外点/超界滚动选择后焦点回正文，后续键盘输入直接进正文。

### 3.6 macOS 原生菜单对齐（附录 A 口径）

- 原生菜单分组与 menu-tree 对齐（文件/编辑/视图/窗口 + App 菜单）；label 走 `NATIVE_MENU_STRINGS`（i18n 第 3 份字典，新增分组名须同步 en/zh）；
- 格式子菜单不挂原生加速键（CM6 keymap 拥有 Mod-B/I/E，避免抢注——既有行为不变）；
- 标签命令不挂原生加速键（Ctrl+W 走 before-input 标签感知路由，既有行为不变）；
- 命令 id 经 `menu:<id>` 转发同一命令注册表，id 契约不变。

---

## 4. 与现有实现差异（现状 → 目标）

| # | 现状 | 目标 | 涉及文件 |
|---|---|---|---|
| 1 | `MENU_LAYOUT` 平铺分组：文件标签页三项裸列；编辑尾部混入 insertTable/convertToTable；视图 7 条分隔线切碎；insertTable 在编辑+插入重复 | menu-tree §3 目标分组（文件 5 组/编辑 5 组/视图 6 组/插入 2 组/帮助单项） | `src/renderer/src/commands/menuLayout.ts` |
| 2 | `toggleTheme` 与 `reopenClosedTab` 双占 Ctrl+Shift+T（viewCmds L142 / tabsCmds L27，均 bindGlobal） | Q6：`reopenClosedTab` 独占；`toggleTheme` 撤键 | `src/renderer/src/commands/viewCmds.ts`、`tabsCmds.ts` |
| 3 | `DARWIN_COMMAND_ACCELERATORS` 含 `toggleTheme: 'Cmd+Shift+T'` | 删除该 entry（Q6 清单 #2） | `electron/shared/commandAccelerators.ts` |
| 4 | i18n `tb.theme`「切换主题（Ctrl+Shift+T）」 | 去键位文案「切换主题」（Q6 清单 #3） | `src/renderer/src/i18n/zh.ts`、`i18n/en.ts` |
| 5 | `shortcutSync.test` 断言现状双源派生（含 toggleTheme） | 同步 Q6/Q7 例外与反向钉住清单（Q6 清单 #4） | `src/renderer/src/commands/shortcutSync.test.ts` |
| 6 | `zoomIn/zoomOut/zoomReset/toggleDevTools` 注册表无 `shortcut` 字段（viewCmds L131-136 仅 id/label/run） | Q7：补注册 `Ctrl+=`/`Ctrl+-`/`Ctrl+0`/`F12`，回显自动齐 | `src/renderer/src/commands/viewCmds.ts` |
| 7 | darwin.ts 视图菜单手写 `accelerator: 'Cmd+Plus'/'Cmd+-'/'Cmd+0'` 与 DevTools `Alt+Cmd+I`（darwin.ts ~L240-247） | 四键迁入 `DARWIN_COMMAND_ACCELERATORS`，darwin.ts 改走单源映射 | `electron/menu/darwin.ts`、`electron/shared/commandAccelerators.ts` |
| 8 | zoomIn 的 mac 加速键 `Cmd+Plus` 与注册表 `Ctrl+=` 派生规则不直观 | `DERIVATION_EXCEPTIONS` 登记该写法差异并注明原因（双源守护不放宽） | `src/renderer/src/commands/shortcutSync.test.ts` |
| 9 | 菜单分组名 i18n 现有 key 集不含 menu-tree 新分组名（「标签页」「侧栏与搜索」等） | 新分组名 key 双字典同加 + `NATIVE_MENU_STRINGS` 同步（AC-FN-28） | `src/renderer/src/i18n/zh.ts`、`i18n/en.ts`、`electron/shared/menuStrings.ts` |
| 10 | 「文件夹内搜索…」命名现状与 menu-tree 目标一致但与旧「全局搜索」表述并存于文档 | 命名统一口径登记（id `globalSearch` 不变） | 文档/文案核对 |
| 11 | AC-FN-07 的「无快捷键右侧为空」现状菜单项已按 `shortcut ? fmt : undefined` 派生 | 行为不变，验收口径固化 | —（复用） |

---

## 5. 验收映射（AC 条目 → 本域判据）

| AC 条目 | 本域判据 |
|---|---|
| AC-RULE-02 | §3.5 菜单状态机：子菜单移回收拢回一级；选中/Esc/外点终态关闭 |
| AC-RULE-10 | §3.5 限高滚动 + 边缘翻转，全项可达 100% |
| AC-RULE-11 | §3.2 单源派生零例外（Q7 后 zoom/DevTools 不再漂移） |
| AC-FN-05 | 表格 ⋮ 菜单贴底边缘翻转、19 项可点、分组呈现（与 TBL 域共验） |
| AC-FN-07 | §3.2 有键 100% 回显、逐键一致、无键右侧为空 |
| AC-FN-08 | §3.5 子菜单完整可达、hover 不闪烁、移回父级收拢 |
| AC-FN-09 | §3.1 重排后命令 id 集合与 data-op 集合与重排前完全一致 |
| AC-FN-10 | §3.5 四条关闭路径 + 焦点回正文 |
| AC-FN-28 | §3.6/§4-9 新增文案 en/zh 双字典 + 原生菜单文案同步，无 key 裸露 |
| AC-FN-35 | §3.1 行业习惯对照走查（差异留对比记录与理由） |
| AC-ERR-09 | §3.5 窗口极小自适应，无裁切不可达 |
| AC-NF-02 | §3.5 展开 ≤200ms |
| AC-NF-06 | §3.2 一致率 100% |
| AC-NF-08 | §3.5 边缘位置可达率 100% |
| AC-PEND-01 → 转正 | §3.3 Ctrl+Shift+T 唯一归属断言 |
| AC-PEND-02 → 转正 | §3.4 补注册键位表 + 双源同步断言 |
| UI-IXD-11 | 菜单项 hover/激活/禁用三态可区分 |
| UI-ELEM-01 | 菜单间距/圆角/hover 取值全走 token，无裸值 |
| UI-ELEM-04 | 禁用项灰显不可点 |
