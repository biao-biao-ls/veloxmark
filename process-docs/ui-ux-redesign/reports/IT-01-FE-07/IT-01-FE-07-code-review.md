# FE-07 代码审查报告（toast 动作按钮能力）

**得分：** 94/100（阈值：90）　**状态：** ✅ 通过（Important-1 裁定必修，已派 fix-cr-FE07-ack）
**基线规范：** code-review/SKILL.md + rubric-code-review.md（前端 90）；已独立读码，未采信 implementation-notes #7 自述
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

## 风格归因（前置）
- 已有代码：Dialog/ctxMenu/mermaidLightbox 模块单例 bus、`useSyncExternalStore`（preferences/useStore.ts）、`getCtxRuntime()?.toast` 反向 seam、`t('ns.key')` 双字典、CSS token 化——useToast.ts / ToastHost.tsx / toast.css 全部对齐既有模式
- CLAUDE.md：React 19 不用 forwardRef ✓、App.tsx 仅装配（净增 `<ToastHost />` + 别名导入）✓、i18n 新 key 双字典同加 ✓、token 无裸 px 新值（13px 为 ui_07 既有规格）✓
- 结论：无风格扣分项

## 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 功能完整 | 10 | 10 | — | |
| 遗漏需求 | 7 | 8 | -1 按钮路径 undo 失败仍回执（见 P2） | 客观 |
| 越界多做 | 8 | 8 | — | |
| 理解正确 | 7 | 7 | 三入口同栈/5s/队列/冻结文案均正确 | |
| 边界覆盖 | 6 | 7 | -1 undo 失败分支未收口 | 客观 |
| 职责分离 | 10 | 10 | bus/渲染面/App 装配三层干净 | |
| 错误处理 | 8 | 10 | -2 undoAction.run 忽略 undo() 返回值 | 客观 |
| 编码风格 | 8 | 8 | — | |
| 测试覆盖 | 6 | 8 | -2 真实 undoAction 闭包无测试 | 客观 |
| 安全 | 8 | 8 | message 走 React 文本渲染，无 XSS | |
| 性能 | 8 | 8 | 计时器替换/清理正确 | |
| DRY | 4 | 4 | refocusAfterUndo/undoneInput 单源 | |
| YAGNI | 4 | 4 | dispose() 供测试用，合理 | |
| **合计** | **94** | **100** | | |

## 重点核查（范围指定项）
- **三入口等效一步还原**：✓ 共同面成立——Ctrl+Z（setup.ts:189-192 Mod-z→undoWithAck）/ 编辑菜单（editCmds.ts:34）/ toast 按钮（useToast.ts:164-172 undoAction.run→undo(view)）均走同一 CM6 `undo()`；ack 归属差异见 P2
- **AC-OP-12 判据3 锚定回位**：✓ `activationHistory`（table/state.ts:138-151 invertActivation，仅 doc 变化事务入栈）注册于 setup.ts:122-125（colWidthHistory 之后），三入口共享同一 history，undo 时 invertedEffects 回放操作前 active/editFrom 快照；refocusAfterUndo（useToast.ts:152-157）焦点已在 view.dom 内（含嵌套）不动、否则 view.focus()，满足「随后键盘输入直达正文」
- **i18n 专项**：✓ en/zh toast.* 38 key 全对齐；冻结族「（Ctrl+Z 可撤销）」全角括号逐字匹配 AC，frozenCopy.test.ts:21-42/57-71 逐字守护；`toast.undone`=「已撤销」/`toast.undoBtn`=「撤销」正确（frozenCopy.test.ts:37-38）
- 并发修复批文件（table/commands.ts、opsTable.ts）读到中间态：toast 撤销按钮挂接点（commands.ts:255/271/332、opsTable.ts:221/372）与 FE-07 契约一致，不下重结论

## 问题清单

| severity | item | detail | location | suggestion |
|---|---|---|---|---|
| Important | 三入口回执门控不等效 | `undoAction.run` 调 `undo(view)` 后忽略返回值，`runAction` 无条件 `show(undoneInput())`——undo 失败（空栈）时按钮仍回「已撤销」假回执；而 `undoWithAck` 正确地以 `if (!undo(view)) return false` 门控、失败不回执（useToast.ts:140-141）。三入口在此分支行为分叉，违背 glb-undo:triple-entry「同上」终态 | useToast.ts:98-103、164-172 | `ToastAction.run` 改返回 `boolean`（`undo(view)` 成功才 refocus 并返 true）；`runAction` 仅在 `run()` 返 true 时 `show(undoneInput())`，失败时收起或保持原 toast |
| Minor | 撤销按钮真实闭包零测试 | useToast.test.ts:62-79 用 mock `run` 测 store 契约，`undoAction(view)`（真 undo+refocus）与单例 `runToastAction` 路径、`refocusAfterUndo` 分支均无用例；任务阶段1「撤销回调」仅覆盖了 mock 面 | useToast.test.ts:62-79（缺口）；useToast.ts:164-177 | 补 2 例：`undoAction`+`runToastAction` 对 historyView 真实一步还原+回执「已撤销」；undo 失败时不回假回执（与 P1 同改可一并断言） |
| Info | ToastAction 泛化与 ack 硬编码并存 | `runAction` 对任意 action 回执固定「已撤销」——当前 GLB 契约「唯一动作是 undo」成立，未来引入非 undo 动作会错回执 | useToast.ts:98-103 | 接口注释已声明 undo-only；若后续扩动作，ack 文案随 action 走 |
| Info | 任务文档位置口径漂移 | 任务文件页面元素表写「编辑区下方居中浮层」，ui_07 设计与实现为「窗口右下角」（ui_07_global.html:1139/1174、toast.css:5-12）——实现以设计稿为准，任务文档侧偏差 | FE-07.md:48（任务文档，非代码） | 任务文档该行对齐 ui_07 口径（归 doc-reconcile 登记候选） |
| Info | 快速连操作可能合并 history 组 | 相邻结构 op（<500ms，同 userEvent 族）可能被 CM6 history 合并为一步 undo，一次还原两 op——三入口行为仍等效，但超出「单 op 一步还原」理想口径 | editor/table/commands.ts:307-319（dispatch 未加 isolateHistory） | 属表格 op/修复批边界议题，FE-07 不阻塞；如需严格逐步可在 op 事务加 `annotations: isolateHistory`（与修复批一并评估） |

## 结论

FE-07 核心交付（useToast 单例 bus + ToastHost 渲染面 + 5s 恒驻留/队列替换/撤销按钮 + 既有调用点全量迁移 + App.tsx 一行装配）全部落地且与项目既有模式高度一致；范围指定的三入口等效与判据3 锚定回位经独立读码确认成立（共享 history + invertActivation）。94 ≥ 90，**通过**。Important-1（按钮路径假「已撤销」回执）裁定**必修**，派 fix-cr-FE07-ack（含 Minor 测试补缺同批），小修后以单测证据收口、无需全量重审。
