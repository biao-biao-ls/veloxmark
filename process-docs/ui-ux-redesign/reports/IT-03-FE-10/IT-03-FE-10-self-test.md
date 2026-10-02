# IT-03-FE-10 自测报告 — 公式/代码/mermaid 块观感审计微调与非回归（双区/错误态/last-good 保持 + 导出联动核验）

- 任务：`process-docs/ui-ux-redesign/tasks/IT-03/FE-10.md`
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend`
- 日期：2026-09-30
- 验收：AC-FN-20 / AC-OP-18 / AC-OP-20 / AC-ERR-10 / AC-ERR-11 / UI-IXD-15（+ AC-RULE-17 缝契约切片）
- 契约：`ren-block:audit-preserve`（零契约变更，PEND-14 观感豁免幅度）
- 实现图：
  - [IT-03-FE-10-impl.png](./IT-03-FE-10-impl.png)（块族总览，浅色主题）
  - [IT-03-FE-10-impl-dualpane-math-error.png](./IT-03-FE-10-impl-dualpane-math-error.png)（公式双区 + 预览错误态）
  - [IT-03-FE-10-impl-math-error.png](./IT-03-FE-10-impl-math-error.png)（公式错误条 + 跳源码入口）
  - [IT-03-FE-10-impl-mermaid-lastgood.png](./IT-03-FE-10-impl-mermaid-lastgood.png)（mermaid last-good dim 态 + 错误条）
- 浏览器验收：CDP 驱动 [IT-03-FE-10-cdp-driver.mjs](./IT-03-FE-10-cdp-driver.mjs)，结果 [IT-03-FE-10-cdp-data.json](./IT-03-FE-10-cdp-data.json) / [IT-03-FE-10-run.log](./IT-03-FE-10-run.log) — **98/98 checks passed**

## 0. 环境与测量口径

| 项 | 值 |
|---|---|
| 被测构建 | Electron `out/main/index.js` 产物（`npm run build` ✓，构建产物 CSS 已含 `--errbar-*` token），全新实例：CDP `http://127.0.0.1:9478` + 独立 `user-data-dir=D:/code/typora/temp/it03-fe10-userdata`（每轮验证前杀自有进程树、重新拉起） |
| 驱动 | Node v22.18.0 + WebSocket CDP；`Page.bringToFront` + `Page.setWebLifecycleState(active)` + `Emulation.setFocusEmulationEnabled`（防遮挡拖慢定时器）；`Runtime.evaluate` 全部带 12s 墙钟超时 |
| 运行窗口 | 2026-09-30T06:35:02.400Z → 06:35:28.717Z（截图与断言同一次运行） |
| fixture | `frontend/it03-fe10-audit-selftest.md`（driver 权威写盘）：块级公式 `E = mc^2` + 行内公式、3 行 js 代码块、mermaid `graph TD A[Start]-->B[End]`、任务 1 勾 1 未勾、有序 2 项、链接 `https://example.com/design-spec`、图 `=200x100{align=center}`（`it03-fe10-fixture.png` 200×100）、2 列表格 |
| 草稿对话框 | 若现「恢复未保存的草稿」一律点「稍后」（dismissDraftDialog）——本轮启动无弹窗；**从未丢弃草稿** |
| undo/autosave | `__veloxP13.getDoc()` 源码 diff + 磁盘读回（autosave 落盘真实文件） |
| 对比度 | 页内 WCAG 相对亮度（fg 对复合底色 alpha 合成后 ≥4.5:1），逐元素 computed style + token 读数双口径 |
| 编辑输入 | `Input.insertText` 真实键入路径（选区 dispatch + `view.focus()`），失败才回退 `dispatch({changes, userEvent:'input.replace'})`（本轮全部 `usedFallback:false`） |

## 1. 改动面（观感审计微调，零契约变更）

| 文件 | 改动 | 说明 |
|---|---|---|
| `src/renderer/src/styles/themes.css` | 新增 `--errbar-fg/--errbar-bg/--errbar-border`（light/dark 各一套） | 公式/mermaid 错误条琥珀色族 theme-split（F08：主题差异只翻 token 值）；色值与改前硬编码**逐字节一致**（light `#b45309`/`rgba(245,158,11,.14)`/`#f59e0b`，dark `#fcd34d`/`rgba(245,158,11,.18)`/`#d97706`）——零视觉变化，未触发 4 处主题色副本同步纪律（未改色） |
| `src/renderer/src/styles/markdown.css` | `.cm-md-mermaid-error,.cm-md-math-error` 改吃 `var(--errbar-*)`；**删除** `.theme-dark .cm-md-mermaid-error/.cm-md-math-error` 补丁 | 改前是全仓唯一选择器级 `.theme-dark` 补丁（宪法明令禁止项），本次收口为 token 翻转 |
| `src/renderer/src/styles/code-chrome.css` | 裸 px → token：`padding-right: var(--space-3)`、`calc(var(--space-2) - var(--space-half)) var(--space-3)`（6px pad-y 用注释标定）、`font-size: var(--text-meta)/var(--text-caption)`、`border: var(--border-width) solid var(--border)` | 数值等价；mask-image 的 `#000` 为蒙版亮度值非主题色，保留 |
| `src/renderer/src/styles/render-zone.css` | 零改动（FE-01 已全 token 化，审计通过） | — |
| `src/renderer/src/editor/livePreview/dualPane.ts` | **零 diff** | 逻辑不动（AC：逻辑 diff 为空） |
| `src/renderer/src/editor/livePreview/codeBlockUi.ts` | **零 diff** | 同上 |
| `src/renderer/src/export/` | **零改动**（回归核验面） | FE-04 的图片对齐导出改动在 `inline.ts`（他人任务面，未触碰） |

非回归/边界纪律执行：heading-fold 装饰管线（FE-07 面）未触碰；clickSemantics/TaskWidget 点击闸门/widgets-extended（FE-09 面）未触碰；hoverDiscipline 时序未动；toast.*/ctx.*/err.* i18n 冻结契约未动（本任务零新文案）；表格 `widget.ts` 仅被并发任务（FE-06/FE-09 族）改动，非本任务产物。

## 2. S1 双区编辑 + AC-OP-20 / UI-IXD-15

fixture 公式块点击进双区（源码区 + 预览区并排）：

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 双区面板浮现（AC-FN-20 判据1） | 源码行（`cm-md-math-src` + `-first`/`-last`）≥2 + 预览区 1 | srcLines=3（first=1,last=1）、preview=1、previewKatex=1 | ✓ |
| 退出 chip（「公式 ✓」） | `cm-md-math-edit-chip` 在位 | chip=1，text=「公式 ✓」 | ✓ |
| 输入合法源码即时渲染 | 真实键入 `F = ma`，预览 KaTeX 即时更新 | `usedFallback:false`，doc 同步含 `F = ma`，预览渲染含 F=ma | ✓ |
| 退出回渲染态（AC-OP-20 判据2 / UI-IXD-15） | 回渲染态、内容为编辑后内容、面板消失无残留 | afterExit：srcLines=0, preview=0, chip=0, rendered=1（F=ma） | ✓ |
| .md 同步 + autosave 落盘（AC-OP-20 判据3） | 磁盘文件含编辑后内容 | autosave 时间戳 1790750107634，磁盘读回 `onDiskHas:true` | ✓ |
| 一次 Ctrl+Z 还原 | 单步 undo 回编辑前 | undo 后 doc 回 `E = mc^2` | ✓ |

## 3. S2 公式错误态 AC-ERR-10（全判据）

双区中输入非法 TeX `\frac{1}{`：

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 错误态标识、不显示乱码（判据1） | 预览区错误标识（非乱码） | 预览渲染 KaTeX 错误 span（结构化，非乱码）；退出后 `cm-md-math-error` ×1 | ✓ |
| 错误条文案 + 跳源码入口（判据2 前置） | 「公式渲染失败」+「跳到源码」 | errorText=「公式渲染失败」，jump=1，jumpText=「跳到源码」 | ✓ |
| 点击跳源码光标定位源码区（判据2） | 光标落入 `$$` 块 | 点击后 sel.from=26 ∈ blockFrom=26 起 40 字符窗；源码面板行在位（srcPanel=3） | ✓ |
| 源码区保留用户输入（判据3） | `\frac{1}{` 不被清空 | `has:true` | ✓ |
| 修复后错误条消失 | 回正常渲染态 | 修复输入生效（usedFallback:false），errorBar=0、rendered=1（E=mc2） | ✓ |

## 4. S3 mermaid last-good AC-ERR-11（全判据）

合法 `A[Start]-->B[End]` 渲染 SVG 后，点 wrap padding 进双区（**svg 本体点击是 FE-09 AC-RULE-13 的 lightbox 手势**，padding/error-bar 点击才走 click-to-source——驱动先扫 padding 命中点 `hit.via='padding'`，lightbox=0），破坏语法为 `A[Start`：

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| last-good 图保留、不白屏（判据1） | 保留上次成功渲染图 | preview svgCount=1（旧图 Start→End） | ✓ |
| last-good dim 失效标识 | 更新中/失效标识 | `is-dim` ×1 + badge「更新中」 | ✓ |
| 错误条 + 跳源码入口（判据2） | 错误条可见 + 跳源码 | errorBar=1（hidden=false，Parse error on line 2…）、jump=1 | ✓ |
| 跳源码定位 fence 内 | 光标进 ` ```mermaid ` 源范围 | sel.from=163 ∈ fence=154 起 80 字符窗 | ✓ |
| 修复后重渲染为新图（判据3） | 新 SVG（含 Start2）非 dim | previewError=0、previewSvg=1、previewText 含 `Start2End`、isDim=0 | ✓ |
| 退出后渲染态为新图、预览面板无残留 | 渲染态新图 + preview 消失 | preview=0、rendered svg 含 Start2End | ✓ |

## 5. S4 深浅主题观感走查（AC-FN-20 判据 + PEND-14）

在错误态上场（公式错误条 + mermaid 错误条）后 `__veloxP20.setThemePref` 切换逐主题走查（`.app` host 类名翻转确认）：

| 口径 | 浅色 | 深色 | 结果 |
|---|---|---|---|
| `.cm-md-math-error` 错误条对比度 | 4.513:1 | 8.199:1 | ✓ ≥4.5 |
| `.cm-md-mermaid-error` 错误条对比度 | 4.513:1 | 8.199:1 | ✓ ≥4.5 |
| token 口径 `--errbar-fg` over `--bg`+`--errbar-bg` | 4.513:1 | 8.199:1 | ✓ ≥4.5（与元素口径一致，token 链路真生效） |
| `--fg-dim` on `--bg` | 5.329:1 | 5.925:1 | ✓ |
| `--fg-dim` on `--widget-surface` | 5.106:1 | 5.442:1 | ✓ |
| 代码 idle chip / mermaid badge / expander | 5.106 / 5.329 / 5.106 | 5.442 / 5.925 / 5.442 | ✓ |
| `--errbar-*` 随主题翻转（无 `.theme-dark` 补丁亦生效） | light `rgb(180,83,9)`(#b45309) | dark `rgb(252,211,77)`(#fcd34d) | ✓ 值翻转且等于设计琥珀色 |
| 深主题块级 chrome 无硬编码浅色块 | —（浅主题本就浅色面，按口径只查深色） | `noLightBlocks: []` | ✓ |

浅色错误条 4.513:1 是原值即有的边界通过（本次零改色、保持 last-good 观感，符合 `ren-block:audit-preserve`）；如需抬高留待专门改色任务走 4 副本同步纪律。

## 6. S5 导出三通道 AC-OP-18 + FE-05 链接段复验（联调阶段）

前置真实编辑操作集：点任务勾选（未勾 → 勾，doc 中 `[x]` ×2）；点表格 cell 进编辑态后拖 `col-grip` +40px（FE-03 删4留1 契约 `{col-grip}` 命中），`__veloxPrefs.getSession().tableColWidths` 写入 `{"416":[431,336]}`（显示态）。

三通道导出（`__veloxP04.setExportStub` 捕获 HTML 通道物 + PDF 打印渲染源 → `IT-03-FE-10-export-html.html` / `IT-03-FE-10-export-pdf-render.html`（各 394,769 B，同一 renderDoc 管线）；`__veloxP20.copyRichText/getClipboard` → `IT-03-FE-10-export-rich.html`（20,572 B，inline 风格化 fragment））。DOMParser 逐项比对：

| 判据（AC-OP-18 判据2/3） | HTML | PDF | 富文本 | 结果 |
|---|---|---|---|---|
| 导出流程完成并生成导出物（判据1） | ✓ 394,725 B 捕获 | ✓ 含 pdfOpts(A4) | ✓ 20,530 B | ✓ |
| 公式渲染（KaTeX）与编辑视图一致 | katex≥2 ✓ | ✓ | ✓ | ✓ |
| 任务勾选态一致（1 勾 1 未勾写入） | `[checked, checked]` 2 box ✓ | ✓ | ✓ | ✓ |
| 图片尺寸与对齐（200×100 + center） | width=200,height=100,`margin-left:auto;margin-right:auto` ✓ | ✓ | ✓ | ✓ |
| 链接 URL 与 .md 一致 | 含 `https://example.com/design-spec` ✓ | ✓ | ✓ | ✓ |
| 列表顺序（有序第一项 < 有序第二项） | ✓ | ✓ | ✓ | ✓ |
| 代码渲染（pre/code + 高亮 span） | ✓ | ✓ | ✓ | ✓ |
| mermaid 渲染为 SVG | ✓ | ✓ | ✓ | ✓ |
| 表格列宽显示态**不**写入导出物（判据3） | width attr=0、style width=0、colgroup=0 ✓ | ✓ | ✓ | ✓ |
| 表格单元格内容一致（cell one） | ✓ | ✓ | ✓ | ✓ |

**FE-05 遗留委托复验（链接段三通道一致性）**：三通道 href 集合完全一致（均 == `[https://example.com/design-spec]`）且源自 .md——`.md` 单源的构造性保证在实测中成立，**委托闭环**（该项在 FE-05 报告为构造性论断、留待本阶段复验，现已实测）。

## 7. S6 非回归契约扫描（阶段 4 / AC-RULE-17 切片）

| 扫描面 | 结果 |
|---|---|
| 双区/块级 chrome DOM 契约静态类可达 | `cm-md-math-block/code-block/mermaid/mermaid-svg` 全在位；双区/错误态类（`math-src[-first/-last]`、`math-edit-chip`、`math-error/jump`、`code-src[-first/-last]`、`code-src-chip/idle-chip/expander`、`mermaid-preview/error/jump/badge`）源码可达且运行期按态出现（S1–S3 已逐态断言） |
| CSS 契约规则全在 | 10 个契约类全部仍有样式规则命中（math-error:1, mermaid-error:1, jump:2×2, math-src:3, code-src:7, mermaid-preview:1, edit-chip:1, expander:2, idle-chip:5） |
| `window.__velox*` 缝 key 集 | 基线 24 键全程不变、无消失；仅多出懒装缝 `__veloxTableCellView`（表格嵌套编辑会话在 S5 首用后安装，`nestedSession.ts` 既有契约，白名单放行）——无意外新增/丢失 |
| `data-op` 集可扫描 | 6 项：`TBL-MOR-OPN/alignCenter/alignLeft/alignRight/deleteTable/resizeTable`（表格菜单面，与本任务无涉） |
| 命令 id / i18n 冻结契约 | 本任务零命令/零文案改动（`toast.*`/`ctx.*`/`err.*` 未触碰） |

## 8. 质量门禁（收敛恒定）

| 门禁 | 结果 |
|---|---|
| `npm run typecheck`（双 tsconfig） | **0 error**（tsconfig.web + tsconfig.node 全过） |
| `npm run test:unit` | **820/820 passed（64 files）** |
| dualPane/codeBlockUi 逻辑 diff 为空 | `git diff --stat` 对两文件为空（仅 css/样式 class 变更面） |
| e2e 缝未破坏 | S6 扫描通过（上表） |

> 备注：验证中途共享 worktree 曾瞬时出现 `table/widget.ts` 并发编辑（FE-06/FE-09 族任务同文件推进）引起的 typecheck/test 抖动（`TableWidgetSpec.editing` / `editMode.test.ts`），与本任务改动面无关；并发收敛后复跑门禁即全绿。本任务产物不包含 `table/widget.ts`。

## 9. AC 逐条判定（QA 阶段 · REN-render-zone.md §5 映射）

| AC | §5 映射 | 判定 | 证据 |
|---|---|---|---|
| AC-FN-20 | §3.7 双区编辑/错误态/last-good/跳源码保持 | **通过** | 判据1：S1 双区 + S6 DOM/CSS 契约；判据2：S2 错误条+跳源码；判据3：S3 last-good；判据4：S1/S3 退出回渲染态 |
| AC-OP-18 | §3.1/§3.2 导出三通道一致；列宽不导出 | **通过** | S5 三通道逐项比对 30 项全绿 + 列宽 `tableColWidths` 显示态写入而导出物零 width |
| AC-OP-20 | §3.7 双区即时渲染、退出回渲染态、undo | **通过** | S1：即时 KaTeX + 退出渲染态 + autosave 落盘 + 单步 Ctrl+Z 还原 |
| AC-ERR-10 | §3.7 公式错误态 + 跳源码 + 输入保留 | **通过** | S2 全判据（错误标识非乱码、跳源码定位、输入保留、修复消失） |
| AC-ERR-11 | §3.7 mermaid last-good + 错误条 + 修复重渲染 | **通过** | S3 全判据（保留旧图 dim、错误条+跳源码、修复为新图） |
| UI-IXD-15 | 双区退出后面板消失无残留 | **通过** | S1 afterExit（srcLines/preview/chip 全 0）；S3 退出 preview=0 |
| AC-RULE-17（切片） | 缝契约 | **通过** | S6：`__velox*` 基线键无丢失、无意外新增（懒装 `__veloxTableCellView` 为既有契约）；data-op 可扫描；命令/文案零改动 |

## 10. 动态发现（已记入任务 frontmatter）

1. **错误条琥珀色族已 token 化**（`--errbar-*`，themes.css theme-split）——后续块级 chrome 改观感应继续走 token，勿再写死色值或加 `.theme-dark` 选择器补丁。
2. **mermaid svg 本体点击 = lightbox（FE-09 AC-RULE-13）**；进源码编辑的手势是 wrap padding / 错误条 / placeholder 点击。自动化/后续任务注意勿把 svg 中心点击当作"进编辑"路径。
3. **col-grip 只在表格编辑态挂载**（`spec.editing` + 表头 cell，FE-03）——测列宽拖拽前须先点 cell 进编辑态。
4. **`__veloxTableCellView` 是懒装缝**（表格嵌套编辑会话首用时挂到 window）——`__velox*` key 集断言需允许该白名单增量。
5. 浅色错误条对比度 4.513:1 为原值边界通过（本次零改色保持 last-good）；如需抬高属改色任务，须走 4 副本同步（styles token / exportCss / palette / hljsTokens）。
