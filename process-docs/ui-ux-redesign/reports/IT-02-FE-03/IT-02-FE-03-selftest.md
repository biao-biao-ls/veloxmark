# IT-02-FE-03 自测报告 — 键位归属清理与补注册（Q6 Ctrl+Shift+T 独占 + Q7 zoom×3/DevTools 注册表侧）

- 任务：`process-docs/ui-ux-redesign/tasks/IT-02/FE-03.md`
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`
- 日期：2026-09-29
- 结论：**阶段 1 开发验收 + 阶段 2 自测验收通过**（阶段 3 与 BE-01 合流后闭环——darwin 侧增删已在 `feature-zhanghuanbiao` 落地，本 worktree 不重复）
- 范围口径：仅渲染进程注册表侧（5 文件）；darwin 加速键侧（`electron/shared/commandAccelerators.ts` / `darwin.ts`）归 BE-01，两侧合并后 `shortcutSync.test` 全绿为跨任务验证点

## 1. 验收标准对照

| AC | 判据 | 结果 | 证据 |
|---|---|---|---|
| AC-PEND-01 | Ctrl+Shift+T 唯一归属 reopenClosedTab，toggleTheme 撤键 | ✅ | `shortcutSync.test` > `Q6: reopenClosedTab is the sole Ctrl+Shift+T owner…`（owners 数组恰为 `['reopenClosedTab']`）；浏览器实测：按 Ctrl+Shift+T 前后 `div.app` 主题类不变、有已关标签时走 reopenClosedTab（§4） |
| AC-PEND-02 | zoom×3/DevTools 四键补注册生效 | ✅ | `shortcutSync.test` > `Q7: zoom/devtools registry chords match the MENU-menubar key table`（四值 + bindGlobal 逐条断言）；浏览器实测：Ctrl+=/Ctrl+-/Ctrl+0/F12 全部触发对应动作（§4） |
| AC-RULE-11 | 回显单源派生零例外 | ✅ | 菜单回显随注册表自动齐/空（FE-02 单源派生，本次零菜单代码改动）；实测视图菜单 zoom 四项回显 `Ctrl+=`/`Ctrl+-`/`Ctrl+0`/`F12`、切换主题回显空（无 span、无占位符） |
| AC-NF-06 | 提示与触发一致率 100% | ✅ | §3 双源审计逐条一致（含 Q6 过渡态登记）；§4 回显↔触发逐键一致（Windows 形态回显=注册表拼写） |

## 2. Q6/Q7 注册表断言（shortcutSync.test 同步用例，TDD RED→GREEN）

TDD 过程：先写 4 组断言运行确认 RED（`owners` 含 toggleTheme、zoomIn shortcut 为 undefined，2 failed / 7 passed），再改注册表与 i18n 转 GREEN（9/9）。

| 用例 | 断言内容 | 状态 |
|---|---|---|
| `Q6: reopenClosedTab is the sole Ctrl+Shift+T owner…` | 恰好一个命令持有 `Ctrl+Shift+T`（`= ['reopenClosedTab']`，bindGlobal）；`NO_CHORD_BY_RULING = ['toggleTheme']` 反向钉住 shortcut 为 undefined（防"顺手补回"） | ✅ |
| `Q6: toggleTheme has no darwin accelerator…` | darwin 侧目标态无加速键；BE-01 合流前仅容忍精确残留 `Cmd+Shift+T`（改键即红）；以 `zoomIn ∈ DARWIN_COMMAND_ACCELERATORS` 为 BE-01 落地标记**自升格严格 `toBeUndefined()`** | ✅（过渡分支） |
| `Q7: zoom/devtools registry chords match the MENU-menubar key table` | `zoomIn=Ctrl+=` / `zoomOut=Ctrl+-` / `zoomReset=Ctrl+0` / `toggleDevTools=F12` 逐值 + 四命令 `bindGlobal: true`（matcher 拾取前提）；darwin 四值在表后自动钉 `Cmd+Plus`/`Cmd+-`/`Cmd+0`/`Cmd+Alt+I` | ✅ |
| 既有机制用例（FE-02） | 正向互检 / 例外原因非空 / 非 pending 例外在表 / Q7 例外 armed（zoomIn `Cmd+Plus`、toggleDevTools `Cmd+Alt+I`）/ inline-format 反向钉住 / AC-NF-06 审计 | ✅ 6/6 保持 |

**过渡态设计（实现要点）**：本 worktree 尚无 BE-01 darwin 改动（表中仍有 `toggleTheme: 'Cmd+Shift+T'`、无 zoom 四键）。`DERIVATION_EXCEPTIONS` 新增 `toggleTheme` `pending` 条目精确容忍该残留（reason 注明过渡态）——注册表撤键后正向互检不红；合流后表中无该 entry，条目自动失效可删，Q6 用例自动升格严格断言。**守护未放宽**：残留只允许预裁决原值，任何改键/补键即失败。

## 3. AC-NF-06 比对记录 — 双源审计（Q6/Q7 后）

记录形状同 `shortcutSync.test` `auditRecords`：`{ cmd, win, darwin, derived, exception }`，`derived = win.replaceAll('Ctrl+','Cmd+')`。本 worktree 当前（BE-01 合流前）15/15 一致（100%）；受影响行：

| cmd | win | darwin | derived | exception |
|---|---|---|---|---|
| zoomIn | （未入 darwin 表，预登记） | Cmd+Plus（BE-01） | Cmd+= | Q7 永久例外：mac 把 =/+ 键写作 Plus |
| zoomOut | （未入 darwin 表，预登记） | Cmd+-（BE-01） | Cmd+- | —（派生一致，FE-03 补注册后自动互检） |
| zoomReset | （未入 darwin 表，预登记） | Cmd+0（BE-01） | Cmd+0 | —（同上） |
| toggleDevTools | （未入 darwin 表，预登记） | Cmd+Alt+I（BE-01） | （F12 无派生） | Q7 永久例外：平台原生键差异（CHANGE-7） |
| toggleTheme | undefined（FE-03 撤键） | Cmd+Shift+T（残留，BE-01 删） | （空） | Q6 过渡登记（pending）：仅容忍该残留 |
| reopenClosedTab | Ctrl+Shift+T | 无 entry（标签命令不挂原生加速键，BE-01 口径） | — | 归属唯一，无双占 |

合流后（阶段 3 预期）：toggleTheme 行消失、zoom×4 行自动纳入正向互检——zoomOut/zoomReset 派生直接一致，zoomIn/toggleDevTools 命中永久例外，一致率仍 100%。

## 4. 浏览器验证（Windows 形态，out 构建 + Electron/CDP 实测）

- 实现图：`IT-02-FE-03-impl.png`（视图菜单展开至缩放/开发与主题组）
- 平台口径：Windows/Linux 自绘 MenuBar 回显 = 注册表拼写（`Ctrl+=` 等）；macOS 自绘菜单隐藏、原生菜单加速键显示形态归 darwin 侧（BE-01），`fmtShortcut` 的 ⌘ 转换单测已钉（含 `Ctrl+= → ⌘=`）

### 4.1 菜单回显（AC-RULE-11 自动齐）

| 菜单项 | Command.shortcut | 实测回显 | 一致 |
|---|---|---|---|
| 放大 | Ctrl+= | Ctrl+= | ✅ |
| 缩小 | Ctrl+- | Ctrl+- | ✅ |
| 重置缩放 | Ctrl+0 | Ctrl+0 | ✅ |
| 开发者工具 | F12 | F12 | ✅ |
| 切换主题 | undefined | 空（无 span、无占位符） | ✅ |

### 4.2 交互逐条

| 交互 | 操作 | 结果 |
|---|---|---|
| Q6 撤键 | 按 Ctrl+Shift+T（无已关标签） | 主题类 `app theme-light` 不变——**切换主题不再被该键触发** ✅ |
| Q6 归属 | 关闭 untitled-2 后按 Ctrl+Shift+T | 已关标签栈弹出恢复（reopenClosedTab 执行；untitled 重编号为 untitled-3 系 useDocIo 既有 `nextUntitledNo` 行为，非本任务面）✅ |
| 视图▸切换主题 | 点击菜单项 | 主题 light→dark 切换执行（id/run 不变）；回显空 ✅ |
| Titlebar 按钮 | 点击 + 查 tooltip | 主题 dark→light 切换执行；`title="切换主题"`（zh 无键位残留）✅ |
| Ctrl+= | 按键 | zoom in：zoomLevel +0.5（dpr 1.0→1.0954，innerWidth 640→584）✅ |
| Ctrl+- | 按键 | zoom out：zoomLevel -0.5（dpr 1.3145→1.2 回落一档）✅ |
| Ctrl+0 | 按键 | zoom reset：→ level 0（dpr 1.0 / 640），与点击菜单「重置缩放」同状态 ✅ |
| F12 | 按键 | DevTools 打开（CDP 新目标 t2 出现）；再按关闭（t2 消失）✅ |
| 菜单放大（对照） | JS 点击菜单项 | 与 Ctrl+= 同路径同幅度（level 0→0.5）——动作通道 `window.api.windowZoom` 零改动复用 ✅ |

en 文案：源码 `'tb.theme': 'Toggle theme'`（无键位残留）+ i18n key 全对齐单测通过（UI 语言在 zh 形态，en 走字典与对齐测试面验证）。

## 5. 测试与质量门禁

| 项 | 命令 | 结果 |
|---|---|---|
| 双源守护 | `npx vitest run src/renderer/src/commands/shortcutSync.test.ts` | ✅ 9/9（6 既有 + 3 Q6/Q7 新增） |
| 命令面回归 | `npx vitest run src/renderer/src/commands/ src/renderer/src/i18n/` | ✅ 6 文件 57 测试 |
| 全量单测 | `npm run test:unit` | ✅ 54 文件 651 测试 |
| 类型检查 | `npm run typecheck` | ✅ 0 Error（tsconfig.web + tsconfig.node） |
| 构建 | `npm run build` | ✅ out/ 构建成功（浏览器验证用） |
| e2e 缝 | 命令 id 字面量 | ✅ 零改动（toggleTheme/zoomIn/zoomOut/zoomReset/toggleDevTools/reopenClosedTab id 全不变） |

## 6. 待联动闭环（阶段 3）

1. **与 BE-01 合流**（darwin 改动已在 `feature-zhanghuanbiao`）：合并后 `npx vitest run src/renderer/src/commands/shortcutSync.test.ts` 应仍全绿——Q6 用例自动升格「toggleTheme 加速键已删」严格断言、Q7 darwin 四值钉住自动生效；届时 `DERIVATION_EXCEPTIONS.toggleTheme` 过渡条目失效可删（连同 pending 注释）。
2. **快捷键三消费方一致性**（AC-RULE-09）：合并后抽查全局快捷键 / MenuBar 回显 / mac 原生菜单加速键指向同一命令行为（macOS 实测项，本机 Windows 不假 ✅）。
3. **文档小项**：`commands/build.ts` 头注释「reopenClosedTab 先于 toggleTheme 同键遮蔽」Q6 后成历史说明（concat 序行为化保留，注释可顺手更新）；`MENU-menubar.md` §3.4 toggleDevTools 例外清单 doc-drift 已由 BE-01 登记（CHANGE-7 合并已对齐）。

## 7. 文件变更清单

| 文件 | 变更 |
|---|---|
| `src/renderer/src/commands/viewCmds.ts` | Q7 四命令补 `shortcut`（Ctrl+=/Ctrl+-/Ctrl+0/F12）+ `bindGlobal: true`；Q6 删 `toggleTheme` 的 shortcut/bindGlobal（id/run 不变） |
| `src/renderer/src/commands/tabsCmds.ts` | 核对无双占残留——`reopenClosedTab` 独占 `Ctrl+Shift+T`（bindGlobal），零改动 |
| `src/renderer/src/i18n/zh.ts` | `tb.theme` → 「切换主题」 |
| `src/renderer/src/i18n/en.ts` | `tb.theme` → 「Toggle theme」 |
| `src/renderer/src/commands/shortcutSync.test.ts` | Q6/Q7 同步用例 3 个 + `NO_CHORD_BY_RULING` 反向钉住清单 + toggleTheme 过渡例外登记（pending） |
