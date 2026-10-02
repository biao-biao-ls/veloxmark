# IT-03-FE-08 自测报告 — 长引用折叠（useQuoteFold + 摘要行 + quoteFolds 读写，阈值 >5 行）

- **任务ID**: IT-03/FE-08（长引用折叠）
- **测试时间**: 2026-10-03 06:55–07:20（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段 CDP Electron 实测存档（phase1–3 **62/62 checks passed** + r3 补证 19/19）。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；验证面 = quoteFold 纯逻辑（阈值/摘要/key 派生/field 状态机/装饰契约）单测 + CDP 实测（折叠还原零字节/持久化/sanitizer 互操作）。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-03/FE-08.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-FN-16 | 渲染行数 >5 行长引用块：点击折叠入口→摘要行（原引用内容不丢失）；点击展开→完整还原无字节差异 | ✅ 通过 | ① 阈值/摘要单测本轮重跑 `quoteFold.test.ts` **33/33**：`threshold: >5 render lines is foldable (AC-PEND-09)` 3 用例（`constant is 5 and lives in this module only`/`5 lines → not foldable`/`6 lines → foldable`，QUOTE_FOLD_LINE_THRESHOLD=5 单点）+ `quoteSummaryText` 3 用例（`long first line truncates at the max and appends ……`）+ `formatQuoteLines: 「N 行」 tail` 3 用例（zh/en 双语 + FE-01 模板 key 不改）✓；② 内容不丢失/还原：CDP 存档 §2（S2 折叠为摘要行）+ §3（S3 展开还原**零字节差**）；③ 装饰面 = `collectQuoteFoldBlocks`（excerpt 取去标记首行/`callout blockquotes are excluded (P21 owns their fold)`/嵌套引用 depth-keyed id） |
| AC-RULE-14 | 显示态不写 .md、写本地偏好键；跨重启持久；键位向后兼容 | ✅ 通过 | ① 块 id 口径定稿 `q:{depth}:{去标记首行}`（内容派生、位置无关：`is position-independent: same block content at different offsets shares the key` ✓）→ 偏好键 `veloxmark.session.quoteFolds[filePath]`；② CDP 存档 §4（S4 会话写入 + tab 切换）+ §5（S5 重启持久化）；③ 向后兼容 = FE-02 SessionState.quoteFolds 字段 + sanitizer（CDP §6 与 FE-02 sanitizer 互操作，AC-NF-14 同场）；④ `.md` 零字节 + 不回 toast（PEND-15）+ 不挂 atomicRanges（fold 族纪律，选区进入自动展开） |
| UI-IXD-14 | 引用块折叠入口：点击折叠为摘要行；点击展开还原；两态切换可辨 | ✅ 通过 | ① 两态切换：`quoteFoldField: toggle / restore / auto-expand / stale drop > toggle folds then unfolds a key (UI-IXD-14 two-state)` ✓ + CDP §2/§3；② UI 存档 `IT-03-FE-08-impl-folded.png`/`-impl-expanded.png`/`-quote-caret-frame.png`；③ r3 必修修复后行盒几何实测（PIL 三帧 run 28.57/161.71/33.71 CSS px，摘要单行盒 28.8px 同 heading fold 模式）——两态可辨 + 零 80px 匿名块盒劈裂 |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| quoteFold 纯逻辑全量（阈值/摘要截断/N 行尾标/key 派生/块测量/field 状态机/装饰契约） | ✅ 33/33 | `npx vitest run src/renderer/src/editor/livePreview/quoteFold.test.ts` | 2026-10-03 06:55 重跑（原 27 项 + r3 N2 装饰契约 6 项） |
| S2/S3 折叠摘要 + 展开还原（零字节差） | ✅ | CDP 存档 phase1–3 | 62/62 同场 |
| S4/S5 会话写入 + 重启持久化 | ✅ | CDP 存档 §4/§5 | quoteFolds 偏好键 |
| S6/S7 sanitizer 互操作 + 与标题折叠共存 | ✅ | CDP 存档 §6/§7 | FE-02/FE-07 联调 |
| r3 补证（N1/N2 行盒几何修复回归） | ✅ 19/19（存档） | `shots/batch-r3-*` + PIL 三帧 | 行盒 28.8px 钉死 |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（历史问题已闭环：r3 必修 N1（块级 display:flex 劈裂行内排版→80px 匿名块盒）改 inline-flex+width:100%+vertical-align:top；N2（CM6 行盒不承载竖直 padding）改首/末行挂 cm-md-quote-first/last 行装饰 + `--space-1`（任务文 --space-2 为笔误，tokens.css --space-2=8px，已勘误）。doc-drift 在案：restore 文案消费 FE-01 冻结 key `render.fold.restore=「展开还原」`（不新增 key）。）

## 结论

**通过**。AC-FN-16 / AC-RULE-14 / UI-IXD-14 三条全过。本轮 quoteFold 33/33 全绿（阈值 5 单点、摘要截断与「N 行」尾标双语、位置无关 key、callout 排除、field 状态机），CDP 62/62 + r3 补证 19/19 存档证据在场（零字节差还原/重启持久化/sanitizer 互操作/行盒几何），零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 折叠为摘要行（阈值/截断/N 行尾标） | ✅ | ✅ | ✅（≤5 行不可折） | ✅（空 excerpt 降级） | ✅ |
| 展开还原（零字节差） | ✅ | ✅ | ✅ | — | ✅ |
| quoteFolds 读写（位置无关 key/持久化） | — | ✅ | ✅ | ✅（stale drop） | ✅ |
| callout 排除 + 标题折叠共存 | ✅ | — | ✅ | — | ✅ |

覆盖率: 10/12 (83%)
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest quoteFold 纯逻辑单测 + CDP 实测存档，桌面适配口径）

## 证据来源存档

- 本轮重跑：`editor/livePreview/quoteFold.test.ts` 33/33（2026-10-03）
- CDP 存档（dev 阶段实测）：`IT-03-FE-08-self-test.md`（S1–S7 + AC 证据映射 + 实现决策摘要）、`IT-03-FE-08-cdp-data-phase1/2/3.json`（37+14+11=62）、`IT-03-FE-08-cdp-driver.mjs`；截图 `IT-03-FE-08-impl-folded.png` / `-impl-expanded.png` / `-quote-caret-frame.png` + `shots/batch-r3-*`（PIL 三帧几何）
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
