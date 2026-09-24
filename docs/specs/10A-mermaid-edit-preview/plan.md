# 10A 实施方案

## 技术决策与理由

- **路线 = 8B 同款 P28 文本源码双区**（复用 `livePreview/dualPane.previewBelow`）：mermaid 源码留在文档里直接编辑，聚焦态 = P28 面板（既有）+ 尾随 `MermaidPreviewWidget`（新增）。否决表格 nestedSession 路线（理由同 8B：pendingHandoff 类正确性风险、独立 undo 纠缠；mermaid 源码是纯文本）。
- **P25 底栏并联保留、零行为改动**（spec 决策节已论证）：`__veloxP25.panel()` 探底栏 DOM，压制/退役 = 盲改探针。本项纯新增，App.tsx / MermaidPreviewPanel / mermaidPreview.ts / e2e seams 全部不碰。
- **渲染宿主抽取 `mermaid/renderHost.ts`**：`mountMermaidRender({ wrap, code, sourceFrom, theme, view })` 承接 `MermaidWidget.toDOM` 中 svgHost/badge/errorBar 装配 + last-good 恢复 + placeholder/rendering 态 + `setError`（含「跳到源码」）+ `renderMermaid` then/catch 全套语义（**原样搬移、不改语义**）。返回 `svgHost` 供工具栏导出查询。`MermaidWidget` 与 `MermaidPreviewWidget` 共用——AC7 同壳成立，errMemory 按 `sourceFrom` 键控，编辑态/渲染态 last-good 连续（同 fence 同键）。
- **`mermaidErrorDocPos` 纯化**：签名 `view → doc: Text`（原实现只用了 `view.state.doc`），挪入 renderHost 一并共用 + 补单测（AC3 行号解析可测面）。
- **`MermaidPreviewWidget` = 普通 WidgetType，否决 BlockWidget**：`wrapWithGap` 的 click-to-source 会把光标拽回块首、打断正在编辑的光标位——预览是显示层不是跳源入口（跳源已有错误条按钮专责）。`ignoreEvent: true`（点击预览不动光标，AC8）；`eq(code, theme, sourceFrom, i18nEpoch)` 对齐 `MermaidWidget.eq`；svg 点击 → `openMermaidLightbox`（同静息态，stopPropagation 防误触）。
- **预览挂点 = `previewBelow(Math.min(last.to + 1, doc.length), …)`**（8B 同款落位，块末行下一行起点/文末钳制）；块级 widget 自然换行落位，占 focused fence 自身 box（红线 10 布局归属论证同 8B plan）。
- **CSS 复用为主**：预览 wrap class `cm-md-mermaid cm-md-mermaid-preview`——`cm-md-mermaid` 族全部既有样式（svg 缩放/错误条/badge/is-dim/placeholder）免费继承（⑭ 去边框盒时两态同改）；仅补 `.cm-md-mermaid-preview` 与面板行拼缝的少量间距覆盖 + 无 hover toolbar 的无关项。全 token，无 `.theme-dark` 补丁。
- **i18n 零新 key**：复用 `mermaid.failed/updating/errorLabel/jumpToSource/rendering`（同壳语义的一部分）。
- **不做 chip/Escape 退出**（spec out of scope）：退出 = 光标移出（AC4）；chip 归 ⑪。

## 文件切法

| 源 | 改动 |
|---|---|
| `editor/mermaid/renderHost.ts` | **新建**：`mountMermaidRender`（svg/badge/error + last-good + setError + 渲染流程，语义自 widget.toDOM 原样抽出）+ 纯函数 `mermaidErrorDocPos(doc: Text, sourceFrom, msg)` |
| `editor/mermaid/renderHost.test.ts` | **新建**：`mermaidErrorDocPos` 单测（`Parse error on line N` 行号解析 / 无行号回落 body 首行 / 钳制 / 空 doc 防护） |
| `editor/mermaid/previewWidget.ts` | **新建**：`MermaidPreviewWidget`（普通 WidgetType；eq/ignoreEvent；mountMermaidRender + svg 灯箱） |
| `editor/mermaid/widget.ts` | `MermaidWidget.toDOM` 换用 `mountMermaidRender`（只留 BlockWidget chrome：wrapWithGap/toolbox/svg 灯箱）；`mermaidErrorDocPos` 私有实现移除改 import |
| `editor/mermaid/index.ts` | barrel 补导出 `MermaidPreviewWidget`、`mountMermaidRender`（按需） |
| `editor/livePreview/handlers-code.ts` | `enterFencedCode` 的 blockTouched 分支：`buildFocusedCodePanel` 后 lang === 'mermaid' 时 `previewBelow` 挂预览；小助手 `fenceBody(state, node)` 抽出（两路径共用 body 剥离） |
| `styles/markdown.css` | `.cm-md-mermaid-preview` 少量覆盖（与面板拼缝间距等），token 化 |

## 状态/契约归属

无新状态（无 StateField/无存储）。e2e 契约零改动（P25 seams / `__velox*` / data-op / 命令 id 全不碰）。导出侧平行契约无涉（纯 livePreview 聚焦态，`export/renderDoc` 的 mermaid 静态渲染不动）。

## import 改动面

`renderHost` → errMemory/render/i18n/CM Text（纯依赖，无环）；`previewWidget` → renderHost + mermaidLightboxBar（components 单例 bus，widget.ts 既有面）；`widget` → renderHost（替换内联段）；`handlers-code` → mermaid barrel（既有 import 面 +1 导出）。`npx madge --circular --extensions ts,tsx` 守护 0 cycles。

## 任务拆分

1. `renderHost.ts`（含 `mermaidErrorDocPos` 纯化）+ 单测 + `widget.ts` 换用 [先行，行为不变重构]
2. `previewWidget.ts` + barrel 导出 [依赖 1]
3. `handlers-code.ts` 聚焦分支挂 `previewBelow` + CSS 拼缝 [依赖 2]

## 验证方案

- `npm run typecheck && npm run test:unit`（renderHost 单测全绿）
- `npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles
- e2e 缝：diff 内零既有字面量改动（`__velox*`/`data-op`/命令 id/`.mermaid-preview-panel` 等 DOM 探针类名不触碰）
- 人工冒烟（对照 `mermaid-focus.png`/`mermaid-default.png`）：
  1. 光标进 mermaid fence：上 P28 源码面板（chip/着色照旧）+ 下实时预览；键入预览逐键刷新
  2. 故意写坏语法：预览 last-good dim（或 placeholder）+ 错误条 +「跳到源码」可定位行；改回即恢复
  3. 光标移出：回纯渲染，预览撤除；再进编辑态 last-good 连续（不再闪 rendering）
  4. 点击预览 SVG 开灯箱；点击预览空白处光标不动（ignoreEvent）
  5. P25 底栏照旧自动弹出/钉住/收起/缩放（行为零变化）；`__veloxP25.panel()` 语义原样
  6. 普通代码块聚焦双区/静息态 mermaid 渲染零回归
  7. 深浅主题两张对照

## 实现细化（2026-09-24 implement 时决策）

- **`mermaidErrorDocPos` 纯化签名 `view → doc: Text`**：原实现只读 `view.state.doc`；调用点在 **click 时刻**传 `view.state.doc`（新鲜 state，与原闭包语义一致）。随 renderHost 落单测 5 例（行号映射/无行号回落/钳制含 line 0/sourceFrom 定位 body 原点/空 doc 与越界防护）。测试小插曲：`Text.of([])` 非法（CM 文档至少一行），空文档实形 `Text.of([''])`。
- **renderHost 语义原样搬移**：`prev`（last-good）仍闭包捕获于 toDOM/mount 时刻，catch 分支 dim/placeholder 分叉、`setError` 跳源按钮（mousedown preventDefault 防抢焦点）逐行照旧；仅位置变化。
- **`MermaidPreviewWidget` 否决 BlockWidget**（plan 既定）：点击预览不触发 click-to-source（会把光标拽回块首、打断编辑）；`ignoreEvent: true`（点击不动文档光标，P09 不受扰）；svg 点击开灯箱时排除 `.cm-md-mermaid-jump`（错误条按钮优先）。
- **`fenceBody(state, node)` 小助手抽出**：enterFencedCode 渲染/聚焦两路径共用 CodeText 剥离（行为保持，非语义变更）。
- **预览落位 `Math.min(last.to + 1, doc.length)`** 同 8B——本仓 block-widget 插入的第二个用例，落位/行边界吸附冒烟同点复查。
- **CSS 仅 1 条**：`.cm-md-mermaid-preview { margin-top: var(--space-2) }`（覆盖 `.cm-md-mermaid` 简写 margin 的 top，同特异性靠后生效）；其余全部继承 `cm-md-mermaid` 族既有样式（⑭ 去边框盒时两态同改的耦合面在此显式记录）。
- **P25 并联的观感代价显式记录**：编辑态会同时出现就地预览 + 底栏预览（双预览并存）——刻意保守（缝契约下零行为改动是唯一不盲改的选项）；降噪归探针侧同步后的后续任务，不暗改。
- **i18n 零新 key**（复用 `mermaid.*`）；e2e 零字面量触碰（diff grep 核对过）。

## 收敛记录（2026-09-24）

- `npm run typecheck` ✓（双 tsconfig）
- `npm run test:unit` ✓ 30 files / 302 tests（新增 `renderHost.test.ts` 5 例：mermaidErrorDocPos 行号映射/回落/钳制/sourceFrom 原点/防护）
- `npx madge --circular --extensions ts,tsx src/renderer/src` ✓ 0 cycles（221 files）
- e2e 缝核对：diff 内零既有字面量改动（`__velox*`/`data-op`/`data-testid`/`.mermaid-preview-*` 探针类名全不触碰；App.tsx/MermaidPreviewPanel/mermaidPreview.ts/e2e seams 零改动）
- AC1–9 逐条核对：双区（P28 面板 + previewBelow）/逐键刷新（eq 到 code + renderMermaid 缓存并发门）/错误态同壳（last-good dim + 跳源，纯函数有测）/退出回纯渲染（blockTouched 解除）/P25 零改动/布局归属 fence 自身 box/mountMermaidRender 同壳/ignoreEvent + 灯箱/非 mermaid 零回归——逻辑路径全通
- 人工冒烟（对照 mermaid-focus/default 两图）**待运行时冒烟补签**，重点实测点：① previewBelow 落位（第二个 block-widget 用例的行边界吸附）② 源码面板与预览拼缝观感 ③ 就地预览与 P25 底栏双预览并存的观感 ④ 编辑↔渲染切换时 last-good 连续（同 sourceFrom 键）⑤ 预览 svg 灯箱 / 点击不动光标
