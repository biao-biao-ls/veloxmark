---
req_no: ui-ux-redesign
req_name: VeloxMark UI/UX 全面交互重设计
status: 正式
来源系统: docs/requirements/ui-ux-redesign（zcode 时代产物迁入）
导出日期: 2026-10-05
---

# VeloxMark UI/UX 全面交互重设计 · UI 菜单交互树

| 项 | 内容 |
|---|---|
| 文档标题 | VeloxMark UI/UX 全面交互重设计菜单树（menu-tree.md） |
| 需求编号 | ui-ux-redesign |
| 来源基线 | [PRD.md](PRD.md) v1.0（正式）M06 功能清单 + M09 功能详细说明（6.1 表格交互 / 6.2 顶部菜单栏 / 6.5 全局交互） |
| 模块配置 | M06+M09 均激活 → 本树取 **M09 页面级深度**；M14 未激活 → **跳过编码映射补充**（见 §10） |
| 现状对照源（只读） | `src/renderer/src/components/MenuBar.tsx`、`src/renderer/src/commands/`（menuLayout.ts / 各域 cmds）、`src/renderer/src/editor/contextMenu/opsTable.ts`、`electron/menu/darwin.ts` |
| 语言 | 中文业务语言（与 PRD 一致） |
| 硬契约 | 命令 id / data-op id 为 e2e 缝硬契约，**全部保持不变**；本树只定义呈现层（分组/命名/层级/回显/防溢出） |

---

## 0. 读法与全局约定

### 0.1 层级与区域代号

```text
L1  主窗口入口级        VeloxMark 编辑主界面
L2  分区级              顶部菜单栏各根菜单的下拉面板 / 全局交互面
L3  功能场景级          子菜单（打开最近 / 导出 / 格式）、表格结构操作菜单
L4  深度交互级          菜单触发的弹窗 / 内嵌面板
L5  反馈级              toast / 提示
```

| 代号 | 说明 | z-index |
|------|------|---------|
| C区 | 主内容区 | 1 |
| S区 | 侧边抽屉（左导航搜索面板） | 100 |
| E区 | 居中弹窗（背景遮罩） | 100（叠加 +10） |
| D区 | 确认弹窗（恒最上层，含模态确认框） | 恒最上层（原 200 字面废除，CHANGE-18） |
| T区 | toast / tooltip / 下拉与右键快捷菜单 | 不得超过 D 区（原 999 字面废除，CHANGE-18）；实际分层以 overlayZOrder 契约为准：dialog-overlay(2000) > popover(1500) > editor-context-menu(1000) |

> 尺寸约定：E/D 区像素尺寸为**示意基线**，终值以《UI/UX 设计规范》定稿为准；C/F 区一律百分比。下拉/子菜单属 T 区快捷菜单，不标固定像素，改用**限高约束**（见 §5）。

### 0.2 节点编号

交互节点 3 段式大写编号（模块-功能-动作，每段 ≤4 字符，全文档全局唯一）。布局节点与内容节点不编号。动作段词表：`OPN` 展开 / `EXE` 执行 / `TGL` 切换 / `DLG` 开弹窗 / `CNF` 确认流 / `CAN` 取消 / `SEA` 检索 / `PIC` 选中条目 / `FLT` 翻转（事件）。

### 0.3 快捷键回显规则（统辖全树，PRD 6.2 / AC-11）

1. **有快捷键的命令，回显率 100%**——菜单项右侧必显快捷键；无快捷键的项右侧留空（不写占位符）。
2. 回显文案**由快捷键总表单源派生**（渲染端命令注册表 `shortcut` + 表格 `STRUCT_KEYS` → `fmtShortcut`），与实际键位一致率 100%，消除双源漂移（PRD M10 联动）。
3. 显示形态：Windows/Linux `Ctrl+N`；macOS `⌘N`（`fmtShortcut` 统一转换）。
4. 表格结构操作菜单（⋮ / 右键）同属"结构操作菜单"，回显要求同为 100%。
5. 现状偏差（必须在期 3 收敛，见 §8）：`zoomIn/zoomOut/zoomReset/toggleDevTools` 在 macOS 原生菜单有加速键而注册表无 `shortcut` 字段；`reopenClosedTab` 与 `toggleTheme` 同抢 `Ctrl+Shift+T`。

### 0.4 命令 id 规则

- 菜单树中每项标注 `id: <commandId>`（或表格菜单的 `data-op: <id>`），**全部"保持不变"**——e2e 缝（cdp 探针静态契约）按 id 字面量扫描，重排呈现不得改 id。
- 菜单项的**菜单位次、所属菜单、分组、命名文案**属于呈现层，可随本树重排；id → 动作的绑定不变。

### 0.5 交互与失败通则（适用全部交互节点）

- `precondition` 不满足 → 菜单项 `:disabled` 灰显（灰显即语义，PRD M11 表头保护/最小表规则）。
- 通用 `fail`：文件 IO / 导出 / 另存类操作超时或失败 → `toast("操作失败（原因）")`，不产生半提交状态，可原路径重试；只读文件 → `toast("文件为只读，无法修改，可另存后编辑")` + 提供另存出口（PRD M11 权限异常）。
- 破坏性操作（删除表格）走 D 区确认；其余结构操作单事务一步 undo，误触后 `toast("已撤销")`。
- 菜单开合状态机（PRD 5.5）：关闭 → 一级展开 →（子菜单展开）→ 关闭；Esc / 外点 / 选中项 / 超界滚动选择后**终态必回关闭**，无悬空态。

---

## 1. L1 菜单根节点清单

```text
L1: 主窗口 Menu → [C区 100%×100%] {VeloxMark 编辑主界面}
│
│   布局（内容节点）：顶部菜单栏 / 左导航栏（文件树·大纲）/ 正文渲染区 / 状态栏 / 标签栏
│
├── L2: 顶部菜单栏（Windows/Linux 为渲染进程菜单栏；macOS 为原生菜单，见附录 A）
│   ├── 文件   （12 项，长菜单：限高滚动 + 边缘翻转）
│   ├── 编辑   （12 项）
│   ├── 视图   （15 项，全栏最长下拉：限高滚动优先）
│   ├── 插入   （4 项）
│   └── 帮助   （1 项）
│
├── L2: 表格编辑工具栏菜单面（⋮ 与单元格右键同源，19 项，见 §4）
│
└── L2: 全局交互（菜单开合语境，见 §3.6）
```

> 根菜单共 **5 个**：文件 / 编辑 / 视图 / 插入 / 帮助。macOS 原生另有「VeloxMark（App）」「窗口」两个系统级菜单（附录 A，不计入菜单栏业务根节点）。
> 命名对齐行业习惯：文件/编辑/视图/插入/帮助 与 Typora / 常见编辑器一致，**本次不改根菜单名**（PRD 6.2 命名重排仅作用于菜单项与分组名）。

---

## 2. 分组重排意图总表（现状 → 目标）

| 域 | 现状问题（对照 menuLayout.ts） | 目标重排 | 意图 |
|---|---|---|---|
| 文件 | 标签页三项（关闭/重开/下一个）裸列在保存组后，无分组名 | 归入「标签页」分组 | 会话生命周期归文件域，组名自解释 |
| 文件 | 「导出」子菜单与「偏好设置」之间只靠分隔线 | 明确分组：新建与打开 / 保存 / 标签页 / 导出 / 设置 | 分隔线升级为语义分组，按"打开→保存→导出→设置"任务序排列 |
| 编辑 | `insertTable` / `convertToTable`（插入类）混在编辑菜单尾部，且 `insertTable` 与「插入」菜单重复出现 | 迁出至「插入」域（插入域去重后只此一份） | 编辑域只留编辑/剪贴板/查找/格式/选区导出；插入类命令收敛插入域 |
| 编辑 | 「格式」子菜单只有 5 个行内项，与"格式化文档"相邻关系弱 | 「格式 ▸」保持行内 5 项，与「格式化文档」同组相邻 | 行内修饰与全文整理同属格式语义 |
| 视图 | 15 项用 7 条分隔线切碎，折叠项插在大纲与搜索之间 | 重排为 6 组：侧栏与搜索 / 折叠 / 模式 / 输入辅助 / 缩放 / 开发与主题 | 语义分组 + 组内按使用频次降序 |
| 视图 | 「文件夹内搜索…」命名与命令 id `globalSearch` 语义漂移 | 命名统一为「文件夹内搜索…」（id 不变） | 命名与实际能力一致（搜索范围是文件夹） |
| 插入 | 仅 3 项，能力面窄 | 迁入「选区转表格…」，按 表格 / 图表与容器 分两组 | 插入域成为全部"从无到有"命令的单一入口 |
| 帮助 | 单项无分组 | 保持单项 | 不过度设计 |
| 表格 ⋮ | 平铺 19 项无分组（opsTable.ts 单一数组） | 重排为 5 组：行操作 / 列操作 / 对齐 / 单元格 / 结构删除 | PRD 6.1 点名四组（行操作/列操作/对齐/结构删除）+ 单元格剪贴板独立成组 |

---

## 3. 顶部菜单栏菜单树

> 通用节点属性（不逐条重复）：`fail: { timeout|500: toast("操作失败（原因）"), 保持现场可重试 }`；文件/导出/只读场景的专用 fail 见节点行。所有 `echo:` 均为 100% 必显（有快捷键时）。

### 3.1 L2: 文件 [T区 下拉，限高滚动 + 边缘翻转]

```text
L2: 文件 Menu → [T区 下拉] {文件}
│   防溢出: 限高滚动 + 边缘翻转（下边缘翻上 / 右边缘翻左）；子菜单「打开最近」hover 延展不丢失
│
├── 分组「新建与打开」
│   ├── FIL-BAR-OPN  click [文件] → L2: 文件下拉 [T区]
│   │                 transition: 展开 ≤200ms（PRD M13 下拉响应）
│   │                 expect: 下拉展开，快捷键列就位；再次 click / Esc / 外点 → 关闭
│   ├── FIL-NEW-EXE  click [新建] → 新建未命名标签 [C区 100%×100%] | echo: Ctrl+N | id: newFile（不变）
│   ├── FIL-OPN-EXE  click [打开…] → 系统文件对话框 → 载入文档 [C区] | echo: Ctrl+O | id: openFile（不变）
│   │                 fail: { 用户取消: 无事发生; 读失败: toast("打开失败") }
│   ├── FIL-FLD-EXE  click [打开文件夹…] → 系统目录对话框 → 左导航文件树 [S区] | echo: Ctrl+Shift+O | id: openFolder（不变）
│   ├── FIL-QIK-DLG  click [快速打开…] → L4: 快速打开 [E区 560×420px] | echo: Ctrl+P | id: quickOpen（不变）
│   │                 transition: 弹出 fade 120ms
│   │                 fail: { 扫描超时: 列表区 error 态 + click [重试] }
│   └── FIL-REC-OPN  hover [打开最近] → L3: 打开最近子菜单 [T区] | echo: — | id: 动态（不变）| 见 3.1.1
│
├── 分组「保存」
│   ├── FIL-SAV-EXE  click [保存] → 落盘 .md | echo: Ctrl+S | id: saveFile（不变）
│   │                 precondition: 有活动文档 | 否则 :disabled
│   │                 fail: { timeout|500: toast("保存失败（原因）") }
│   └── FIL-ASA-EXE  click [另存为…] → 系统另存对话框 | echo: Ctrl+Shift+S | id: saveFileAs（不变）
│                     fail: { 取消: 无事发生; 写失败: toast("保存失败（原因）") }
│
├── 分组「标签页」
│   ├── FIL-CLT-EXE  click [关闭标签] → 关闭当前标签；单标签时走关闭窗口拦截 [D区 未保存询问] | echo: Ctrl+W | id: closeTab（不变）
│   ├── FIL-ROT-EXE  click [重新打开已关标签] → 恢复最近关闭标签 [C区] | echo: Ctrl+Shift+T | id: reopenClosedTab（不变）
│   │                 precondition: 存在可恢复标签 | 否则 :disabled
│   └── FIL-NXT-EXE  click [下一个标签] → 切换标签 [C区] | echo: Ctrl+Tab | id: nextTab（不变）
│                     precondition: 标签数 ≥2 | 否则 :disabled
│
├── 分组「导出」
│   └── FIL-EXP-OPN  hover [导出] → L3: 导出子菜单 [T区] | echo: — | 见 3.1.2
│
└── 分组「设置」
    └── FIL-PRF-DLG  click [偏好设置…] → L4: 偏好设置 [E区 720×520px] | echo: Ctrl+, | id: openPreferences（不变）
```

#### 3.1.1 L3: 打开最近子菜单 [T区]

```text
├── 内容节点: 最近文件条目 ×N（标题=文件名，title=全路径）
│   ├── FIL-REN-EXE  click [最近文件条目] → 载入文档 [C区] | echo: —（文件路径类命令无快捷键）| id: 动态（不变）
│   │                 precondition: 路径存在 | 失效条目 :disabled（灰显即语义）
│   │                 fail: { 文件已删/无权限: toast("打开失败") + 条目维持灰显 }
│   ├── 内容节点: 「暂无最近文件」（空态，:disabled）
│   └── FIL-RCL-EXE  click [清空列表] → 清空最近列表 | echo: — | id: clearMenu（不变）
│                     expect: 子菜单回落空态；原生菜单最近列表同步（M10 联动）
```

#### 3.1.2 L3: 导出子菜单 [T区]

```text
├── FIL-PDF-EXE  click [PDF…] → L4: 导出选项 [E区 480×320px] → 系统保存 → L5: toast("已导出 → {path}")
│                 echo: —（无快捷键，右侧留空）| id: exportPdf（不变）
│                 fail: { 渲染失败|500: L4 内 error 态 + toast("导出失败") }
└── FIL-HTM-EXE  click [HTML…] → L4: 导出选项 [E区 480×320px] → 系统保存 → L5: toast("已导出 → {path}")
                  echo: — | id: exportHtml（不变）| fail: 同上
```

#### 3.1.3 L4: 快速打开 [E区 560×420px]

```text
├── FIL-QIK-SEA  fill [搜索框] → 模糊匹配文件名 | expect: 命中列表即时过滤（≤200ms）
├── FIL-QIK-PIC  click [结果条目] → 载入文档 [C区 100%×100%] + 关闭弹窗 | expect: 焦点回正文
└── 内容节点 state: {
      loading: spinner("正在索引工作区…"),
      empty: "无匹配文件" + 引导 click [打开文件夹…] → L2: 文件,
      error: "索引失败" + click [重试]
    }
```

#### 3.1.4 L4: 导出选项 [E区 480×320px]

```text
├── 内容节点: 格式/范围/样式选项（与导出三通道观感契约联动，M10）
└── FIL-EXP-CNF  click [导出] → 系统保存对话框 → L5: toast("已导出 → {path}") / toast("导出失败")
```

#### 3.1.5 L4: 偏好设置 [E区 720×520px]

```text
└── 内容节点（M09 页面级深度，不展开内部页签）: 外观 / 编辑辅助 / 快捷键总表视图
    规则: 偏好键位向后兼容（M10）；快捷键页展示总表派生值，与菜单回显同源
```

### 3.2 L2: 编辑 [T区 下拉，限高滚动 + 边缘翻转]

```text
L2: 编辑 Menu → [T区 下拉] {编辑}
│   重排意图: 插入类命令迁出（→ 插入）；保留 历史 / 剪贴板 / 查找与整理 / 格式 / 选区导出 五组
│
├── 分组「历史」
│   ├── EDT-BAR-OPN  click [编辑] → L2: 编辑下拉 [T区]
│   ├── EDT-UND-EXE  click [撤销] → 撤销一步（含结构操作单事务）| echo: Ctrl+Z | id: undo（不变）
│   │                 expect: 表格/正文回滚一步；结构操作误触路径终点为 L5: toast("已撤销")
│   └── EDT-RED-EXE  click [重做] → 重做一步 | echo: Ctrl+Y | id: redo（不变）
│
├── 分组「剪贴板」
│   ├── EDT-CUT-EXE  click [剪切] → echo: Ctrl+X | id: cut（不变）
│   ├── EDT-CPY-EXE  click [复制] → echo: Ctrl+C | id: copy（不变）
│   ├── EDT-PST-EXE  click [粘贴] → echo: Ctrl+V | id: paste（不变）
│   │                 fail: { 相对路径图片未落盘: 走另存为后重试路径 }
│   ├── EDT-CRT-EXE  click [复制为富文本] → L5: toast("已复制为富文本") | echo: Ctrl+Shift+C | id: copyRichText（不变）
│   ├── EDT-CAH-EXE  click [复制为 HTML] → L5: toast("已复制 HTML") | echo: — | id: copyAsHtml（不变）
│   └── EDT-SLA-EXE  click [全选] → echo: Ctrl+A | id: selectAll（不变）
│
├── 分组「查找与整理」
│   ├── EDT-FND-DLG  click [查找] → L4: 查找面板 [C区 顶部内嵌 100%宽×auto] | echo: Ctrl+F | id: find（不变）
│   │                 expect: 面板展开且输入框聚焦；Esc 收拢（一键回安静）
│   └── EDT-FMT-EXE  click [格式化文档] → 全文格式化（单事务可 undo）| echo: Shift+Alt+F | id: formatDocument（不变）
│
├── 分组「格式」
│   └── EDT-FOR-OPN  hover [格式] → L3: 格式子菜单 [T区] | echo: — | 见 3.2.1
│
└── 分组「选区导出」
    └── EDT-ESH-EXE  click [导出选区为 HTML…] → 系统保存 → L5: toast("选区已导出")
                      echo: — | id: exportSelectionHtml（不变）
                      precondition: 存在非空选区 | 否则 :disabled
```

#### 3.2.1 L3: 格式子菜单 [T区]

```text
├── EDT-DBD-EXE  click [加粗] → echo: Ctrl+B | id: bold（不变）
├── EDT-ITL-EXE  click [斜体] → echo: Ctrl+I | id: italic（不变）
├── EDT-COD-EXE  click [行内代码] → echo: Ctrl+E | id: inlineCode（不变）
├── EDT-STR-EXE  click [删除线] → echo: —（无快捷键）| id: strikethrough（不变）
└── EDT-HLT-EXE  click [高亮] → echo: — | id: highlight（不变）
```

### 3.3 L2: 视图 [T区 下拉，限高滚动 + 边缘翻转]（全栏最长，15 项）

```text
L2: 视图 Menu → [T区 下拉] {视图}
│   防溢出: 15 项为全栏最长下拉 → 限高滚动为默认策略；窗口下边缘附近展开时整菜单上翻
│   重排意图: 6 组语义分组（侧栏与搜索 / 折叠 / 模式 / 输入辅助 / 缩放 / 开发与主题）
│
├── 分组「侧栏与搜索」
│   ├── VW-BAR-OPN  click [视图] → L2: 视图下拉 [T区]
│   ├── VW-OUT-TGL  click [切换大纲] → 左导航大纲显隐 [S区] | echo: — | id: toggleOutline（不变）
│   │                expect: 勾选态（✓）与侧栏实际显隐一致
│   └── VW-GSB-DLG  click [文件夹内搜索…] → L4: 文件夹内搜索面板 [S区 侧栏 100%高] | echo: Ctrl+Shift+F | id: globalSearch（不变）
│                    expect: 搜索视图打开且查询框聚焦
│
├── 分组「折叠」
│   ├── VW-FLA-EXE  click [折叠全部] → 全部章节折叠 | echo: — | id: foldAll（不变）
│   └── VW-UFA-EXE  click [展开全部] → 全部章节展开 | echo: — | id: unfoldAll（不变）
│
├── 分组「模式」
│   ├── VW-FCS-TGL  click [专注模式] → 切换 | echo: F8 | id: toggleFocusMode（不变）| state: checked=开
│   ├── VW-TYP-TGL  click [打字机模式] → 切换 | echo: F9 | id: toggleTypewriterMode（不变）| state: checked=开
│   └── VW-SRC-TGL  click [源码模式] → 切换 | echo: Ctrl+/ | id: toggleSourceMode（不变）| state: checked=开
│                    expect: 源码/实时预览互斥；终态回静息（PRD 状态机）
│
├── 分组「输入辅助」（开关组，勾选态即当前偏好）
│   ├── VW-AST-TGL  click [输入辅助] → 切换 | echo: — | id: toggleTypingAssists（不变）
│   ├── VW-URL-TGL  click [粘贴时包裹裸链接] → 切换 | echo: — | id: toggleWrapBareUrlOnPaste（不变）
│   └── VW-PTM-TGL  click [粘贴 HTML 转 Markdown] → 切换 | echo: — | id: togglePasteHtmlToMd（不变）
│
├── 分组「缩放」
│   ├── VW-ZIN-EXE  click [放大] → 窗口缩放 +0.5 | echo: 待入总表后回显（见 §8-2）| id: zoomIn（不变）
│   ├── VW-ZOU-EXE  click [缩小] → 窗口缩放 −0.5 | echo: 待入总表后回显（见 §8-2）| id: zoomOut（不变）
│   └── VW-ZRS-EXE  click [重置缩放] → 缩放归 100% | echo: 待入总表后回显（见 §8-2）| id: zoomReset（不变）
│
└── 分组「开发与主题」
    ├── VW-DTL-TGL  click [开发者工具] → 开关 DevTools | echo: 待入总表后回显（mac 原生 Alt+Cmd+I，见 §8-2）| id: toggleDevTools（不变）
    └── VW-THM-TGL  click [切换主题] → 深浅主题切换 | echo: Ctrl+Shift+T（冲突待裁决，见 §8-1）| id: toggleTheme（不变）
                     expect: token 级翻转，正文与控件对比度 ≥ 4.5:1（PRD M13）
```

### 3.4 L2: 插入 [T区 下拉，限高滚动 + 边缘翻转]

```text
L2: 插入 Menu → [T区 下拉] {插入}
│   重排意图: 自「编辑」迁入「选区转表格…」并与「插入表格…」去重收敛；分 表格 / 图表与容器 两组
│
├── 分组「表格」
│   ├── INS-BAR-OPN  click [插入] → L2: 插入下拉 [T区]
│   ├── INS-TBL-DLG  click [插入表格…] → L4: 插入表格 [E区 400×280px] | echo: — | id: insertTable（不变）
│   │                 expect: 空白网格插入正文；一步 undo 可还原
│   └── INS-CTB-DLG  click [选区转表格…] → L4: 选区转表格 [E区 400×240px] | echo: — | id: convertToTable（不变）
│                     precondition: 存在非空选区 | 否则 :disabled（现状 enablement 语义保持）
│
└── 分组「图表与容器」
    ├── INS-MER-DLG  click [Mermaid 图表…] → L4: Mermaid 模板选择 [E区 640×480px] | echo: — | id: insertMermaidDiagram（不变）
    │                 precondition: 光标不在代码围栏内 | 否则菜单项 :disabled（现状 App no-op 收敛为可见禁用）
    │                 fail: { 模板渲染失败: L4 内 error 态 + click [重试] }
    └── INS-CAL-DLG  click [插入 Callout…] → L4: Callout 类型选择 [E区 360×320px] | echo: — | id: insertCallout（不变）
```

#### 3.4.1 L4 落点（插入域弹窗统一终态）

```text
├── INS-TBL-CNF  click [插入] → 表格落正文 [C区] + 关闭弹窗 | expect: 焦点回正文，零布局抖动（位移 0px）
├── INS-CTB-CNF  click [转换] → 选区转表格 [C区] + 关闭弹窗 | fail: { 选区无法解析: toast("转换失败") + 保留原文 }
├── INS-MER-PIC  click [模板条目] → 围栏模板插入 [C区] + 关闭弹窗 | expect: 光标落模板占位
└── INS-CAL-PIC  click [类型条目] → Callout 骨架插入 [C区] + 关闭弹窗 | expect: 标题文案走 i18n 双字典（M10）
```

### 3.5 L2: 帮助 [T区 下拉]

```text
L2: 帮助 Menu → [T区 下拉] {帮助}
├── HLP-BAR-OPN  click [帮助] → L2: 帮助下拉 [T区]
└── HLP-MDR-EXE  click [Markdown 语法参考] → 打开内置参考文档 [C区 100%×100%] | echo: — | id: showHelp（不变）
                  expect: 以只读/示例文档标签打开；不覆盖当前文档
```

### 3.6 L2: 全局交互（菜单开合语境，PRD 6.5）

```text
├── GLO-ESC-EXE  key [Esc] / click [正文空白] → 一键回安静：收拢全部下拉/子菜单/popover/编辑态 [C区]
│                 expect: 一次触发全部收拢（非逐个关闭）；焦点回正文；终态静息，无悬空菜单
└── EVT-MNU-FLT  事件: 下拉/子菜单超出可视区（窗口下/右边缘或极小窗）→ 自动边缘翻转 + 限高内滚动
                  expect: 全部菜单项完整可达可点（可达率 100%，PRD M13）；子菜单不丢失、不裁切
```

---

## 4. L2/L3: 表格结构操作菜单（⋮ 与单元格右键同源，19 项）

> 同源契约（PRD 6.1 / 核心闭环）：⋮ 更多操作菜单与单元格右键菜单为**同一菜单面**（同 id / 同分组 / 同 toast / 同禁用规则）；工具栏 🗑 与菜单「删除表格」共用同一确认流。
> 打开入口：`TBL-MOR-OPN`（工具栏 ⋮）与 `TBL-CTX-OPN`（单元格右键）落到同一 L3 面。
> `data-op` id 为 cdp-p10/cdp-p27 探针硬契约，**全部保持不变**。

```text
L3: 表格结构操作菜单 Menu → [T区 下拉] {行操作 / 列操作 / 对齐 / 单元格 / 结构删除}
│   防溢出: 19 项必限高滚动 + 边缘翻转（AC-04：表格贴窗口底部时全部项完整可达可点）
│   回显: 有快捷键项 100% 回显（STRUCT_KEYS 单源派生）；无快捷键项右侧留空
│
├── TBL-MOR-OPN  click [⋮] → L3: 本菜单 [T区] | expect: 分组呈现，快捷键列就位
├── TBL-CTX-OPN  contextmenu [单元格] → L3: 本菜单 [T区]（同一菜单面）| expect: 与 ⋮ 完全一致
│
├── 分组「行操作」
│   ├── TBL-IRA-EXE  click [在上方插入行] → 锚定单元格上方插空行 | echo: Ctrl+Shift+Enter（新增键位，必回显）| data-op: insertRowAbove（不变）
│   │                 precondition: 非首行表头保护规则见下；单事务 + 一步 undo
│   ├── TBL-IRB-EXE  click [在下方插入行] → 锚定单元格下方插空行 | echo: Ctrl+Enter | data-op: insertRowBelow（不变）
│   ├── TBL-RMU-EXE  click [上移该行] → echo: Alt+↑ | data-op: moveRowUp（不变）
│   │                 precondition: 非首行 | 首行（表头）:disabled 灰显（AC-09，灰显即语义）
│   ├── TBL-RMD-EXE  click [下移该行] → echo: Alt+↓ | data-op: moveRowDown（不变）
│   │                 precondition: 非末行 | 末行 :disabled
│   └── TBL-DRW-EXE  click [删除行] → L5: toast("行已删除") | echo: — | data-op: deleteRow（不变）
│                     precondition: 行数 >1 | 1 行表 :disabled（PRD M11 删至最小表）| 一步 undo 可还原
│
├── 分组「列操作」
│   ├── TBL-ICL-EXE  click [在左侧插入列] → 锚定单元格左侧插空列，默认左对齐 | echo: Ctrl+Shift+←（新增键位，必回显）| data-op: insertColLeft（不变）
│   ├── TBL-ICR-EXE  click [在右侧插入列] → 锚定单元格右侧插空列，默认左对齐 | echo: Ctrl+Shift+→（新增键位，必回显）| data-op: insertColRight（不变）
│   ├── TBL-CML-EXE  click [左移该列] → echo: Alt+← | data-op: moveColLeft（不变）
│   │                 precondition: 非首列 | 首列（表头列）:disabled 灰显（PRD 6.1 表头保护）
│   ├── TBL-CMR-EXE  click [右移该列] → echo: Alt+→ | data-op: moveColRight（不变）
│   │                 precondition: 非末列 | 末列 :disabled
│   └── TBL-DCL-EXE  click [删除列] → L5: toast("列已删除") | echo: — | data-op: deleteCol（不变）
│                     precondition: 列数 >1 | 1 列表 :disabled | 一步 undo 可还原
│
├── 分组「对齐」（与工具栏对齐三键同 op、同回显）
│   ├── TBL-ALL-EXE  click [左对齐] → 写入冒号行并即时回显 | echo: — | data-op: alignLeft（不变）
│   ├── TBL-ALC-EXE  click [居中对齐] → echo: — | data-op: alignCenter（不变）
│   └── TBL-ALR-EXE  click [右对齐] → echo: — | data-op: alignRight（不变）
│
├── 分组「单元格」
│   ├── TBL-CTC-EXE  click [剪切单元格] → 清空单元格 + 入剪贴板 | echo: — | data-op: cutCell（不变）
│   ├── TBL-CPY-EXE  click [拷贝单元格] → 单元格文本入剪贴板 | echo: — | data-op: copyCell（不变）
│   └── TBL-PST-EXE  click [粘贴单元格] → 覆写单元格 | echo: — | data-op: pasteCell（不变）
│                     fail: { 剪贴板为空: 无事发生; 写失败: toast("复制失败") }
│
└── 分组「结构删除」（危险动作聚组：删除类收敛一组，视觉弱化/危险色由设计规范定）
    ├── TBL-CPB-EXE  click [拷贝表格] → L5: toast("表格已复制") | echo: — | data-op: copyTable（不变）
    ├── TBL-FTS-EXE  click [格式化表格源码] → L5: toast("表格源码已格式化") / toast("表格无需格式化")
    │                 echo: — | data-op: formatTableSource（不变）
    └── TBL-DTB-CNF  click [删除表格] → L4: 删除表格确认 [D区 400×200px] | echo: — | data-op: deleteTable（不变）
```

### 4.1 L4: 删除表格确认 [D区 400×200px]

```text
├── 内容节点: 文案按 PRD M11 目标态——「删除后可用一步撤销还原，确认删除该表格」
│            （现状 i18n 为「此操作无法撤销」，与 PRD 目标态冲突 → §8-3 联动修正）
├── TBL-DTB-EXE  click [确认删除] → 整表删除 + L5: toast("表格已删除") | expect: 一步 undo 可还原整表（AC-15）
└── TBL-DTB-CAN  click [取消] → 关闭弹窗，表格原样 | expect: 终态回静息，无残留高亮
```

### 4.2 表格结构菜单快捷键回显清单（新增键位是本期承诺）

| 菜单项 | data-op（不变） | 回显快捷键 | 键位来源 |
|---|---|---|---|
| 在上方插入行 | insertRowAbove | Ctrl+Shift+Enter | 新增 Shift 升档键位 |
| 在下方插入行 | insertRowBelow | Ctrl+Enter | STRUCT_KEYS 既有 |
| 上移该行 | moveRowUp | Alt+↑ | STRUCT_KEYS 既有 |
| 下移该行 | moveRowDown | Alt+↓ | STRUCT_KEYS 既有 |
| 在左侧插入列 | insertColLeft | Ctrl+Shift+← | 新增 Shift 升档键位 |
| 在右侧插入列 | insertColRight | Ctrl+Shift+→ | 新增 Shift 升档键位 |
| 左移该列 | moveColLeft | Alt+← | STRUCT_KEYS 既有 |
| 右移该列 | moveColRight | Alt+→ | STRUCT_KEYS 既有 |
| 其余 11 项（删除行/列、对齐三键、单元格三项、拷贝表格、格式化表格源码、删除表格） | 各自 id | 无快捷键 → 右侧留空 | — |

> 新增 4 个 Shift 升档键位须**双源同步**（渲染端键表 + 表格 STRUCT_KEYS/菜单回显），回显由总表派生（PRD M10 风险「快捷键双源漂移」的缓解措施）。

---

## 5. 防溢出与可达性约束（统辖全部下拉/子菜单）

| # | 约束 | 适用面 | 验收锚点 |
|---|---|---|---|
| 1 | 限高滚动：下拉/子菜单最大高度 = 窗口可视高 − 菜单栏高 − 边距，超出内滚动 | 全部 L2/L3 菜单（视图 15 项、表格菜单 19 项为最高风险面） | AC-04 / AC-12 |
| 2 | 边缘翻转：靠近窗口下缘整菜单上翻、靠右缘子菜单左翻 | 全部下拉与子菜单 | AC-12 |
| 3 | 子菜单 hover 延展不丢失：移入路径不因翻转/滚动断链；移回父项不关闭 | 打开最近 / 导出 / 格式 / Callout 类型 | AC-12 |
| 4 | 窗口极窄/极小（min 640×400）：菜单自适应收紧/滚动，不裁切不可达 | 全部菜单 | PRD M11 环境异常 |
| 5 | 展开响应 ≤200ms；菜单内滚动不重排父级位置 | 全部下拉 | PRD M13 性能 |
| 6 | 深浅主题下菜单文字/快捷键列对比度 ≥ 4.5:1 | 全部下拉 | AC-18 |

---

## 6. 顶部菜单栏快捷键回显矩阵（目标态）

> 「回显」列全为「必显」的项 = 有快捷键命令，回显率 100%（AC-11）；「—」= 无快捷键，右侧留空。
> 全部 id 保持不变。

| 菜单 | 菜单项 | id（不变） | 回显 | 备注 |
|---|---|---|---|---|
| 文件 | 新建 | newFile | Ctrl+N | |
| 文件 | 打开… | openFile | Ctrl+O | |
| 文件 | 打开文件夹… | openFolder | Ctrl+Shift+O | |
| 文件 | 快速打开… | quickOpen | Ctrl+P | |
| 文件 | 打开最近 ▸ | — | — | 子菜单父项 |
| 文件 | 保存 | saveFile | Ctrl+S | |
| 文件 | 另存为… | saveFileAs | Ctrl+Shift+S | |
| 文件 | 关闭标签 | closeTab | Ctrl+W | |
| 文件 | 重新打开已关标签 | reopenClosedTab | Ctrl+Shift+T | §8-1 冲突待裁决 |
| 文件 | 下一个标签 | nextTab | Ctrl+Tab | |
| 文件 | 导出 ▸ | — | — | 子菜单父项 |
| 文件 | PDF… | exportPdf | — | |
| 文件 | HTML… | exportHtml | — | |
| 文件 | 偏好设置… | openPreferences | Ctrl+, | |
| 编辑 | 撤销 | undo | Ctrl+Z | |
| 编辑 | 重做 | redo | Ctrl+Y | |
| 编辑 | 剪切 | cut | Ctrl+X | |
| 编辑 | 复制 | copy | Ctrl+C | |
| 编辑 | 粘贴 | paste | Ctrl+V | |
| 编辑 | 复制为富文本 | copyRichText | Ctrl+Shift+C | |
| 编辑 | 复制为 HTML | copyAsHtml | — | |
| 编辑 | 全选 | selectAll | Ctrl+A | |
| 编辑 | 查找 | find | Ctrl+F | |
| 编辑 | 格式化文档 | formatDocument | Shift+Alt+F | |
| 编辑 | 格式 ▸ | — | — | 子菜单父项 |
| 编辑 | 加粗 | bold | Ctrl+B | |
| 编辑 | 斜体 | italic | Ctrl+I | |
| 编辑 | 行内代码 | inlineCode | Ctrl+E | |
| 编辑 | 删除线 | strikethrough | — | |
| 编辑 | 高亮 | highlight | — | |
| 编辑 | 导出选区为 HTML… | exportSelectionHtml | — | precondition: 有选区 |
| 视图 | 切换大纲 | toggleOutline | — | |
| 视图 | 文件夹内搜索… | globalSearch | Ctrl+Shift+F | |
| 视图 | 折叠全部 | foldAll | — | |
| 视图 | 展开全部 | unfoldAll | — | |
| 视图 | 专注模式 | toggleFocusMode | F8 | 开关勾选 |
| 视图 | 打字机模式 | toggleTypewriterMode | F9 | 开关勾选 |
| 视图 | 源码模式 | toggleSourceMode | Ctrl+/ | 开关勾选 |
| 视图 | 输入辅助 | toggleTypingAssists | — | 开关勾选 |
| 视图 | 粘贴时包裹裸链接 | toggleWrapBareUrlOnPaste | — | 开关勾选 |
| 视图 | 粘贴 HTML 转 Markdown | togglePasteHtmlToMd | — | 开关勾选 |
| 视图 | 放大 | zoomIn | 待定 | §8-2 双源补总表 |
| 视图 | 缩小 | zoomOut | 待定 | §8-2 |
| 视图 | 重置缩放 | zoomReset | 待定 | §8-2 |
| 视图 | 开发者工具 | toggleDevTools | 待定 | §8-2（mac 原生 Alt+Cmd+I） |
| 视图 | 切换主题 | toggleTheme | Ctrl+Shift+T | §8-1 冲突待裁决 |
| 插入 | 插入表格… | insertTable | — | |
| 插入 | 选区转表格… | convertToTable | — | precondition: 有选区 |
| 插入 | Mermaid 图表… | insertMermaidDiagram | — | |
| 插入 | 插入 Callout… | insertCallout | — | |
| 帮助 | Markdown 语法参考 | showHelp | — | |

---

## 7. 节点编号索引（全局唯一性检查）

| 编号段 | 域 | 节点数 |
|---|---|---|
| FIL-* | 文件菜单及其子菜单/弹窗 | 20 |
| EDT-* | 编辑菜单及其子菜单 | 18 |
| VW-* | 视图菜单 | 16 |
| INS-* | 插入菜单及其弹窗 | 9 |
| HLP-* | 帮助菜单 | 2 |
| TBL-* | 表格结构操作菜单及确认弹窗 | 23 |
| GLO-* / EVT-* | 全局交互/事件 | 2 |
| 合计 | — | 90（全局唯一） |

> 全部编号 3 段式、每段 ≤4 字符、跨域无重复（FIL-CTB 与 TBL-CPB 已避让）。

---

## 8. 开放裁决点与联动修正（期 3 前须闭环）

| # | 事项 | 现状 | 目标 | 归属 |
|---|---|---|---|---|
| 1 | **Ctrl+Shift+T 一键双命令**：`reopenClosedTab` 与 `toggleTheme` 均 `shortcut: 'Ctrl+Shift+T'` 且均 bindGlobal | 回显与实际键位无法同时一致 | 裁决归属（行业习惯：Ctrl+Shift+T 更常给"重开关闭项"；主题切换可让位 F9 同族或无快捷键），总表定稿后回显 | 设计规范 · 快捷键总表 |
| 2 | **缩放/开发者工具键位双源漂移**：mac 原生菜单有 `Cmd+Plus / Cmd+- / Cmd+0 / Alt+Cmd+I`，渲染端注册表无 `shortcut` 字段 | 两端加速键不一致、在应用菜单无回显 | 四键纳入快捷键总表（注册表 `shortcut` + `DARWIN_COMMAND_ACCELERATORS` 双源同步），菜单 100% 回显 | M10 快捷键双源 |
| 3 | **删除表格确认文案冲突**：PRD M11 目标「删除后可用一步撤销还原，确认删除该表格」；现状 i18n `ctx.deleteTableConfirm`「此操作无法撤销」 | 与 PRD 冻结契约不符 | 按 PRD M11 目标文案改 i18n（en/zh 双字典同步），一步 undo 能力保持 | M10 i18n 联动 |
| 4 | 表格菜单分组取舍：PRD 点名四组（行操作/列操作/对齐/结构删除），单元格剪贴板三项归组未点名 | 现状平铺 | 本树提案独立「单元格」组；若规范定稿要求严格四组，单元格三项并入行/列组或保留分隔线子簇（id 不变） | 设计规范 · 信息架构 |
| 5 | 候选扩充（**本期非承诺**，仅登记）：`foldSection`（Ctrl+Alt+[）/`unfoldSection`（Ctrl+Alt+]）补入视图·折叠组；`heading1-6 / paragraph / blockquote / listUl / listOl / taskList / code / clearFormat / lift / insertLink`（Ctrl+Shift+L）补入「格式 ▸」段落子组；`copyAsMarkdown / copyAsPlainText` 补入剪贴板组 | 注册表已有命令未进菜单栏 | 由设计规范按 Need Gate 取舍；若采纳，回显率要求同步适用 | 设计规范 · 信息架构 |
| 6 | 「格式」子菜单仅 5 项与命令面（含块级格式命令）不对称 | — | 与 #5 合并裁决 | 设计规范 |

---

## 9. e2e 缝硬契约清单（全部"保持不变"）

| 契约面 | 内容 | 约束 |
|---|---|---|
| 命令 id（菜单栏） | newFile / openFile / openFolder / quickOpen / saveFile / saveFileAs / openPreferences / exportPdf / exportHtml / showHelp / undo / redo / cut / copy / paste / copyRichText / copyAsHtml / selectAll / find / formatDocument / bold / italic / inlineCode / strikethrough / highlight / exportSelectionHtml / insertTable / convertToTable / toggleOutline / globalSearch / foldAll / unfoldAll / toggleFocusMode / toggleTypewriterMode / toggleSourceMode / toggleTypingAssists / toggleWrapBareUrlOnPaste / togglePasteHtmlToMd / zoomIn / zoomOut / zoomReset / toggleDevTools / toggleTheme / insertMermaidDiagram / insertCallout / nextTab / closeTab / reopenClosedTab | id 字面量被 cdp 探针静态扫描；菜单重排**不得改 id** |
| data-op（表格菜单） | insertRowAbove / insertRowBelow / deleteRow / insertColLeft / insertColRight / deleteCol / moveRowUp / moveRowDown / moveColLeft / moveColRight / alignLeft / alignCenter / alignRight / cutCell / copyCell / pasteCell / copyTable / formatTableSource / deleteTable | cdp-p10/p27 契约；⋮ 与右键同面不得分叉 |
| 键位单源 | 表格 `STRUCT_KEYS`（含本期新增 4 键位）| 菜单回显由此派生，禁止菜单侧硬编码键位文案 |
| 其他 e2e 缝 | window.__velox 系列 / data-table-handle | 本次菜单改造不触碰 |

---

## 10. 编码映射补充

**跳过**——模块配置 M14（encoding-source 配置）未激活，本需求无编码映射场景，按约定不做编码映射补充。

---

## 附录 A：macOS 原生菜单差异对照（只读现状对照，非 Windows/Linux 菜单栏范围）

| 原生菜单 | 项 | 说明 |
|---|---|---|
| VeloxMark（App） | 关于 / 服务 / 隐藏 / 隐藏其他 / 全部显示 / 偏好设置… / 退出 | 系统级 role；「偏好设置」复用命令 id `openPreferences`（不变） |
| 文件 | 同业务项 + 「关闭窗口」role | 标签命令不挂原生加速键（Ctrl+W 走 before-input 标签感知路由） |
| 编辑 | 剪切/复制/粘贴/粘贴并匹配样式/删除/全选 + 复制为富文本/复制为 HTML + 格式 ▸ | 原生 role 与 CM6 keymap 并存；格式子菜单**不挂原生加速键**（避免拦截 Mod-B/I/E） |
| 视图 | 业务项 + 缩放三项（Cmd+Plus/Cmd+-/Cmd+0）+ 开发者工具（Alt+Cmd+I） | 见 §8-2：加速键须入总表以满足回显一致率 |
| 窗口 | 最小化 / 缩放 / 全屏 / 前置 | 系统级 role，无命令 id |

> 原生菜单 label 走 `NATIVE_MENU_STRINGS`（i18n 第 3 份字典）；本次菜单信息架构重排落地时，原生菜单分组须与本树对齐（M10 i18n / 快捷键双源联动），命令 id 契约不变。

---

## 附录 B：菜单项计数口径

- 计数单位：可选中叶子项 + 子菜单父项；**不含**分隔线、动态「打开最近」条目、弹窗内部按钮。
- 顶部菜单栏固定项：**52**（文件 12 含 2 父项 + 打开最近子菜单 1 + 导出子菜单 2 + 编辑 12 含 1 父项 + 格式子菜单 5 + 视图 15 + 插入 4 + 帮助 1）。
- 表格结构操作菜单：**19**。
- 合计固定菜单项：**71**（叶子 68 + 子菜单父项 3）；另有动态最近条目 N（空态为「暂无最近文件」禁用项）。
