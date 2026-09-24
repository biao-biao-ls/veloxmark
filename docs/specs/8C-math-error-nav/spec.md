# 8C spec — KaTeX 错误态补跳源码入口（8.4）

> 看板任务：⑩ 8.4（`docs/markdown-ux-optimization.md` P1），spec id `8C-math-error-nav`。复用既定缝：mermaid 错误条交互（`cm-md-mermaid-jump` 同款）+ `findMathBlockAt`（`mathScan.ts` 文件头点名「later 8C's error jump」）。

## 背景 / 差距（what & why）

对照 mermaid 既有交互（P16 错误条 + `cm-md-mermaid-jump` 跳源码按钮）：mermaid 渲染失败时错误条给出「跳到源码」直达入口。

VeloxMark 现状：块级公式 TeX 非法时 KaTeX 以红色错误着色显示源文（`renderKatexHtml` `throwOnError: false`），**无错误条、无跳源入口**——用户只知道「坏了」，不知道点哪去修（静息块虽有整块 click-to-source，但错误态下无显式可发现入口）。**What**：公式渲染失败时，渲染块内出现错误条 + 「跳到源码」按钮，点击定位到 `$$` 起点（进入 P09 源码显形态）。**Why**：错误恢复动线闭环，与 mermaid 交互同构。

## AC（可测试）

1. **错误条 + 按钮**：块级公式（`MathBlockWidget`）TeX 非法时显示错误条（文案 `math.renderFailed`）+「跳到源码」按钮（`math.jumpToSource`）；KaTeX 错误着色展示保持现状（同壳契约：合法 TeX 渲染 HTML 逐字节不变）。
2. **跳转语义**：点击按钮 → 光标定位到该公式块 `$$` 起点（`findMathBlockAt(…).start`，与 widget `sourceFrom` 同点）+ `scrollIntoView` + 编辑器聚焦；定位后块进 P09 触碰态、源码显形（既有语义，不特判）。
3. **正常渲染无错误条**：合法 TeX 零新 DOM（无 bar 无按钮）。
4. **事件时重解析**（红线 4）：点击时 `view.state.sliceDoc()` + `findMathBlockAt` 现算，`sourceFrom` 仅作 hint；hint 失效回退 clamp 到 `sourceFrom`（mermaid `mermaidErrorDocPos` 回退模式同款）。
5. **e2e 缝不破坏**：`cm-md-mermaid-jump`/`cm-md-mermaid-error` class 与 mermaid DOM 零触碰（皮肤经选择器列表共享，不改名）；新 class `cm-md-math-error`/`cm-md-math-jump` 为 add-only。
6. **纯逻辑可测**：错误检测（`renderKatexChecked` → `{ ok, html }`）配单测；跳转落点复用 `findMathBlockAt` 既有单测面。

## Out of scope（明确不做）

- 行内公式错误态（无 bar 空间；⑰ 8.3 行内 hover 另立）。
- 8B 聚焦预览（`MathPreviewWidget`）错误条：编辑态源码区就在上方，跳转无增量——错误着色已有（plan 决策）。
- 静态导出（`export/renderDoc`）错误态跳转（无 view；KaTeX 错误着色原样）。
- KaTeX 错误着色/文案样式改动（同壳契约）。

## 约束引用

1（e2e 缝）→ AC5：mermaid class 名零改、皮肤选择器扩展；3（Widget 纪律）→ 不新增 widget 类型（bar 在 `MathBlockWidget.toDOM` 内装配）；4（stale）→ AC4；5（i18n）→ 新 key `math.renderFailed`/`math.jumpToSource` 同落 en/zh；6（皮肤）→ 错误条/跳转钮与 mermaid 共享同一规则体（选择器列表扩展，零复制）；10（零布局）→ 错误条仅错误态追加（错误态本就异常布局，非状态切换抖动面）。
