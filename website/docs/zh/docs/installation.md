---
title: 安装
description: 在 macOS、Windows 或 Linux 上安装 VeloxMark——各平台安装包、SHA256 校验验证、从源码构建、更新与卸载步骤。
keywords: [VeloxMark 安装, Markdown 编辑器安装包, AppImage, NSIS, dmg, deb, rpm, snap, 校验验证]
---

# 安装

VeloxMark 免费开源。macOS、Windows 与 Linux 的预构建二进制发布在
[GitHub Releases](https://github.com/biao-biao-ls/veloxmark/releases)。
每个版本都附带 `SHA256SUMS.txt`，供你验证下载内容。

## Windows

| 产物 | 说明 |
| --- | --- |
| `VeloxMark-Setup-<ver>-x64.exe` / `-arm64.exe` | NSIS 安装包，推荐。支持原地自动更新。 |
| `VeloxMark-Setup-<ver>.exe` | 通用安装包（自动更新清单指向此文件）。 |
| `VeloxMark-Win-<arch>-<ver>.zip` | 便携版——解压即用，无安装、无自动更新。 |

运行安装包，从开始菜单启动 VeloxMark。无需账户。

## macOS

| 产物 | 说明 |
| --- | --- |
| `VeloxMark-Mac-arm64-<ver>.dmg` / `VeloxMark-Mac-x64-<ver>.dmg` | Apple Silicon 与 Intel 的磁盘映像。 |
| `VeloxMark-Mac-arm64-<ver>.zip` / `VeloxMark-Mac-x64-<ver>.zip` | Zip 归档（也是自动更新载体）。 |

将应用拖入**应用程序**文件夹后启动。

> [!WARNING]
> 发布构建目前**未签名**。首次启动时 macOS Gatekeeper 会拒绝打开。
> 请改为移除隔离属性：
>
> ```sh
> xattr -d com.apple.quarantine /Applications/VeloxMark.app
> ```

由于构建未签名，macOS 上的内置自动更新无法完成安装——更新器会退化为打开发布页，
供你手动下载新版本。

## Linux

| 格式 | 说明 |
| --- | --- |
| `VeloxMark-Linux-x86_64-<ver>.AppImage` / `…-aarch64-…` | 推荐。`chmod +x` 后运行。完整自动更新。 |
| `VeloxMark-Linux-amd64-<ver>.deb` / `…-arm64-…` | Debian / Ubuntu：`sudo apt install ./VeloxMark-Linux-amd64-<ver>.deb` |
| `VeloxMark-Linux-x86_64-<ver>.rpm` / `…-aarch64-…` | Fedora / RHEL / openSUSE。 |
| `VeloxMark-Linux-<arch>-<ver>.tar.gz` | 便携 tar 包。 |
| `VeloxMark-Linux-x64-<ver>.snap` | Snap 包（仅 x64）。 |

deb、rpm、snap 与 tar.gz 安装的更新仅为通知式——应用会告诉你新版本的存在并指向发布页。

## 校验下载文件

每个发布都包含 `SHA256SUMS.txt`。对照校验你的文件：

```sh
sha256sum -c SHA256SUMS.txt --ignore-missing
```

macOS：`shasum -a 256 -c SHA256SUMS.txt --ignore-missing`（或 `shasum -a 256 <文件>` 后手动比对）。
Windows（PowerShell）：

```powershell
Get-FileHash .\VeloxMark-Setup-0.1.0-x64.exe -Algorithm SHA256
```

## 更新

VeloxMark 会检查 GitHub Releases 上的新版本。行为取决于安装形式：

- **Windows NSIS** 与 **Linux AppImage**——完整检查、下载与安装。下载完成后，
  应用会在退出安装前征求同意。
- **macOS**——检查能找到新版本，但未签名构建无法完成 Squirrel.Mac 更新；应用改为打开发布页。
- **其他形式**（便携 zip、deb / rpm / snap / tar.gz、开发模式）——仅通知式手动检查。

你也可以随时从[发布页](https://github.com/biao-biao-ls/veloxmark/releases)获取最新版本。

## 从源码构建

```sh
git clone https://github.com/biao-biao-ls/veloxmark.git
cd veloxmark
npm install
npm run dev      # 开发模式
npm run build    # 生产构建到 out/
```

受限网络下 Electron 二进制下载失败时：

```sh
ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ npm install
```

用 `npm run build:win`、`npm run build:mac` 或 `npm run build:linux` 打包分发产物。

## 卸载

- **Windows**——设置 → 应用 → VeloxMark → 卸载。
- **macOS**——将 VeloxMark.app 从应用程序拖到废纸篓。
- **Linux**——移除软件包（`apt remove`、`dnf remove`、`snap remove`）或删除 AppImage / 解压的 tar 包。

用户数据（草稿、偏好、会话状态）存放在标准的用户应用数据目录；只有在需要彻底清理时才删除它。
