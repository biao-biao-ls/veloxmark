## 代码审查报告 — IT-01/FE-09 useHushLayer 一键回安静与模态叠加

**目标**：`D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-01/FE-09.md` 对应前端实现（工作目录 `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`）
**得分：88/100**（阈值：90）
**状态：❌ 不通过（r1）**——差 2 分；修复 1 项 Important 即可过线。已并入 fix-biz-PATH06 修复批（同域：浮层收拢/模态层级），修毕重审 r2。
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因摘要（评分前置，不扣分）
- 已有代码风格：`hooks/useHushLayer.ts` 与 Dialog/ctxMenu/useToast/mermaidLightbox 单例 bus 同型（store 工厂 + 模块单例 + App 一行装配 `App.tsx:144`）；纯逻辑同目录 `*.test.ts`（13 项）；单测不渲染 widget —— 全部对齐项目既有模式 ✅
- CLAUDE.md 约定：行为型改动零新增文案；i18n 专项通过：en/zh key 对齐有 `i18n/i18n.test.ts` 守护；快捷键回显单源 `commands/shortcutDisplay.ts`（`shortcutMatch.test.ts:140,171` 钉住 AC-FN-07/AC-RULE-11）；子菜单字形「▸」`MenuBar.tsx:534` = `EditorContextMenu.tsx:92` 一致 ✅

### 评分明细

| 维度 | 得分 | 满分 | 扣分项（归因） |
|---|---|---|---|
| 需求合规 | 32.5 | 40 | 遗漏需求点 4/8（gridPicker Esc 未入 bus，-2.5，客观）；边界 3.5/7（picker+modal 遮挡边缘 -2 客观；确认框 z-index 非最上层 -1.5，标注疑似在修中）；其余：功能实现 10/10、无多做 8/8、理解正确 7/7 |
| 代码质量 | 56 | 60 | 测试 6/8（toast 断言同义反复 -2）；DRY 3/4（Esc 委托两处小重复、keyboardNav 死 Esc 合同+死测试 -1）；YAGNI 3/4（`dispose()` 无调用方 -1）；其余：职责分离 10/10、错误处理 10/10、风格 8/8、安全 8/8、性能 8/8 |
| **合计** | **88** | **100** | |

### 问题清单

| severity | item | detail | location | suggestion |
|---|---|---|---|---|
| Important | gridPicker Esc 绕过 hush bus | 自有 keydown 以 `preventDefault+stopPropagation+closePicker()` 吃掉 Esc（`gridPickerKey` 的 `close` 分支），事件不到 document bus。picker+表格工具栏共存时一次 Esc 只关 picker、工具栏残留（第二次才静息）——违背 AC-FN-21「一次收拢（非逐个关闭）」/UI-IXD-12 与任务实现笔记 1「Esc 统一消费权归 bus」；picker 焦点+模态共存时也是先关 picker 而非最上层确认框（PEND-04 边缘） | `src/editor/table/gridPicker.ts:252-260` | Esc 分支改为委托 `hushLayers.consumeTop()` 后 `preventDefault+stopPropagation`，照抄 `MenuBar.tsx:160-166` / `EditorContextMenu.tsx:301-310` 同款 |
| Important（疑似在修中） | 确认框非视觉最上层 | `.dialog-overlay` z-index 2000 低于 `.table-grid-picker`/`.code-lang-picker` 2400（另有 markdown.css 2500/3000/4000、tabs.css 3000）——「确认框恒最上层」在 CSS 层不成立，共存时确认框被盖且上层浮层不 yield 点击。overlays.css 属并发修复 agent 改动区，不下重结论 | `src/styles/overlays.css:6` vs `:235,:283` | 确认框层提到全仓浮层之上（或浮层统一 ≤1900）；与修复 agent 收敛后落，复核 UI-IXD-12 无穿透。**注：该条即 PATH-06 P2a，已在 fix-biz-PATH06 批内** |
| Minor | 两级 Esc 死合同残留 | `applyMenuKey` Escape 仍实现「子菜单→收拢回一级」两段式并被测试钉住；MenuBar 在其前已拦截 Esc 委托 bus（`MenuBar.tsx:160-166`），与 glb-hush:one-shot「Esc 一键到底」裁决相悖，属不可达旧合同 | `src/editor/contextMenu/keyboardNav.ts:174-182`；`keyboardNav.test.ts:163-165` | 删除/改写 Escape 分支（一级收拢仍走 ←/ArrowLeft），同步更新测试为一键到底口径 |
| Minor | toast 不可动断言同义反复 | `toastVisible` 为函数内局部变量，`expect(toastVisible).toBe(true)` 永真，无法守护「toast 永不注册/永不收拢」 | `src/hooks/useHushLayer.test.ts:122-132` | 改断言真实面：`store.layerIds()` 不含 toast 类 id，或经注入 deps 验证 collapse 路径未触碰外部 toast 面 |
| Minor | dispose() 无任何调用方 | store 暴露 `dispose()`（接口 `useHushLayer.ts:67`）但生产/测试均未调用，轻度 YAGNI | `src/hooks/useHushLayer.ts:149-151` | 移除；或接线到 unmount/热重载清理并补一测 |
| Info | Esc 消费片段两份小重复 | `consumeTop + preventDefault + stopPropagation` 在 MenuBar/EditorContextMenu 各一份（各 3 行，现状可控） | `MenuBar.tsx:160-166`、`EditorContextMenu.tsx:301-310` | 可选抽 `consumeEsc(event)` 供各浮层共用 |
| Info | fix-agent 并发区不重评 | `editor/table/state.ts` 的 editFrom/`invertActivation`（fix-FN29 + undo）按 AC-FN-29 口径核对逻辑自洽（active 与 editFrom 解耦、gap 点→`enterTableEdit` 保会话、全退仅 `exitTableEdit`），文件在并发修复区，不下重结论 | `src/editor/table/state.ts:25-81,132-142` | 修复 agent 收敛后复核 undo 可逆性终态 |

### 已核实的良好面（不扣分）
- bus 分层栈（modal>menu>chrome）+ `consumeTop()` modal-only（PEND-04）/一次性 `collapseAll()`（AC-FN-21 非逐个）/空栈零副作用：`useHushLayer.ts` + 13 项纯逻辑测试覆盖（modal 优先、toast 不动、死层 prune、skip-guard 让路）
- 五处注册点齐备：Dialog(`Dialog.tsx:383-388`)/ctxMenu/MenuBar/gridPicker(`gridPicker.ts:299-305`)/table toolbar(`toolbar.ts:169-175`)；`isDialogOverlayTarget` 让路布在 MenuBar/EditorContextMenu/gridPicker 三条 outside-close 路径；blur-exit 竞态守护 `nestedSession.ts:226`；RenderFloat 临时 Esc 监听已拆（`RenderFloat.tsx:180-182`）
- AC-FN-29 分级回退（fix-FN29）：`state.ts` editFrom 解耦 + `commands.ts` `enterTableEdit`/`exitTableEdit` + gap 路由，`editMode.test.ts` 15 测钉住

### 结论

❌ 不通过（88/100 < 90）。核心交付质量高（bus 架构、一键收拢、modal 优先、FN-29 分级回退、测试与风格全部达标），卡线主因是 **gridPicker Esc 绕过统一消费权**（AC-FN-21 直接违背，Important）与确认框 z-index 非最上层（PATH-06 P2a，在修）。修复 gridPicker Esc 委托一项即 +2.5 ≈ 90.5 过线；顺手 2 项 Minor（死 Esc 合同、toast 同义反复断言）；dispose() 遗留登记。
