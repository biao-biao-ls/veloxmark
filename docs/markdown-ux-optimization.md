# Markdown 渲染 UX 优化 — 实施看板

> **定位**：本文件是与 [refactor-tasks.md](refactor-tasks.md) **平行**的规格化 Backlog（不向其续写），专门收纳 **Markdown 渲染/编辑的 UX 与操作便捷性** 优化任务。任务推进仍走 [sdd-workflow.md](sdd-workflow.md) 的 spec → plan → implement → converge 循环，spec 单元落 `docs/specs/<task-id>/`；**收敛看板是本文件的优先级队列**，勾 checkbox 在此，不动 refactor-tasks.md。
>
> **Constitution 不变**：所有 spec/plan 不得与 [CLAUDE.md](../CLAUDE.md)（根 + electron/ + src/renderer/）冲突；冲突时先改宪法。
>
> **Converge 验收恒定**：`npm run typecheck && npm run test:unit` 通过 + e2e 缝未破坏 + 勾销本文件对应 checkbox；行为不变类任务需人工冒烟确认 UI 无回归。
>
> **清单结构**：「实施优先级」是唯一任务清单与执行顺序（checkbox 唯一来源）；「批次对照」各章是按 Markdown 元素归档的现状对照表与已领先记录，供 spec 阶段引用，不含 checkbox。

## 实施优先级（执行顺序）

**排序原则**：
1. 功能缺口（对标 Typora 做不到的操作）> 效率/可发现性（做得到但慢/难发现）> 观感（好看）；
2. 纯逻辑、低风险先行；UI 大改靠后但**同构机制集中设计**（8.2/10.1 共用「块内源码/预览双区」机制）；
3. 依赖方向：被依赖项先行（7.1→7.2→7.6；7.4/7.5/7.9→7.3；9.1→10.3；8.2→8.1 入口语义）；
4. 任务编号保持元素批次号（7.x 表格 / 8.x 公式 / 9.x 代码 / 10.x mermaid / 11.x 跨元素）——spec id 命名（`7A-*`…）与编号绑定，**不因排序重编号**；
5. 探索类（P3）需先补 Typora 基准截图 + 现状对照表才立项，不占前排。

### P0 — 操作能力缺口（对标 Typora 缺功能，必做）

- [x] **① 7.1 行/列移动操作**（spec `7A-table-move-ops`）——**全局性价比最高，起点**
  `ops.ts` 增加 `moveRowOp`/`moveColOp`（交换相邻行/列，列移动时 `aligns` 随列走），右键菜单补「上移该行 / 下移该行 / 左移该列 / 右移该列」4 项。纯函数 + `ops` 单测；菜单 id 进 cdp 契约时同步 `opsTable.ts` id 字面量注释。
  AC：任意行/列可上/下/左/右移动；首行（表头）不上移、首列不左移（按钮禁用或 no-op 语义在 plan 定）；undo 一步还原；移动列后对齐属性跟随。

- [x] **② 7.2 表格结构操作快捷键**（spec `7B-table-shortcuts`，依赖 ①）
  编辑表格时绑定 Ctrl+Enter（下方插行）、Alt+↑/↓（移行）、Alt+←/→（移列），与 Typora 一致。落点：`keymap.ts`（嵌套单元格编辑态）+ 主编辑器/生命周期侧（激活态未进单元格时）。
  AC：快捷键仅在表格编辑激活态生效，不劫持全局；与 ① 菜单项同 userEvent/同 toast 语义；`shortcutSync` 相关测试若涉及须同步。

- [x] **③ 8.2 公式编辑态源码/预览并排**（spec `8B-math-edit-preview`）——**公式 UX 头号差距**
  聚焦编辑 `$$…$$` 时不再整块塌回裸源码：改为**上方源码区（语法着色）+ 下方实时 KaTeX 预览**，右上「公式 ✓」chip 点击/Escape 退出回纯渲染态（对照 `math-focus.png`）。实现倾向：仿 mermaid P25 的"源码在文档、预览为投影"路线或嵌套编辑器（对照表格 nestedSession 先例），plan 择一；本项沉淀「块内源码/预览双区」共用机制，④ 直接复用。
  AC：编辑时 KaTeX 实时刷新（可接受 debounce）；无效 TeX 时预览区显示错误态但源码可继续编辑；「公式 ✓」+ Escape 均可退出；undo 语义不破坏；行内公式编辑行为不变（17 另管）。

- [ ] **④ 10.1 mermaid 编辑态源码/预览就地并排**（spec `10A-mermaid-edit-preview`，依赖 ③ 的双区机制）——**mermaid UX 头号差距**
  聚焦 mermaid 时改为**图表位置就地**「源码区 + 实时预览」上下并存（对照 `mermaid-focus.png`），替代/并联 P25 底部面板（plan 决策：就地预览为主、底栏降级为可选或退役）。与 ③ 同属"块内源码/预览双区"模式，spec 显式对齐共用机制。
  AC：编辑时预览在图表原位置实时刷新；错误时沿用 last-good dim + 错误条 + 跳源码；退出编辑回纯渲染；P25 行为去留在 plan 写明。

- [ ] **⑤ 7.5 已有表格的行列规模网格选择器**（spec `7E-table-resize-grid`）
  复用 `TableInsertDialog` 的 20×12 网格交互做成工具栏 ⊞ popover：向右/下拖 = 加行/列，向左/上拖 = 删行/列，底部「R × C」读数（对照 `table-btn-4.png` 增删改菜单旁的 `table-btn-1.png` 网格选择器）。一次 transaction（undo 一步）。
  AC：扩/缩整表一次完成；缩到 1×1 边界不再缩；对齐数组随列增删正确伸缩；popover 键盘可达（方向键 + Enter）。

- [ ] **⑥ 7.3 编辑态表格工具栏**（spec `7C-table-toolbar`，依赖 ⑤ 的 ⊞ 语义 + 下述 7.4/7.9 按钮语义，一次落地三件套）
  聚焦表格时顶部浮现统一工具栏（现成模式：`BlockWidget.attachBlockToolbar` / 图片 toolbar）：左「行列数 ⊞ + 对齐三键」，右「⋮ 更多操作 + 🗑 删除」。**含 7.4**：对齐三键一键切换当前列 `aligns`，按钮按下态回显（对照 `table-focus.png`）；**含 7.9**：🗑 一键触发删除表格，保留现有确认框作安全垫。散落的 +/− 把手保留为直达入口或退役（plan 决策）。
  AC：工具栏仅编辑态可见、离开即隐；对齐三键与右键菜单对齐项同源（同 `setAlignOp`）且状态回显与源码冒号行一致；删除与右键「删除表格」同 confirm/同 toast；e2e 缝不破坏（见约束）；布局抖动不回归（UX-P28 F3 零布局抖动契约）。

### P1 — 效率与可发现性

- [ ] **⑦ 9.1 语言 chip 右下角化 + 可点击切换语言**（spec `9A-code-lang-chip`）——**代码块核心交互缺口**
  聚焦态语言 chip 移到右下角（对照 `code-focus.png`），点击弹出语言列表（常用语言 + 搜索，复用 ListPickDialog 模式），选择后改写 fence info 串。**含 9.3**：语言 id 显示为可读名称（`typescript` → `TypeScript`），列表常用优先；未知 id 原样显示。开栏处的 CodeLangChip 可退役或保留双处同步（plan 决策）。
  AC：选语言后高亮即时切换；非法/未知语言名不崩；chip 仅聚焦态可见；常见语言显示名正确。

- [x] **⑧ 8.1 公式 hover 提示带**（spec `8A-math-hover-hint`；可提前并入 ③ 的 spec 一并做——chip 本就是双区编辑的入口）**已并入 8B 一并收敛（2026-09-24）**
  hover 块级公式时显示整行浅灰底纹带 + 右上「公式 `</>`」chip（对照 `math-hover.png`），点击公式或 chip 进入源码编辑。纯 CSS/装饰层，不改 P09 语义。
  AC：hover 有底纹 + chip；移出即隐；深浅主题走 token；点击行为与现 click-to-source 一致（③ 落地后即进双区编辑）。

- [ ] **⑨ 7.6 菜单快捷键提示**（spec `7B` 内或独立，依赖 ②）
  `opsTable.ts` 表单项填 `shortcut`（② 绑定后），菜单右列渲染提示（对照 `table-btn-4.png` 观感）。
  AC：有快捷键的项均显示提示；无快捷键项不占位；mac 下显示 ⌘ 风格（走现有 `fmtShortcut`）。

- [ ] **⑩ 8.4 KaTeX 错误态补跳源码入口**（spec `8C-math-error-nav`）
  公式渲染失败时错误条提供「跳到源码」按钮（对照 mermaid `cm-md-mermaid-jump` 同款交互）。
  AC：错误条可点击定位到 `$$` 起点；正常渲染时无错误条。

- [ ] **⑪ 10.3 「mermaid」聚焦提示 chip + 语言切换**（spec `10A` 内，依赖 ⑦ 的语言列表）
  聚焦态右上/右下角显示语言 chip（对照 `mermaid-focus.png`），点击可切换 fence 语言（mermaid ↔ 普通代码，与 ⑦ 共用语言列表）。
  AC：切走 mermaid 后按普通代码块渲染；切回即恢复图表渲染。

- [ ] **⑫ 7.7 列宽跨会话持久化**（spec `7F-colwidth-persist`；**决策后实施**）
  `colWidths` 现为会话级 Map（`state.ts`）。持久化方案：元数据侧车（不污染 .md 正文，符合「Markdown 唯一数据源」）或按文件路径存 preferences store（plan 择一，[NEEDS CLARIFICATION: 侧车文件形态与 .gitignore 策略需产品决策]）。
  AC：重开文件列宽保持；文档行列数变化时陈旧宽度合理失效或钳制；不向 .md 写入非 Markdown 内容。

### P2 — 观感对齐

- [ ] **⑬ 9.2 静息态去语言顶栏**（spec `9B-code-idle-chrome`）
  对照 `code-default.png`：静息态去掉横贯的 `.cm-md-code-lang` 顶栏，语言降级为 hover/聚焦时的角标（或并入 ⑦ 的右下角 chip）。涉及 widget 结构与 `export/renderDoc` 平行契约同步。
  AC：静息态观感与 `code-default.png` 一致（圆角灰底 + 高亮、无横条）；复制/折叠按钮不回退；导出 HTML 样式同步。

- [ ] **⑭ 10.2 mermaid 静息态去边框盒**（spec `10B-mermaid-idle-chrome`）
  对照 `mermaid-default.png`：静息态改为无边框/无底色（或仅 hover 时浮现轻边框），导出侧平行契约同步。
  AC：观感与 `mermaid-default.png` 对齐；错误条/更新中 badge 不回退。

- [ ] **⑮ 7.8 表格静息态零 chrome / 与正文列对齐**（spec `7G-table-idle-chrome`，全清单风险最高项，单独排期）
  56px/28px 常驻预留槽（UX-P28 F3 零抖动代价）导致表格缩进脱离正文列。方案：编辑态才撑开槽位 + overlay/transform 吸收抖动，或把手改 overlay 不占 layout。**零布局抖动契约不得回退**——编辑态进/出仍不许推挤正文。
  AC：静息态表格与正文同列、上方无 28px 空隙；进/出编辑态正文零位移（或位移 ≤ 1px 且 plan 中论证）；把手不遮挡单元格文本。

- [ ] **⑯ 7.10 表格静息态视觉微调**（spec `7H-table-visual-tune`）
  对照 `table-default.png`：表头底色更浅、th 下边框 1px 统一细线（现 2px）等；改色走 `export/palette.ts` 单源 + `palette.test.ts` 对齐流程。
  AC：深浅主题各冒烟一张对照截图；palette 测试通过；不新增 `.theme-dark` 选择器补丁。

- [ ] **⑰ 8.3 行内公式 hover 高亮**（spec `8A` 内或独立）
  行内公式 hover 显示浅色底纹提示可点击编辑；点击行为沿用 markTouched 显源码。
  AC：仅视觉提示，不改显隐契约；选区触碰显源码（P09）不变。

- [ ] **⑱ 11.9 「块级 chrome 规范」定稿**（横向收口，建议 ③⑦⑧⑪ 收敛期一并做）
  表格/公式/代码/mermaid 的 hover chip、聚焦 chip、工具栏位置现在各自为战（表格顶部工具栏、块右上 hover 工具栏、mermaid badge 左上）。把各批次落地后的实际形态收口为一份「块级 chrome 规范」附录（位置/显隐时机/点击语义），后续元素（P3）按规范长 UI，不再逐块发明。
  AC：规范附录落在本文件或 `docs/specs/`；③⑦⑧⑪ 实际形态与规范一致（不一致处要么改代码要么改规范，显式记录）。

### P3 — 探索储备（先补基准截图 + 对照表再立项，不占前排）

无 Typora 基准截图的元素先立**方向**不立 AC；进入实施前补基准截图 + 现状对照表（同批次门槛）。按"预期收益 / 实现成本"初排：

- [ ] **11.1 图片编辑体验**（预期收益高）
  Typora：点击图片出现尺寸拖拽 + 对齐按钮浮层。我们已有 P05 选中态/缩放滑杆/翻转（`editor/widgets.ts` ImageWidget），可补：角点拖拽改宽高、对齐（左/中/右/独行）写回 HTML `<img>` 属性或标题后缀。风险：图片尺寸的 Markdown 单源表达（` =WxH` 后缀 vs HTML 标签）需 spec 定夺。
- [ ] **11.2 链接 hover 编辑浮层**（收益高）
  hover 内联链接显示可编辑 URL 浮层（点击改地址 / 外开 / 复制），免去进源码手改 `[]()`。现只有 linkNav（Ctrl+点击外开）。注意宪法：外部链接只走 `shell.openExternal`。
- [ ] **11.3 引用块折叠/展开**（收益中）
  长引用（> N 行）hover 出折叠，点击折叠为摘要行——与 P24 代码折叠同模式复用。
- [ ] **11.4 列表/任务项 hover 快捷操作**（收益中）
  hover 行首出「拖拽把手 + 勾选」微操作；任务项完成态划线样式核对（5A 已修渲染，本项是操作面）。
- [ ] **11.5 标题锚点/折叠**（收益中）
  hover 标题左侧出折叠三角（章节折叠，Typora 原生）；与 5D/6.x 大纲联动（点大纲跳转已有，折叠状态可同步）。
- [ ] **11.6 脚注 hover 预览**（收益低）
  hover 脚注引用弹定义内容预览卡，免跳转（现已有跳转/回跳，UX-P11）。
- [ ] **11.7 行内代码/强调 hover 提示**（收益低）
  hover 行内代码显示"点击编辑"轻提示；与 ⑱ 规范对齐。
- [ ] **11.8 分隔线/front-matter 观感核对**（收益低）
  hr 线宽/间距、front-matter 卡片折叠态与 Typora 逐项对表（extendedSyntax 已有卡片，缺对照基准）。

## 基准素材

与专业 Markdown 软件 **Typora** 的截图对照（2026-09-24）：

| 截图 | 内容 |
|---|---|
| `temp/typora/table-default.png` | 表格静息态默认 UI（1px 细边框、浅灰表头、斑马纹、零 chrome、与正文列对齐） |
| `temp/typora/table-focus.png` | 表格编辑态 UI：顶部浮现工具栏——左「行列数 ⊞ + 左/中/右对齐三键」，右「⋮ 更多操作 + 🗑 删除」 |
| `temp/typora/table-btn-1.png` | 行列数网格选择器 popover：Excel 式 N×M 拖选（读数 `3 × 4`），一拖完成整表扩/缩（= 工具栏第 1 按钮） |
| `temp/typora/table-btn-4.png` | 「行列增删改」菜单：上/下插行（Ctrl+Enter）、左/右插列、上移/下移该行（Alt+↑↓）、左移/右移该列（Alt+←→）、删除列、复制表格、格式化表格源码、删除表格——**菜单右列回显快捷键**（= 工具栏第 5 按钮） |
| `temp/typora/math-default.png` | 公式静息态：KaTeX 居中渲染、**零 chrome**；行内公式随文渲染 |
| `temp/typora/math-hover.png` | 公式 hover 态：整行浅灰**底纹带** + 右上「公式 `</>`」提示 chip（点击进入源码编辑） |
| `temp/typora/math-focus.png` | 公式聚焦态：上方 `$$…$$` 源码区（可编辑、着色）+ 下方**实时渲染预览** + 右上「公式 ✓」确认 chip |
| `temp/typora/code-default.png` | 代码块静息态：圆角灰底 + 语法高亮，**无语言顶栏**、零 chrome |
| `temp/typora/code-focus.png` | 代码块聚焦态：就地编辑 + **右下角「typescript」语言 chip**（点击切换语言） |
| `temp/typora/mermaid-default.png` | mermaid 静息态：干净渲染图（白底、无边框盒） |
| `temp/typora/mermaid-focus.png` | mermaid 聚焦态：上方源码区 + 下方**实时渲染预览** + 「mermaid」chip |

> 注：读图曾出现批量错位，已按**内容**逐张归位核对：两图归属与会话原文描述一致（btn-1 = 网格选择器、btn-4 = 增删改菜单），此前「归属写反」的注记作废。

## 批次对照（背景资料，无 checkbox）

### 表格（任务 7.x）

| 维度 | Typora | VeloxMark 现状 | 锚点 |
|---|---|---|---|
| 静息态外观 | 零 chrome、与正文列对齐 | 视觉接近，但 wrap 常驻 `padding-left:56px + padding-top:28px` 把手预留槽，表格与正文列不对齐 | `styles/markdown.css` `.cm-md-table-wrap` |
| 编辑态入口 | 顶部浮现统一工具栏 | 无工具栏；+/− 把手散在左槽（行）/顶槽（列）+ 列宽 grip；hover 块工具栏仅「复制」 | `editor/table/widget.ts` `addRowHandles`/`addColHandles`/`attachBlockToolbar` |
| 行列数量调整 | ⊞ 网格选择器一拖扩/缩整表 | 只能逐次点 +/−；网格选择器仅限**新建**对话框 | `components/TableInsertDialog.tsx` |
| 对齐 | 工具栏三键一键切换 + 状态回显 | 仅右键菜单 3 项，无状态回显 | `editor/contextMenu/opsTable.ts` |
| 行列增删改 | 含**上移/下移该行、左移/右移该列** | 缺移动行/列 4 项（全仓无 moveRow/moveCol），其余齐全 | `editor/table/ops.ts` |
| 快捷键 | Ctrl+Enter 插行、Alt+方向键移行列，菜单回显 | 结构操作零快捷键；单元格内仅 Tab/Shift-Tab/Enter/Shift-Enter/Escape | `editor/table/keymap.ts` |
| 菜单快捷键提示 | 右列回显 | `CtxMenuItem.shortcut` 字段已有但表单项全未填 | `editor/contextMenu/types.ts` L52 |
| 列宽 | 表头缘拖拽，跨会话记住 | 有 col-grip 拖拽，但 `colWidths` 仅存 `tableEditField`，重开即丢 | `editor/table/state.ts` |
| 删除表格 | 工具栏 🗑 直达 | 仅右键菜单（带确认框），工具栏无可见入口 | `opsTable.ts` `deleteTable` |

**已领先/对齐、无需跟**（防重复建设）：TSV 粘贴自动扩表（`pasteTsvOp`）、选区转表格 + 分隔符嗅探（P22）、Tab 末格自动加行、Shift-Enter 单元格内换行、单元格嵌套 CM6 实时预览、复制表格/格式化表格源码/删除表格确认框、结构操作 toast 反馈。

### 数学公式（任务 8.x）

现状锚点：`editor/widgets-math.ts`（MathBlockWidget/InlineMathWidget）、`editor/livePreview/handlers-math.ts`（正则 pass）、`styles/markdown.css` `.cm-md-math-*`、hover 工具栏仅「复制 TeX」一项。

| 维度 | Typora | VeloxMark 现状 | 锚点 |
|---|---|---|---|
| 静息态 | 居中渲染、零 chrome | 对齐（`.cm-md-math-block` 居中无边框） | `markdown.css` L583 |
| hover 态 | 整行浅灰底纹带 + 右上「公式 `</>`」chip，明确告知"可点击进源码" | 无 hover 反馈（仅 `cursor:pointer`），hover 块工具栏只出现「复制」 | `blockWidget.ts` |
| 聚焦/编辑态 | **源码区 + 实时预览上下并存**，右上「公式 ✓」chip 确认退出；所见即所得 | `blockTouched` 整块塌回裸 `$$…$$` 源码，**无实时预览**——编辑时完全看不到渲染效果；再点别处才回渲染 | `handlers-math.ts` L66/86 |
| 行内公式 | hover 提示、点击进源码（推断，截图未覆盖） | 点击/光标触碰即显源码（P09 mark 规则），无 hover 提示 | `handlers-math.ts` L102-122 |
| KaTeX 错误 | （截图未覆盖） | `renderKatexHtml` 错误呈现在 widget 内，无跳源码入口（对照 mermaid 有「跳到源码」） | `editor/render-helpers.ts` |

**已领先/无需跟**：复制 TeX 源码 hover 按钮、行内/块级分离渲染、`$…$` 空格防误触规则——保持。

### 代码块（任务 9.x）

现状锚点：`editor/codeBlock-widget.ts`（CodeBlockWidget/CodeLangChip）、`editor/livePreview/handlers-code.ts`（P28 聚焦面板 + P29 着色）、`editor/livePreview/codeBlockUi.ts`（P24 折叠记忆）、`styles/code-chrome.css`。

| 维度 | Typora | VeloxMark 现状 | 锚点 |
|---|---|---|---|
| 静息态 | 圆角灰底 + 高亮，**无语言顶栏** | 圆角灰底 + 高亮 + **常驻语言顶栏**（`.cm-md-code-lang` 带下边框横条），观感比 Typora 重 | `markdown.css` L399 |
| 聚焦态 | 就地编辑 + 右下角**语言 chip**（点击切换语言） | 就地编辑 + P28 面板边框 + 开栏 fence 处语言 chip（**纯展示不可点**）；P29 源码着色已有——着色/面板已对齐甚至超前 | `handlers-code.ts` `buildFocusedCodePanel` |
| 语言切换 | chip 点开语言列表，直接改 info 串 | **无语言切换 UI**——只能手改 ``` 后的 info | — |
| 长代码 | （截图未覆盖） | P24 折叠/展开 + 行号 + 软换行选项已领先 | `codeBlockUi.ts` |

**已领先/无需跟**：P24 折叠展开记忆（按内容 hash）、行号开关、软换行、P28 聚焦面板边框、P29 聚焦态源码着色、复制全文——保持（Typora 无折叠/行号选项，我们已超前）。

### mermaid 图表（任务 10.x）

现状锚点：`editor/mermaid/widget.ts`（MermaidWidget）、`editor/mermaid/errMemory.ts`（last-good dim）、`editor/mermaid/exportIo.ts`（SVG/PNG/复制图）、`editor/mermaidPreview.ts` + P25 底部预览面板、`components/MermaidLightbox.tsx`（P16 灯箱）。

| 维度 | Typora | VeloxMark 现状 | 锚点 |
|---|---|---|---|
| 静息态 | 干净渲染图（白底无边框盒） | 边框盒 + 灰底 + padding（`.cm-md-mermaid`），比 Typora 重一档 | `markdown.css` L428 |
| 聚焦/编辑态 | **源码区 + 实时预览上下并存** + 「mermaid」chip | 整块塌回裸源码；实时预览在 **P25 编辑器底部面板**（交互割裂——眼睛要离开图表位置去底栏找预览） | `handlers-code.ts` L59 + `mermaid-preview.css` |
| 错误态 | （截图未覆盖） | 超前：last-good dim + 错误条 + **跳到源码**（可定位行号） | `widget.ts` `setError` |
| 导出 | （截图未覆盖） | 超前：SVG/PNG/复制图片/复制源码 + 灯箱缩放 | `exportIo.ts`/`MermaidLightbox` |

**已领先/无需跟**：SVG/PNG 导出、复制图片、灯箱缩放、last-good dim、错误行号跳源、P25 底栏（在 ④ 落地前是我们的"实时预览"载体）——能力保留，位置体验待改。

## 约束与红线（所有批次共用）

1. **e2e 缝是硬契约**：`window.__velox*` 系列（含 `__veloxTable`、`__veloxTableCellView`）、`data-op` id、命令 id 字面量、`data-table-handle` 等探针正则扫描点——改 UI/改 id 须同步缝契约与 `e2e/handles.d.ts` 类型，探针脚本不在本仓库，破坏即盲改。
2. **Markdown 源码唯一数据源**：不引入第二份文档模型；列宽等展示态持久化不得写入 .md 正文（7.7 例外形态须在 plan 显式论证）。
3. **Decoration/Widget 纪律**（Constitution）：改变行布局的 block widget/replace 走 `EditorView.decorations` 直供并正确 `map(tr.changes)`；WidgetType 实现 `eq`/`ignoreEvent`；replace 超 1 字符同步 `atomicRanges`。
4. **表格事件闭包不得捕获 cell 偏移**（stale-instance 纪律，`widget.ts` 文件头）；`pendingHandoff`（destroy→remount 未提交文本交接）correctness-critical，动它先读 `nestedSession.ts` 设计注释。
5. **i18n**：新 key 必须同时加 `i18n/en.ts` + `i18n/zh.ts`；菜单/按钮文案一律 `t('ns.key')`。
6. **主题色单源 `export/palette.ts`**：改色必跑 `palette.test.ts` 并同步点名的 `styles/` 行；不新增 `.theme-dark` 补丁、不新增平行按钮皮肤（新按钮用 `styles/buttons.css` `.btn` 族）。
7. **循环依赖红线**：`livePreview/build → handlers → table/*` 的拆分缝（`setNestedPreviewField` 注入）勿绕开 barrel/缝重建环；`npx madge --circular` 守护 0 cycles。
8. **导出侧平行契约**：表格/列表/代码块等静态渲染（`export/renderDoc/*`）与 livePreview 是手工平行实现，动 class 契约或渲染语义须双处同步。
9. **单测只测纯函数**，禁止在单测里渲染 widget；重浏览器依赖走 `test-stubs/`。
10. **零布局抖动**（UX-P28 F3）：编辑态进/出不得推挤正文——⑮ 改造把手/槽位时该契约是验收底线而非可选项；③④ 的双区展开同受此约束（展开只能占 widget 自身 box，不得推挤邻块以外的正文布局——plan 明确双区的布局归属）。

## 推进协议（每项任务）

1. **spec**（what/why）→ `docs/specs/<task-id>/spec.md`：AC 可测试；歧义标 `[NEEDS CLARIFICATION: …]`，不猜。
2. **plan**（how）→ `docs/specs/<task-id>/plan.md`：技术决策 + 文件切法 + 验证方案；UI 类必写「截图对照点」。
3. **implement**：一次一个 spec 单元，不做批外顺手改。
4. **converge**：`npm run typecheck && npm run test:unit` + e2e 缝核对 + 人工冒烟（对照本文件基准截图）→ 勾销本文件优先级队列对应 checkbox → commit（feat/docs 分离，同 5.x/6.x 惯例）。
