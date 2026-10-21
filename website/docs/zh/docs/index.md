---
title: 介绍
description: 欢迎阅读 VeloxMark 用户文档——一款免费开源的 Markdown 编辑器，带实时预览，基于 Electron 与 CodeMirror 6 构建。
keywords: [VeloxMark 文档, Markdown 编辑器指南, 实时预览编辑器, 介绍]
---

# 介绍

欢迎使用 VeloxMark 用户文档——一款面向 macOS、Windows 与 Linux 的免费开源 Markdown 编辑器，
带实时预览，灵感来自 Typora，基于 Electron 与 CodeMirror 6 构建。

<div class="vm-shot">

![VeloxMark 界面](/img/hero-light.png)

</div>

## VeloxMark 有何不同

**Markdown 源码是唯一的数据源。** 一切富文本效果——渲染后的标题、公式、图表、表格——
都只是纯文本文件上的临时装饰。保存写回的是干净的 `.md`，往返零损失。没有私有文档格式，
也没有隐藏状态。

实时预览引擎在每次文档与选区变化时重建装饰：语法标记用替换装饰隐藏，
代码 / 公式 / mermaid / 图片块被渲染组件替代。当光标进入某个范围时，该范围的装饰被跳过，
源码形式随之回来。光标行始终保持源码形式，所以你永远清楚自己正在编辑什么。

## 下一步去哪

<div class="vm-grid-3" style="margin-top:24px">
  <div class="vm-card">
    <h3><a href="./installation">安装</a></h3>
    <p>macOS、Windows 与 Linux 的安装包、校验验证与平台注意事项。</p>
  </div>
  <div class="vm-card">
    <h3><a href="./basics">基础</a></h3>
    <p>窗口、侧栏、标签页与三种编辑器模式——首次启动看到的一切。</p>
  </div>
  <div class="vm-card">
    <h3><a href="./editing">深入编辑</a></h3>
    <p>实时预览在输入时的行为：块级组件、表格、专注模式与输入辅助。</p>
  </div>
  <div class="vm-card">
    <h3><a href="./markdown-syntax">Markdown 语法</a></h3>
    <p>VeloxMark 特殊渲染的全部语法构造，附源码示例。</p>
  </div>
  <div class="vm-card">
    <h3><a href="./key-bindings">快捷键</a></h3>
    <p>各平台完整命令列表与加速键。</p>
  </div>
  <div class="vm-card">
    <h3><a href="./faq">常见问题</a></h3>
    <p>支持的平台、故障排除与问题反馈方式。</p>
  </div>
</div>

## 许可证

VeloxMark 基于 [MIT 许可证](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE)发布。
源码位于 [github.com/biao-biao-ls/veloxmark](https://github.com/biao-biao-ls/veloxmark)。
