## 代码审查报告 — IT-01/FE-09 useHushLayer 一键回安静与模态叠加（**r2 重审**）

**得分：** 98/100（阈值：90）　**状态：** ✅ 通过（r1 88 → r2 98，fail 路径第 2 轮闭合）
**评审者：** zcode:zcode-reviewer（只读独立复核，未采信修复批自述）· 2026-10-02
**范围：** FE-09 前端实现；并发批在途文件（table/{state,source,ops,commands,nestedSession}.ts、opsTable、i18n、tokens/render-zone.css）不评；已登记存量债（dispose 无调用方、P2a 同开态编程式构造说明等）不重复扣分。

### 风格归因摘要（前置，不扣分）
- 已有代码：hushLayers 单例 bus 与 Dialog/ctxMenu/useToast 同型；codeEdit 纯函数+薄封装与 mathScan→mathEdit 同构；纯逻辑 `*.test.ts` 同目录共置；契约式源扫描断言（contract.test.ts 同法）——全部对齐既有模式 ✅
- CLAUDE.md：零新文案/零 App 新逻辑（App.tsx:144 一行装配）；e2e 缝未动；CSS z 值改动带契约测试守护 ✅

### 评分明细

| 维度 | 得分 | 满分 | 扣分项（归因） |
|---|---|---|---|
| 需求合规 | 39.5 | 40 | 边界 6.5/7（-0.5：探针 from-only 与渲染 blockTouched from-or-to 口径不一致，客观小边角）；功能 10/10、遗漏 8/8、无多做 8/8、理解 7/7（r1 两项缺口均闭合） |
| 代码质量 | 58.5 | 60 | 测试 7/8（-1：toastHide mock 未接线断言仍永真，部分闭合）；DRY 3.5/4（-0.5：gridPickerKey 平行 Esc 合同+死分支）；职责 10/10、错误处理 10/10、风格 8/8、安全 8/8、性能 8/8、YAGNI 4/4（dispose 列已登记债不扣） |
| **合计** | **98** | **100** | | |

### 问题清单

| severity | item | detail | location | suggestion |
|---|---|---|---|---|
| Minor | 探针 from-only vs blockTouched from-or-to | `isCodeEditActive`/`isMathEditActive` 仅查 `selection.main.from`，而渲染面 `blockTouched` 认 from 或 to 端点入块（build.ts:61-62）——范围选区仅尾端入块时面板仍渲染但 `blockEdit()` 返回 null，Esc/空白收拢不会退编辑面（exitCodeEdit 自身是 from??to，口径互不一致）。与 mathEditExitBindings 既有 from-only 同型，故轻扣 | `hooks/useHushLayer.ts:210-211`、`editor/codeEdit.ts:92`、`editor/mathEdit.ts:14` | 探针改为 from??to 双端判定（与 exitCodeEdit 对齐），补一例尾端入块断言 → 收口批候选 |
| Minor | toast 断言残余永真 | 改造后真实面已加（closed 集无 toast 类 id + collapseChrome 计数，useHushLayer.test.ts:149-151），但 `toastHide` 是未注入任何被测路径的本地 mock，`expect(toastHide).not.toHaveBeenCalled()` 恒真，无法守护收拢不触碰外部 toast 面 | `hooks/useHushLayer.test.ts:139,150` | 删该 mock 两行；或给 store 注入 toast 面缝后断言零调用 → 收口批候选 |
| Minor | gridPickerKey 平行 Esc 合同+死分支 | Esc 委托 bus 后 `gridPickerKey` 的 `Escape→'close'` 成平行旧合同（仍被 test:62 钉住），DOM 路径的 `else closePicker()` 不可达（Esc 在 :257 已提前 return） | `editor/table/gridPicker.ts:70,264-270`、`gridPicker.test.ts:62` | 删除 gridPickerKey 的 Escape 分支与死 else，或注释注明「函数级合同、DOM 层归 bus」并同步测试 → 收口批候选 |
| Info | Esc 消费三份小重复 | `consumeTop+preventDefault+stopPropagation` 现有三份（MenuBar/EditorContextMenu/gridPicker） | MenuBar.tsx:160-166、EditorContextMenu.tsx:301-310、gridPicker.ts:257-262 | 可选抽 `consumeEsc(event)` 共用 → 登记候选 |

### r1 扣分点逐条闭合状态

| r1 扣分点 | 状态 | 复核证据 |
|---|---|---|
| Important：gridPicker Esc 绕过 hush bus（-4 遗漏） | ✅ 闭合 | Esc 分支改委托 `hushLayers.consumeTop()` 后 preventDefault+stopPropagation，MenuBar 同款（gridPicker.ts:252-263）；modal 在场只关确认框、不关 picker（PEND-04 保持） |
| Important：确认框 z 非最上层（picker 2400>dialog 2000） | ✅ 闭合 | `.table-grid-picker`/`.code-lang-picker` z=1500（overlays.css:238,289）< `.dialog-overlay` 2000（:6）> ctx 1000；`overlayZOrder.test.ts` 契约钉死两不变量；余留高值取舍逐一核实：link-tooltip 4000 `pointer-events:none`（markdown.css:144）、quickopen 2100 系 `.dialog-overlay` 子类自模态（QuickOpen.tsx:189）、`cm-md-table-menu` 3000 全仓无 TS 消费方、mermaid 2500 自模态遮罩；tab-context-menu 同开态=已登记债不重挖 |
| Minor：keyboardNav 两级 Esc 死合同 | ✅ 闭合 | `applyMenuKey` Escape 一律 `{toRoot, effect:'close'}` 一键到底（keyboardNav.ts:175-177），测试改一键口径（keyboardNav.test.ts:163-170） |
| Minor：toast 同义反复断言 | 🟡 大部闭合 | closed 集真实面 + collapseChrome 计数已落（test:146-151）；残余 toastHide 永真行（见问题清单，-1） |
| Minor：dispose() 无调用方 | ➖ 不重扣 | 已列存量债登记（useHushLayer.ts:180-182 仍在，不动） |
| Info×2：Esc 重复片段 / 并发区 | ✅ 维持 Info | 重复升为三份仍可控；并发批在途文件未评 |

### 修复批声称逐项核验（全部真实落地且语义正确）

BlockEditHandle+blockEdit 探针（useHushLayer.ts:54-57,205-213,227）✓；collapseAll 顺序 注册层逆序→be.close→focusBody(open>0||be)→collapseChrome（:115-141）✓；consumeTop 扩条件 `blockEdit?.()!=null`（:158）✓；BLOCK_EDIT_SEL 选择器与真实 DOM 逐一对上（widgets-math.ts:33,105,132、codeBlock-widget.ts:96,209、handlers-math.ts:111-114、previewWidget.ts:45）✓；keydown `defaultPrevented` 保护（:285）✓；codeEdit.ts 围栏定位符合 CommonMark（同符、长度≥开栏、闭栏无信息串）+ 9 测试 ✓；mathEdit `isMathEditActive` 导出 ✓；useHushLayer.test +3 blockEdit 用例（:166-196）✓；gridPicker 注册 tier:'menu'+isAlive（:310-316）✓；App.tsx:144 一行装配 ✓。纯逻辑测试全绿可复算（16+9+2+keyboardNav），在途批 TS 报错不涉本任务文件。

### 结论

✅ **通过（98/100 ≥ 90）**。r1 两项 Important（gridPicker Esc 入 bus、确认框 z 恒最上层）均以正确语义真实落地并有契约测试守护，两项 Minor 死合同/断言已修或大部修复；剩 3 项 Minor/Info（探针双端口径、toast 残余永真行、gridPickerKey 平行合同）均为小边角/清理项，不阻塞验收，入收口批候选。
