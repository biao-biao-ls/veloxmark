# GLB 全局模式契约（glb-toast / glb-confirm / glb-hush）

## 1. 概述

| 项 | 内容 |
|---|---|
| 接口域职责 | 跨功能域统一交互模式：toast 回执（含撤销按钮 5s 驻留）、undo 三入口等效、破坏性确认框与模态叠加、一键回安静、静息零 chrome 与 0px 布局抖动、轻量操作不回 toast 的差异声明 |
| 通道类型 | toast（渲染层反馈面）/ 确认框（Dialog 模态）/ keymap（Esc）/ 全局点击（正文空白）/ undo 通道（keymap Ctrl+Z + 菜单命令 + toast 按钮） |
| 类型 | **修改**（toast 增撤销按钮与 5s 驻留、确认口径收窄为仅删表）+ **新增**（一键回安静全局收拢、模态叠加分层语义、轻量操作差异声明）+ **复用**（Dialog/ctxMenu 单例 bus、`useSyncExternalStore`、既有 undo 栈） |
| 裁决来源 | Q3（仅删表确认）、PEND-04（Esc/空白仅关确认框）、PEND-05（toast 5s 驻留）、PEND-15（轻量操作不回 toast 差异声明）、AC-RULE-05/13/16 冻结规则 |
| 代码真源（现状） | `src/renderer/src/App.tsx`（showToast 字符串态 + 计时器）、`src/renderer/src/components/Dialog.tsx`、`src/renderer/src/editor/contextMenu/registry.ts`（CtxRuntime.toast）、`src/renderer/src/components/EditorContextMenu.tsx` |

> 本域是 Q0 裁决的「通用能力」横向面（`design/adr/extensibility.md`）：toast / 确认 / 一键回安静 / 静息 chrome 显隐为全部功能域共用模式，表格是首个实施对象，规则本身不带表格特例。

---

## 2. 契约清单

| 契约标识 | 通道类型 | 类型 | 说明 | PRD 来源章节 | AC 条目 | 裁决来源 |
|---|---|---|---|---|---|---|
| `glb-toast:op-receipt` | toast | 修改 | 结构/破坏性/可撤销类操作回执 toast，统一含「（Ctrl+Z 可撤销）」后缀 | PRD 6.5、PRD M11 | AC-FN-06, AC-OP-01~12 | PRD 冻结 |
| `glb-toast:undo-button` | toast | 新增 | 回执 toast 内嵌「撤销」按钮，点击等效 Ctrl+Z，回执「已撤销」 | PRD 12 #9 | AC-OP-12 | PEND-05 |
| `glb-toast:dwell-5s` | toast | 新增 | toast（含撤销按钮）驻留 5s 自动消失；超时后 undo 仍由 Ctrl+Z / 编辑菜单承载（三入口不减一） | PRD 12 #9 | AC-FN-06, AC-OP-12 | PEND-05 |
| `glb-toast:undo-ack` | toast | 修改 | undo 终态回执固定「已撤销」并自动消失 | PRD M11 | AC-OP-12, AC-ERR-04 | PRD 冻结 |
| `glb-toast:lightweight-none` | toast | 新增 | 轻量态切换（任务项勾选、标题/引用折叠、大纲同步等）**不回 toast**；差异声明登记 | PRD 6.5 | AC-OP-15（显式豁免） | PEND-15 |
| `glb-undo:triple-entry` | keymap/菜单/toast | 复用 | undo 三入口等效：Ctrl+Z / 编辑菜单「撤销」/ toast 撤销按钮，同一事务栈 | PRD 6.1、PRD 5.4 | AC-OP-12 | PEND-05 |
| `glb-confirm:delete-table-only` | 确认框 | 修改 | 破坏性确认仅保留删表；删行/删列不弹确认 | PRD 6.1、PRD 8 | AC-RULE-15, AC-OP-09/10 | Q3 |
| `glb-confirm:copy` | 确认框文案 | 修改 | 删表确认文案冻结「删除后可用一步撤销还原，确认删除该表格」 | PRD M11、PRD 6.5 | AC-RULE-15, AC-ERR-07 | PRD 冻结（现状冲突见 §4） |
| `glb-modal:stacking` | keymap/点击 | 新增 | 模态优先层：Esc / 点正文空白只关最上层确认框；再 Esc 才全收拢 | PRD 12 #8 | AC-FN-21（模态叠加分支） | PEND-04 |
| `glb-hush:one-shot` | keymap/点击 | 新增 | 一键回安静：Esc 或点正文空白，一次收拢全部浮层与编辑态（非逐个关闭），焦点回正文 | PRD 6.5、PRD 5.5 | AC-FN-21, AC-FN-22 | PRD 冻结 |
| `glb-hush:boundary` | 交互边界 | 修改 | 「表格空白」仅分级退格（单元格激活→编辑态）；「正文空白」直达静息 | PRD 5.5 判定边界 | AC-FN-29, AC-FN-21 | PRD 冻结 |
| `glb-calm:zero-chrome` | 显示态 | 修改 | 静息零 chrome：无把手/工具栏/chip/常驻按钮/常驻边框高亮 | PRD 6.5、PRD 术语表 | AC-FN-23, AC-RULE-01 | PRD 冻结 |
| `glb-calm:zero-shift` | 显示态 | 复用 | 进出编辑态/控件显隐正文位移 0px（水平+垂直） | PRD 10 | AC-NF-05, AC-FN-03 | PRD 冻结 |
| `glb-calm:debounce` | 显示态 | 复用 | hover 控件出入防抖 ≥150ms、快速掠过闪烁 0 次、不遮挡被 hover 正文 | PRD 10、PRD 6.5 | AC-NF-04, AC-FN-14 | PRD 冻结 |
| `glb-state:exit-inevitable` | 状态机 | 复用 | 任何路径终态必为静息/菜单关闭，无悬空态（工具栏残留/半展开菜单/浮层驻留判不通过） | PRD 5.5 | AC-RULE-05 | PRD 冻结 |
| `glb-readonly:intercept` | 提示 | 复用 | 只读拦截提示固定「文件为只读，无法修改，可另存后编辑」 | PRD 8 | AC-RULE-16, AC-ERR-08 | PRD 冻结 |
| `glb-autosave:fail-notice` | 提示 | 修改 | autosave 失败提示固定「自动保存失败，文档可另存副本」，不静默丢稿 | PRD 8、PRD M11 | AC-ERR-15 | PRD 冻结（现状文案差异见 §4） |

---

## 3. 行为语义明细

### 3.1 toast 回执 + 撤销按钮 5s 驻留（PEND-05）

**触发路径**：任一结构/破坏性/可撤销类操作执行成功后（表格结构操作、删表、图片尺寸/对齐、链接 URL 编辑、列表拖拽排序、格式化表格源码等）。

**行为规则**：

| 项 | 规则 |
|---|---|
| 内容 | 操作回执文案（各域冻结文案逐字引用，见 TBL §3.1 / REN §3）+ 内嵌「撤销」按钮 |
| 后缀 | 结构/可撤销类回执统一含「（Ctrl+Z 可撤销）」后缀（AC-FN-06） |
| 驻留 | toast 自动驻留 **5 秒**后自动消失（含撤销按钮一并消失）；消失前不获取键盘焦点、不遮挡光标所在输入行、不引发布局位移（UI-ELEM-03） |
| 撤销按钮 | 点击即执行一步 undo，行为与 Ctrl+Z / 编辑菜单「撤销」完全等效（同事务栈）；undo 后 toast 切换为回执「已撤销」并按同 5s 驻留自动消失 |
| 超时后 | 撤销按钮随 toast 消失不可点，但 undo 三入口不减一——Ctrl+Z 与编辑菜单「撤销」继续可用（PEND-05 要点） |
| undo 回执 | 固定文案「已撤销」，无按钮 |

**undo 事务边界**：toast 撤销按钮作用于**最近一次可撤销事务**；结构操作单事务语义见 TBL §3.1（一次还原行列/对齐/列宽/表头身份）。光标落回操作前锚定单元格（AC-OP-12）。

**e2e 缝影响**：toast 面新增按钮节点属 UI 呈现层，不新增 data-op/命令 id 契约；`window.__velox*` 系列不触碰。

### 3.2 undo 三入口等效（PEND-05 / AC-OP-12）

| 入口 | 通道 | 触发 | 终态 |
|---|---|---|---|
| Ctrl+Z | keymap | 按键 | 一步还原 + toast「已撤销」 |
| 编辑菜单「撤销」 | 命令 id `undo`（不变） | 菜单/原生菜单点击 | 同上 |
| toast 撤销按钮 | toast 内按钮 | 点击（5s 驻留窗口内） | 同上 |

三入口共享同一 CM6 事务栈，任意入口执行后其余入口作用于新的栈顶；重做 `redo`（Ctrl+Y）不变。

### 3.3 仅删表确认 + 模态叠加（Q3 / PEND-04）

**确认流集合（Q3 收窄后）**：

| 操作 | 是否确认 | 确认框文案（冻结） | 按钮 |
|---|---|---|---|
| 删除表格 | 是 | 「删除后可用一步撤销还原，确认删除该表格」 | 「确认删除」（danger）/「取消」 |
| 删除行 / 删除列 | 否 | —（toast+undo 承载） | — |
| 其余结构操作（插/移/对齐/缩放） | 否 | — | — |

**模态叠加规则（PEND-04）**：

1. 确认框开启时处于最上层（以 overlayZOrder 契约分层为准：dialog-overlay(2000) > popover(1500) > editor-context-menu(1000)，契约测试 overlayZOrder.test.ts 守护；menu-tree §0.1「D 区=200 / T 区=999」字面值废除，改「D 区确认框恒最上层，T 区不得超过 D 区」——CHANGE-18）；
2. 按 Esc 或点击正文空白：**只关闭最上层确认框**，其余浮层/编辑态保持原状；文档不变；
3. 确认框已关后再次 Esc / 点空白：走一键回安静，全部收拢回静息；
4. 点击「取消」= 关闭确认框（等价于②的关闭动作）；点击「确认删除」= 执行删除 + toast 回执；
5. AC-FN-21 的 Given「无开启中的模态确认框」排除解除，补模态叠加分支断言（AC-PEND-04 → PEND-04 转正）。

**undo 事务边界**：确认框「取消」不产生事务；「确认删除」后的删除为单事务，一次 Ctrl+Z 还原整表（AC-ERR-07）。

### 3.4 一键回安静（glb-hush:one-shot）

**触发路径**：Esc 键 / 点击正文空白区域。

**行为规则**：

| 项 | 规则 |
|---|---|
| 覆盖面 | 菜单栏下拉与子菜单、⋮/右键菜单、⊞ 网格选择器、图片/链接浮层、表格工具栏、双区编辑面板、chip、查找面板等全部浮层与编辑态 |
| 收拢语义 | 一次触发**全部**收拢（非逐个关闭）；模态确认框在场时例外——只关确认框（§3.3） |
| 焦点 | 收拢后焦点回正文，随后键盘输入直接进入正文编辑（AC-FN-10） |
| 终态 | 零 chrome 静息态（AC-FN-23）；无悬空菜单/残留高亮 |
| 分级退格边界 | 「表格空白」= 表格内未命中单元格的区域：仅退出单元格激活→编辑态，工具栏保持（AC-FN-29）；「正文」= 表格以外正文区域（含空白）：直达静息（PRD 5.5 判定边界） |
| 纯选中复制 | 拖选/选区后松开视为选中复制，不触发编辑、不弹浮层（AC-RULE-13） |

**e2e 缝影响**：无新增契约；收拢逻辑不改变命令 id 与 data-op 集合。

### 3.5 静息零 chrome + 0px 布局抖动（glb-calm:*）

| 项 | 判据 |
|---|---|
| 零 chrome | 无 hover、无焦点、无浮层时正文区域无把手、无工具栏、无 chip、无常驻按钮、无常驻边框高亮（AC-FN-23） |
| 0px 抖动 | 进出编辑态、控件浮现/消失前后，正文区域水平位移 0px、垂直位移 0px（AC-NF-05） |
| 防抖 | hover 控件出入延迟 ≥150ms，快速掠过闪烁 0 次，浮现期间不遮挡被 hover 元素正文文字（AC-NF-04、AC-FN-14） |
| 状态出口 | 任何路径终态必为静息或菜单关闭（AC-RULE-05）：工具栏残留、半展开菜单、浮层驻留均判不通过 |

### 3.6 轻量操作不回 toast 差异声明（PEND-15）

**差异声明（冻结口径）**：结构 / 破坏性 / 可撤销类操作回 toast 回执；**轻量态切换不回 toast**——任务项勾选、标题折叠/展开、长引用折叠/展开、大纲折叠同步、对齐幂等重复点击等。

| 操作类别 | 是否回 toast | 代表操作 |
|---|---|---|
| 结构操作 | 是 | 插/删/移行列、⊞ 缩放、格式化表格源码（TBL §3.1） |
| 破坏性操作 | 是 | 删除表格 |
| 可撤销内容编辑 | 是 | 图片尺寸/对齐、链接 URL 编辑、列表拖拽排序（REN 域，回执含 undo 后缀） |
| 轻量态切换 | **否** | 任务项勾选（AC-OP-15 显式豁免）、标题/引用折叠（AC-FN-15/16/30 无 toast 断言）、大纲同步 |
| 剪贴板安全动作 | 沿用现状 | 复制类可保留既有轻提示或静默（不属本次冻结面，不新增断言） |

- AC-OP-15 等以显式豁免收口（AC-PEND-15 → PEND-15 转正）；
- 轻量操作的误触恢复仍由 undo（Ctrl+Z）承载（勾选/折叠可撤销时）或操作本身幂等可逆（折叠再点即还原）。

### 3.7 冻结文案表（全局面）

| 场景 | 冻结中文文案 | 来源 |
|---|---|---|
| 撤销回执 | 「已撤销」 | AC-OP-12 / AC-ERR-04 / PRD M11 |
| 删表确认 | 「删除后可用一步撤销还原，确认删除该表格」 | AC-RULE-15 / PRD M11 |
| 删表回执 | 「已删除表格（Ctrl+Z 可撤销）」 | AC-OP-09 |
| 删行回执 | 「已删除第 i 行（Ctrl+Z 可撤销）」 | AC-OP-10 |
| 删列回执 | 「已删除第 j 列（Ctrl+Z 可撤销）」 | AC-OP-10 |
| 只读拦截 | 「文件为只读，无法修改，可另存后编辑」 | AC-RULE-16 / AC-ERR-08 |
| autosave 失败 | 「自动保存失败，文档可另存副本」 | AC-ERR-15 / PRD M11 |
| toast 按钮 | 「撤销」 | PEND-05（按钮为新增控件，文案随 i18n 双字典落盘） |

---

## 4. 与现有实现差异（现状 → 目标）

| # | 现状 | 目标 | 涉及文件 |
|---|---|---|---|
| 1 | `showToast(message: string)` 纯文本 + 定时清空（App.tsx ~L106-115），toast 无按钮 | toast 面支持动作按钮（撤销）；`CtxRuntime.toast` 签名扩为可携动作（保持旧调用兼容）。**落点收口**：动作按钮/驻留逻辑落独立 toast 呈现组件（如 `components/ToastHost.tsx` + `hooks/useToast.ts`），App.tsx `showToast` 仅一行转发装配（CLAUDE.md：新逻辑不入 App.tsx） | `src/renderer/src/hooks/useToast.ts`（新）、`components/ToastHost.tsx`（新）、`src/renderer/src/editor/contextMenu/types.ts`（CtxRuntime）；App.tsx 仅转发接线 |
| 2 | toast 驻留时长为现有计时值（非 5s 契约） | 回执 toast 驻留 5s（PEND-05，常量集中一处）；超时后 undo 三入口不减一。落点同 #1（useToast/ToastHost 承载，App.tsx 零逻辑） | `src/renderer/src/hooks/useToast.ts` |
| 3 | 删表确认文案「确定删除该表格？此操作无法撤销。」与冻结文案直接冲突 | 改写为「删除后可用一步撤销还原，确认删除该表格」（en/zh 同步） | `src/renderer/src/i18n/zh.ts`、`i18n/en.ts`（`ctx.deleteTableConfirm`） |
| 4 | AC-RULE-15 / AC-OP-10 载删行/删列确认流；代码侧删行/列本就无确认 | Q3 口径固化：ac.md 两处修订为仅删表确认（差异登记，不改裁决） | `docs/requirements/ui-ux-redesign/ac.md`（修订登记） |
| 5 | Esc/点空白收拢语义散落各组件（ctxMenu Esc 关自身、CM6 Esc 出单元格），无「模态在场只关确认框」统一分层 | PEND-04：统一 Esc/点击分层处理（确认框最上层优先）。**落点收口**：分层判定与一键回安静抽成独立模块 `hooks/useHushLayer.ts`（模块级浮层注册 bus，照 Dialog/ctxMenu 单例 bus 模式抄），App.tsx 仅一行装配接线 | `src/renderer/src/hooks/useHushLayer.ts`（新）、`components/Dialog.tsx`、`components/EditorContextMenu.tsx`；App.tsx 仅装配 |
| 6 | Esc 从单元格激活态出格为「分级」路径（keymap Escape → move out），与「一键直达静息」并存边界靠分散实现 | 按 PRD 5.5 判定边界固化：正文空白/Esc 直达静息；表格空白分级退格。分级判定落 keymap + useHushLayer，App.tsx 零逻辑 | `src/renderer/src/editor/table/keymap.ts`、`hooks/useHushLayer.ts`（新） |
| 7 | autosave 失败文案「自动保存失败（{reason}）」/「自动保存失败：{path}（{reason}）」 | 冻结文案「自动保存失败，文档可另存副本」（AC-ERR-15 口径；如保留 reason 后缀需评审登记） | `src/renderer/src/i18n/zh.ts`、`i18n/en.ts`、`hooks/useAutoSave.ts` |
| 8 | 轻量操作 toast 无显式差异声明（任务勾选/折叠路径无 toast 断言但口径未冻结） | PEND-15 差异声明落盘 + AC-OP-15 显式豁免收口 | `docs/requirements/ui-ux-redesign/ac.md`（修订登记）、本文件 §3.6 |
| 9 | hover 防抖/0px 抖动为散落实现，无统一出口断言 | 作为通用模式判据固化（AC-NF-04/05 全域适用），实现期按域核对 | `src/renderer/src/styles/`、各 hover 控件组件 |

---

## 5. 验收映射（AC 条目 → 本域判据）

| AC 条目 | 本域判据 |
|---|---|
| AC-RULE-05 | §3.5 状态出口：终态必静息/关闭，无悬空态 |
| AC-RULE-13 | §3.4 纯选中复制不弹 chrome、点击进编辑 |
| AC-RULE-15 | §3.3 仅删表确认 + 冻结文案（Q3 修订后口径） |
| AC-RULE-16 | §3.7 只读拦截固定文案 |
| AC-FN-06 | §3.1 回执含 undo 后缀、undo 回执「已撤销」、自动消失不遮挡 |
| AC-FN-14 | §3.5 防抖 ≥150ms、不遮挡、位移 0px、移出无残留 |
| AC-FN-21 | §3.4 一次收拢 + 焦点回正文；§3.3 模态叠加分支（确认框在场只关确认框） |
| AC-FN-22 | §3.4 点正文其他段落退出表格编辑，无残留，偏移 0px |
| AC-FN-23 | §3.5 静息零 chrome 逐块核对 |
| AC-FN-29 | §3.4 表格空白分级退格（单元格激活→编辑态，工具栏保持） |
| AC-OP-09/10 | §3.3 确认流集合（仅删表）+ §3.7 回执文案 |
| AC-OP-12 | §3.1/§3.2 toast 撤销按钮 5s 驻留 + undo 三入口等效 +「已撤销」 |
| AC-OP-15 | §3.6 轻量不回 toast（显式豁免收口） |
| AC-ERR-04 | §3.2 误触一步 undo +「已撤销」 |
| AC-ERR-07 | §3.3 删表确认两分支 + 固定文案 |
| AC-ERR-08 | §3.7 只读文案 + 不产生半提交 |
| AC-ERR-15 | §3.7 autosave 失败文案 + 不静默丢稿 + 另存恢复 |
| AC-NF-04 | §3.5 出入防抖 ≥150ms、闪烁 0 |
| AC-NF-05 | §3.5 垂直/水平位移 0px |
| UI-ELEM-03 | §3.1 toast 自动消失/不夺焦/不遮挡/无布局位移 |
| UI-IXD-05 | §3.3 确认框两按钮可点、文案固定 |
| UI-IXD-12 | §3.4 Esc/正文空白一键回安静 |
