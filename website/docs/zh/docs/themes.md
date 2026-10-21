---
title: 主题
description: VeloxMark 亮色与暗色主题——一键切换、跨会话记忆，以及主题如何应用到代码、公式与图表组件。
keywords: [Markdown 编辑器暗色模式, 亮色主题, 暗色主题, 编辑器主题, 主题切换]
---

# 主题

VeloxMark 提供两套精心调校的一等主题——亮色与暗色——专为长时间写作设计。
两者都覆盖编辑器配色、语法色与渲染组件（公式、图表、代码、表格）。

<div class="vm-grid-2" style="margin-top:24px">
  <div class="vm-card" style="padding:0;overflow:hidden">
    <div class="vm-window" style="border:none;border-radius:0">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">亮色</span>
      </div>
      <img src="/img/hero-light.png" alt="VeloxMark 亮色主题" />
    </div>
  </div>
  <div class="vm-card" style="padding:0;overflow:hidden">
    <div class="vm-window" style="border:none;border-radius:0">
      <div class="win-bar">
        <span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>
        <span class="fname">暗色</span>
      </div>
      <img src="/img/hero-dark.png" alt="VeloxMark 暗色主题" />
    </div>
  </div>
</div>

## 切换主题

- 菜单：**视图 → 切换主题**（也可通过"切换主题"命令）。
- 或在偏好设置中显式选择主题模式：`亮色` / `暗色` / `跟随系统`。
- 选择会被跨会话记住。

自定义无边框标题栏与应用内菜单（文件 / 编辑 / 视图 / 插入 / 帮助）随主题变色。

## 暗色主题下的代码示例

<div class="vm-shot">

![暗色主题中的代码块](/img/code-dark.png)

</div>

## 主题如何应用

编辑器基于 [CodeMirror 6](https://codemirror.net)；每个主题都是一套 CM6 主题
加上覆盖应用外壳的 CSS 变量。渲染组件（KaTeX、Mermaid、highlight.js）
使用同一色板，因此代码块与图表永远不会显得突兀。
