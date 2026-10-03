## 代码审查报告 — IT-03/FE-07 标题折叠/展开

**得分：** 93/100（阈值：90）
**状态：** ✅ 通过（Important×1 裁定必修 → fix-cr-IT03FE07-foldbtn）
**基线规范：** rubric-code-review.md + code-review/SKILL.md（前端，阈值 90）
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02
**评审范围：** FE-07 前端实现（fold.ts / useFoldSync.ts / Outline.tsx / i18n / render-zone.css / fold.test.ts + App 接线）

### 风格归因（前置）

- **已有代码风格**：livePreview 小文件群+共置单测；WidgetType 实现 `eq`/`ignoreEvent`；`useFoldSync` 是 `useQuoteFold`/`useTableWidthSync` 的镜像母本（签名门+suppressDirty+live-key 过滤）；会话写回走 `patchSession`+sanitizer；i18n 双字典+对齐/占位符测试守护；render-zone.css token 优先（兄弟裸 px 已注册豁免）。
- **CLAUDE.md**：App 只接线（逻辑在 fold.ts/hooks）✓；`t('ns.key')` en/zh 双加 ✓；单测只测纯函数（DOM 交互走 CDP 自测 71/71）✓；无 `.theme-dark` 补丁 ✓。
- **团队规范差异（Info 不扣）**：CLAUDE.md「replace>1 字符同步 atomicRanges」全仓未实践（widgets/table/quoteFold 均以选区进入自动展开替代），本任务与既有代码一致。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 功能实现（AC-FN-15/30、AC-RULE-14、UI-IXD-06 全落地） | 10 | 10 | — | — |
| 无遗漏需求点 | 8 | 8 | — | — |
| 无多做需求外内容（幽灵三角对齐槽有 ui_06 依据） | 8 | 8 | — | — |
| 需求理解正确（折叠粒度/双向同步/headingFolds 口径） | 7 | 7 | — | — |
| 边界与异常（空章节/空行退化/嵌套 ride-along/改名清洗/文件切换） | 7 | 7 | — | — |
| 职责分离 | 10 | 10 | — | — |
| 错误处理 | 5 | 10 | 非主键点击未拦截（-5） | 客观（正确性） |
| 项目风格遵循 | 8 | 8 | — | — |
| 测试覆盖（fold.test.ts 25 项真实 buildDecorations） | 8 | 8 | — | — |
| 安全（textContent 渲染、无注入面） | 8 | 8 | — | — |
| 性能（viewport 限装饰、签名门防写抖动） | 8 | 8 | — | — |
| DRY | 2 | 4 | outermost 过滤双写 + extractOutline 双走（-2） | 客观 |
| YAGNI | 4 | 4 | — | — |
| **合计** | **93** | **100** | | |

### 问题清单

| severity | item | detail | location | suggestion |
|----------|------|--------|----------|------------|
| Important | foldClickExtension 缺主键守卫 | `mousedown` 任意按键即 `toggleFold`：右键/中键点折叠三角或占位行会先切换折叠再弹正文右键菜单（意外状态变更）。同仓既有交互均判 `button===0`，本处漏判属客观交互边界问题 | src/renderer/src/editor/livePreview/fold.ts:261（对照 editor/table/widget.ts:218、hooks/useHushLayer.ts:296） | handler 首行加 `if (event.button !== 0) return false` → **裁定必修，fix-cr-IT03FE07-foldbtn** |
| Minor | 外层折叠过滤与大纲提取双写 | ① outermost 过滤谓词在 `collectFoldRanges` 与 `applyHeadingFoldDecos` 各写一遍，日后口径漂移无编译期报错；② `applyHeadingFoldDecos` 内 `collectFoldSections`（内部走 extractOutline）后又独立 `extractOutline`，每次重建双倍树遍历 | fold.ts:84-86 与 fold.ts:301-304；fold.ts:283 与 fold.ts:289 | 复用 `collectFoldRanges(state, foldedKeys)` 取 outermost；`const items = extractOutline(state)` 一次提取消两处调用 → **随 fix-cr-IT03FE07-foldbtn 顺带（同文件）** |
| Info | foldKey 同级同文冲突（存量口径） | 两个 `## 同名` 节共享 `level:text` 键，折叠其一两者同折——Q10「foldKey 口径不动」冻结契约，非本任务引入，不扣分 | fold.ts:22-24 | 登记已知限制；后续若解，键加出现序并做 headingFolds 迁移 → 登记候选 |
| Info | 任务文件注记与现状微漂移 | implementation-notes「大纲三角保留全部行」已被 FE-08#4/FE-09#2（已登记）修正为 `hasChildren && foldable` 才出三角、其余「·」占位（outlineKeys.ts:132），属已收口跨任务决策，勿回改代码 | process-docs/ui-ux-redesign/tasks/IT-03/FE-07.md:29 | 勾销/更新该句注记 → 随 fix-cr-IT03FE07-foldbtn 顺带（任务注记勘误） |
| Info | 文案冻结区双份同串 | `cmd.foldSection`/`cmd.unfoldSection` 与 `render.fold.collapse`/`expand` 中文同串（FE-01 冻结区+命令菜单各一），本任务仅消费零改动 | src/renderer/src/i18n/zh.ts:60-61 与 zh.ts:590-591 | 无需动作；如收口走 i18n 债清单统一登记 |

### i18n 专项核验（本任务域）

`fold.collapsedLine` en/zh 双字典齐、`{n}` 占位符一致、与 ui_06 文案样例逐字吻合（zh.ts:484/en.ts:491）；`render.fold.collapse|expand` 冻结区零改动、正文/大纲两侧同源消费；key 全对齐有 `i18n.test.ts` 守护。AC-FN-07/AC-RULE-11 快捷键回显与本任务无交点（未触 commands/shortcut）。e2e 缝：`__veloxP18.getRanges` 形状与值口径（key/from/to/lines）保持（e2e/seams/p18.ts:39-48）；`grep headingFolds` 无新增平行键，写回单漏斗 `useFoldSync`。交付物齐：`process-docs/ui-ux-redesign/reports/IT-03-FE-07/`（impl 三图 + CDP 两阶段数据 + 自测报告，sha256 前后恒定）。

### 结论

✅ **93/100 ≥ 90，通过**。AC-FN-15/AC-FN-30/AC-RULE-14/UI-IXD-06 判据均有代码+单测+CDP 自测三重证据，双向同步闭环（toggleFold 单通道 → foldTouched → syncFoldedKeys → Outline 镜像 + headingFolds 写回）与既有 useQuoteFold/useTableWidthSync 合同一致。唯一实修建议为 foldClickExtension 主键守卫（一行，Important）→ fix-cr-IT03FE07-foldbtn（含 DRY 双写顺带）；DRY/注记已入同批，foldKey 同名冲突入登记候选。
