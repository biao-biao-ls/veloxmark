# 10A spec — mermaid 编辑态源码/预览就地并排

> 看板任务：④ 10.1（`docs/markdown-ux-optimization.md` 实施优先级 P0）。依赖 ③（8B）沉淀的「块内源码/预览双区」机制。

## 背景 / 差距（what & why）

对照基准截图 `temp/typora/mermaid-focus.png`：Typora 聚焦 mermaid 时**在图表原位置**呈现「上方源码区（可编辑）+ 下方实时渲染预览」，视线不离开图表位置即可边改边看。

VeloxMark 现状（差距见看板批次对照 mermaid 表）：光标进 fence 后 P28 聚焦面板只给源码（着色 + 面板 chrome），实时预览在 **P25 编辑器底部面板**——交互割裂，眼睛要离开图表位置去底栏找预览。这是 mermaid UX 头号差距。

**What**：聚焦 mermaid fence 时，图表位置就地双区——源码区（既有 P28 面板）+ 尾随实时预览（block widget）上下并存，与 8B 数学双区同构。

**Why**：修复视线割裂；复用 8B 沉淀的 `previewBelow` 共用机制（看板排序原则 2「同构机制集中设计」的兑现半边）。

## 与共用机制的显式对齐（8B → 10A）

- 预览半边走 `livePreview/dualPane.ts` 的 `previewBelow(pos, widget)`（尾随 block widget，side: 1）。
- 源码半边 = `buildFocusedCodePanel` 既有 P28 面板（mermaid 今天已走这条路，面板行 class / open-fence chip / P09 reveal 契约全部不动）。
- 预览 widget 纪律同 `dualPane` 约定：`eq` 到内容 + `i18nEpoch`（逐键重建仅内容变才换 DOM）；预览只占 focused fence 自身 box（红线 10）。
- 与 8B 的差异（刻意）：数学预览 widget 挂 `MathPreviewWidget(tex)`，mermaid 挂 `MermaidPreviewWidget`——渲染宿主（svg/错误条/last-good）从 `MermaidWidget` 抽共用 `mountMermaidRender`，不复制粘贴两份。

## P25 底栏去留（AC 显式决策项）

**决策：并联保留、行为零改动**（自动弹出/钉住/收起/缩放全语义原样）。

理由（红线 1「e2e 缝是硬契约」）：`e2e/seams/p25.ts` 的 `window.__veloxP25.panel()` 直接探底栏 DOM（`.mermaid-preview-panel`/`.mermaid-preview-svg`/`.mermaid-preview-error`/`.mermaid-preview-pin.is-on`），`probeNow`/`clickPin`/`panel()`/`getPinSession` 是硬契约；探针脚本不在本仓库，压制自动弹出或退役面板都可能让 `visible`/`pinOn` 断言盲改失败。

配套表述：就地预览是**主编辑 UX**（视线不离图表位置）；底栏并联为辅助预览（钉住跟随 fence 本身是多图工作流的既有能力，保留）。底栏降级/退役需探针侧同步变更后**另立任务**，不在本 spec 范围。

## AC（可测试）

1. **就地双区**：光标在 mermaid fence 内时，图表原位置呈现「P28 源码面板 + 下方实时预览」并存；源码可直接编辑（文档文本，非嵌套会话）。
2. **实时刷新**：键入源码，预览随内容刷新（逐键重建 + 既有 renderMermaid 缓存/并发门 2，等效可接受 debounce）。
3. **错误态**：渲染失败时预览沿用 MermaidWidget 同款语义——last-good dim（或 placeholder）+ 错误条 +「跳到源码」按钮可定位错误行（`mermaidErrorDocPos` 行号解析）；编辑中改回合法语法即恢复。
4. **退出回纯渲染**：光标移出 fence（blockTouched 解除）后下次重建回 `MermaidWidget` 纯渲染，就地预览撤除。
5. **P25 零改动**：底栏面板行为与 DOM 契约原样（`__veloxP25` 各探针语义不变）。
6. **零布局抖动**（红线 10）：预览占 focused fence 自身 box 尾随位（块级 widget 自然换行落位），不引入绝对定位/负 margin 技巧以外的正文推挤——进出编辑态的块高变化属「widget 自身 box」内（与 8B 同一论证）。
7. **同壳语义**：渲染中/空代码/last-good 恢复/更新中 badge 文案与 `MermaidWidget` 同一 render host（同一 `mountMermaidRender`），无第二份渲染路径。
8. **预览交互**：点击预览 SVG 打开灯箱（同静息态语义）；预览不劫持光标（`ignoreEvent: true`，点击预览不移动文档光标、不打断编辑）。
9. **回归面**：非 mermaid 代码块聚焦行为不变；mermaid 静息态（`MermaidWidget`）行为不变。

## Out of scope（明确不做）

- ⑪ 10.3「mermaid」聚焦提示 chip + 语言切换（依赖 ⑦ 语言列表，另立/后续 spec）——`mermaid-focus.png` 的 chip 归 ⑪。
- ⑭ 10.2 静息态去边框盒（观感批次，另立 spec）。
- Escape/chip 退出编辑（退出 = 光标移出，AC4；chip 退出可与 ⑪ 一并定）。
- P25 底栏降级/退役（需探针侧同步，见上节）。
- 渲染引擎/导出侧语义（exportIo、renderMermaid 本体不动；`export/renderDoc` 平行契约无涉——本项纯 livePreview 聚焦态）。

## 约束引用（红线逐条对应）

1（e2e 缝）→ P25 零改动 + 零字面量触碰；3（Decoration/Widget 纪律）→ 预览 widget `eq`/`ignoreEvent`，`previewBelow` 正确 `map`；5（i18n）→ 本 spec 零新 key（复用 `mermaid.*`）；7（循环依赖）→ renderHost 抽取不绕开 barrel，madge 0 cycles；9（单测只测纯函数）→ 仅 `mermaidErrorDocPos` 纯化后补单测；10（零布局抖动）→ AC6。
