# IT-02-FE-09 自测报告 — 折叠记忆口径统一（headingFolds 跨重启持久 + 失效清洗 + 不写正文收口）

> 任务：[tasks/IT-02/FE-09.md](../../tasks/IT-02/FE-09.md)｜验收数据：`IT-02-FE-09-cdp-data-phase{1,2,3}.json`｜驱动：`IT-02-FE-09-cdp-driver.mjs`
>
> **合并来源说明**：代码实现为本 agent 对工作区半成品的盘点续作（`useFoldSync.ts` / `preferences/store.ts` 清洗与口径注释），验收数据为前一轮 agent 的 r3 CDP 三阶段全绿结果（主 agent 裁决方案 B：代码=盘点结论、验收数据=r3，合并口径）。r1/r2 为调试轮（r2 曾 17/20，S7d 删除交互为驱动脚本键盘落点问题，已在驱动中以 `__veloxP26.setCursor` 光标硬定位修复；r3 22/22 含 S7d 全过）。

## 0. 验收总览

| 阶段 | 内容 | 结果 |
|---|---|---|
| CDP phase1（S0–S4） | 基线 + 折叠粒度 + 双向同步 + 存储/tab/键盘 | **30/30 PASS** |
| CDP phase2（S5–S7） | 重启持久 + FE-07 联调 + 失效清洗 | **22/22 PASS** |
| CDP phase3（S8/S10） | sanitizer 污染清洗 + 键位缺失降级 | **11/11 PASS** |
| 质量门禁 | `npm run typecheck` + `npm run test:unit` | **0 Error / 833/833** |

不写正文收口（贯穿证据）：fixture `it02-fe09-fold-memory-selftest.md` 磁盘 sha256 全程恒等
`c7f6e99340a94ca9b0764720e3cad36cd40068190ea66c104ad70b6c8f900751`（fixtureHashBefore == 每阶段恒等断言 == fixtureHashFinal）。

## 1. 折叠粒度与显示态（AC-FN-15 / UI-IXD-06，S2）

- 点击正文折叠三角（Alpha 章节）→ 单行摘要替换正文区，**含全部子章节**（Alpha 子节一/二折叠入口随父折叠隐藏），**标题行保留**。
- 三角指向随态切换：折叠后 `▸` + title「展开本节」（UI-IXD-06）。
- 折叠后 `getDoc` 与 fixture 逐字节一致（AC-FN-15-4）；磁盘 hash 不变；折叠无 toast（PEND-15 轻量态）。
- 空章节（紧邻标题、无正文行）正文侧无折叠入口（空态），大纲行仍在（对照一致）。

## 2. 双向同步（AC-FN-30-1，S3）

- 大纲侧点折叠入口（Beta）→ 正文同步折叠出摘要行，大纲三角 `▸`。
- 正文侧点三角展开 → 大纲同步展开（无残留 is-folded）。
- 双向往返后 `getDoc` 零字节变化（AC-FN-30-3）+ 磁盘 hash 恒等。

## 3. 跨重启持久（AC-FN-25，S4 tab 切换 + S5 重启）

- 写回形状：`headingFolds: Record<filePath, string[]>`，foldKey 为 `level:text` 口径（`['2:Alpha 章节','2:Beta 章节']`）。
- SessionState 键集无平行键（Q10 零 schema 变更）：`activePath, headingFolds, lastCursor, lastFilePath, lastFolderPath, mermaidPreviewPin, openTabs, quoteFolds, recentFiles, sidebarMode, sidebarVisible, sidebarWidth, tableColWidths`。
- tab 切走再切回：折叠保持、切换不清 headingFolds、getDoc 零字节变化（AC-FN-25-1 前半）。
- 重启（同 user-data-dir 冷启动）：boot 快照 `bootRawSession.headingFolds` 含 `2:Alpha 章节/2:Beta 章节` → 自动恢复上次文件 + 折叠摘要自动恢复（AC-FN-25-1）；`getDoc` 与原文逐字节一致（AC-FN-25-2）；磁盘 hash 恒等。**localStorage 天然跨重启，Q10 零 schema 变更**——「SessionState」命名的是 `veloxmark.session` 存储命名空间而非内存态，注释口径已在 `useFoldSync.ts`/`store.ts` 统一。

## 4. 失效 key 清洗（NAV §3.3，S7）

- **改名**已折叠标题（Beta 章节→Beta 章节改名，用户编辑）：旧 foldKey `2:Beta 章节` 被清洗，**其余折叠不变**（`2:尾部章节` 保留）；`getDoc == 原文+用户编辑`（折叠簿记零附加写入）；磁盘 hash 恒等。
- **幽灵键**：大纲点空章节折叠 → 不产生 `2:空章节` 幽灵 key（live-key 过滤，collectFoldSections 空态不入簿）；其余折叠不变。
- **删除**已折叠标题行：foldKey 清洗、存储无脏 key 残留（entry 收敛为 `[]`）；`getDoc == 原文+用户编辑`；磁盘 hash 恒等。
- 清洗规则双族统一：写回/恢复前对 live foldable sections 过滤（useFoldSync 唯一写回漏斗，签名门控 + 防抖），quoteFolds 同口径（useQuoteFold parity）。

## 5. sanitizer 与兼容降级（AC-NF-14，S8/S10）

- 注入污染：`[KEY_ALPHA, 123, null, '', KEY_GHOST]` + 非数组条目 + 空路径 + 坏形状对象 → reload 后：
  - 非数组条目/空路径/坏形状剔除（paths 仅剩合法 filePath）；
  - 元素类型清洗（123/null/空串滤除），合法键 `2:Alpha 章节` 存活并**恢复折叠 UI**（摘要行就位）；
  - 陈旧 ghost 键（`2:ghost 章节`）不生效（restore 侧 live-key 过滤）；
  - 一次折叠写回后幽灵 key 不入簿（写回漏斗清洗）；`getDoc` 逐字节一致；磁盘 hash 恒等。
- 键位整体缺失（delete `headingFolds`）→ 默认值降级 `{}`，不抛错（S10）。
- 单测同口径：`store.test.ts` `normalizeSession headingFolds` 组 + 两族规则统一断言 + serialize→parse→normalize 跨重启读路径回环。

## 6. 联调验收（阶段 3）

| 联调项 | 结果 |
|---|---|
| FE-08 键盘折叠（←/→）写回口径与点击一致、清洗共存（S4 keyboard） | PASS：← 折叠写回 `1:折叠记忆口径自测` 且不影响既有键；→ 展开移除 foldKey；往返 getDoc 零字节变化 |
| FE-07 跳转自动展开写回口径一致（S6） | PASS：跳进折叠区自动展开，写回移除 foldKey，其余折叠不变，不写正文 |

## 7. AC 证据映射

| AC | 判据 | 证据 |
|---|---|---|
| AC-FN-25-1 | 折叠跨 tab/重启保持 | S4 tabSwitch + S5（phase1/2） |
| AC-FN-25-2 | .md 逐字节一致 | S2/S4/S5 getDoc + 全程磁盘 sha256 恒等 |
| AC-FN-30-1 | 大纲⇄正文双向同步 | S3（phase1） |
| AC-FN-30-3 | 折叠操作零字节变化 | S3 往返 + hash 恒等 |
| AC-FN-15 | 折叠含全部子章节、标题行保留、三角不移光标 | S2（phase1；点击三角为 preventDefault 不移光标） |
| AC-RULE-14 | 显示态仅本地存储、不写正文 | 存储形状断言 S4 + 全程 sha256 恒等 + 单测键集 pin |
| AC-NF-14 | 脏数据丢弃不抛错、键位缺失降级 | S8/S10（phase3）+ store.test.ts |

## 8. 质量门禁

| 门禁 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `npm run typecheck`（tsconfig.web + tsconfig.node） | **0 Error** ✓ |
| 单测 | `npm run test:unit` | **64 文件 833/833 全绿**（含 store.test.ts headingFolds/quoteFolds sanitize 组 + 键集 pin + 跨重启回环）✓ |
| cdp 验收 | `IT-02-FE-09-cdp-driver.mjs` 三阶段（独立端口 9473 + 独立 user-data-dir） | **63/63 PASS** ✓ |
| e2e 缝 | `window.__velox*` / data-op / 命令 id | 未破坏（仅消费 `__veloxP12/P13/P14/P18/P26`、`__veloxPrefs` 既有缝）✓ |

## 9. 新增/修改文件

| 文件 | 内容 |
|---|---|
| `src/renderer/src/hooks/useFoldSync.ts` | 跨重启口径注释统一（Q10/AC-FN-25/AC-RULE-14）；写回/恢复 live-key 过滤（collectFoldSections）；`restoreFoldsFor` 补 `foldSigRef.current = ''` 强制再同步 |
| `src/renderer/src/preferences/store.ts` | `normalizePerFileIds` 双族统一清洗（string[] 白名单、脏数据丢弃不抛错）；`normalizeSession` 白名单导出（可测）；headingFolds/quoteFolds 注释口径统一 |
| `src/renderer/src/preferences/store.test.ts` | headingFolds sanitizer 组 + 两族规则统一 + AC-NF-14 污染样本 + 键集 pin + serialize→normalize 跨重启回环 |
| `reports/IT-02-FE-09/IT-02-FE-09-cdp-driver.mjs` | CDP 三阶段验收驱动（S0–S8/S10） |
| `reports/IT-02-FE-09/IT-02-FE-09-cdp-data-phase{1,2,3}.json` | 验收数据（63/63） |
| `reports/IT-02-FE-09/IT-02-FE-09-impl{,-folded,-restart}.png` | 实现图：折叠态特写 / 折叠态全页 / 重启后保持 |

零改动核对：`editor/livePreview/fold.ts` 的 `foldKey(level, text)` → `` `${level}:${text}` `` 格式保持不变（该文件工作区 diff 属 IT-03/FE-07 折叠 UI 加固，非本任务）。

## 10. 动态发现 / 实现决策（已回写任务 frontmatter）

1. **live-key 过滤基线**：失效清洗的「合法键」判定用 `collectFoldSections`（可折叠章节：有正文行），而非裸 outline——空章节标题永远不会成为合法 foldKey，幽灵键（大纲点空节）在写回前即被滤除，与 quoteFolds live-block 过滤同口径。
2. **跨任务依赖**：`collectFoldSections`/caret 装饰来自 IT-03/FE-07 的 fold.ts 加固；本任务消费其「可折叠章节」语义，不改其 UI。
3. **驱动交互坑（FE-07 教训重演）**：删除标题行的键盘序列（End/Shift-Home/Backspace）落点依赖点击命中——点击失焦时 Backspace 会吃错行；验收驱动改用 `__veloxP26.setCursor` 硬定位 + `getCursor` 回执后再发键盘事件（S7d 由 17/20 → 22/22）。
4. **localStorage 落盘时序**：进程强杀可能丢尾部写回（r1 踩坑）；重启验收在阶段收尾后延迟数秒再杀进程，boot 快照（bootRawSession）作为恢复输入证据固化进 phase2 数据。

## 11. 阶段 4 QA 提示

- AC-FN-25/AC-FN-30/AC-FN-15/AC-RULE-14/AC-NF-14 判据均已由 CDP + 单测自动判定（第 7 节映射）；QA 人工复核建议抽两处：重启后折叠三角指向（impl-restart.png 对照）、污染 localStorage 后启动不弹错（S8 无崩溃断言已覆盖）。
- 折叠操作不回 toast（PEND-15）与冻结文案（render.fold.*）均未改动。
