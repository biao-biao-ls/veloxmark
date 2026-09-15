# VeloxMark Windows 打包、签名与版本更新操作指南

> 适用项目：VeloxMark（`D:\code\typora`，electron-vite + Electron + MIT License）
> 目标：从本地打包 → CI 自动构建 → 代码签名（消除 SmartScreen 弹窗）→ 发布 → 自动更新，形成完整闭环。
> 参考：`1.md`（SignPath Foundation 开源免费签名方案介绍）

---

## 目录

1. [总体架构](#1-总体架构)
2. [第一步：本地 Windows 打包配置（electron-builder + NSIS）](#2-第一步本地-windows-打包配置electron-builder--nsis)
3. [第二步：代码签名证书方案选择与申请](#3-第二步代码签名证书方案选择与申请)
4. [第三步：GitHub Actions CI + SignPath 签名流水线](#4-第三步github-actions-ci--signpath-签名流水线)
5. [第四步：应用内自动更新（electron-updater）](#5-第四步应用内自动更新electron-updater)
6. [第五步：后续每次版本更新的操作清单](#6-第五步后续每次版本更新的操作清单)
7. [验证、注意事项与常见问题](#7-验证注意事项与常见问题)

---

## 1. 总体架构

```
开发者 push tag vX.Y.Z
        │
        ▼
GitHub Actions 触发 release.yml
        │
        ├─ 1. npm ci + electron-vite build        （编译 out/）
        ├─ 2. electron-builder --dir               （生成 win-unpacked/，未签名）
        ├─ 3. zip → 上传 GitHub Actions artifact
        ├─ 4. SignPath Action 远程签名             （SignPath HSM 持有私钥）
        ├─ 5. 下载已签名目录 → electron-builder --prepackaged 打 NSIS 安装包
        ├─ 6. 安装包再次送 SignPath 签名
        └─ 7. 安装包 + latest.yml 挂到 GitHub Release
                                                  │
                                                  ▼
                              用户下载安装 / 应用内 electron-updater 自动更新
```

核心思想（来自 1.md）：**私钥不落地**。SignPath Foundation 作为非营利组织持有证书，私钥存于其云端 HSM；只有当 GitHub 上的公开仓库触发合法构建时，SignPath 才远程签名并把文件还给流水线。

---

## 2. 第一步：本地 Windows 打包配置（electron-builder + NSIS）

> 本节只做本地打包，先不涉及签名。本地打出的安装包会有 SmartScreen 警告，属预期现象。

### 2.1 安装依赖

```powershell
# 在 D:\code\typora 下
npm install -D electron-builder electron-updater
```

> 国内网络若 Electron 相关下载失败，参照项目既有经验设置镜像：
> `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/`

### 2.2 创建 `electron-builder.yml`（项目根目录）

```yaml
appId: io.github.veloxmark.veloxmark
productName: VeloxMark
copyright: Copyright © 2026 VeloxMark contributors

directories:
  buildResources: build      # 已有 build/icon.ico，直接复用
  output: dist

# electron-vite 的编译产物是 out/，必须打进包里
files:
  - out/**
  - package.json

win:
  icon: build/icon.ico
  target:
    - target: nsis
      arch:
        - x64
  # 签名接入后填写（见第 3、4 节）；未签名阶段保持注释
  # signtoolOptions:
  #   ...

nsis:
  oneClick: false                          # 非一键安装，体验更像传统桌面软件
  perMachine: false                        # 装到用户目录，免管理员权限
  allowToChangeInstallationDirectory: true
  createDesktopShortcut: true
  createStartMenuShortcut: true
  shortcutName: VeloxMark
  deleteAppDataOnUninstall: false
  artifactName: VeloxMark-Setup-${version}-${arch}.${ext}

# 自动更新需要 GitHub provider，供 electron-updater 读取 latest.yml
publish:
  provider: github
  owner: <你的GitHub用户名>        # TODO：仓库推到 GitHub 后替换
  repo: veloxmark                 # TODO：仓库名
```

### 2.3 修改 `package.json` scripts

```jsonc
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "preview": "electron-vite preview",
    "typecheck": "tsc --noEmit -p tsconfig.web.json && tsc --noEmit -p tsconfig.node.json",
    // ---- 新增 ----
    "build:win": "electron-vite build && electron-builder --win",
    "build:win:dir": "electron-vite build && electron-builder --win --dir"
  }
}
```

同时补全 `package.json` 顶层元数据（electron-builder 会读取）：

```jsonc
{
  "description": "VeloxMark — a fast Markdown reader/editor with live preview",
  "homepage": "https://github.com/<owner>/veloxmark",
  "repository": { "type": "git", "url": "https://github.com/<owner>/veloxmark.git" },
  "bugs": { "url": "https://github.com/<owner>/veloxmark/issues" }
}
```

### 2.4 `.gitignore` 追加

```
dist
```

### 2.5 本地验证

```powershell
npm run build:win
```

产物在 `dist/`：

| 文件 | 说明 |
|---|---|
| `VeloxMark-Setup-0.1.0-x64.exe` | NSIS 安装包（最终分发物） |
| `win-unpacked/` | 便携版目录（未压缩的 app） |
| `builder-effective-config.yaml` | 生效配置快照，排错用 |

验收清单：
- 双击安装包能安装、卸载干净；
- 安装后从开始菜单启动，frameless 窗口、暗色主题、菜单正常；
- 版本号与 `package.json` 的 `version` 一致。

> ⚠️ Windows 下 NSIS 打包偶发杀软误报（尤其未签名时），属正常现象；签名并积累信誉后会消失。

---

## 3. 第二步：代码签名证书方案选择与申请

### 3.1 方案对比

| 方案 | 费用 | 适用 | 私钥形态 | 备注 |
|---|---|---|---|---|
| **SignPath Foundation**（推荐，见 1.md） | **免费** | 仅开源、完全免费软件 | 云端 HSM，不落地 | 人工审核，完美契合 GitHub Actions |
| Azure Trusted Signing | ~$9.99/月 | 商业/闭源也行 | 云端 HSM | 微软体系，需要组织身份验证 |
| 传统 OV 证书（Certum、SSL.com 等） | ~$100–400/年 | 通用 | USB Key / 云 | 有 USB Key 无法进 CI 的问题 |
| 传统 EV 证书 | ~$300+/年 | 通用 | USB Key / HSM | 即时消除 SmartScreen，最贵 |

VeloxMark 是 MIT 开源、完全免费 → **首选 SignPath Foundation**。

### 3.2 SignPath 免费签名硬性条件（申请前自检）

摘自 1.md，逐条对照：

- [x] OSI 批准的开源许可证 —— 项目 `license: "MIT"` ✅
- [ ] 公开仓库 —— 源码须托管在 **GitHub / GitLab 等公开平台**（当前需先把 `D:\code\typora` 推成公开仓库）
- [x] 完全免费 —— 无收费墙、无内购、无闭源组件 ✅（注意：mermaid/KaTeX/highlight.js 等依赖均为开源许可，符合）
- [ ] 活跃维护 —— 有提交记录、README、截图、真实用户；纯空壳仓库会被拒
- [x] 合规内容 —— 非恶意软件、非广告软件、非黑客工具 ✅

### 3.3 申请步骤（详细操作）

1. **准备仓库（申请前提）**
   - 在 GitHub 创建公开仓库（如 `<owner>/veloxmark`），推送全部源码；
   - 完善 README（功能截图可用 `scripts/*.png` 中的 CDP 截图）、LICENSE（MIT）、CHANGELOG；
   - 项目主页/下载页链接先指向 GitHub Releases。

2. **注册 SignPath**
   - 打开 <https://signpath.org> → Apply（或直接 `/apply` 页面）；
   - 用 **GitHub 账号** 登录（后续 CI 集成依赖 GitHub 关联）。

3. **创建 Organization**
   - 登录后创建组织（Organization），名称建议与 GitHub 账号/项目一致；
   - 在组织下关联你的开源仓库。

4. **提交开源签名申请**
   - 在控制台提交 **"Open Source Code Signing"** 申请；
   - 填写：项目说明（一句话 + 功能列表）、开源协议链接（LICENSE 文件 URL）、发布/下载地址（GitHub Releases 页）、仓库链接；
   - 提交后 SignPath 官方**人工审核**，通常需 **几个工作日**；期间可能邮件追问项目活跃度，及时回复。

5. **安装 SignPath GitHub App 并关联构建系统**（必做，官方文档明确要求）
   - 访问 <https://github.com/apps/signpath> 安装 GitHub App，授权其访问你的仓库；
   - SignPath 控制台 → Organization → 添加预定义的 **GitHub.com Trusted Build System**，并关联到你的项目；
   - 作用：SignPath 靠它验证"构建确实来自 GitHub 托管的真实 workflow，而非泄露的 API Token 伪造"，且签名前的所有 job 必须跑在 GitHub 托管 runner 上。

6. **记录关键信息**（第 4 节 CI 要用）
   - SignPath 控制台 → 你的项目 → 记下：
     - **Organization ID**（组织设置页，UUID 格式）
     - **Project Slug**（项目标识，如 `veloxmark`）
     - **Signing Policy Slug**（签名策略；开源项目通常为 `release-signing` / `download-signing`，**以控制台实际显示为准**）
   - 创建 API Token：Organization 设置 → API Tokens → 创建一个仅含提交签名请求权限的 token，**立即复制保存**（只显示一次）。

7. **配置 GitHub Secrets**
   - GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret：
     - `SIGNPATH_API_TOKEN` = 上一步的 API Token
     - `SIGNPATH_ORGANIZATION_ID` = Organization ID

> 审核被拒的常见原因：仓库刚建、无 star、无下载记录、README 空洞。可先发几个未签名的版本积累用户，再重新申请。

---

## 4. 第三步：GitHub Actions CI + SignPath 签名流水线

### 4.1 为什么要签两次

Windows 最佳实践是 **签名链完整**：先签 `win-unpacked/` 里的应用 exe/dll，再用已签名的应用打 NSIS 安装包，最后签安装包 exe。只签外层安装包时，安装后主程序仍未签名，SmartScreen/属性页仍会显示"未知发布者"。

SignPath 的 Action 以 **GitHub Actions artifact** 为输入/输出（官方流程：`actions/upload-artifact` 先上传未签名文件，其 `artifact-id` 输出作为 Action 输入；签名完成后通过 `output-artifact-directory` 下载回 CI）。注意：`upload-artifact` 会自动把路径打成 zip，**不要再手动 zip**，否则会双重压缩、签名配置对不上。

### 4.2 创建 `.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'        # 仅 v 开头的 tag 触发，如 v0.2.0

permissions:
  contents: write   # 创建 GitHub Release
  actions: read     # SignPath Action 需要读取 artifact / job 信息

jobs:
  release-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build (electron-vite)
        run: npm run build

      - name: Package unpacked app
        run: npx electron-builder --win --dir

      # ---- 第一次签名：应用本体 ----
      - name: Upload unsigned app
        id: upload-app
        uses: actions/upload-artifact@v4
        with:
          name: unsigned-app
          path: dist/win-unpacked        # upload-artifact 自动 zip，无需手动打包
          if-no-files-found: error

      - name: Sign app binaries (SignPath)
        uses: signpath/github-action-submit-signing-request@v2
        with:
          api-token: '${{ secrets.SIGNPATH_API_TOKEN }}'
          organization-id: '${{ secrets.SIGNPATH_ORGANIZATION_ID }}'
          project-slug: 'veloxmark'                 # TODO 与控制台 Project Slug 一致
          signing-policy-slug: 'release-signing'    # TODO 与控制台 Policy Slug 一致
          github-artifact-id: '${{ steps.upload-app.outputs.artifact-id }}'
          wait-for-completion: true
          output-artifact-directory: 'dist/signed-app'

      - name: Replace unpacked app with signed version
        shell: bash
        run: |
          rm -rf dist/win-unpacked
          mkdir -p dist/signed-app-extracted
          unzip -qo dist/signed-app/*.zip -d dist/signed-app-extracted
          # 兼容两种 zip 内结构：带 win-unpacked 前缀 / 直接是内容
          if [ -d dist/signed-app-extracted/win-unpacked ]; then
            mv dist/signed-app-extracted/win-unpacked dist/win-unpacked
          else
            mv dist/signed-app-extracted dist/win-unpacked
          fi

      # ---- 用已签名的应用打 NSIS 安装包 ----
      - name: Build NSIS installer from signed app
        run: npx electron-builder --win nsis --prepackaged dist/win-unpacked

      # ---- 第二次签名：安装包 ----
      - name: Upload unsigned installer
        id: upload-installer
        uses: actions/upload-artifact@v4
        with:
          name: unsigned-installer
          path: dist/VeloxMark-Setup-*.exe
          if-no-files-found: error

      - name: Sign installer (SignPath)
        uses: signpath/github-action-submit-signing-request@v2
        with:
          api-token: '${{ secrets.SIGNPATH_API_TOKEN }}'
          organization-id: '${{ secrets.SIGNPATH_ORGANIZATION_ID }}'
          project-slug: 'veloxmark'
          signing-policy-slug: 'release-signing'
          github-artifact-id: '${{ steps.upload-installer.outputs.artifact-id }}'
          wait-for-completion: true
          output-artifact-directory: 'dist/signed-installer'

      # ---- 发布到 GitHub Release（latest.yml 供自动更新）----
      - name: Prepare release assets
        shell: bash
        run: |
          mkdir -p release-assets
          cp dist/signed-installer/*.exe release-assets/
          cp dist/latest.yml release-assets/      # electron-builder 生成的更新清单

      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: release-assets/*
          generate_release_notes: true
```

### 4.3 Action 输入项说明（已对照官方 `action.yml` 核实）

`signpath/github-action-submit-signing-request@v2` 全部输入：

| 输入 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `connector-url` | 是 | `https://githubactions.connectors.signpath.io` | 一般无需改 |
| `api-token` | 是 | — | GitHub Secret `SIGNPATH_API_TOKEN` |
| `organization-id` | 是 | — | GitHub Secret `SIGNPATH_ORGANIZATION_ID` |
| `project-slug` | 是 | — | SignPath 控制台项目标识 |
| `signing-policy-slug` | 是 | — | 控制台签名策略（开源项目以实际显示为准） |
| `github-artifact-id` | 是 | — | 上一步 `upload-artifact` 的 `artifact-id` **输出**（注意：是 id，不是 name） |
| `artifact-configuration-slug` | 否 | — | 仅当控制台有多个 Artifact Configuration 时指定 |
| `wait-for-completion` | 否 | `true` | 阻塞等签名完成 |
| `wait-for-completion-timeout-in-seconds` | 否 | `600` | 等待超时 |
| `output-artifact-directory` | 否 | — | 签名产物下载目录；**不设置则不下载** |
| `github-token` | 否 | `${{ github.token }}` | 读取 job 详情、下载 artifact 用 |

Action 输出：`signing-request-id`、`signing-request-web-url`（可到控制台看进度）、`signed-artifact-download-url`。

> **zip 结构说明**：`upload-artifact` 默认打 zip，SignPath 开源项目预配的 Artifact Configuration 一般以 `<zip-file>` 为根，能覆盖 zip 内的 `.exe/.dll/.msi`。若签名后发现有 PE 文件漏签（可用 `signtool verify` 检查 `win-unpacked` 内每个 exe），到控制台调整 Artifact Configuration。
>
> **已知坑**：`upload-artifact` 有 `name` 被忽略的已知 issue（actions/upload-artifact#769、#785），若后续步骤找不到命名的 artifact，升级 action 版本或查这两个 issue。

### 4.4 首次接入建议：用测试分支验证

正式打 tag 前，可临时把触发器改成 `workflow_dispatch` 手动触发，用假 tag/测试签名策略跑通整条流水线，确认签名产物的文件属性里"数字签名"页签正确，再切回 tag 触发。

---

## 5. 第四步：应用内自动更新（electron-updater）

### 5.1 主进程接入（`electron/main.ts`）

```ts
import { autoUpdater } from 'electron-updater'

// app ready 后调用（仅生产环境；dev 下 updater 找不到 app-update.yml）
if (!process.env.ELECTRON_RENDERER_URL) {
  autoUpdater.checkForUpdatesAndNotify()
  // 可选：每 4 小时再查一次
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 60)
}
```

依赖 `electron-updater` 读取 Release 里的 `latest.yml`（electron-builder 在打包时自动生成，含版本号、exe 文件名与 sha512）。**因此第 4.2 节必须把 `latest.yml` 和安装包一起挂到 Release**，否则客户端检测不到新版本。

### 5.2 自动更新生效条件

- 应用是通过 **NSIS 安装包安装**的（绿色解压版无法自动更新）；
- Release 上有签名一致的 `VeloxMark-Setup-*.exe` + `latest.yml`；
- 安装包与更新包用**同一签名证书**（换证书会被 electron-updater 拒绝，SignPath 长期持有同一证书，天然满足）。

---

## 6. 第五步：后续每次版本更新的操作清单

发一个新版本（以 `0.2.0` 为例），本地只需 4 条命令：

```powershell
# 1. 确保工作区干净、typecheck 通过
npm run typecheck

# 2. 升版本（自动改 package.json 并创建 git tag）
npm version minor        # 或 patch / minor / major，遵守 semver

# 3. 补充 CHANGELOG（手动编辑，记录本版本变更）

# 4. 推送 commit + tag，CI 接管
git push origin main --follow-tags
```

之后全自动：CI 构建 → SignPath 签名（两次）→ 创建 GitHub Release 并挂载安装包与 `latest.yml`。已安装旧版的用户会在应用内自动收到更新。

**版本号约定（semver）**：

| 位 | 何时动 | 例 |
|---|---|---|
| patch `0.1.x` | 修 bug | `0.1.1` |
| minor `0.x.0` | 加功能（兼容） | `0.2.0` |
| major `x.0.0` | 破坏性变更 | `1.0.0` |

**发版前检查单**：

- [ ] `npm run typecheck` 通过
- [ ] `npm run dev` 冒烟：编辑器、暗色主题、菜单、大纲、mermaid/KaTeX 渲染
- [ ] CHANGELOG 已更新
- [ ] tag 名以 `v` 开头（`npm version` 默认带，别改掉）
- [ ] 发布后在一台干净机器（或虚拟机）下载安装包验证：签名有效、安装、自动更新能收到该版本

---

## 7. 验证、注意事项与常见问题

### 7.1 验证签名

```powershell
# 查看签名详情（应显示 VeloxMark / SignPath 背书的组织信息）
signtool verify /pa /v "dist\signed-installer\VeloxMark-Setup-0.2.0-x64.exe"

# 或资源管理器右键 → 属性 → "数字签名"选项卡
```

### 7.2 SmartScreen 的真相（重要预期管理）

- **OV 级证书（SignPath 属此类）不会立刻消除 SmartScreen**。Windows 依靠"下载量信誉"积累，全新证书签发的安装包初期仍可能提示"未知发布者"，需要一定真实下载量后逐步消退。
- 好消息：有合法签名的信誉积累速度远快于无签名；且用户可通过"属性 → 解除锁定"绕过。
- 若需要即时零弹窗，只有 **EV 证书**（或 Azure Trusted Signing 在部分场景）能做到，但费用高，开源项目通常不必。

### 7.3 常见问题

| 问题 | 原因 / 解法 |
|---|---|
| `electron-builder` 找不到 icon | `build/icon.ico` 必须含 256×256 尺寸（项目已有多尺寸 png，经 `scripts/make-icons.py` 生成的 ico 可用） |
| 打包后白屏 | `files` 漏了 `out/**`；确认 `electron-vite build` 先于 `electron-builder` 执行 |
| CI 里 SignPath 报权限错误 | API Token 过期/权限不足；重新创建 token 并更新 Secret |
| SignPath 报"仓库不匹配" | Action 只允许从关联的公开仓库触发；fork 的 PR 构建不会被签名（这是特性，防伪造） |
| 安装包被浏览器/杀软拦截 | 未签名或信誉不足，见 7.2 |
| `latest.yml` 404 | Release 资产没挂 `latest.yml`，检查 4.2 节 "Prepare release assets" 步骤 |
| 更新提示"签名不匹配" | 新旧版本用了不同证书，必须保持同一 SignPath 项目/证书 |
| 国内 CI/本地下载 Electron 慢 | 设置 `ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/` |

### 7.4 安全提醒

- `SIGNPATH_API_TOKEN` 只放 GitHub Secrets，**绝不提交进仓库**；
- SignPath 的开源策略不允许夹带闭源二进制依赖——新增依赖时留意许可证；
- 合并到 main 的代码最终会被签成公开分发物，保护好有推送权限的账号（开启 2FA）。

---

## 附：从零到发版的路线图（checklist）

- [ ] **阶段 0**：本地 `electron-builder` 配置完成，`npm run build:win` 出包验收（第 2 节）
- [ ] **阶段 1**：代码推送到 GitHub **公开**仓库，完善 README / LICENSE（第 3.2 节）
- [ ] **阶段 2**：注册 SignPath，提交开源签名申请，等待审核（第 3.3 节）
- [ ] **阶段 3**：配置 Secrets，添加 `release.yml`，用 `workflow_dispatch` 验证流水线（第 4 节）
- [ ] **阶段 4**：接入 `electron-updater`，确认 `latest.yml` 随 Release 发布（第 5 节）
- [ ] **阶段 5**：`npm version` + push tag，正式发版，干净机验证（第 6 节）
- [ ] **持续**：按发版清单迭代；积累下载量消除 SmartScreen
