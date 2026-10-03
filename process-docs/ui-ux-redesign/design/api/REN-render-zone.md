# REN 渲染区契约（ren-float / ren-fold）

## 1. 概述

| 项 | 内容 |
|---|---|
| 接口域职责 | 渲染区 Markdown 语法预览/编辑交互：图片编辑浮层、链接悬浮浮层、列表行首拖拽排序、任务项勾选、标题折叠（与大纲双向同步）、长引用折叠、点击语义裁决、公式/代码/mermaid 块审计微调 |
| 通道类型 | hover 浮层 / 点击 / 拖拽 / keymap（既有）/ `.md` 语法写回（唯一数据源）/ localStorage（`headingFolds` 复用、`quoteFolds` 新增） |
| 类型 | **新增**（图片编辑浮层、链接浮层、列表拖拽、标题折叠、长引用折叠）+ **修改**（点击语义固化、任务项勾选轻量口径）+ **复用**（任务项勾选、双区编辑/错误态/跳源码已收敛契约、headingFolds） |
| 裁决来源 | Q10（quoteFolds 双键平铺追加）、PEND-09（长引用折叠阈值 >5 行）、PEND-15（轻量操作不回 toast）、AC-RULE-13（点击语义裁决）、PRD 6.4 冻结功能点 |
| 代码真源（现状） | `src/renderer/src/editor/widgets.ts`（任务/图片/公式/代码/mermaid WidgetType）、`editor/livePreview/`（fold.ts / linkNav.ts / dualPane.ts / codeBlockUi.ts）、`editor/livePreview/fold.ts`（foldKey）、`hooks/useFoldSync.ts`、`preferences/store.ts`（quoteFolds 待新增） |

---

## 2. 契约清单

| 契约标识 | 通道类型 | 类型 | 说明 | PRD 来源章节 | AC 条目 | 裁决来源 |
|---|---|---|---|---|---|---|
| `ren-image:edit-float` | hover/点击浮层 | 新增 | 图片编辑浮层：尺寸拖拽控制点 + 对齐按钮；按需浮现、退出干净 | PRD 6.4 | AC-OP-13, UI-IXD-10 | PRD 冻结 |
| `ren-image:write-md` | .md 语法 | 新增 | 尺寸/对齐写 .md 图片语法（非显示态旁路）：尺寸落源码、对齐落语法 | PRD 6.4 | AC-OP-13, AC-OP-18 | PRD 冻结 |
| `ren-link:hover-float` | hover 浮层 | 新增 | 链接浮层三入口：编辑 URL / 外开 / 复制完整 URL | PRD 6.4 | AC-FN-19, AC-OP-14, UI-IXD-07 | PRD 冻结 |
| `ren-link:edit-url` | .md 语法 | 新增 | URL 编辑写回 .md 链接语法；外开只走 `shell.openExternal` 固定入口不传用户可控串 | PRD 6.4 | AC-OP-14, AC-NF-12 | PRD 冻结 |
| `ren-list:drag-handle` | hover 拖拽 | 新增 | 列表行首拖拽把手按需浮现（hover 才现、不常驻不遮挡），拖动排序同层级、层级（缩进）不变 | PRD 6.4 | AC-OP-16, UI-IXD-08 | PRD 冻结 |
| `ren-task:check` | 点击 | 复用（口径固化） | 任务项勾选切换 `[ ]`/`[x]` 写回 .md；轻量操作不回 toast | PRD 6.4 | AC-RULE-04, AC-OP-15 | PEND-15 |
| `ren-head:fold` | 点击 | 新增 | 标题折叠三角：章节含全部子章节折叠、与大纲双向同步、复用 headingFolds | PRD 6.4、PRD 6.3 | AC-FN-15, AC-FN-30 | Q10 |
| `ren-quote:fold` | 点击 | 新增 | 长引用折叠：>5 行阈值折叠为摘要行（首行文本截断 + 「N 行」尾标），点击展开还原 | PRD 6.4 | AC-FN-16 | PEND-09 |
| `ren-quote:store` | localStorage | 新增 | `quoteFolds: Record<filePath, string[]>` 平铺进 `veloxmark.session` | PRD M10 | AC-RULE-14, AC-NF-14 | Q10 |
| `ren-click:semantics` | 点击裁决 | 修改 | 点击内容进对应编辑形态；纯选中/复制不弹 chrome；图/表/代码相邻处语义一致 | PRD 6.4 | AC-RULE-13, AC-FN-17, AC-FN-18 | PRD 冻结 |
| `ren-block:audit-preserve` | 块级 chrome | 复用 | 公式/代码/mermaid：双区编辑、错误态可修复、跳源码定位保持；仅观感审计微调 | PRD 6.4、PRD 1.3 | AC-FN-20, AC-OP-20, AC-ERR-10/11 | PRD 冻结（不改 11A） |
| `ren-hover:discipline` | 显示态 | 复用 | hover 浮层/微操作 ≥150ms 防抖浮现、不遮挡正文、位移 0px、移出无残留 | PRD 6.4 | AC-FN-14, AC-NF-04/05 | PRD 冻结 |

---

## 3. 行为语义明细

### 3.1 图片编辑浮层（`ren-image:*`）

**触发路径**：hover / 点击图片唤起编辑浮层（UI-IXD-10）；点击图片内容同时进入图片编辑形态（AC-FN-17）。

**行为规则**：

| 分支 | 行为 | 落盘 | 回执 |
|---|---|---|---|
| 尺寸拖拽 | 按住尺寸控制点拖拽，预览尺寸随鼠标变化；松开后按新尺寸渲染 | 新尺寸写 .md 图片语法（非显示态旁路），autosave 落盘 | toast 回执含「（Ctrl+Z 可撤销）」后缀（AC-OP-13；回执字样按统一格式派生「已调整图片尺寸（Ctrl+Z 可撤销）」，i18n 双字典落盘） |
| 对齐调整 | 点击对齐按钮，按钮进入激活态；尺寸不变 | 目标对齐写 .md 图片语法 | toast 回执同上格式（回执字样「已设置图片对齐（Ctrl+Z 可撤销）」） |

**禁用规则**：无图片解析结果时浮层不浮现；只读文件编辑被拦截（AC-ERR-08）——写前拦截真源为 `isWritable` 跨进程探针（`RendererApi.isWritable(filePath)`，channel `file:isWritable`，`fs.access(W_OK)` 判定）+ `editor/readOnlyGuard.ts` `assertWritable()` 单点闸门，图片写回统一走该闸门（FE-05/FE-06 复用同一入口，CHANGE-8）。

**undo 事务边界**：每次尺寸/对齐编辑为独立事务，一次 Ctrl+Z 还原编辑前状态（AC-OP-13）；退出浮层后无残留控件。

**导出联动**：图片尺寸与对齐参与导出三通道一致性（AC-OP-18）。

**e2e 缝影响**：浮层为新增呈现层，不改既有命令 id / data-op 集合；`window.__velox*` 不触碰。

### 3.2 链接悬浮浮层（`ren-link:*`）

**触发路径**：hover 链接浮现浮层，三入口（UI-IXD-07）：「打开」「复制」「编辑」。

| 入口 | 行为 | 反馈/恢复 |
|---|---|---|
| 打开 | 经 `shell.openExternal` 固定入口由系统默认浏览器打开该 URL，不拼接、不传用户可控串（AC-NF-12） | 无 toast（外开为安全动作） |
| 复制 | 剪贴板得到该链接完整 URL | 既有轻提示沿用（不属本次冻结面） |
| 编辑 | 浮层内 URL 进入可编辑输入态，原 URL 预填；确认后按新 URL 渲染 | 新 URL 写 .md 链接语法 + autosave；toast 回执含「（Ctrl+Z 可撤销）」后缀（AC-OP-14；回执字样「已更新链接地址（Ctrl+Z 可撤销）」）；一次 Ctrl+Z 还原修改前 URL；「打开」对新 URL 生效 |

**规则**：浮层不遮挡链接文本（UI-IXD-07）；hover 防抖 ≥150ms、移出延迟消失无残留（AC-FN-14）；只读拦截同全局。**能力边界（CHANGE-35）**：GFM 裸 URL literal（无尖括号）不装饰、无 hover chrome、不唤本浮层/编辑入口——`enterLink` 装饰面仅覆盖 `[text](url)` 与 `<url>` Autolink 两形态；如需全覆盖须扩展 enterLink 装饰面（另立任务）。

**undo 事务边界**：URL 修改为独立事务，一步 undo（AC-OP-14）。

### 3.3 列表行首拖拽排序（`ren-list:drag-handle`）

**触发路径**：hover 列表项行首浮现拖拽把手（UI-IXD-08）→ 按住拖动 → 松开落位。

| 项 | 规则 |
|---|---|
| 把手显隐 | 仅 hover 行首浮现，不常驻、不遮挡正文、静息不渲染（UI-ELEM-05） |
| 拖动过程 | 显示插入位置指示线；被拖项随鼠标移动 |
| 落位结果 | 列表项移动到指示线位置，同层级其他项顺序调整；**列表层级（缩进）不变** |
| 落盘 | .md 列表源码顺序更新 + autosave |
| 回执 | toast 含「（Ctrl+Z 可撤销）」后缀（AC-OP-16；回执字样「已移动列表项（Ctrl+Z 可撤销）」） |
| undo | 一次 Ctrl+Z 还原顺序（AC-OP-16） |

**任务项勾选（`ren-task:check`，复用）**：点击勾选框即时切换未勾选 `[ ]` / 已勾选 `[x]`，同列表其他项不变；写回 .md 任务语法 + autosave；一次 Ctrl+Z 还原（AC-OP-15）；**不回 toast**（PEND-15 轻量口径，显式豁免）。

### 3.4 标题折叠（`ren-head:fold`）

**触发路径**：点击标题左侧折叠三角（正文侧）/ 大纲侧折叠入口（双向同步，NAV §3.4 共同契约）。

| 项 | 规则 |
|---|---|
| 折叠粒度 | 该标题下**全部子章节**内容折叠隐藏，标题行保留（AC-FN-15） |
| 双向同步 | 与大纲折叠状态双向同步：任一入口变更即更新另一处视图（AC-FN-30） |
| 持久化 | 折叠态写 `veloxmark.session.headingFolds`（复用，Q10）；跨重启持久；.md 正文零字节变化 |
| 交互 | 三角指向随折叠/展开切换（UI-IXD-06）；三角点击只折叠、不移动光标；轻量切换不回 toast（PEND-15） |
| 跳转展开 | 点击大纲跳转到折叠区内标题时自动展开目标链路（NAV §3.5） |

**undo 事务边界**：折叠为显示态不进文档 undo 栈；误触恢复 = 再次点击展开（幂等可逆）。

### 3.5 长引用折叠（`ren-quote:*`，PEND-09/Q10）

| 项 | 规则 |
|---|---|
| 阈值 | 引用块渲染行数 **>5 行**触发可折叠（阈值常量集中一处便于调参，PEND-09） |
| 折叠态 | 折叠为**摘要行**：首行文本截断 + 「N 行」尾标（N=折叠隐藏行数）；原内容不可见 |
| 展开 | 点击摘要行/展开入口还原折叠前完整内容，无字节差异（AC-FN-16） |
| 存储 | 折叠块 id 集写 `veloxmark.session` 新增字段 `quoteFolds: Record<filePath, string[]>`（Q10 双键平铺追加，schema 细则见 STORE-local-state.md） |
| 持久 | 跨重启持久（AC-RULE-14 口径同 headingFolds）；.md 正文零字节变化 |
| 回执 | 不回 toast（PEND-15 轻量口径） |
| 观感豁免 | 摘要行构成细则随《UI/UX 设计规范》定稿，AC-FN-16 判据为「可折叠、可展开、内容不丢失」（观感豁免项） |

**undo 事务边界**：显示态折叠不进文档 undo 栈；展开即还原。

### 3.6 点击语义（`ren-click:semantics`，AC-RULE-13）

| 输入 | 语义 |
|---|---|
| 点击普通文本内容 | 进入文本编辑（写作者路径优先） |
| 点击表格内容 | 进入表格编辑形态（命中单元格入单元格激活；未命中表格空白入编辑态，AC-FN-03/29） |
| 点击公式/代码/图内容 | 进入对应源码/编辑形态（公式/代码/mermaid 双区编辑；图编辑浮层） |
| 拖选文本后松开（纯选中/复制） | 仅选区高亮 + 剪贴板得文本；**不进入编辑、不弹任何工具浮层**（AC-FN-18、AC-FN-33） |
| 图/表/代码相邻处 | 点击语义一致（内容点击进对应编辑形态，不弹与被点击元素无关的浮层，AC-FN-17） |

### 3.7 公式/代码/mermaid 块审计微调（`ren-block:audit-preserve`）

**不改已收敛契约（11A 块级 chrome 四态 / N1-N4）**，仅观感按新规范微调：

| 保持项 | 判据 |
|---|---|
| 双区编辑 | 源码区 + 预览区并排；输入合法源码预览即时渲染；退出回渲染态（AC-OP-20、UI-IXD-15） |
| 公式错误态 | 错误态标识 + 跳源码定位入口（点击定位源码区）；源码区保留用户输入（AC-ERR-10） |
| mermaid last-good | 语法错误保留上一次成功渲染图 + 错误条 + 跳源码入口；修复后重渲染（AC-ERR-11） |
| 源码/复制类 chrome | 既有 chip/按钮显隐四态不变（仅 token 观感微调，视觉幅度豁免见 PEND-14 口径） |

---

## 4. 与现有实现差异（现状 → 目标）

| # | 现状 | 目标 | 涉及文件 |
|---|---|---|---|
| 1 | 图片无编辑浮层（widgets.ts 图片为渲染 Widget，无尺寸拖拽/对齐入口） | 新增图片编辑浮层：尺寸拖拽 + 对齐按钮 + .md 语法写回 + undo | `src/renderer/src/editor/widgets.ts`（或独立 `editor/imageEdit.ts` 模块）、`editor/livePreview/` |
| 2 | 链接仅有 linkNav（键盘跳转）与点击外开/复制路径，无 hover 三入口浮层 | 新增链接 hover 浮层（打开/复制/编辑 URL），URL 写回 .md 语法 | `src/renderer/src/editor/livePreview/linkNav.ts`、新浮层组件 |
| 3 | 列表无行首拖拽把手 | 新增 hover 把手 + 拖动排序（层级不变）+ toast 回执 + undo | `src/renderer/src/editor/widgets.ts` / livePreview 列表装饰 |
| 4 | 任务项勾选已存在（widgets.ts 任务 Widget），勾选写回 .md | 行为保持；口径固化为轻量操作不回 toast（PEND-15） | `src/renderer/src/editor/widgets.ts`（仅口径登记） |
| 5 | 标题折叠已存在（fold.ts 三角 + headingFolds + useFoldSync），双向同步经 toggleFold effect | 行为保持；补「大纲侧折叠入口 → 正文同步」验收闭环与跨重启口径 | `editor/livePreview/fold.ts`、`hooks/useFoldSync.ts`、`components/Outline.tsx` |
| 6 | 长引用无折叠能力；无 quoteFolds 字段 | 新增 >5 行阈值折叠 + 摘要行 + `quoteFolds` 字段（STORE 域 schema delta） | `editor/livePreview/`（quoteFold 装饰）、`preferences/store.ts`（字段+sanitizer）、`preferences/store.test.ts` |
| 7 | 点击语义分散（表格/块各有点击→源码逻辑），纯选中不弹浮层靠事件 stopPropagation 逐处维持 | AC-RULE-13 统一语义固化 + 非回归断言（选中复制不弹 chrome） | `editor/widgets.ts`、`editor/table/widget.ts`、App 点击接线 |
| 8 | 公式/代码/mermaid 既有收敛契约（dualPane/codeBlockUi/error bar） | 零契约变更，仅观感微调（豁免数值幅度，PEND-14） | `editor/livePreview/dualPane.ts`、`codeBlockUi.ts`（样式 token 层） |
| 9 | 回执 toast 对图片/链接/列表操作无既有文案键 | 新增回执键（含 undo 后缀格式），en/zh 双字典同步 | `src/renderer/src/i18n/zh.ts`、`i18n/en.ts` |
| 10 | AC-FN-16 的折叠阈值曾为 [PENDING] | 阈值冻结 >5 行（PEND-09），常量集中一处 | 引用折叠实现模块 |

---

## 5. 验收映射（AC 条目 → 本域判据）

| AC 条目 | 本域判据 |
|---|---|
| AC-RULE-04 | §3.3 任务项 `[ ]`/`[x]` 状态由 .md 承载、勾选写回 |
| AC-RULE-13 | §3.6 点击进编辑、纯选中复制不弹 chrome、相邻区语义一致 |
| AC-RULE-14 | §3.4/§3.5 折叠态写偏好键跨重启、不写正文、向后兼容 |
| AC-FN-14 | hover 浮层/微操作 ≥150ms、不遮挡、位移 0px、移出无残留 |
| AC-FN-15 | §3.4 标题折叠含子章节、双向同步、跨重启、.md 不变 |
| AC-FN-16 | §3.5 可折叠/可展开/内容不丢失（阈值 >5 行，PEND-09 收口） |
| AC-FN-17 | §3.6 各元素点击进对应编辑形态、无无关浮层 |
| AC-FN-18 | §3.6 拖选复制仅选区高亮、不进编辑 |
| AC-FN-19 | §3.2 打开走系统默认浏览器固定入口、复制为完整 URL |
| AC-FN-20 | §3.7 双区编辑/错误态/last-good/跳源码保持 |
| AC-FN-30 | §3.4 大纲折叠双向同步 + 持久 + .md 无变化（与 NAV 共验） |
| AC-OP-13 | §3.1 图片尺寸/对齐写 .md 语法、toast 回执、undo |
| AC-OP-14 | §3.2 URL 编辑写 .md、toast 回执、undo、外开新 URL |
| AC-OP-15 | §3.3 任务勾选写 `[x]`、undo；toast 显式豁免（PEND-15） |
| AC-OP-16 | §3.3 列表拖拽排序、指示线、层级不变、toast 回执、undo |
| AC-OP-18 | §3.1/§3.2 导出三通道一致；列宽显示态不参与导出（TBL/STORE 共验） |
| AC-OP-20 | §3.7 双区编辑即时渲染、退出回渲染态、undo |
| AC-ERR-10 | §3.7 公式错误态 + 跳源码 + 输入保留 |
| AC-ERR-11 | §3.7 mermaid last-good + 错误条 + 修复重渲染 |
| AC-NF-12 | §3.2 外开仅 shell.openExternal 固定入口、contextIsolation/sandbox 保持 |
| AC-NF-14 | §3.5 quoteFolds 新键缺失时默认降级读取（见 STORE 域） |
| UI-IXD-06/07/08/09/10/14/15 | §3.1~§3.5/§3.7 各控件交互规格 |
| UI-ELEM-05 | §3.3/§3.1 hover 控件仅 hover/激活态渲染、静息不常驻 |
| AC-PEND-09 → 转正 | §3.5 阈值 >5 行收口 |
