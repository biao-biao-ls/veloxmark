# IT-03-FE-09 自测报告 — 点击语义固化与纯选中保护

| 项 | 值 |
|---|---|
| 任务 | ui-ux-redesign/IT-03/FE-09「点击语义固化与纯选中保护（点击进编辑 / 拖选复制不弹 chrome）」 |
| 被测构建 | `npm run build` 产物 `out/main/index.js`（electron-vite 3，含 clickSemantics + hoverZones 守卫 + CSS `.cm-md-selecting`） |
| 运行实例 | 全新 Electron（独立调试端口 + 独立 user-data-dir `D:/code/typora/temp/it03-fe09-userdata`），CDP `http://127.0.0.1:9457`，page title VeloxMark |
| 驱动 | `IT-03-FE-09-cdp-driver.mjs` → `IT-03-FE-09-cdp-data.json` + `IT-03-FE-09-run.log` |
| 结果 | **51/51 checks passed**（AC-RULE-13 / AC-FN-17 / AC-FN-18 全判据覆盖） |

## AC 证据映射

### AC-RULE-13 点击语义裁决（内容点击进编辑 · 纯选中安全 · 相邻一致）

| 判据 | 证据（run.log check 名） | 结果 |
|---|---|---|
| 点击元素内容 → 进入该元素编辑形态（写作者路径优先） | S3 点文本 → 文本编辑态（光标就位）；S3 点表格单元格 → 表格编辑形态；S3 点公式 → 源码形态（光标进 `$$` 源范围 276、widget 让位）；S3 点代码 → 源码形态（光标进 fence 313 + `.cm-md-code-src` 行可见）；S3 点图 → 图编辑浮层；S3 点 mermaid → 预览形态（lightbox） | ✓ |
| 纯选区松开 = 选中/复制安全动作，不进编辑 | S1 拖选松开后选区非空覆盖 Alpha 段 + S1 纯选中不进编辑（表格未激活/无 lightbox/无图浮层） | ✓ |
| 图/表/代码相邻处反复点击语义一致、一次点击一种语义 | S4 相邻区点击循环 1/2：图→浮层、文→文本（光标 349 + 浮层点击外消失）、表→单元格，两轮确定性一致 | ✓ |
| 陈旧选区不锁写路径（写作者优先） | S2 拖选后直接点图仍进编辑浮层（`selectionEmpty:true` 供给：widget 手势不可选中，构造上是点击） | ✓ |

### AC-FN-17 逐元素点击进对应编辑形态、无无关浮层（全 4 判据）

| 判据 | 证据 | 结果 |
|---|---|---|
| 1 文本 → 文本编辑 | S3 点文本 → 文本编辑态（from=525 就位）+ 无任何浮层 | ✓ |
| 2 表格 → 表格编辑形态 | S3 点表格单元格 → nested 编辑器挂载（row=1,col=0）+ `.cm-md-table-editing` + 编辑工具栏；无无关浮层 | ✓ |
| 3 数学/代码/图 → 对应源码/编辑形态 | S3 公式 → `$$` 源形态（widgets=0）；代码 → fence 源形态（srcLines=3）；图 → 编辑浮层（imageFloat=1，判据「图=编辑浮层」）；mermaid → lightbox（edit:mermaid 预览形态） | ✓ |
| 4 图/表/代码相邻区点击不弹无关浮层 | 各元素点击后 unrelated-chrome 探针（imageFloat/linkFloat/listHandle/tableEditing/mermaidLightbox/blockToolbar/idleChip 交叉）全 0；S4 两轮循环重复验证 | ✓ |

### AC-FN-18 拖选文本松开 = 选中复制（全 3 判据）

| 判据 | 证据 | 结果 |
|---|---|---|
| 1 仅选区高亮 | S1 松开后选区非空（from=34,to=167，覆盖 Alpha→Beta）；impl 截图可见选区高亮、状态栏「选中 133 字符」 | ✓ |
| 2 剪贴板得文本 | S1 Ctrl+C 后 `window.api.clipboardRead()` = 133 字符，含 "Alpha plain paragraph" | ✓ |
| 3 不进编辑、无浮层/把手/chip | S1 松开后 chrome 探针全 0（imageFloat/linkFloat/listHandle/imageToolbar/blockToolbars/idleChips/tableEditing/mermaidLightbox/dragGhost/dropIndicator）；拖动进行中同样全 0（`event.buttons!==0` hover 守卫）；选区存活时 hover 代码块 chip/toolbar 压零（`.cm-md-selecting` CSS 守卫） | ✓ |
| 补充：拖选含链接文本不弹链接浮层 | S5 拖选 Beta（含 `[a link]`）→ linkFloat=0 | ✓ |
| 补充：拖选列表文本不触发把手拖拽 | S5 拖选 list alpha/beta 行 → 得文本选区（"list alpha row\n- list "），全程 listHandle/dragGhost/dropIndicator 均 0 | ✓ |

### 阶段 3 联调与零回归

| 项 | 证据 | 结果 |
|---|---|---|
| FE-04 联调：点图进编辑浮层 | S5 编辑浮层全件：对齐三键（◧▣◨）+ 宽度选择 + ✓完成 + 缩放角柄（image-resize-handle） | ✓ |
| FE-05 联调：hover 链接浮层不被点击路由误触 | S5 hover 链接 → link-hover-float 照常浮现（~160-182ms）；点链接旁纯文本 → 无任何无关浮层（点击路由不弹链接浮层） | ✓ |
| FE-06 联调：拖选列表不触发把手拖拽 + hover 把手不回归 | S5 拖选列表无把手/ghost/指示线；清选区后 hover 行首把手照常浮现（~167ms） | ✓ |
| AC-FN-03 单元格激活零回归 | S3/S6 点 cell one → nested + editing + toolbar | ✓ |
| AC-FN-32 激活转移零回归 | S6 A(1,0)→B(1,1)：B 持有嵌套编辑器 | ✓ |
| AC-FN-29 现状语义保持 | S6 表格 gap 空白点击 → 退出单元格编辑 + 光标回表格源（from=169=TABLE_FROM）——**现状为整体退出**，「分级退格」模型缺口见下方跨任务缺口 | ✓（现状） |
| e2e 缝硬契约 | S7 `window.__velox*` 缝零丢失（24 个基线缝全在）；新增仅 `__veloxTableCellView`（已知惰性缝，首次嵌套单元格会话挂载）；P12/P13/P18/P21/Table/Editor 前置自检全绿 | ✓ |
| 文档零写入 | S7 全程纯点击/拖选后 `getDoc()` 与夹具逐字节一致（558 字符） | ✓ |

## 质量门禁

| 门禁 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npm run typecheck`（tsconfig.web + tsconfig.node） | 0 Error ✓ |
| 单元测试 | `npm run test:unit` | 63 文件 795 tests 全过（含 clickSemantics 26 项：6 hitTarget × 空/非空选区全矩阵 + chromeAllowed + hitTargetFromTarget）✓ |
| 构建 | `npm run build` | 成功（electron-vite ~23s）✓ |
| CDP 自测 | `IT-03-FE-09-cdp-driver.mjs` | 51/51 ✓ |
| e2e 缝 | S0/S7 缝自检 | 未破坏 ✓ |

## 实现要点（AC 裁决模型）

新增纯判定模块 `src/renderer/src/editor/clickSemantics.ts`（`judgeClickSemantics` / `chromeAllowed` / `hitTargetFromTarget` / `syncPureSelectionChrome`）+ 同目录 `clickSemantics.test.ts`。核心设计是 **`selection.isEmpty` 两供给**：

1. **编辑路由（widget 手势）**：图片/表格单元格/块 gap 的 press-release 传 `selectionEmpty: true`——widget 内容不可承载文本选区（mousedown preventDefault，DOMObserver 会把 widget 内插入符映射回文档并塌缩），该手势构造上就是点击；且**陈旧选区不得锁死编辑入口**（S2 验证：拖选后直接点图照样进编辑浮层）。裁决 → `edit`。
2. **chrome 策略（hover 浮现 / 松开回收 / CSS hover chip）**：取活体 `view.state.selection.main.empty`——文本选区存活期间一切工具 chrome 压零（AC-FN-18 严格版）。裁决 → `select` 时 `hoverDiscipline.hideAllNow()`（清掉拖动中竞态进来的 debounce 残留）。

接线点：`blockWidget.mountClickToSource/wrapWithGap`（math/code/mermaid）、`image-widget.ts`（click → judge → FE-04 编辑浮层）、`table/widget.ts`（cell/ gap mousedown 前置 judge，pendingHandoff 未动）、`mermaid/widget.ts`（svg body click → lightbox）、`hoverZones.ts`（mouseover/mouseup 统一裁决）、`App.tsx` `onSelectionChanged` 一行 `syncPureSelectionChrome(view)`、CSS `.cm-md-selecting` 压零 block-toolbar 与 code-idle-chip。

## CDP 驱动踩坑（验证环境纪律）

1. **视口外坐标点击落空**：夹具比窗口高（图 y≈790-1030、mermaid y≈1250+），`Input.dispatchMouseEvent` 坐标超出 `innerHeight` 会被边缘命中错元素——所有取点必须先 `scrollIntoView` 再量 rect，且把 y 钳进 `[48, innerHeight-48]`。首轮 10 个失败全是这个原因。
2. **逐行 scrollIntoView 使先前 rect 失效**：量 A 行再量 B 行会滚动视口，A 的坐标作废（列表拖选只得 3 字符选区）。相邻两行必须一次 evaluate 里同滚同量。
3. **图片编辑浮层（fixed）会盖住邻近文本行**：浮层按放置梯子可落在锚点上方，恰好盖住「Image follows.」行——此时点击落在浮层上属「点浮层」而非「点外部」，click-outside 不触发是正确行为。测试取点须避开 `.cm-md-float/.render-float` 覆盖（`clickLineClear`）。
4. **hover chrome 被活体选区压零是设计而非回归**：拖选后 hover 列表行不浮现把手（`chromeAllowed(false)` 拦截）——验证 FE-06 把手不回归前必须先清选区并离开再入行（新的 mouseover）。
5. **惰性缝 `__veloxTableCellView`**：基线在 loadDoc 前采集，首次单元格激活才挂载——缝对比用「零丢失 + 新增限已知惰性集」规则。
6. 全程 `Page.bringToFront` + `setWebLifecycleState(active)` + `setFocusEmulationEnabled`；evaluate 全带 8s 超时；草稿对话框一律点「稍后」。

## 跨任务缺口（移交登记，不在 FE-09 范围）

| 缺口 | 来源 | 说明 | 处置 |
|---|---|---|---|
| AC-FN-29「分级退格」模型缺失 | IT-01/FE-09（useHushLayer）移交 | `TableEditState` 无「编辑态无 active cell」模型，表格 gap 空白点击现为**整体退出**（commit + 退出单元格编辑 + 光标回表格源），非分级退格。边界选择器与 chrome 挂点已由 IT-01/FE-09 备好 | **不在 FE-09 实现**（FE-09 AC 仅 RULE-13/17/18，阶段 3 对 AC-FN-29 仅要求现状语义保持）。登记待主 agent 统一处置。S6 已断言现状行为不回归 |

兼容性确认：IT-01/FE-09 的 useHushLayer 接入面（MenuBar/EditorContextMenu/RenderFloat/gridPicker/toolbar/nestedSession 的 Esc 委托与遮罩让位）已在本轮验证构建内（重新 build 后实测），点击/选区语义与其让位规则互测通过（S3 Esc 关 lightbox、S5/S6 各路径无冲突）。

## 产物清单

- `IT-03-FE-09-cdp-driver.mjs` — CDP 自测驱动（S0–S7，51 checks）
- `IT-03-FE-09-cdp-data.json` — 结构化结果
- `IT-03-FE-09-run.log` — 运行日志
- `IT-03-FE-09-impl.png` — 拖选文本后无浮层的静息截图（Alpha/Beta 选区高亮 + 全区 0 chrome）
- `IT-03-FE-09-self-test.md` — 本文件
