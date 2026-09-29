# BE-01 自测报告 — 加速键单源收敛（Q6 toggleTheme 撤键 + Q7 zoom×3/DevTools 四键迁入）

- **任务ID**: BE-01（IT-02，后端）
- **测试时间**: 2026-09-29 13:00（Asia/Shanghai）
- **测试方式**: 契约单测 + typecheck（桌面适配口径：本项目为 Electron 桌面应用，无 HTTP 服务/REST API，不存在「接口调通」环节；测试面为加速键单源映射契约单测 + 实测输出证据）
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/backend`（worktree 根）
- **测试环境**: Windows 10（真实 macOS 原生菜单/实体 ⌘ 键触发无法在本机验证，相关条目标注「未验证（需 macOS）」，不假 ✅）

## AC 验证结果

### frontmatter acceptance-criteria 逐条

| AC 编号 | 描述（QA 阶段 4 口径） | 结果 | 证据来源 |
|---------|----------------------|------|----------|
| AC-PEND-01 | darwin 侧 toggleTheme 加速键已删，Ctrl+Shift+T 归属唯一 | ✅ 通过（阶段 1 契约面） | ① 撤键：`commandAccelerators.test.ts` > `Q6: toggleTheme has no native accelerator (chord owned by reopenClosedTab)`（断言 `DARWIN_COMMAND_ACCELERATORS.toggleTheme` 为 `undefined`）通过；② 反向钉住：`shortcutSync.test.ts` > `Q6: toggleTheme stays accelerator-free (chord owned by reopenClosedTab)`（`NO_ACCELERATOR_BY_RULING` 钉住映射侧不得恢复）通过；③ 行为归属唯一：`reopenClosedTab`（tabs 域）在 `matchGlobalShortcut` 顺序上先于 `toggleTheme`（view 域），Ctrl+Shift+T 命中 reopenClosedTab（`build.ts` 文件头 concat 序契约 + `tabsCmds.ts:27`/`viewCmds.ts:142` 同键声明 + `shortcutMatch.ts` 首命中优先）。**残项（非本任务阻断）**：渲染注册表 `viewCmds.ts` `toggleTheme.shortcut='Ctrl+Shift+T'` 双声明尚未删除（行为已被遮蔽，归 FE-03「toggleTheme 删 shortcut」收口，见 implementation-notes ⑤）；macOS 菜单栏「切换主题项无加速键」实测见「未验证（需 macOS）」段 |
| AC-PEND-02 | 四键迁入单源且生效，双源无漂移 | ✅ 通过（阶段 1 契约面） | ① 迁入单源：`commandAccelerators.test.ts` > `Q7: zoom/devtools chords match the MENU-menubar key table`（断言 `zoomIn:'Cmd+Plus'` / `zoomOut:'Cmd+-'` / `zoomReset:'Cmd+0'` / `toggleDevTools:'Cmd+Alt+I'`）通过；② 全走单源：`commandAccelerators.test.ts` > `darwin.ts has no handwritten accelerator literals`（正则 `/accelerator:\s*['"\`]/` 源扫描零命中）通过，`electron/menu/darwin.ts` 现存 accelerator 全部为 `DARWIN_COMMAND_ACCELERATORS[id]` 派生（L123 commandItem / L296-313 zoom×3+DevTools）；③ 双源无漂移：`shortcutSync.test.ts` > `every accelerator entry points at a known command and matches its shortcut` + `derivation exceptions are all still registered in the table`（DERIVATION_EXCEPTIONS 四条登记：zoomIn 永久写法例外、toggleDevTools 平台原生键例外、zoomOut/zoomReset FE-03 过渡钉值）通过。**「实触发生效」**（实体 ⌘ 键按下 → zoomBy/toggleDevTools 动作通道）为 macOS 实测项，见「未验证（需 macOS）」段；动作通道 `window:zoom`/`window:toggleDevTools` 复用零改动（`darwin.ts` click → `zoomBy`/`toggleDevTools`，与 `ipc/window.ts` 既有 handler 同路） |
| AC-RULE-11 | 快捷键提示单源派生零例外（双源守护不放宽） | ✅ 通过（阶段 1 契约面） | `shortcutSync.test.ts` 4 用例全绿（7/7 含 commandAccelerators 3 条）：派生规则 `Ctrl+`→`Cmd+` 逐 entry 比对，任何未登记漂移即 `expect(...).toBe(...)` 失败——守护未放宽；例外均登记 reason 字符串（`DERIVATION_EXCEPTIONS`），无匿名例外。「零例外」口径=零未登记例外（zoomIn 写法差异 / toggleDevTools 平台键差异为裁决内永久例外，MENU-menubar §3.4 口径）。**残项**：toggleTheme 渲染侧 shortcut 声明导致的「提示与触发不一致」收口归 FE-03（同 AC-PEND-01 残项）；菜单提示文本实显核对见「未验证（需 macOS）」段 |

### 任务正文阶段 1（开发验收）checkbox 对照

| 阶段 1 条目 | 结果 | 证据 |
|------------|------|------|
| `getDiagnostics` 输出 0 Error | ✅ | IDE getDiagnostics：已跟踪文件 diagnostics 全空（0 Error）；全量以 `npm run typecheck` 双 tsconfig 0 Error 实证 |
| `npm run typecheck` 通过 | ✅ | `tsc --noEmit -p tsconfig.web.json && tsc --noEmit -p tsconfig.node.json` 退出码 0，无输出（无错误） |
| `npx vitest run …/shortcutSync.test.ts` 通过 | ✅ | 4 用例全绿（见输出摘要） |
| 映射断言（不含 toggleTheme；含 zoom×3/DevTools 四值） | ✅ | `commandAccelerators.test.ts` Q6/Q7 两用例断言逐值命中（见上表 ①） |
| 手写加速键扫描断言（darwin.ts 无字面量） | ✅ | `commandAccelerators.test.ts` > `darwin.ts has no handwritten accelerator literals`；辅助复核 `grep -n "accelerator:" electron/menu/darwin.ts` 仅命中注释与 `DARWIN_COMMAND_ACCELERATORS[...]` 派生赋值，无字符串字面量 |

### 任务正文阶段 2（自测验收）checkbox 对照

| 阶段 2 条目 | 结果 | 说明 |
|------------|------|------|
| macOS 原生菜单验证（切换主题项无加速键；zoom/DevTools 显示 ⌘+/⌘-/⌘0/⌘⌥I） | 未验证（需 macOS） | 键值已由契约单测钉住（AC-PEND-02 ①），但菜单栏实显 ⌘ 符号与无键状态须真实 macOS 菜单渲染确认；本机 Windows 不得假 ✅ |
| 手动触发四键（Cmd+Plus/Cmd+-/Cmd+0/Cmd+Alt+I）动作通道生效 | 未验证（需 macOS） | 实体 ⌘ 组合键触发为 macOS 专属；动作通道为零改动复用（`zoomBy`/`webContents.toggleDevTools`，`ipc/window.ts` L6-24 既有实现），接线正确性由源码契约确认但不替代实触发 |
| 格式子菜单不挂原生加速键、标签命令不挂 Ctrl+W（不回归） | ✅ | `darwinMenu.test.ts` > `format submenu and tab commands keep no native accelerator`（`bold/italic/inlineCode/strikethrough/highlight/closeTab/reopenClosedTab/nextTab` 在映射中 `undefined`）通过；`shortcutSync.test.ts` > `inline-format chords intentionally have no native accelerator` 通过；darwin.ts L198-200 注释确认标签命令维持 before-input 路由不挂键 |
| toggleTheme 仅 Titlebar 按钮 + 「视图▸切换主题」入口可用 | ✅（契约面）/ 未验证（运行态 UI 冒烟） | 契约面：toggleTheme 无任何加速键通路（映射 `undefined` + 渲染 shortcut 被 reopenClosedTab 遮蔽，按 Ctrl+Shift+T 不会切换主题）；菜单入口存在于 darwin 模板（`commandItem('toggleTheme',…)`，BASELINE_COMMAND_IDS 含 toggleTheme）。Titlebar 按钮运行态点击属 UI 冒烟，超出本任务契约测试面 |
| 自测报告含双源比对记录（zoomIn 例外登记原因核对） | ✅ | 本报告「双源比对记录」节（下） |

### 阶段 3/4 说明

阶段 3（与 FE-03 合流双侧闭环、menu:<id> 转发三平台一致）与阶段 4（QA 复核）不在本自测范围，归 FE-03 合流与 QA 流程；本任务侧契约面已由单测钉住。

## 双源比对记录（zoomIn 例外登记原因核对）

| 命令 id | 渲染侧 `Command.shortcut` | darwin 映射值 | 派生 `Ctrl+`→`Cmd+` | 例外登记 | 登记原因核对 |
|---------|--------------------------|---------------|---------------------|----------|--------------|
| zoomIn | （FE-03 补 `Ctrl+=`） | `Cmd+Plus` | 派生为 `Cmd+=` ≠ `Cmd+Plus` | 是（永久） | 「mac 将 = 键写作 Plus」——与 MENU-menubar §3.4 裁决一致，映射值 `Cmd+Plus` 与例外登记值逐字相同 |
| zoomOut | （FE-03 补 `Ctrl+-`） | `Cmd+-` | 派生一致 | 是（过渡钉值） | FE-03 注册后派生即一致，届时可撤或保留成对钉住 |
| zoomReset | （FE-03 补 `Ctrl+0`） | `Cmd+0` | 派生一致 | 是（过渡钉值） | 同上 |
| toggleDevTools | （FE-03 补 `F12`） | `Cmd+Alt+I` | F12 无 Ctrl→Cmd 派生 | 是（永久） | 平台原生键差异（Win/Linux F12 ↔ mac ⌘⌥I），菜单快捷键提示按平台各自键位显示 |
| toggleTheme | `Ctrl+Shift+T`（残留声明，FE-03 删） | 无（Q6 撤键） | 反向钉住 `NO_ACCELERATOR_BY_RULING` | — | Q6 裁决：Ctrl+Shift+T 唯一归属 reopenClosedTab；切换主题仅 Titlebar 按钮+菜单入口 |
| copyRichText | `CmdOrCtrl+Shift+C` | `CmdOrCtrl+Shift+C` | 原样一致 | 是（P20 既有） | 双修饰符跨平台写法，登记保持 |
| bold/italic/inlineCode | （CM6 keymap） | 无 | 反向钉住 `NO_ACCELERATOR_BY_DESIGN` | — | Mod-B/I/E 归 CM6，原生加速键会抢注（锁定裁决） |

文档漂移登记（doc-drift 已记）：MENU-menubar §3.4 仅点名 zoomIn 例外，未提 toggleDevTools——实测确认必须登记（F12 派生 ≠ Cmd+Alt+I），shortcutSync.test 注释已注明原因。

## 测试命令与输出摘要

```bash
# 工作目录 D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/backend
npx vitest run src/renderer/src/commands/commandAccelerators.test.ts src/renderer/src/commands/shortcutSync.test.ts
```

```
RUN  v5.0.1
 ✓ src/renderer/src/commands/commandAccelerators.test.ts > DARWIN_COMMAND_ACCELERATORS single-source contract (Q6/Q7) > Q6: toggleTheme has no native accelerator (chord owned by reopenClosedTab) 3ms
 ✓ src/renderer/src/commands/commandAccelerators.test.ts > DARWIN_COMMAND_ACCELERATORS single-source contract (Q6/Q7) > Q7: zoom/devtools chords match the MENU-menubar key table 1ms
 ✓ src/renderer/src/commands/commandAccelerators.test.ts > DARWIN_COMMAND_ACCELERATORS single-source contract (Q6/Q7) > darwin.ts has no handwritten accelerator literals (all chords single-source) 1ms
 ✓ src/renderer/src/commands/shortcutSync.test.ts > DARWIN_COMMAND_ACCELERATORS ↔ Command.shortcut > every accelerator entry points at a known command and matches its shortcut 5ms
 ✓ src/renderer/src/commands/shortcutSync.test.ts > DARWIN_COMMAND_ACCELERATORS ↔ Command.shortcut > derivation exceptions are all still registered in the table 1ms
 ✓ src/renderer/src/commands/shortcutSync.test.ts > DARWIN_COMMAND_ACCELERATORS ↔ Command.shortcut > inline-format chords intentionally have no native accelerator 1ms
 ✓ src/renderer/src/commands/shortcutSync.test.ts > DARWIN_COMMAND_ACCELERATORS ↔ Command.shortcut > Q6: toggleTheme stays accelerator-free (chord owned by reopenClosedTab) 0ms

 Test Files  2 passed (2)
      Tests  7 passed (7)
   Duration  4.09s
```

```bash
npm run typecheck
```

```
> veloxmark@1.0.0 typecheck
> tsc --noEmit -p tsconfig.web.json && tsc --noEmit -p tsconfig.node.json
(exit 0, 无错误输出)
```

辅助扫描（手写字面量复核，非门禁命令）：`grep -n "accelerator:" electron/menu/darwin.ts` → 命中均为注释或 `accelerator: DARWIN_COMMAND_ACCELERATORS[...]` 派生赋值，无 `'…'` 字面量。

## 问题清单（如有）

| 级别 | 问题描述 | 复现步骤 | 处置 |
|------|----------|----------|------|
| P2（登记残项，非缺陷） | 渲染注册表 `viewCmds.ts` `toggleTheme.shortcut='Ctrl+Shift+T'` 声明未删（与 reopenClosedTab 同键，行为被 concat 序遮蔽） | 查 `src/renderer/src/commands/viewCmds.ts` L142 | implementation-notes ⑤ 已登记 FE-03 收口（「toggleTheme 删 shortcut」），阶段 3 合流闭环；本任务不动渲染侧（范围裁决） |
| P2（文档漂移） | MENU-menubar §3.4 例外清单未列 toggleDevTools | 对照 `shortcutSync.test.ts` DERIVATION_EXCEPTIONS | 已记 doc-drift，文档宜补一句；测试注释已注明原因 |

## 结论

**通过**（阶段 1 契约面全绿）。3 条 frontmatter AC 的本任务契约面全部 ✅：Q6 darwin 撤键 + 反向钉住、Q7 四键迁入单源 + 手写字面量零命中、双源守护 7/7 全绿且例外均登记原因未放宽。typecheck 双 tsconfig 0 Error。macOS 原生菜单实显与实体 ⌘ 键实触发 2 项标「未验证（需 macOS）」，不假 ✅；toggleTheme 渲染侧 shortcut 声明删除归 FE-03（阶段 3 双侧闭环）。无需修复轮次，无需重新构建。

## API 测试覆盖率

（桌面适配口径：无 HTTP API，无 api-selftest-guide 清单适用面；下表按契约测试维度折算）

| 契约面 | 正向（映射值正确） | 参数校验 | 边界值 | 业务规则 | 异常 | 联动 |
|--------|------------------|----------|--------|----------|------|------|
| `DARWIN_COMMAND_ACCELERATORS` 单源映射（accel:single-source） | ✅（Q6/Q7 断言逐值） | -（纯数据表无参数面） | - | ✅（双源派生比对 + 例外登记制 + 反向钉住） | ✅（未登记漂移→测试失败拦截，构建期暴露） | ✅（darwin.ts 消费侧：commandItem/zoom×3/DevTools 全走映射，源扫描零字面量） |

覆盖率: 4/4 适用维度 (100%)（2 维不适用：纯数据映射无参数校验/边界值面）
