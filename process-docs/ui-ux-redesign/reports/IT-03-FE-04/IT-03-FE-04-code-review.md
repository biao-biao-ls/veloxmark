## 代码审查报告 — IT-03/FE-04 图片编辑浮层

**得分：** 91/100（阈值：90）
**状态：** ✅ 通过（Important-1 裁定必修 → fix-cr-IT03FE04-broken-img；3 Minor 入收口批候选）
**基线规范：** code-review/SKILL.md + rubric-code-review.md + reviewer.md 方法论（已 Read）
**评审对象：** worktree `src/renderer` 下 FE-04 实现（imageEdit.ts / image-parse.ts / image-widget.ts / ImageEditFloat.tsx / markdown-image-ext.ts / export/renderDoc/inline.ts / render-zone.css / markdown.css / i18n / 各单测）
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）

- **已有代码风格**（已 Read 同类 8+：LinkHoverFloat.tsx、linkEdit.ts、readOnlyGuard.ts、useHoverDiscipline.ts、RenderFloat.tsx、image-widget.ts(P05)、ListDragHandle.tsx、opsTable.gate.test.ts）：浮层组件 = `registerHoverContent` 模块级注册 + bus-only 显隐（hideNow/pin/unpin、点击外部 mousedown capture）；写回单源 = `applyXEditAtAnchor`（DOM 派生锚点 + 语法树定位 + 单 dispatch + 只读闸）；stale-widget 纪律 = `eq()` 故意不比显示态、DOM 为活体真源。ImageEditFloat/imageEdit 与 FE-05 兄弟件逐条同构。
- **CLAUDE.md 约定**：`t('ns.key')` 双字典（i18n.test.ts 对称锁）、token 化几何（--img-resize-*/--img-tb-*）、WidgetType 实现 `eq`/`ignoreEvent`、纯函数共置单测、无 forwardRef。均符合。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 需求合规-所有功能 | 8 | 10 | -2 失败态修复入口未实现（与下同源，从轻） | 客观 |
| 需求合规-遗漏需求点 | 4 | 8 | -4 「重试/编辑地址」失败态入口（FE-04.md:83 元素表 + task-list.json PATH-05 归属 FE-04） | 客观 |
| 需求合规-多做 | 8 | 8 | — | — |
| 需求合规-理解正确 | 7 | 7 | 语法口径（=WxH px 槽 + {align=} 尾缀）、回执/undo/只读真源均与契约一致 | — |
| 需求合规-边界异常 | 7 | 7 | 只读闸/IPC fail-open/未加载 guard/无解析拒写/refusal 回滚齐备 | — |
| 质量-职责分离 | 10 | 10 | parse/write/float/widget/export 五层单源清晰 | — |
| 质量-错误处理 | 9 | 10 | -1 拖拽会话无 pointercancel/失焦/Esc 中止兜底 | 客观 |
| 质量-编码风格 | 8 | 8 | 与 FE-03/FE-05 兄弟件完全同构 | — |
| 质量-测试 | 8 | 8 | 三条点名判据（保对齐/保尺寸/补字段）+ lezer 跨度 + export 5 用例全钉死 | — |
| 质量-安全 | 8 | 8 | export escapeHtml、flip/align 枚举约束、无用户可控串外传 | — |
| 质量-性能 | 8 | 8 | 装饰/写回无放大；拖拽仅改 DOM 样式 | — |
| 质量-DRY | 3 | 4 | -1 尺寸百分比派生公式双份 | 客观 |
| 质量-YAGNI | 3 | 4 | -1 renderImageMarkdown 生产路径未调用 | 客观 |
| **合计** | **91** | **100** | | |

### 问题清单

| severity | item | detail | location | suggestion |
|---|---|---|---|---|
| Important | 失败态可修复入口缺失 | 元素表要求「图加载失败→错误条+重试/编辑地址，不静默占位」；现状仅 alt/`image.notFound` 静默占位，全仓无 重试/retry 实现。PATH-05 明确归属 FE-04/ui_06 规则卡（非已路由收口项） | `editor/image-widget.ts:114-123`；FE-04.md:83；task-list.json:260 | 在 `.cm-md-image-broken` 占位上补两按钮：「重试」= invalidateImageCache + 重设 src 重载；「编辑地址」= 复用 FE-05 URL 编辑态改写 src 写回；补 en/zh 键 → **裁定必修，fix-cr-IT03FE04-broken-img** |
| Minor | 拖拽会话无中断兜底 | pointerup 外无 pointercancel/blur 监听；Esc→hideAllNow 卸载浮层后拖拽仍继续且 pointerup 仍会写文档（ListDragHandle 有 Esc cancel，本件没有） | `components/ImageEditFloat.tsx:117-152` | window 同挂 pointercancel/blur 走 onUp 收尾；Esc 中止恢复 saved 样式、不写回 → **随 fix-cr-IT03FE04-broken-img 顺带（同文件正确性边缘）** |
| Minor | 尺寸派生公式双份 | `deriveWidthPct` 与 P05 zoom 工具栏 `derivePct` 均为 `(w/naturalWidth)*100`，fallback 不一致（100 vs spec.width） | ImageEditFloat.tsx:57-66；image-widget.ts:219-226 | 抽纯函数进 `editor/image-parse.ts` 双侧共用并补单测 → 收口批候选 |
| Minor | renderImageMarkdown 仅测试消费 | 注释称「写回口径单源」但写回实走 rewriteImage* 外科改写，生产无调用 | `editor/imageEdit.ts:47-54` | 注释改标 test-only round-trip mirror，或让一处写路径真用它 → 收口批候选 |
| Info | en UNDO_SUFFIX 缺分隔空格 | 合成后 `adjusted(Ctrl+Z…)` | i18n/en.ts:5 | **fix-cr-IT03FE01 已收口**（勿重复修） |
| Info | render-zone.css 2 处裸 px | `height:18px`（:148，ui_06 .tb-sep 常量有注释依据）、`inset:-1px`（:260） | styles/render-zone.css:148,260 | **batch-J 已路由 FE-04 收口批**，已注册 RENDER_ZONE_BARE_PX_ALLOWLIST |
| Info | 注释失真 | IMAGE_SPLIT_RE 注释称 permissive tail 可 round-trip 未知 `{key=}` 组，但 `parseImageMarkdown` 先拒未知组，该路径实际不可达 | editor/imageEdit.ts:23-28 | 注释改为「尾缀宽松仅容忍已知组的重排」 |

### 已核通过要点（抽样证据）

- **AC-OP-13**：写回单 dispatch（imageEdit.ts:181-184），undo=单步；toast 冻结句 zh/en 双源 + frozenCopy 锁；flip 无回执符合 PEND-15 冻结 4 key。
- **AC-ERR-08**：`assertWritable` 真源 `file:isWritable`（readOnlyGuard.ts:19-34），拒写零 dispatch、refusal 回滚预览样式（ImageEditFloat.tsx:143-148）；err.readonly 冻结文案有测试锁。
- **UI-IXD-10**：显隐全走 FE-03 hoverDiscipline（含 hoverZones dwell 与点击两路）；角柄 createPortal 随浮层卸载零残留；对齐成功后 `applyImageAlignDom` 活体打类、no-op 键不写文档（ImageEditFloat.tsx:185-198）——与任务 stale-widget 纪律自述一致（已独立验证属实）。
- **AC-OP-18**：export Image 分支 width/height 属性 + auto-margin inline style + flip transform（export/renderDoc/inline.ts:85-103），与 `.cm-md-image-align-*` 放置等价，inline.test.ts 5 用例钉死。
- **i18n**：render.image.* / render.toast.* en/zh key 全对齐（i18n.test.ts 对称断言 + 4 toast 冻结句）；快捷键回显走 UNDO_SUFFIX 单常量，与 IT-02 冻结体例一致。

### 结论

实现质量高、与已过审的 FE-01/02/03/05 合同面一致，核心 AC（OP-13/ERR-08/IXD-10/OP-18）全部落实且测试可证。唯一实质缺口是 ui_06 规则卡的图片失败态「重试/编辑地址」入口（PATH-05 归属本任务但未实现）——裁定必修，派 fix-cr-IT03FE04-broken-img（含同文件拖拽中断兜底）；余 2 Minor 入收口批。**91 ≥ 90，通过**。
