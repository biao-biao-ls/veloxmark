# 7G spec — 表格静息态零 chrome / 与正文列对齐（7.8 / ⑮）

> 看板任务：⑮ 7.8（`docs/markdown-ux-optimization.md` 实施优先级 P2 观感对齐，标注「全清单风险最高项」）。

## 背景 / 差距（what & why）

对照基准截图 `temp/typora/table-default.png`：静息态表格**与正文列同列**（左右缘齐平、占满正文列宽）、上方无死空隙、零 chrome。VeloxMark 现状：`.cm-md-table-wrap` 常驻 `padding-left: 56px + padding-top: 28px` 把手预留槽（UX-P28 F3 零抖动的代价）——表格左缘缩进 56px 脱离正文列、宽度少 56px、上方多 28px 死空隙。

**What**：静息态表格占满正文列（左右缘与正文齐平）、上方回到正常块间距；进/出编辑态布局零位移不回退；把手不遮挡单元格文本。

**Why**：观感对齐基准；常驻预留槽是对**每一张**表格永久征收的几何税，而它只为编辑态把手存在。

## 核心决策：负 margin 吸收（槽位外移，布局效果恒抵消）

**保留常驻槽宽（padding 不随状态变），用负 margin 抵消其布局效果**——wrap 的盒子向左/向上扩张进「左空白/gutter 条 + 块间空隙」，内容盒（表格）恰好落回正文列：

- `margin-left: calc(var(--editor-gutter) - var(--table-handle-gutter, 56px))`（= −40px）+ `padding-left: 56px` → 表格内容盒左缘 = 正文左缘（`.cm-line` padding = `--editor-gutter`），宽度 = 正文列宽，右缘齐平（wrap `margin-right` 不变）。
- `margin-top: calc(-1 * var(--table-col-handle-gutter, 28px))` + `padding-top: 28px` → 表格上缘回到正常块节奏（外层 `cm-md-block-gap` 净高少 28px，上方无死空隙）；顶槽随 wrap 盒上移，落在块间空隙里（静息态透明，零视觉）。

**零位移证明（AC2）**：margin/padding **全部与状态无关**，进/出编辑只切换绝对定位把手的显隐（本来就是 out-of-flow）——外层 widget 盒高恒为 `gap + 表格高 + gap`，正文与表格几何 **0px 位移**（优于 AC 允许的 ≤1px）。

**槽宽不能删的原因（为什么不是「把手改 overlay 不占 layout」的裸删 padding）**：wrap 有 `overflow-x: auto`（宽表内滚），把手必须落在滚动口（padding box）内才不被裁剪。把手几何紧贴首列左缘/表头上缘，表格又须与正文列齐平 → 槽必然伸到正文列**左侧** → wrap 边盒必须外扩。负 margin 是唯一让「槽在滚动口内、表格在正文列上」两全的纯 CSS 手段。

**否决的备选**：
- **编辑态才撑开槽位（状态依赖 padding）**：进编辑表格右跳 56px（几何跳变，列宽 grip 位置跟着跳），或需表格级 transform 补偿后把手仍落在滚动口外被裁剪。
- **JS 测量 overlay**（把手挪出 wrap 按 cell 位置摆）：要 ResizeObserver/滚动/列宽拖拽全链路同步，复杂度与风险远超收益（本项恰是全清单风险最高项，做减不做加）。
- **把手挪进单元格内缘/列右缘**：遮挡单元格文本（AC3 明禁）/ 列语义错位（diag-P28 曾修掉 in-cell 布局）。

## 把手与 gutter 条共存（行把手左伸进 gutter 带的对策）

行把手（`right: 100%` + margin，占表格左缘外 ~53px）在负 margin 后会伸到 cm-content 左缘外，与 `.cm-gutters`（flex 兄弟、常驻 fold 槽、`z-index: 200`、不透明底）重叠。核对 gutter 渲染几何后判定**功能零损失**：

- 表格 widget 是**单个源码行** → 对应 gutter 元素只有一个且**无折叠箭头**（折叠只对标题）——被把手覆盖的是空条；
- 行号（若开启）数字渲染在该高元素的**顶部**（widget 盒顶端 = 顶槽/工具栏区），行把手在数据行高度处——**垂直错开，不撞字形**；
- 对策：把手 `z-index` 抬到 200 之上（210），保证可见/可点；代价是编辑态把手小牌与 gutter 条视觉搭接（无字形遮挡）。

## 编辑工具栏平移（栈位逐像素不变）

7C 编辑工具栏现锚在外层 `bottom: calc(100% - var(--space-1))`。顶槽随负 margin 上移 28px 后，工具栏须同步上移**恰一个槽高**——`bottom: calc(100% + var(--table-col-handle-gutter, 28px) - var(--space-1))`——使得「工具栏 → 列把手带 → 表格」的相对栈位与改造前**逐像素一致**（工具栏底缘 = 表格上缘 −32px、与把手带留 6px），编辑态内部观感零回归。同时左右缘对齐表格列（`left: var(--editor-gutter); width: calc(100% - 2 * var(--editor-gutter))`，对照 `table-focus.png` 工具栏与表格左缘对齐）。

**代价（plan 显式论证）**：编辑态 chrome（工具栏 + 列把手带）改为向上**绘制**覆盖前邻块底部 ~46px，不再占预留空间——这是零位移契约的必然推论（要进/出不推挤正文，编辑态浮层就只能 paint-only 覆盖）。属 7C 已接受的「paint-only overlap with previous block」同类，足迹更大、仅编辑态存在；hover-reveal 等减负策略留给 ⑱ 块级 chrome 规范收口。

## AC（可测试）

1. **静息观感**：表格左右缘与正文列齐平（同代码块 `margin: 0 gutter` 盒）、宽度 = 正文列宽；上方无 28px 死空隙（与 `table-default.png` 对齐：零 chrome、同列）。
2. **零位移**：进/出编辑态正文与表格几何 **0px 位移**（盒值与状态无关，构造性证明 + 冒烟测量）；列宽 grip/列边界不跳。
3. **把手不遮挡单元格文本**：行把手整体在表格边盒左侧、列把手整体在表头上缘之上（与现状同几何）。
4. **探针契约零触碰**：`data-table-handle` 五值、`dataset.tableFrom`、`.cm-md-table-handle-btn`、`.cm-md-table-toolbar` 等 class/attr 契约不变；7C 工具栏语义（⊞/对齐三键/⋮/🗑）不回退。
5. **hover chrome 不回退**：复制条位置/显隐、点击回源码区、宽表内滚、折叠箭头（邻近标题）均不受影响。

## Out of scope

- 7H 视觉微调（表头底色/边框粗细，走 `export/palette.ts` 单源流程）；把手 hover-reveal 策略（⑱）；工具栏移位到底部（保持 Typora 顶置）；导出侧（导出表格本就满列、无把手，零改动）。

## 约束引用

1（e2e 缝）→ class/attr 契约零改动，纯 CSS 属性值/盒模型改动；3（Widget 纪律）→ 零 widget TS 改动；6（红线 6/token）→ 新表达式只消费 `--editor-gutter`/`--table-handle-gutter`/`--table-col-handle-gutter`/`--space-*`，无裸 px 新值、无 `.theme-dark` 补丁；10（零布局抖动）→ 本项验收底线，由盒值状态无关性构造性满足；CSS-only → 零新单测（7C/8A/9B/10B 先例）。
