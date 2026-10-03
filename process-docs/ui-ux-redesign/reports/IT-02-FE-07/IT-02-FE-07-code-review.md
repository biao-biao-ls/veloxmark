## 代码审查报告 — IT-02/FE-07 大纲平滑跳转与 active 跟随

**得分：96/100（阈值：90）**
**状态：✅ 通过**（无 Important；5 Minor 入收口批候选，不阻塞）
**基线规范：** rubric-code-review.md + code-review/SKILL.md + eval-loop/prompts/reviewer.md（前端项目，通用 90 阈值）
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）
- **已有代码风格**（已读 useFoldSync.ts / useQuoteFold / useToast 等 sibling hooks + hooks/*.test.ts 群）：文件头设计注释收口纪律、纯核导出可测 + hook 两层、`ViewRef` seam（e2e/seams/types）、render 期 ref-mirroring、`*.test.ts` 同目录共置。新代码全部吻合。
- **CLAUDE.md 约定**：新逻辑不入 App.tsx（goToHeading 一行转发，已核 `App.tsx:635`）；纯逻辑配单测；样式取 token（`chrome.css:563-581` active-follow 三件套全 token 化）；i18n 双词典对齐。
- 结论：无风格类扣分；客观类问题独立扣分。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 功能完整性 | 10 | 10 | — | |
| 遗漏需求点 | 8 | 8 | — | |
| 多做需求外 | 8 | 8 | flush 归入 YAGNI 计 | |
| 需求理解 | 7 | 7 | — | |
| 边界/异常 | 7 | 7 | 4 项异常场景全落（折叠内/连点/无标题/动画中滚动）+ clamp/非标题/空 view 防御 | |
| 职责分离 | 10 | 10 | — | |
| 错误处理 | 10 | 10 | seq 守卫/coords null/settle 兜底/cleanup 齐 | |
| 编码风格 | 8 | 8 | — | |
| 测试覆盖 | 8 | 8 | 23 例纯核断言含节流双边界/pin 互斥/连点末击胜出 | |
| 安全 | 8 | 8 | 无注入面，React 文本转义 | |
| 性能 | 8 | 8 | 节流+无 rAF 跳是加分项；小重复见 M3 | |
| DRY | 2 | 4 | -2：extractOutline 双走 | 客观 |
| YAGNI | 2 | 4 | -2：Throttle.flush() 生产零消费 | 客观 |
| **合计** | **96** | **100** | | |

### 问题清单

| severity | item | detail | location | suggestion |
|---|---|---|---|---|
| Minor | YAGNI | `Throttle.flush()` 仅测试消费（test:205），hook 只用 schedule/cancel | hooks/useOutlineNav.ts:162-166 | 删 flush，或 settle 处确有需要再留并注释用途 |
| Minor | DRY | `jumpToHeading` 已持 `items`，`headingAtLine` 内部再跑一次 extractOutline 全树遍历 | useOutlineNav.ts:255 + editor/livePreview/fold.ts:156-160 | 用 `items.find(i => i.pos === doc.lineAt(pos).from)` 就地解出标题 |
| Minor | 性能 | pin 期间 `runFollow` 仍急切 `extractOutline`（结果被 pin 覆盖丢弃），动画期约 8 次无效树遍历 | useOutlineNav.ts:231-237 | `isPinned()` 早退（pin 时已 setActivePos） |
| Minor | 边界 | 跨文档 stale pin：跳转 settle 窗口内切标签，旧 doc 的 pin 位点残留给新文档大纲 active（settle 只 release 不重算，需等下次滚动/选区事件） | useOutlineNav.ts:112-115, 221-229 | `update()` 加守卫：pin 不在当前 `items` 中则回落探针规则（或 doc 替换时 bump jumpSeq+release） |
| Minor | settle 时序 | 长文档 smooth 动画若 >800ms，兜底 timer 提前 release，尾段动画可能被跟随探针翻 active | useOutlineNav.ts:36, 298 | 兜底改为 scrollTop 稳定 2 帧后 settle，或阈值放宽至 ~1200ms（低置信，疑似） |
| Info | 契约字面 | NAV-sidebar.md `nav-outline:jump` 输入写作 `{ headingId }`，实现签名为 `heading pos`（implementation-notes① 已登记，FE-08 按 pos 联调） | design/api/NAV-sidebar.md:27 + useOutlineNav.ts:188 | 下轮文档对齐写「heading pos（=OutlineItem.pos）」，避免 doc-drift 名实不符 → 归 doc-reconcile 登记候选 |
| Info | i18n/字形 | 无新增文案；`outline.empty`/`render.fold.*` en.ts:411,589-590 ↔ zh.ts:406,583-584 对齐；▸/▾ 与 FileTree.tsx:565、fold.ts:222、quoteFold.ts:241 一致 | i18n/ + components/Outline.tsx:160,167 | 无需处理；快捷键回显（AC-FN-07/AC-RULE-11）本任务文件集零触碰（菜单域） |

### 结论

✅ **通过（96 ≥ 90）**。核心合同全部落地并有实证：smooth 显式居中跳转（禁 scrollIntoView 瞬移）、pin/release 互斥防闪烁、settle 后 `throttle.cancel()` 兜文末 clamp 抖动、`jumpExpandKeys` 仅开目标+折叠祖先（兄弟不展开，6 例边界测试）、`pickActiveHeading` 顶部归首节、App.tsx 零新逻辑（`App.tsx:635` 一行转发）、`outline-item-{i}`/`outline-fold-{i}` 缝对齐 FE-08 约定。扣分仅 YAGNI/DRY 两处小项（-4）。5 条 Minor/Info 均为收口批候选，不阻塞提交。
