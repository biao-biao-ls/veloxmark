# 9B spec — 代码块静息态去语言顶栏（9.2 / ⑬）

> 看板任务：⑬ 9.2（`docs/markdown-ux-optimization.md` 实施优先级 P2 观感对齐）。

## 背景 / 差距（what & why）

对照基准截图 `temp/typora/code-default.png`：静息态代码块 = **圆角灰底 + 高亮代码，无任何横条**。VeloxMark 现状：顶栏横贯 `.cm-md-code-lang` 语言标签（`codeBlock-widget.ts` 装配 + `markdown.css` 底边框分隔），比 Typora 重一档；语言 id 以小写渲染（9.3 前的旧形态）。

**What**：去掉语言顶栏；语言降级为 **hover 显现的右下角标**（聚焦态即 ⑦ 的右下角 chip——「hover/聚焦时的角标」同一视觉位）；导出侧平行契约同步（`renderDoc/code.ts` 的 `.export-code-lang` 标签一并去掉）。

**Why**：观感对齐基准；语言在聚焦态已有可交互 chip（⑦/9A），静息态顶栏是冗余 chrome。

## 语言角标决策（implement 前定）

看板两案：「hover/聚焦时的角标」或「并入 ⑦ 的右下角 chip」。**决策：hover 右下角标 + 聚焦 ⑦ chip（两案合流）**——同一右下视觉位：hover（静息）浮现只读角标，聚焦升级为可交互切换 chip，连续体自然（对照 8A `cm-md-math-hover-chip` hover 显现先例）。

- 位置：`absolute; right/bottom`（`.cm-md-code-src-chip` 同值——皮肤选择器列表扩展，红线 6）。
- 文案：`langDisplayName(lang)`（9.3 可读名；`''` → `text`），不再小写化。
- **折叠态藏角标**：展开按钮（`.cm-md-code-expander`）占满底边行，角标与之冲突——`display: none`（聚焦/展开后照常）。
- 角标只读（点击冒泡 click-to-source，同块语义）；切换交互仍是聚焦 chip 专属（交互统收⑱ 规范时再议）。

## AC（可测试）

1. **静息观感**：无 `.cm-md-code-lang` 横条；圆角灰底 + 高亮代码（与 `code-default.png` 对齐）；hover 右下浮现语言角标。
2. **功能不回退**：复制/折叠（fold/expand）按钮与行为不变；折叠态角标不遮挡展开按钮。
3. **导出同步**：`codeBlockHtml` 不再产 `.export-code-lang` 标签（HTML/PDF/复制富文本共用面）；导出观感与静息态一致（无语言横条）；`codeBlockHtml` 纯函数配单测钉新形态。
4. **9.3 一致**：角标显示名与聚焦 chip 同源（`langDisplayName`，未知 id 原样）。
5. **双主题**：深浅主题角标/块底色观感不回归。

## Out of scope（明确不做）

- 聚焦 chip（⑦/9A）行为改动；角标点击切换语言（⑱ chrome 规范统收时再议）。
- mermaid/表格/公式静息态（⑭⑮⑯ 另项）。
- 导出补 `language-x` class 等语义增强（导出只做减法对齐，不加新面）。
- hover 时浮现复制/折叠工具栏的显隐调整（现状不回退即可）。

## 约束引用

1（e2e 缝）→ `export-code-lang` 移除是**本任务授权的导出契约变更**（平行契约同步一节点名）；in-repo 守护 `inlineStyles.test.ts` 同步更新；diff 显式核对零其它既有字面量改动。3（Widget 纪律）→ badge 无状态、eq 已含 lang。5（i18n）→ 零新 key。6（红线 6 皮肤）→ 角标皮肤 = `.cm-md-code-src-chip` 选择器列表扩展，零复制规则体。9（纯函数单测）→ `codeBlockHtml` 形态钉测。
