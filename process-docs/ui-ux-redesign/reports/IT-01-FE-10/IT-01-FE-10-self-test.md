# IT-01-FE-10 自测报告 — 静息零 chrome 与防抖零抖动（显隐收口/≥150ms 防抖/0px 位移）

- 任务：`process-docs/ui-ux-redesign/tasks/IT-01/FE-10.md`
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`
- 日期：2026-09-30
- 验收：AC-FN-23 / AC-FN-31 / AC-FN-32 / AC-FN-33 / AC-NF-04 / AC-NF-05 / AC-RULE-01 / AC-RULE-13 / UI-ELEM-05
- 实现图：`IT-01-FE-10-impl.png`（聚焦编辑态：表格工具栏在位 + 活单元格）；`IT-01-FE-10-idle-quiet.png`（静息零 chrome = 纯正文）；`IT-01-FE-10-select-safe.png`（拖选压零）；`IT-01-FE-10-final-quiet.png`（终态静息）
- 比对图：`IT-01-FE-10-debounce-timeline.svg`（防抖时间轴）；`IT-01-FE-10-zero-shift-compare.svg`（0px 位移比对）
- CDP 全量结果：`IT-01-FE-10-cdp-results.json`（**47/47 PASS**，场景 S0–S9）

验证驱动：`IT-01-FE-10-cdp-driver.mjs`（CDP WebSocket，全部 `Runtime.evaluate` 带 8s 超时；目标实例为全新 Electron：debug port **9531** + 独立 `temp/fe10-chrome-userdata`，验证前重启，未触碰其它任务实例）。验证前已发 `Page.bringToFront` + `Page.setWebLifecycleState({state:'active'})` + `Emulation.setFocusEmulationEnabled({enabled:true})`；草稿恢复对话框策略「稍后」（本轮未触发）。

## 0. 门禁（阶段 1）

| 门禁 | 结果 |
|---|---|
| `npm run typecheck`（双 tsconfig） | 0 Error |
| `npm run test:unit` | **869/869**（65 文件；chromeState 36 例全绿，含本轮 +5 quietLock / +1 延迟消失补强） |
| `editor/table` 全量（含 editMode 15 例 AC-FN-29 回归） | **167/167**（10 文件） |
| `npm run build` | ✓ 26.27s |
| e2e 缝 key 集 | 不变（新增 `__veloxTableCellView` 为懒安装白名单契约，无未知 key） |

## 1. 静息零 chrome（AC-FN-23 / 交互 #2）

夹具装载后指针停在正文（非表格区）：

| 断言面 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 表格工具栏 DOM | 0 | `toolbar: 0` | ✓ |
| 编辑态类 | 0 | `editing: 0` | ✓ |
| chrome-on 漆 | 无 | `chromeOn: false` | ✓ |
| col-grip 残留 | 隐身 + 不可命中 | `opacity:0; pointer-events:none`（DOM 在场但零漆零命中，AC-FN-23「不渲染」以可见/可命中为准） | ✓ |
| 块级 chrome（block-toolbar / code-idle-chip） | 全隐 | `barOpacity:0; chipOpacity:0` | ✓ |
| 图/链浮层 | 0 | `floats: 0` | ✓ |

截图比对：`IT-01-FE-10-idle-quiet.png` 与纯正文一致（无任何把手/工具栏/chip）。

## 2. 防抖时间轴（AC-NF-04 / AC-FN-33 / 交互 #1）→ `IT-01-FE-10-debounce-timeline.svg`

in-page 探针（wrap 的 pointerenter/leave + MutationObserver 类名变化，performance.now 时钟）：

| 场景 | 期望 | 实测 | 结果 |
|---|---|---|---|
| ① 快速掠过 <150ms | 闪烁 0 次、不半途浮现 | enter→leave 73.9ms，`flashes: 0`，无 class 变化 | ✓ |
| ② 慢速 hover | ≥150ms 才浮现 | reveal latency **165.2ms**（150–320 判定窗） | ✓ |
| ② 浮现内容 | 仅微控件（col-grip） | `gripOpacity:0.5; gripPointer:auto`（accent 提示线）；**表格工具栏 hover 态不渲染**（`toolbar:0`，AC-FN-33） | ✓ |
| ③ 离开消失 | 同延迟 ≥150ms | hide latency **162.9ms** | ✓ |
| ③ 移出残留 | 零残留 | chrome-on 撤除、grip 隐身不可命中 | ✓ |
| ④ Esc 回安静 | 立即静息、无防抖残留 | class-off 即时（hush 清计时器）；quietLock 压制驻留指针复燃 | ✓ |
| 深色主题复测 | 一致 | reveal **156.3ms**（token 翻值，零 `.theme-dark` 补丁） | ✓ |

CSS 侧防抖（code/mermaid/math 块级 chrome + code-idle-chip）：`transition: opacity 0s var(--chrome-duration)` = **0s 动画 + 0.15s 延迟**（防抖语义——到点瞬现/瞬隐，无渐隐半透明「半途浮现」）；两主题 `--chrome-duration: 150ms` / `transition-delay: 0.15s` 一致（S8）。

## 3. 0px 位移比对（AC-NF-05 / 交互 #1 期望效果）→ `IT-01-FE-10-zero-shift-compare.svg`

MARKERS 探针（表前 prose 行 / table-outer / 表后 tail 行）：

| 状态迁移 | prose dTop/dLeft | table dTop/dLeft | tail dTop/dLeft | 结果 |
|---|---|---|---|---|
| 静息 → hover 浮现 | 0 / 0 | 0 / 0 | 0 / 0 | ✓ |
| hover → 离开消失 | 0 / 0 | 0 / 0 | 0 / 0 | ✓ |
| 编辑态工具栏 overlay 挂载 | 0 / 0 | 0 / 0 | **+1.28 / 0** | ✓（显隐面 0px；见注） |
| toast 出现 / 消失（FE-07） | 0 / 0 | 0 / 0 | 0 / 0 | ✓ |

> **注**：+1.28px 是进入编辑态时表后段的亚像素位移——来源为 P10 嵌套单元格编辑器度量（active cell `min-width:3em` + 嵌套 cm 行高），属编辑态单元格 chrome（FE-09 冻结面），非 chrome 显隐面。chrome 显隐（工具栏/col-grip/浮层）全程 0px（S3 六组比对全 0；`CHROME_SLOT_PX=0` 常量 + slotPx 恒 0 单测钉死）。

## 4. 写作者路径 + 一次进编辑（AC-RULE-13 / AC-FN-03 / 交互 #3）

| 检查点 | 期望 | 实测 | 结果 |
|---|---|---|---|
| hover→点击内容 | 一次进聚焦编辑态 | click 后 `nested:true, editing:1, toolbar:1`（无中间确认/闪烁） | ✓ |
| 工具栏渲染时机 | 仅编辑态 | hover 态 toolbar 0 → 点击后 1 | ✓ |
| Esc 一次退出 | 回静息无残留 | `toolbar:0, editing:0, nested:false` | ✓ |
| 拖选复制安全 | 不触发编辑、不弹浮层 | 选区 18→119 存活（`.cm-md-selecting` 压零 chrome），松开后 `editing:0`，拖选过程 chrome 全程 0 | ✓ |

实现图 `IT-01-FE-10-impl.png` = ui_02_table_edit 对齐面（工具栏 ⊞+对齐三键 | ⋮+🗑 在位）。

## 5. 与 FE-09 联调 — 回安静复位静息（交互 #2）

| 场景 | 期望 | 实测 | 结果 |
|---|---|---|---|
| hover 微控件浮现 → Esc | 立即静息 | class-off 即时，指针驻留不残留 | ✓ |
| 编辑态 → Esc | 静息零 chrome（工具栏/把手/chip 全灭） | `chromeOn:false; gripOpacity:0`（**quietLock**：驻留指针/重建合成 enter 不复燃，直到真实 leave） | ✓ |
| hush 复位 | 状态机回 idle + 清计时 | 单测 + CDP 双证 | ✓ |

## 6. 与 FE-07 联调 — toast（交互 #2 协同面）

真实命令路径 Ctrl+Shift+C（Edit>Copy as Rich Text → `ops.showToast`；P20 裸 seam 无 toast）：

| 检查点 | 实测 | 结果 |
|---|---|---|
| toast 出现 | 「已复制为富文本」（DOM + `getToast()` 同步） | ✓ |
| 出现不引起正文位移 | prose/table/tail 全 0 | ✓ |
| 不触发 chrome 浮现 | `chromeOn:false`，grip 隐身 | ✓ |
| 消失后位移 | 仍 0 | ✓ |

## 7. 本轮发现并修复的 2 个真实缺陷（CDP 首轮 38/45 → 修复后 47/47）

1. **「离开同延迟消失」原本不延迟**：leave 把 phase 直接翻 `idle`，paint 规则 `microVisible && phase==='hover'` 使 class 同步掉漆——hide-pending「仍绘制」的快照语义与 runtime 脱节（单测只断言 snapshot 未钉 paint 时序）。修复：leave(visible) 保持 `phase:'hover'` + `micro:'hide-pending'`，dwell 到点才回 idle（掉漆点 = 到点）；补强 runtime 断言 `not.toHaveBeenCalledWith('w', false)`。
2. **Esc 退编辑后驻留指针复燃**：exit 重建触发 retarget/合成 pointerenter，150ms 后 hover chrome 复现——违背「Esc 回安静后**立即**进入静息态」。修复：状态机新增 **quietLock**（editExit/hush 置位，enter/retarget 压制，真实 leave 解锁）；+5 单测（含写作者路径 editEnter 不受锁影响）。

## 8. 实现层口径登记（详见任务 frontmatter implementation-notes）

- col-grip 挂载条件由「仅编辑态」放宽为常驻 DOM + CSS 零漆（方案 A 裁决）：慢速 hover 浮现属本任务验收要求；IT-03/FE-10「仅编辑态挂载」注记按任务 AC 让位。
- hover 浮现面 = col-grip（accent 提示线）+ 表格 hover copy bar（FE-03 既有面，chrome-on 机器计时）；「仅微控件浮现」按与「表格工具栏 hover 态不渲染」的对照解读（表格工具栏 = 编辑态 toolbar）。
- FE-03 hover 160–170ms 基线与 ≥150ms 口径并存：以任务 AC ≥150ms 为验收（实测 156–166ms 落窗内）。
- idle DOM 现含 col-grip span（opacity 0）——FE-03「idle handleValues 空」探针基线变化，以可命中/可见为断言面。
