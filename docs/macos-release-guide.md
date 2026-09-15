# VeloxMark macOS 打包、签名、公证与分发指南

> 适用项目：VeloxMark（electron-vite + Electron + MIT License）
> 与 `windows-release-guide.md` 为姊妹篇：发版流程（semver / tag / CHANGELOG）两平台共用，本文只写 macOS 侧的差异与操作。
> 参考：Electron 官方 Code Signing 教程、SignPath 官网、electron-builder Code Signing 文档（见文末链接）。

---

## 目录

1. [调研结论：macOS 与 Windows 的关键差异](#1-调研结论macos-与-windows-的关键差异)
2. [不签名分发的代价（决策依据）](#2-不签名分发的代价决策依据)
3. [开源项目的四种常见策略](#3-开源项目的四种常见策略)
4. [VeloxMark 的两阶段路线](#4-veloxmark-的两阶段路线)
5. [阶段 A：无签名分发（当前立即可执行）](#5-阶段-a无签名分发当前立即可执行)
6. [阶段 B：签名 + 公证（付费后接入）](#6-阶段-b签名--公证付费后接入)
7. [macOS 端自动更新（依赖阶段 B）](#7-macos-端自动更新依赖阶段-b)
8. [验证、注意事项与常见问题](#8-验证注意事项与常见问题)
9. [附：路线图 checklist](#9-附路线图-checklist)

---

## 1. 调研结论：macOS 与 Windows 的关键差异

**核心问题：一定要购买 Apple Developer 账号吗？**

- 想做**正规的代码签名 + 公证（notarization）→ 必须买**，Apple Developer Program **$99/年**（个人 Individual 版即可，无需 Organization）。
- **不买也能分发**（未签名 dmg），但有明确代价，见第 2 节。这是开源社区大量小项目的真实状态。

与 Windows 侧（见 `windows-release-guide.md`）的对比：

| | Windows | macOS |
|---|---|---|
| 证书颁发方 | 多家 CA（Certum、SSL.com…） | **只有 Apple 一家** |
| 开源免费签名通道 | SignPath Foundation（免费，云端 HSM） | **不存在任何等价物**（SignPath 仅支持 Windows） |
| 费用 | 免费 或 ~$100+/年 | **$99/年，唯一选项** |
| 分发前审查 | 无 | **必须通过 Apple 公证**（自动化扫描） |
| 未签名时的拦截 | SmartScreen 警告（可积累信誉消除） | Gatekeeper 拦截，无"信誉积累"机制 |
| 签名次数 | 应用本体 + 安装包各签一次 | electron-builder 签一次 `.app`，dmg/zip 由公证覆盖 |

根本原因：macOS 的信任链被 Apple 垄断。自 Catalina 起，第三方 CA 签发的证书无法用于公证——不存在"绕开 Apple 自己搞签名"的路。

---

## 2. 不签名分发的代价（决策依据）

1. **Gatekeeper 拦截**：用户首次打开会看到"无法打开，因为无法验证开发者"。macOS 15（Sequoia）起更严格：右键→打开的旁路被收紧，用户必须去 **系统设置 → 隐私与安全性 → 仍要打开** 手动放行；完全未签名的 App 甚至可能被直接提示"已损坏，无法打开"。
2. **需手动清除隔离属性**（README 必须写明，见 5.3）：
   ```bash
   xattr -dr com.apple.quarantine /Applications/VeloxMark.app
   ```
3. **Electron 特有的功能性损失**（来自 Electron 官方文档，对 VeloxMark 直接相关）：

   | 功能 | 未签名时的行为 |
   |---|---|
   | **`autoUpdater`（Squirrel.Mac）** | **完全不工作**——mac 端自动更新与"不买账号"互斥 |
   | `safeStorage`（Keychain 加密存储） | 每次更新后可能反复弹 Keychain 权限框 |
   | `app.setLoginItemSettings()`（开机自启） | 可能静默失败 |
   | `cookieEncryption` fuse | 同 `safeStorage`，依赖 Keychain |

4. **Homebrew Cask 救不了**：Homebrew 会对 cask 安装的 App 主动打上 quarantine 属性，未签名 App 走 `brew install --cask` 同样触发 Gatekeeper。

另：**ad-hoc 签名（`identity: "-"`）不是分发方案**。Apple Silicon 上二进制至少要有 ad-hoc 签名才能在本机执行，但 ad-hoc 对其他机器的 Gatekeeper 毫无帮助。

---

## 3. 开源项目的四种常见策略

| 策略 | 成本 | 代表/适用 | Gatekeeper | mac 自动更新 |
|---|---|---|---|---|
| **A. 付费签名+公证** | $99/年 | VS Code、Obsidian 等有正经 mac 用户的项目 | ✅ 无弹窗 | ✅ 可用 |
| **B. 不签名，文档教用户绕过** | 0 | 早期/小体量项目（多数 OSS 的起点） | ❌ 用户手动放行 | ❌ 不可用 |
| **C. 只发 Homebrew Cask** | 0 | 命令行受众为主的工具 | ❌ 同 B | ❌ |
| **D. 上架 Mac App Store** | $99/年 + 审核 | 极少数 Electron 项目 | ✅ | MAS 自管 |

策略 D 说明：MAS 强制沙盒、审核周期长、抽成，且 Markdown 编辑器需要任意文件读写，沙盒限制很大——**不建议 VeloxMark 走这条路**。

---

## 4. VeloxMark 的两阶段路线

```
阶段 A（现在）                      阶段 B（有真实 mac 用户 / 需要 mac 自动更新时）
─────────────────                  ──────────────────────────────────
未签名 dmg + zip                   购买 $99 账号
README 写绕过说明           ──▶    证书 + 公证接入 CI
零成本先发起来                     dmg 无弹窗、autoUpdater 可用
```

**何时从 A 切到 B（满足任一即建议付费）：**

- [ ] mac 用户在 Issue/反馈中明确抱怨 Gatekeeper 弹窗；
- [ ] 需要 mac 端应用内自动更新（Squirrel.Mac 硬性要求有效签名）；
- [ ] 项目要进 Homebrew 官方 cask 或其他渠道，对签名有要求。

在此之前，阶段 A 完全够用，也是开源社区的通行做法。

---

## 5. 阶段 A：无签名分发（当前立即可执行）

### 5.1 本地打包（配置已就绪）

`electron-builder.yml` 的 `mac` 段（icon / dmg+zip target / fileAssociations）与 `package.json` 的 `build:mac` 脚本已配置完成，本地验证：

```bash
npm run build:mac
```

产物在 `dist/`：

| 文件 | 说明 |
|---|---|
| `VeloxMark-0.1.0-arm64.dmg` | Apple Silicon 安装包（最终分发物） |
| `VeloxMark-0.1.0.dmg` | Intel 安装包（默认命名不带 x64 后缀，属正常） |
| `VeloxMark-0.1.0-{arch}.zip` | 供 electron-updater 使用（阶段 B 才有意义） |
| `mac{,-arm64}-unpacked/` | 未压缩的 .app 目录 |

> 本机（开发者自己的 Mac）上 App 可正常启动，因为本机执行不走 Gatekeeper 信任链；**拦截只发生在别人下载打开时**。验证拦截行为需把 dmg 传到另一台 Mac 或用浏览器重新下载触发 quarantine。

验收清单：
- 双击 dmg 能打开、拖入 Applications、启动正常；
- frameless 窗口、暗色主题、mermaid/KaTeX 渲染正常；
- `.md` 文件双击能用 VeloxMark 打开（fileAssociations 生效）；
- 版本号与 `package.json` 的 `version` 一致。

### 5.2 CI 构建（未签名）

在 `release.yml` 中增加 macOS job（与 Windows 篇第 4.2 节的 job 并列，同一 tag 触发双平台）：

```yaml
  release-macos:
    runs-on: macos-latest          # Apple Silicon runner，可交叉产出 x64 包
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

      - name: Package (unsigned)
        run: npx electron-builder --mac
        env:
          CSC_IDENTITY_AUTO_DISCOVERY: 'false'   # 关键：不搜钥匙串，跳过签名

      - name: Prepare release assets
        run: |
          mkdir -p release-assets
          cp dist/*.dmg dist/*.zip dist/latest-mac.yml release-assets/ 2>/dev/null || true

      - name: Upload to GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: release-assets/*
```

要点：
- `CSC_IDENTITY_AUTO_DISCOVERY=false` 让 electron-builder 跳过钥匙串搜索与签名，CI 上更快且不会因 runner 环境意外失败；
- `latest-mac.yml` 是 electron-builder 自动生成的更新清单，阶段 A 用不上但先一起挂载，阶段 B 接入 updater 时不用改流程。

### 5.3 README 用户引导文案（可直接抄）

在 README 的下载章节加入：

> **macOS 用户注意**：VeloxMark 目前尚未购买 Apple 开发者签名（$99/年），首次打开会提示"无法验证开发者"。请：
> 1. 打开 **系统设置 → 隐私与安全性**，下滑点 **仍要打开**；或
> 2. 在终端执行：`xattr -dr com.apple.quarantine /Applications/VeloxMark.app`
>
> *macOS users: the app is not yet notarized. Right-click → Open, or allow it in System Settings → Privacy & Security, or run the `xattr` command above.*

---

## 6. 阶段 B：签名 + 公证（付费后接入）

### 6.1 购买账号与申请证书

1. **购买 Apple Developer Program**
   - <https://developer.apple.com/programs/> → Enroll → 选 **Individual**（$99/年，OSS 够用）；
   - 需 Apple ID + 双因素认证；新账号实名审核通常 **24–48 小时**，通过后才能创建证书。

2. **创建 Developer ID Application 证书**（分发 App Store 之外的唯一正确类型）
   - 方式一（推荐）：Mac 上装 Xcode → Settings → Accounts → 选中账号 → Manage Certificates → `+` → **Developer ID Application**；
   - 方式二：[developer.apple.com/account](https://developer.apple.com/account) → Certificates, Identifiers & Profiles → `+` → Developer ID Application，按指引用 CSR 创建；
   - 个人账号下 Developer ID Application 证书**数量有限（5 个）**，不要重复创建浪费配额。

3. **导出 .p12 并存入 CI**
   - 打开 **钥匙串访问** → 我的证书 → 找到 `Developer ID Application: 你的名字 (TEAMID)` → 展开确认含私钥 → 右键导出为 `.p12`，设一个强密码；
   - Base64 编码备用：
     ```bash
     base64 -i cert.p12 | pbcopy   # 结果进剪贴板
     ```

4. **公证凭据（二选一）**
   - **App 专用密码**（个人账号最简单）：<https://appleid.apple.com> → 登录与安全 → App 专用密码 → 生成；
   - **App Store Connect API Key**（更规范，适合 CI）：App Store Connect → 用户和访问 → 集成 → App Store Connect API → 生成密钥（需 App Manager/Admin 权限），**`.p8` 文件只可下载一次**。记录 Key ID 与 Issuer ID。

5. **记录 Team ID**：[开发者账号 Membership 页](https://developer.apple.com/account) 顶部的 Team ID（10 位字母数字，**非机密，可入库**）。

### 6.2 GitHub Secrets

仓库 → Settings → Secrets and variables → Actions：

| Secret | 值 |
|---|---|
| `MAC_CERTS_P12_BASE64` | 第 6.1 步 base64 后的 .p12 |
| `MAC_CERTS_PASSWORD` | 导出 .p12 时设的密码 |
| `APPLE_TEAM_ID` | Team ID（若用 6.3 的 config 写法可不设） |
| `APPLE_ID` | 开发者 Apple ID（App 专用密码方式） |
| `APPLE_APP_SPECIFIC_PASSWORD` | App 专用密码 |

> 若走 API Key 方式，改为设置 `APPLE_API_KEY`（.p8 内容）、`APPLE_API_KEY_ID`、`APPLE_API_ISSUER`，可不设 `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD`。

### 6.3 新增 `build/entitlements.mac.plist`

公证要求开启 Hardened Runtime，Electron 需要以下 entitlements（照抄即可，纯 JS 依赖足够）：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.allow-dyld-environment-variables</key>
    <true/>
  </dict>
</plist>
```

> 若后续引入原生模块（node native addon）导致签名后启动失败，再追加 `com.apple.security.cs.disable-library-validation`。

### 6.4 更新 `electron-builder.yml` 的 mac 段

阶段 B 启用（在现有 `mac:` 段内追加）：

```yaml
mac:
  # ……保留现有 icon / target / fileAssociations……
  hardenedRuntime: true              # 公证的硬性要求
  gatekeeperAssess: false            # 打包时不本地跑 gatekeeper 检查（CI 上无意义）
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  # 公证：electron-builder ≥24.4 内置 @electron/notarize，凭据走环境变量
  # v26 为对象写法；若构建报配置 schema 错误，对照所装版本的 electron-builder mac 文档调整
  notarize:
    teamId: <你的TeamID>
```

### 6.5 CI 签名 + 公证流水线

替换 5.2 的 Package 步骤（其余步骤不变）：

```yaml
      - name: Import Developer ID certificate
        env:
          P12_BASE64: ${{ secrets.MAC_CERTS_P12_BASE64 }}
          P12_PASSWORD: ${{ secrets.MAC_CERTS_PASSWORD }}
        run: |
          KEYCHAIN_PATH=$RUNNER_TEMP/app-signing.keychain-db
          KEYCHAIN_PASSWORD=$(openssl rand -base64 24)
          echo "$P12_BASE64" | base64 --decode > $RUNNER_TEMP/cert.p12
          security create-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
          security set-keychain-settings -lut 21600 "$KEYCHAIN_PATH"
          security unlock-keychain -p "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
          security import $RUNNER_TEMP/cert.p12 -P "$P12_PASSWORD" -A -t cert -f pkcs12 -k "$KEYCHAIN_PATH"
          security list-keychain -d user -s "$KEYCHAIN_PATH"
          security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k "$KEYCHAIN_PASSWORD" "$KEYCHAIN_PATH"
          rm $RUNNER_TEMP/cert.p12

      - name: Build, sign & notarize
        run: npx electron-builder --mac
        env:
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
```

说明：
- 手动导入临时钥匙串 + `set-key-partition-list` 是 Electron CI 的标准姿势，避免 codesign 在 runner 上弹密码框卡死；
- 公证由 electron-builder 内部调用 `@electron/notarize` 完成，上传 Apple 扫描通常 **1–5 分钟**，失败会直接让构建报错（看 job 日志定位）；
- 私钥只以 Secret 形式存在于 CI 内存/临时钥匙串，job 结束即销毁——与 Windows 篇 SignPath"私钥不落地"理念一致。

### 6.6 验证签名与公证

发布后在任意一台干净 Mac 上：

```bash
# 1. 签名有效且链到 Developer ID
codesign --verify --deep --strict --verbose=2 /Applications/VeloxMark.app

# 2. Gatekeeper 信任（应输出: accepted, source=Notarized Developer ID）
spctl --assess --type execute --verbose /Applications/VeloxMark.app

# 3. 公证票据已装订（stapled，离线也可验证）
xcrun stapler validate /Applications/VeloxMark.app
```

---

## 7. macOS 端自动更新（依赖阶段 B）

mac 端 `electron-updater` 走 **Squirrel.Mac**，两个硬性前提：

1. **App 有有效 Developer ID 签名**（未签名直接不工作，见第 2 节）→ 必须先完成阶段 B；
2. Release 上挂有 **zip 包 + `latest-mac.yml`**（electron-builder 自动生成；5.2/6.5 的流水线已包含挂载步骤）。

主进程接入与 Windows 完全一致（同一份 `autoUpdater` 代码即可，见 Windows 篇第 5.1 节），无需平台分支。electron-builder 的 `mac.target` 中 zip 已配置——**阶段 B 接通后不要删掉 zip target**，否则收不到更新清单。

> 换证书会破坏更新链（与 Windows 篇 7.3 同理）：Developer ID 证书到期续签时，用**同一 Team 的新证书**签名的更新，Squirrel.Mac 会校验通过；但若换了开发者账号（Team ID 变了），老用户将无法自动更新，只能公告手动重装。

---

## 8. 验证、注意事项与常见问题

### 8.1 常见问题

| 问题 | 原因 / 解法 |
|---|---|
| 用户报"已损坏，无法打开" | macOS 15 对未签名应用的误报话术；引导用 系统设置→隐私与安全性→仍要打开，或 `xattr -dr com.apple.quarantine` |
| CI 公证失败：`invalid credentials` | App 专用密码过期/输错；Team ID 与证书不匹配。重新生成密码并更新 Secret |
| CI 公证失败：`not ready for distribution` / 未签名 | 证书导入步骤失败（看 `security import` 日志）；确认 .p12 含私钥、base64 无换行损坏 |
| codesign 在 CI 卡住无输出 | 缺 `set-key-partition-list`，补上 6.5 的完整导入脚本 |
| 构建报 `notarize` 配置 schema 错误 | electron-builder 版本差异（对象写法 vs `true`）；对照所装版本文档调整 6.4 |
| 本机 `npm run build:mac` 后签名身份不对 | 本机钥匙串有多个证书时 electron-builder 可能选错；`mac.identity` 显式指定 "Developer ID Application: ..." |
| arm64 包在 Intel Mac 打不开 / 反之 | 正常，架构不同；Release 同时挂两个 arch 的 dmg，或后续考虑 universal target |
| 公证通过但 `spctl` 仍拒绝 | 网络首次校验失败；确认 `stapler validate` 通过即可离线信任 |
| Developer ID 证书过期后公证失败 | 会员资格须**每年续费**且保持有效——即使证书本身未过期，会员过期也无法公证 |
| `latest-mac.yml` 404 | Release 资产没挂该文件，检查流水线 Prepare 步骤 |

### 8.2 安全提醒

- `.p12` / App 专用密码 / `.p8` 只放 GitHub Secrets，**绝不提交进仓库**；导出用的本机 `.p12` 文件用完即删；
- Team ID、证书序列号不是机密，可写进 `electron-builder.yml`；
- 与 Windows 侧相同：合并进 main 的代码最终会被签成公开分发物，保护好有推送权限的账号（开启 2FA）。

---

## 9. 附：路线图 checklist

**阶段 A（现在）**

- [ ] `npm run build:mac` 本地出包验收（5.1）
- [ ] `release.yml` 增加 `release-macos` job（5.2），`CSC_IDENTITY_AUTO_DISCOVERY=false`
- [ ] README 加 Gatekeeper 绕过说明（5.3）
- [ ] 用测试 tag 验证 dmg 能被正常下载、安装、手动放行后启动

**阶段 B（触发条件见第 4 节）**

- [ ] 购买 Apple Developer Program（Individual，$99/年），等待实名审核
- [ ] 创建 Developer ID Application 证书，导出 .p12
- [ ] 配置公证凭据（App 专用密码或 API Key）
- [ ] 填写 GitHub Secrets（6.2）
- [ ] 添加 `build/entitlements.mac.plist`（6.3）
- [ ] 更新 `electron-builder.yml` mac 段（6.4）
- [ ] CI 接入证书导入 + 公证步骤（6.5），`workflow_dispatch` 先验证流水线
- [ ] 干净 Mac 三连验证：`codesign` / `spctl` / `stapler`（6.6）
- [ ] 接入/确认 mac 端 autoUpdater 收到更新（第 7 节）
- [ ] README 删除阶段 A 的绕过说明

**持续**

- [ ] 每年记得续费开发者会员（过期 = 公证失效 = 自动更新对新用户不可信）
- [ ] 发版流程与 Windows 篇共用：`npm version` + push tag，双平台 job 并行

---

## 参考链接

- Electron 官方教程 — Code Signing：<https://www.electronjs.org/docs/latest/tutorial/code-signing>
- electron-builder — Code Signing（mac 配置项权威说明）：<https://www.electron.build/code-signing>
- Apple — Notarizing macOS software before distribution：<https://developer.apple.com/documentation/security/notarizing-macos-software-before-distribution>
- Apple Developer Program：<https://developer.apple.com/programs/>
- SignPath（仅 Windows，本文对比对象）：<https://signpath.org/>
