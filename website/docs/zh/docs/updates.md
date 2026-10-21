---
title: 自动更新
description: VeloxMark 各安装形式的更新方式——Windows NSIS 与 Linux AppImage 完整自动更新，其余仅通知，支持手动兜底。
keywords: [VeloxMark 自动更新, electron-updater, AppImage 更新, NSIS 更新, 手动更新]
---

# 自动更新

VeloxMark 会检查 [GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases)
上的新版本，并按安装形式走不同的更新路径。

## 各安装形式的行为

| 安装形式 | 更新行为 |
| --- | --- |
| Windows NSIS 安装包 | 完整检查 → 下载 → 提示 → 重启后安装 |
| Linux AppImage | 完整检查 → 下载 → 提示 → 重启后安装 |
| macOS（dmg / zip） | 仅检查——未签名构建无法完成 Squirrel.Mac 更新，应用会打开发布页 |
| 便携 zip / deb / rpm / snap / tar.gz | 仅通知——告知新版本并给出链接 |
| 开发模式（`npm run dev`） | 仅通知 |

下载完成后，**应用会先征求同意再退出安装**——绝不会在背后擅自行动。

## 手动检查

在应用菜单中使用**帮助 → 检查更新**。在仅通知的安装形式上，
这会打开或指向发布页。

## 更新清单

发布资产包含 electron-updater 清单（`latest.yml`、`latest-mac.yml`、
`latest-linux.yml`、`latest-linux-arm64.yml`）与 `SHA256SUMS.txt`。
Windows 清单的 `path` 指向通用安装包 `VeloxMark-Setup-<ver>.exe`。

## 更新失败怎么办

1. 检查网络 / 代理——更新来自 GitHub Releases。
2. 手动对照 `SHA256SUMS.txt` 校验下载
   （见[安装](./installation#校验下载文件)）。
3. 从[发布页](https://github.com/biao-biao-ls/veloxmark/releases)全新安装兜底——
   你的设置与草稿会被保留。
