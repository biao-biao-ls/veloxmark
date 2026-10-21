---
title: 常见问题
description: VeloxMark 常见问题——支持的平台、许可、实时预览原理、文件往返、数据存放位置、macOS Gatekeeper 与更新行为。
keywords: [VeloxMark FAQ, Markdown 编辑器常见问题, 实时预览问题, VeloxMark 故障排除]
head:
  - - script
    - type: application/ld+json
    - '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"支持哪些平台？","acceptedAnswer":{"@type":"Answer","text":"macOS（Apple Silicon 与 Intel）、Windows 10/11（x64 与 ARM64）和 Linux（x64 与 arm64——AppImage、deb、rpm、tar.gz；snap 仅 x64）。"}},{"@type":"Question","name":"VeloxMark 免费吗？","acceptedAnswer":{"@type":"Answer","text":"免费。VeloxMark 基于 MIT 许可证开源。无需账户，无订阅，无遥测。"}},{"@type":"Question","name":"什么是实时预览？与分栏视图有何不同？","acceptedAnswer":{"@type":"Answer","text":"没有预览面板。编辑器就地渲染 Markdown：光标离开一行后语法标记隐藏，该行显示最终形态。光标行始终保持源码形式，点击任意渲染块即可找回其原始 Markdown。Markdown 源码是唯一的数据源——保存写回纯 .md，往返零损失。"}},{"@type":"Question","name":"保存时 VeloxMark 会改动我的 Markdown 文件吗？","acceptedAnswer":{"@type":"Answer","text":"不会。保存只是把源码文本原样写回。所有渲染都是装饰。"}},{"@type":"Question","name":"支持哪些 Markdown 语法？","acceptedAnswer":{"@type":"Answer","text":"CommonMark + GFM（表格、任务列表、删除线），外加 KaTeX 公式、Mermaid 图表、提示块、脚注与高亮文本。"}},{"@type":"Question","name":"可以用 VeloxMark 做笔记管理吗？","acceptedAnswer":{"@type":"Answer","text":"VeloxMark 是一个专注的 Markdown 阅读/编辑器——打开文件夹与文件、使用大纲和搜索，但没有知识管理层。你的文件始终是磁盘上的纯 .md，任何其他工具都能接手。"}},{"@type":"Question","name":"如何报告 bug？","acceptedAnswer":{"@type":"Answer","text":"在 GitHub 上提 issue，附应用版本（帮助菜单）、操作系统、复现步骤以及出问题的 Markdown。"}},{"@type":"Question","name":"我的草稿和设置存放在哪里？","acceptedAnswer":{"@type":"Answer","text":"偏好、草稿与会话状态存放在标准用户应用数据目录（Electron userData）：Windows %APPDATA%\\VeloxMark、macOS ~/Library/Application Support/VeloxMark、Linux ~/.config/VeloxMark。文档本身绝不会被移动或复制。"}},{"@type":"Question","name":"为什么 macOS 说应用来自身份不明的开发者？","acceptedAnswer":{"@type":"Answer","text":"发布构建目前未签名。安装后执行一次 xattr -d com.apple.quarantine /Applications/VeloxMark.app 即可。"}},{"@type":"Question","name":"我的平台上没有自动更新——正常吗？","acceptedAnswer":{"@type":"Answer","text":"正常。完整自动更新仅在 Windows NSIS 安装与 Linux AppImage 上启用；其他安装形式为仅通知，macOS 目前因构建未签名而回退为打开发布页。"}}]}'
---

# 常见问题（FAQ）

### 支持哪些平台？

macOS（Apple Silicon 与 Intel）、Windows 10/11（x64 与 ARM64）和 Linux
（x64 与 arm64——AppImage、deb、rpm、tar.gz；snap 仅 x64）。
见[安装](./installation)。

### VeloxMark 免费吗？

免费。VeloxMark 基于
[MIT 许可证](https://github.com/biao-biao-ls/veloxmark/blob/main/LICENSE)开源。
无需账户，无订阅，无遥测。

### 什么是实时预览？与分栏视图有何不同？

没有预览面板。编辑器**就地**渲染 Markdown：光标离开一行后，
`#`、`**`、`` ` `` 之类的语法标记隐藏，该行显示最终形态。
光标行始终保持源码形式，点击任意渲染块（代码、公式、图表、表格、图片）
即可找回其原始 Markdown。Markdown 源码是唯一的数据源——保存写回纯 `.md`，
往返零损失。

### 保存时 VeloxMark 会改动我的 Markdown 文件吗？

不会。保存只是把源码文本原样写回。所有渲染都是装饰。

### 支持哪些 Markdown 语法？

CommonMark + GFM（表格、任务列表、删除线），外加 KaTeX 公式、Mermaid 图表、
提示块、脚注与 `==高亮==`。完整参考：[Markdown 语法](./markdown-syntax)。

### 可以用 VeloxMark 做笔记管理吗？

VeloxMark 是一个专注的 Markdown 阅读/编辑器——打开文件夹与文件、
使用大纲和搜索，但没有知识管理层（没有标签、反向链接或数据库）。
你的文件始终是磁盘上的纯 `.md`，任何其他工具都能接手。

### 如何报告 bug？

在 [GitHub](https://github.com/biao-biao-ls/veloxmark/issues) 上提 issue，
附应用版本（帮助菜单）、操作系统、复现步骤以及出问题的 Markdown。

### 我的草稿和设置存放在哪里？

偏好、草稿与会话状态存放在标准用户应用数据目录（Electron `userData`）：
Windows `%APPDATA%\VeloxMark`、macOS `~/Library/Application Support/VeloxMark`、
Linux `~/.config/VeloxMark`。文档本身绝不会被移动或复制——你在原地编辑文件。

### 为什么 macOS 说应用来自身份不明的开发者？

发布构建目前未签名。安装后执行一次
`xattr -d com.apple.quarantine /Applications/VeloxMark.app`——见
[安装](./installation#macos)。

### 我的平台上没有自动更新——正常吗？

正常。完整自动更新仅在 Windows NSIS 安装与 Linux AppImage 上启用；
其他安装形式为仅通知，macOS 目前因构建未签名而回退为打开发布页。
详见[自动更新](./updates)。
