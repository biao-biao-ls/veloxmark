# IT-03-FE-07 自测报告 — 标题折叠/展开（全部子章节 + 大纲双向同步 + headingFolds 持久化）

- **任务ID**: IT-03/FE-07（标题折叠/展开）
- **测试时间**: 2026-10-03 05:35–06:00（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段 CDP Electron 实测存档（S1–S8 场景，phase1+phase2 **71/71 checks passed**）。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；验证面 = fold 纯逻辑（foldKey/collectFoldRanges/foldField/buildDecorations）单测 + CDP 实测（折叠粒度/双向同步/重启持久化/零字节）。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-03/FE-07.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-FN-15 | 标题下含子章节：点击折叠三角→全部子章节内容折叠隐藏、标题行保留；大纲节点折叠态与正文一致 | ✅ 通过 | ① 折叠粒度单测本轮重跑 `fold.test.ts` **32/32**：`collectFoldRanges > spans heading-line end to the next same-or-higher heading` + `covers ALL sub-sections — nested headings and their bodies stay inside` + `folds a single sub-section on its own (H3 range holds only its body)` + `extends trailing headings to the document end` + `keeps only the outermost range when parent and child are folded` ✓；② CDP 存档 §2（S2 折叠粒度=全部子章节，标题行保留）+ §3（S3 展开还原）+ §1（S1 空态无三角）；③ 大纲一致 = S4 双向同步同场 |
| AC-FN-30 | 大纲侧点击折叠/展开入口→正文对应章节同步；双向同步；持久化跨重启；`.md` 零字节变化 | ✅ 通过 | ① CDP 存档 §4（S4 大纲双向同步：任一入口变更即更新另一处 + tab 切换态保持）；② 持久化：§5（S5 重启持久化实测）+ `foldField > toggleFold adds and removes keys` ✓（写 `veloxmark.session.headingFolds` 本地偏好键，键位契约面不变）；③ `.md` 零字节：`fold memory never mutates the document text (不写正文收口, AC-RULE-14)` ✓ + S4/S5 逐字节比对 |
| AC-RULE-14 | 显示态（折叠/展开、列宽等）不写入 .md 正文、写本地偏好键；折叠态跨重启持久；既有键位不变、新增键向后兼容 | ✅ 通过 | ① 不写正文：foldField 单测钉死（`fold memory never mutates the document text` ✓）；② 跨重启：CDP S5 ✓；③ 键位兼容：headingFolds 读写单漏斗 useFoldSync（签名门+suppressDirty+live-key 过滤，为 FE-09 持久化清洗留统一钩子）——失效键清洗 `drops the key of a deleted heading and keeps every other fold (IT-02 FE-09 失效清洗)` + `drops keys whose heading text disappeared on doc change` ✓；④ 折叠不进文档 undo 栈 + PEND-15 无 toast（render.fold.* 冻结区零改动，仅新增 fold.collapsedLine 双字典） |
| UI-IXD-06 | 标题折叠三角点击折叠/展开子章节；三角指向随态切换；折叠后标题行保留 | ✅ 通过 | ① 三角指向/标题行保留：CDP §2/§3 ✓（▾/▸ 行内 widget，标题行保留可见）；② 装饰面：`buildDecorations × folds` 8 用例（`emits a replace + FoldPlaceholder on the body-only span`/`emits a fold caret for every foldable heading (empty sections get none)`/`keeps the heading caret while folded and drops nested-section carets`/`source mode renders no fold decorations`）+ `HeadingFoldCaretWidget eq()` DOM 复用 2 用例 ✓；③ 点击只折叠不移动光标 + 主键门（`button=2/1 mousedown must not toggleFold — fall through`）✓；UI 存档 `IT-03-FE-07-impl-folded.png`/`-impl-expanded.png` |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| fold 纯逻辑全量（foldKey/collect*/foldField/buildDecorations/点击门） | ✅ 32/32 | `npx vitest run src/renderer/src/editor/livePreview/fold.test.ts` | 2026-10-03 05:35 重跑（原 25 例 + FE-09 清洗/eq 门扩充至 32） |
| S2/S3 折叠粒度与展开还原（全部子章节/标题行保留） | ✅ | CDP 存档 `IT-03-FE-07-cdp-data-phase1.json` | 71/71 同场 |
| S4/S5 双向同步 + 重启持久化（零字节） | ✅ | CDP 存档 phase1/phase2 | headingFolds 偏好键 |
| S6/S7/S8 FE-08 长引用共存 + 跳转自动展开 + e2e 缝 | ✅ | CDP 存档 §6–§8 | AC-RULE-17 面同场 |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（历史移交已闭环：P18 折叠槽 gutter 死样式整体移除；占位行 replace 只吃正文体（foldReplaceSpan 保标题尾 `\n` 与节末分隔 `\n`，空行正文退化点位 widget——CM6 禁零长 replace）均为实现决策记录。装饰限 viewport：自动化点击前须 scrollIntoView（impl 注）。）

## 结论

**通过**。AC-FN-15 / AC-FN-30 / AC-RULE-14 / UI-IXD-06 四条全过。本轮 fold 32/32 全绿（折叠粒度=全部子章节、外层折叠吞内层、失效键清洗、不写正文收口钉死），CDP 71/71 存档证据在场（双向同步/重启持久化/零字节比对/e2e 缝），零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 折叠/展开（全部子章节粒度） | ✅ | ✅ | ✅（空态无三角） | ✅（右/中键不触发） | ✅ |
| 大纲双向同步（单漏斗 useFoldSync） | ✅ | ✅ | ✅ | — | ✅ |
| 持久化（偏好键/跨重启/失效清洗） | — | ✅ | ✅ | ✅（删除标题掉键） | ✅ |
| 零字节（不写 .md / 不进 undo） | — | ✅ | ✅ | — | ✅ |

覆盖率: 10/12 (83%)
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest fold 纯逻辑单测 + CDP 实测存档，桌面适配口径）

## 证据来源存档

- 本轮重跑：`editor/livePreview/fold.test.ts` 32/32（2026-10-03）
- CDP 存档（dev 阶段实测）：`IT-03-FE-07-self-test.md`（S1–S8 + AC 证据映射）、`IT-03-FE-07-cdp-data-phase1.json`（46）、`IT-03-FE-07-cdp-data-phase2.json`（25）、`IT-03-FE-07-cdp-driver.mjs`；截图 `IT-03-FE-07-impl-folded.png` / `IT-03-FE-07-impl-expanded.png`
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
