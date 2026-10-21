---
title: 深入编辑
description: VeloxMark 实时预览在输入时的行为——语法标记、块级组件、原生表格编辑、输入辅助与多标签工作流。
keywords: [实时预览编辑, Markdown 表格编辑, 块级组件, 输入辅助, 粘贴 HTML 转 Markdown]
---

# 深入编辑

VeloxMark 的编辑器基于 CodeMirror 6，装饰引擎在每次文档与选区变化时重建渲染视图。
本页解释它在你写作时的行为。

## 实时预览

- 当光标离开一行时，其语法标记（`#`、`**`、`` ` ``、`*`、`~~`、`==`）
  用替换装饰隐藏，该行显示最终的样式形态。
- **光标行始终保持源码形式**——你永远清楚自己在输入什么。
- 点进隐藏的标记会为该范围恢复源码形式。

<div class="vm-shot">

![光标行的源码形式](/img/caret-source-line.png)

</div>

## 块级组件

代码块、`$$` 公式、Mermaid 图表与图片会以其源码所在位置的组件形式渲染。
**点击任意渲染块即可编辑其源码**；离开该块即重新渲染。

<div class="vm-grid-2" style="margin-top:24px">
  <div class="vm-card" style="padding:0;overflow:hidden">
    <img src="/img/math-light.png" alt="KaTeX 块级公式" style="display:block;width:100%" />
  </div>
  <div class="vm-card" style="padding:0;overflow:hidden">
    <img src="/img/mermaid-light.png" alt="就地渲染的 Mermaid 图表" style="display:block;width:100%" />
  </div>
</div>

## 表格

表格是一等公民：每个单元格都是嵌套的 CodeMirror 编辑器。

- **插入 / 转换**——用插入表格对话框创建指定行列数的表格，或把当前段落转换为表格。
- **列宽调整**——拖拽列边框。
- **对齐**——设置每列对齐（左 / 中 / 右）；源码的分隔行
  （`:---`、`:--:`、`---:`）保持同步。
- 所有编辑都通过事务回到组件所拥有的 Markdown 源码范围——文档绝不会在背后被改动。

<div class="vm-shot">

![表格编辑](/img/table-widget-light.png)

</div>

## 专注与打字机模式

- **专注模式**让正在写的段落之外的一切变暗。
- **打字机模式**把光标行锁定在垂直居中位置。
- 两者可以叠加；激活时状态栏显示 `FOCUS` / `TYPEWRITER` 徽标。

<div class="vm-shot">

![专注模式](/img/focus-mode.png)

</div>

## 输入辅助

- **粘贴 HTML → Markdown**——从剪贴板粘贴的富文本会转换为干净的 Markdown。
- **裸链接**——粘贴的裸 URL 自动包装成链接。
- **任务列表**——`- [ ]` 渲染为可点击的复选框；点击切换。
- **撤销 / 重做**——完整事务历史（`Ctrl+Z` / `Ctrl+Shift+Z`）。

## 多标签编辑

同时打开多个文件。标签可关闭与重新打开，未保存更改有标记，
标签条可拖拽重排。

## 代码块

- 通过 highlight.js 为数百种语言提供语法高亮。
- 可选行号、软换行与长块折叠——见[偏好设置](./preferences)。

## 导出

从文件菜单导出 PDF 或 HTML，支持仅选区 HTML 导出。见[导出文档](./export)。
