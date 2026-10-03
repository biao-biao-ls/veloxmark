## 代码审查报告 — IT-03/FE-03（hover 浮层/微操作防抖基座与退出纪律）

**得分：** 97/100（阈值：90）
**状态：** ✅ 通过（无 Critical/Important；3 Minor 入收口批候选，不阻塞）
**基线规范：** rubric-code-review.md + code-review/SKILL.md + eval-loop/prompts/reviewer.md（已 Read）；本项目为前端（package.json，无后端特征），阈值 90。
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）

**已有代码风格**（抽样：preferences/useStore.ts、hooks/useHushLayer.ts、editor/table/chromeState.ts、editor/livePreview/*、styles/*、i18n/*）：模块级单例 bus + `create*Store` 工厂（Dialog/ctxMenu/HushLayer 同型）；状态接入 `useSyncExternalStore` 稳定快照；纯逻辑模块同目录 `*.test.ts`；CSS token 化 + `t('ns.key')`。
**用户/项目 CLAUDE.md**：新逻辑放 hooks/ 独立模块、单例 bus 既定模式、token 唯一声明点、i18n 双字典对齐。
**归因结论**：`useHoverDiscipline`（工厂+单例+useSyncExternalStore）/`renderFloatPos`（纯函数+共置测试）/`RenderFloat`/`hoverZones` 全部与已有代码及 CLAUDE.md 一致，无风格扣分。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 功能实现完整 | 10 | 10 | — | 客观核验通过 |
| 需求遗漏 | 8 | 8 | — | 四条 AC 均有代码+测试+CDP 数据面证据 |
| 需求外多做 | 8 | 8 | — | hook 为任务点名交付；`registerHoverContent` 形态已由 FE-04~06 三消费方固化 |
| 需求理解 | 7 | 7 | — | 150ms 双向防抖/show-pending 取消/互斥/pin/retain/阶梯定位/below-align 左缘全与任务一致 |
| 边界异常 | 6 | 7 | below-align 上翻极端裁切无兜底（-1） | 客观（Minor） |
| 职责分离 | 10 | 10 | — | 基座/定位/壳/命中区四文件单一职责 |
| 错误处理 | 9 | 10 | `hideNow` 对非活动条目无条件 `setActive(null)`（-1） | 客观（Minor，潜伏合同面） |
| 编码风格 | 8 | 8 | — | 归因通过 |
| 测试覆盖 | 7 | 8 | `render.list.dragHandle` 未入 i18n 非空白名单（-1） | 客观（Minor） |
| 安全 | 8 | 8 | — | 无注入/XSS 面（ReactNode、无 dangerouslySetInnerHTML） |
| 性能 | 8 | 8 | — | 事件代理零 Decoration 增量；快照恒等防重渲 |
| DRY | 4 | 4 | — | `HOVER_DELAY_MS` 单源，chromeState 复用 + 三方同步测试 |
| YAGNI | 4 | 4 | — | 无冗余功能 |
| **合计** | **97** | **100** | | |

独立核验要点（非作者自述）：`useHoverDiscipline.ts:25` 单定义 + `:149` clamp 上限、`:189-193` show-pending 取消（0 闪烁，18 条状态机单测覆盖）；`renderFloatPos.ts:85-114` below→above→beside 阶梯 + 不遮挡断言（13 条单测）；`render-zone.css:474-477` `position:fixed` 零位移；`RenderFloat.tsx:184` 静息卸载零残留；`hoverZones.ts:31-40` 命中优先级 image>link>list + broken 图豁免；Esc 经 `useHushLayer.ts:222` `hideAllNow()` 单消费者；`en.ts:587`/`zh.ts:581` `render.list.dragHandle` 对齐（对称测试守护）。自测报告（`reports/IT-03-FE-03/IT-03-FE-03-selftest.md`）含防抖计时/位移 0.00px/闪烁 0/收拢 0.6ms 原始数据，CDP 计时陷阱已文档化。本任务无快捷键回显面（AC-FN-07/AC-RULE-11 不适用；UNDO_SUFFIX 空格属 fix-cr-IT03FE01 在途，不重复计）。

### 问题清单

| 级别 | 项 | 详情 | 位置 | 建议 |
|------|----|------|------|------|
| Minor | hideNow 快照一致性 | 对非 active 条目调用时 `remove(id)` 后无条件 `setActive(null)`，会误清当前活动通道快照（当前消费方时序不可达，API 合同潜伏面） | `src/hooks/useHoverDiscipline.ts:236-241` | 仅当 `snapshot.active?.id === id` 时 `setActive(null)` → 收口批候选 |
| Minor | i18n 测试名单缺口 | `render.list.dragHandle` 在 EN/ZH 对称测试覆盖内，但未入 `RENDER_STATIC_KEYS`，非空白值检查漏它（i18n.test.ts 在并发批在途，轻记） | `src/i18n/i18n.test.ts:180-206` | 将 `render.list.dragHandle` 加入 `RENDER_STATIC_KEYS` → 收口批候选 |
| Minor | below-align 顶部裁切 | 无下侧空间上翻时 `top` 不 clamp，锚点贴视口顶可裁切出屏（已声明「永不横移」取舍，保不遮挡优先） | `src/components/renderFloatPos.ts:82` | 纵向 `Math.max(0, …)` 仅在不侵占锚点 gap 时生效，或在 AC 报告登记豁免 → 收口批候选 |
| Info | hook 无消费方 | `useHoverDiscipline(id)` 暂无生产调用（FE-04~06 走 imperative bus + registerHoverContent） | `src/hooks/useHoverDiscipline.ts:295` | 消费方落地时接入；任务点名交付面，不判 YAGNI |
| Info | 合同形态微差 | 任务接口表列 `content` 为调用参数，实现为 `registerHoverContent` 注册缝（更优，三消费方已固化） | 任务文件 vs `src/components/RenderFloat.tsx:42` | 维持现状；如回写任务表可记 doc-drift |
| Info | Esc 接线形态 | 任务写 RenderFloatHost keydown，实现归 useHushLayer 单消费者（与任务"useHushLayer 落地后复核"一致，代码注释已声明） | `src/hooks/useHushLayer.ts:221` | 无需动作 |
| Info | drag-handle 裸 px | `letter-spacing:-1px`（drag-handle token 化 fix-cr-IT03FE01 在途） | `src/styles/render-zone.css:281` | 跟踪在途批，不在本任务重复扣 |

### 结论

✅ **通过（97/100 ≥ 90）**。基座状态机/定位数学/命中区接线/退出纪律均按 AC 落地且有单测+CDP 双证，跨模块合同（FE-04~06 消费方、useHushLayer、chromeState 阈值单源）与已核结论一致。3 项 Minor 均为边缘加固（API 合同潜伏面/测试名单/极端几何取舍），无 Critical/Important，可并入收口批处理。
