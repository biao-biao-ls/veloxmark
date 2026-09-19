# P11 扩展语法支持

优先级：P11 | 类别：功能 | 预估规模：M

## 背景

当前语法覆盖 CommonMark + GFM（`@lezer/markdown` GFM 扩展）+ 数学 + mermaid。
Typora 默认还支持 front matter、脚注、`==高亮==`、上标/下标、内联属性等
扩展语法，中文写作场景中 front matter 和脚注使用频率高。

## 目标

补齐常用扩展语法的 live preview 渲染，与 Typora 的 Markdown 语法兼容。

## 功能需求

### Front matter
- [x] 文档开头 `---` 包裹的 YAML 块渲染为灰色折叠卡片，显示解析出的键值
      摘要（title/date/tags），点击展开编辑源码
- [x] 不参与导出正文（对接 P04：导出时可选转为文档标题样式）

### 脚注
- [x] `[^1]` 定义与引用：引用渲染为上标数字，点击跳转到文末定义处；
      定义块渲染为小字列表
- [x] 大纲/P04 导出中正确处理

### 高亮与上下标
- [x] `==text==` 渲染为背景高亮（mark 样式，明暗主题各一色）
- [x] `H~2~O` 下标、`2^10^` 上标（pandoc 语法），或 `x<sub>2</sub>` 透传
      HTML——选 pandoc 语法为主，实现方式同数学的正则扫描补充

### 其他
- [x] 缩写 `*[HTML]: Hyper Text...`（低优）
- [x] 定义列表 `术语\n: 定义`（低优）
- [x] 行内属性 `{#id .class}` 解析并应用到导出 HTML（低优，服务 P04）

## 实现要点

- `editor/livePreview/handlers.ts` 的树遍历补充节点处理（enter 分发处）；
  `@lezer/markdown` 无这些扩展时
  用与数学相同的**正则扫描补充策略**（front matter 仅扫文档头 4KB）。
- 脚注跳转：引用处 Widget 点击 → 查找定义位置 → `goToHeading` 式
  dispatch + scrollIntoView；反向链接悬停显示预览（可选）。
- front matter 折叠卡片是块级 Widget（StateField 提供），编辑行为仿
  代码块：点击进源码。
- 注意与 P09 的标记显隐逻辑协同：新增 mark 类型需遵守同一 touched 规则。

## 验收标准

1. 带 front matter 的文档打开：头部渲染为折叠卡，正文渲染不受影响；
   点击卡片进入 `---` 源码编辑。
2. `[^note]` 引用渲染上标，点击滚动到 `[^note]: ...` 定义；导出 PDF
   脚注在页末或文末（按实现选择，验收文档注明）。
3. `==重要==` 明暗主题下均可见；`H~2~O` 渲染为下标。
4. 所有新增语法在源码模式（P08）下显示原始标记。

## 非目标

- 任意 HTML 标签透传的安全审计（保持现有"不透传原始 HTML"策略，如需
  另立安全需求）。

## 实施状态

已完成（e2e：`scripts/cdp-p11.mjs`，51 项全部通过）。验收要点说明：

- 脚注导出位置：**文末**（正文后 `<ol class="export-footnotes">`，带
  `↩` 返回链接，编号按首次引用顺序）。
- front matter 导出：YAML 不进正文；检测到 `title` 键时首版即转为
  `<h1 class="export-fm-title">` 文档标题（可选增强已做）。
- 解析器为纯函数（`editor/livePreview/extendedSyntax.ts`），通过
  `window.__veloxExtended` 暴露给 CDP/后续 P15 单测；装饰收集在
  `livePreview/handlers.ts` 的 `collectExtendedDecos`（与数学相同的正则
  扫描补充策略，front matter 仅扫文档头 4KB）。
- P09 协同：高亮/上下标/脚注标记/缩写定义/front matter 均遵守
  mark/block touched 显隐规则；源码模式（P08）下显示全部原始标记。
