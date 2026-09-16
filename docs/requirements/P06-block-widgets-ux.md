# P06 渲染块交互增强

优先级：P06 | 类别：UX | 预估规模：S

## 背景

代码块/数学块/Mermaid/表格的 Widget 当前"一点就跳回源码"（mousedown 定位
到 `sourceFrom`），无法复制渲染态内容：代码块没有复制按钮，Mermaid 的
SVG 导出按钮是唯一工具条。Typora 在代码块悬停时显示语言标签 + Copy。

## 目标

渲染块拥有统一的悬停工具条：复制内容、（Mermaid）导出 SVG、定位源码；
点击块空白处仍可回源码，但不再劫持所有点击。

## 功能需求

- [ ] 统一 `blockToolbar` 样式与行为，挂在每个块 Widget 右上角，hover 显示
- [ ] 代码块：Copy 按钮（复制原始代码到剪贴板，成功后短暂变 ✓）
- [ ] 代码块：显示语言标签（现有 `cm-md-code-lang` 保留），点击标签可
      循环切换语言（可选，低优）
- [ ] 数学块：Copy（复制 TeX 源码）
- [ ] Mermaid：保留现有 SVG 导出，新增 Copy（复制 mermaid 源码）
- [ ] 表格：Copy as Markdown（复制原表格源码）
- [ ] 点击工具条按钮不触发"跳回源码"；点击块的非文本区域仍跳回
- [ ] 允许在渲染态选中代码文本复制（工具条 Copy 为主路径，文本选中为
      兜底——mousedown 不再无条件 preventDefault，改为仅对块容器空白命中）

## 实现要点

- 文件：`src/renderer/src/editor/widgets.ts`。P00 已抽 `BlockWidget`
  基类并预留工具条挂载点——在基类实现
  `attachBlockToolbar(wrap, items: {label, onClick}[])`，各子类注册自己
  的 items，不再逐 Widget 复制。
- 剪贴板写入复用 `window.api.clipboardWrite`（preload 已有）。
- mousedown 处理细化（P00 后 click-to-source 已集中在 `BlockWidget`
  基类，只改一处）：`e.target` 命中 `pre/code`/表格单元格/ SVG 内部时
  不 preventDefault，让浏览器原生选区工作；命中容器 padding 才跳源码。
  需配合 CM6 `ignoreEvent` 返回值调整。
- 工具条按钮样式进 `styles.css`（`.cm-md-block-toolbar`），明暗主题各一套。

## 验收标准

1. 悬停代码块右上角出现 Copy；点击后剪贴板内容 == 原始代码（不含高亮
   标记）。
2. 在代码块内拖动可选中文本并 Ctrl+C 复制，不会误触发跳回源码。
3. 点击表格空白 padding 仍能跳回源码编辑。
4. 工具条在暗色主题下可见且对比度达标。

## 非目标

- 渲染态直接编辑代码块内容（保持"点击回源码"的编辑模型）。
