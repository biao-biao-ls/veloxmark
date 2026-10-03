# IT-03-FE-07 自测报告 — 标题折叠/展开（全部子章节 + 大纲双向同步 + headingFolds）

- 任务：`process-docs/ui-ux-redesign/tasks/IT-03/FE-07.md`
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend`
- 日期：2026-09-30
- 验收：AC-FN-15 / AC-FN-30 / AC-RULE-14 / UI-IXD-06（+ PEND-15 无 toast、NAV §3.5 跳转自动展开、FE-08 共存）
- 实现图：[IT-03-FE-07-impl-expanded.png](./IT-03-FE-07-impl-expanded.png)（展开态：全标题 ▾ 入口 + 空章节无入口）/ [IT-03-FE-07-impl-folded.png](./IT-03-FE-07-impl-folded.png) = [IT-03-FE-07-impl.png](./IT-03-FE-07-impl.png)（**正文折叠态 + 大纲同步态同屏**：Alpha/Beta 标题行保留 + 灰字占位行 + 大纲三角 ▸ 镜像）
- 浏览器验收：CDP 驱动 [IT-03-FE-07-cdp-driver.mjs](./IT-03-FE-07-cdp-driver.mjs)，结果 [phase1](./IT-03-FE-07-cdp-data-phase1.json) / [phase2](./IT-03-FE-07-cdp-data-phase2.json) — **71/71 checks passed**（46 + 25）

## 0. 环境与测量口径

| 项 | 值 |
|---|---|
| 被测构建 | `npm run build` 产物 `out/main/index.js`（electron-vite 3，含 fold.ts 行内三角 + 折叠占位行 + Outline 三角镜像） |
| 运行实例 | 两阶段独立进程（杀进程重启验证持久化），同一 `--user-data-dir=D:/code/typora/temp/it03-fe07-userdata`；CDP `http://127.0.0.1:9470` |
| 驱动 | Node 22 + WebSocket CDP；`Page.bringToFront` + `Page.setWebLifecycleState({state:'active'})` + `Emulation.setFocusEmulationEnabled`（防遮挡拖慢定时器） |
| 草稿对话框 | 一律点「稍后」（**绝不丢弃草稿**）；本次两阶段均未出现草稿对话框 |
| fixture | `it03-fe07-heading-fold-selftest.md`：H1 + Alpha（子节 A/孙节/子节 B）/ Beta（2 行）/ 引用章节（6 行长引用，FE-08 共存用）/ 空章节（零正文）/ 仅空行（1 空行退化体）/ 尾部章节（文末） |
| .md hash | sha256，全场景前后恒为 `a70954c8d5011dad36df55f6e529724376e40053daaa2a4b6e1180f4b256c0f7` |
| 折叠粒度 | `collectFoldSections`：标题行尾 → 下一同级/更高级标题行首（含全部子章节标题+正文）；`lines=0` 不可折叠（无入口） |
| 折叠键口径 | `foldKey(level, text)` = `{level}:{标题文本}`（Q10 复用 headingFolds，STORE §3.2 无并行键） |
| 视口口径 | 装饰计算限 viewport（项目契约）——驱动按 top/mid/bottom 滚动取入口并集、点击前 `scrollIntoView` |

**组件复用**：无新组件；复用 `editor/livePreview/fold.ts` 的 `foldKey`/`toggleFold`/`expandFolds`/`restoreFolds`/`foldField`/选区进入自动展开，`hooks/useFoldSync.ts` 的 headingFolds 写回漏斗（签名门 + suppressDirty + live-key 过滤），`components/Outline.tsx` + `hooks/useOutlineNav.ts` 既有跳转/镜像契约（**未另起第二套路由**），FE-01 的 `.cm-md-fold-caret` / `render.fold.collapse|expand` 冻结文案。**新增文案 key 仅 1 个**：`fold.collapsedLine`（zh/en 双字典对齐；`render.fold.*` 冻结区零改动）。**接口对接**：无网络 API（纯本地 CM6 + localStorage）。

## 1. S1 展开态（AC-FN-15 空态 / UI-IXD-06）

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 每个可折叠标题一个 ▾ 入口 | 9 个（除空章节） | 视口并集 = 9 键：H1/Alpha/子节A/孙节/子节B/Beta/引用/仅空行/尾部 | ✓ |
| 空章节无折叠入口（空态） | `2:空章节` 无 caret | 入口列表不含 `2:空章节` | ✓ |
| 入口属性 | `data-testid=heading-fold-caret` + `data-fold-key` + ▾ + title「折叠本节」 | 9/9 命中，class `cm-md-heading-fold-caret` | ✓ |
| 展开态无占位行 | `heading-fold-summary` = 0 | `[]` | ✓ |
| 大纲全渲染 | 10 行（含空章节行） | `outline-item-0..9` | ✓ |
| 大纲三角初始镜像 | 全 ▾、无 is-folded | 10/10 | ✓ |

## 2. S2 折叠粒度 = 全部子章节（AC-FN-15 判据 1 / UI-IXD-06）

点 Alpha 标题三角：

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 全部子章节内容隐藏 | 子节 A/B、孙节标题+正文 7 段全不可见 | `.cm-editor` 文本不含任何一段 | ✓ |
| 标题行保留 | 「Alpha 章节」可见 | 可见 | ✓ |
| 三角指向切换 | ▸ + title「展开本节」 | `▸` / 展开本节 | ✓ |
| 子章节入口随折叠隐藏 | 子节A/孙节/子节B caret 消失 | 消失（视口内仅剩 H1/Alpha▸/Beta/引用/仅空行） | ✓ |
| 折叠范围覆盖子章节 | getRanges 含跨级区间 | `{key:"2:Alpha 章节", from:34, to:125, lines:15}`（覆盖 3/4 级全部） | ✓ |
| 占位行文案 | 「（N 行内容已折叠 · 与大纲双向同步）」 | `（15 行内容已折叠 · 与大纲双向同步）`（N 与 getRanges.lines 一致） | ✓ |
| 其余章节不受牵连 | Beta/尾部仍 ▾ | Beta ▾、尾部 ▾ | ✓ |
| 点三角不移动光标 | cursor 不变 | 0 → 0 | ✓ |
| 无 toast（PEND-15） | toast 空 | `null` | ✓ |
| .md 零字节变化 | getDoc()===原文；磁盘 hash 不变 | `equal:true`；hash 同值 | ✓ |

## 3. S3 展开还原（AC-FN-15）

| 路径 | 结果 |
|---|---|
| 点占位行展开 | 内容全回（7 段全可见），getDoc()===原文 ✓ |
| 再折叠 → 点三角 ▸ 展开 | 内容全回 ✓ |
| 全程 toast | `null` ✓ |
| 磁盘 .md hash | 前后恒等 ✓ |

## 4. S4 大纲双向同步 + 会话写入 + tab 切换（AC-FN-30 / AC-RULE-14）

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 大纲侧折叠 → 正文同步 | 点大纲 Beta 三角 → 正文出占位行 | `（4 行内容已折叠 · 与大纲双向同步）` | ✓ |
| 大纲入口态镜像 | Beta ▸ + is-folded | 命中 | ✓ |
| 正文侧折叠 → 大纲同步 | 点正文尾部三角 → 大纲尾部 ▸ is-folded | 命中 | ✓ |
| 大纲侧展开 → 正文还原 | 点大纲 Beta ▸ → 占位行消失 | 还原 | ✓ |
| 正文折叠/大纲展开互驱 | Alpha 正文折叠 → 大纲 ▸；大纲点开 → 正文还原 | 两个方向均命中 | ✓ |
| 仅空行退化体可折叠 | 1 空行正文 → 占位行（点位 widget） | `（1 行内容已折叠 · 与大纲双向同步）` | ✓ |
| headingFolds 写入 session | `Record<filePath, string[]>` | `["2:尾部章节","2:Alpha 章节","2:Beta 章节"]` | ✓ |
| 大纲三角点击不移动光标 | cursor 不变 | 0 → 0 | ✓ |
| tab 切走再切回 | 折叠保持、正文不变 | 三键俱在，getDoc()===原文 | ✓ |
| 切换不清 session | headingFolds 保留 | 读回同快照 | ✓ |
| 无 toast / hash 恒等 | — | `null` / 同值 | ✓ |
| 同屏实现图 | 正文折叠 + 大纲镜像 | [impl-folded.png](./IT-03-FE-07-impl-folded.png)（Alpha/Beta 占位行 + 大纲 ▸×2 同框） | ✓ |

## 5. S5 重启持久化（AC-RULE-14）

同 user-data-dir 杀进程重启（phase 2）：

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 启动自动恢复折叠 | Alpha+Beta（+尾部）占位行 | `["2:Alpha 章节","2:Beta 章节","2:尾部章节"]` 全恢复 | ✓ |
| 大纲镜像同步 | Alpha/Beta ▸ | `outline-fold-1/5` = ▸ is-folded | ✓ |
| 恢复不改 .md | getDoc()===原文；hash 不变 | `equal:true`；hash 同值 | ✓ |
| 无 toast | `null` | `null` | ✓ |
| session 读回 | 含折叠键 | 三键全在 | ✓ |

## 6. S6 与 FE-08 长引用折叠共存（集成验收）

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 长引用入口存在 | `q:1:引用一` quote-fold-caret | 命中 | ✓ |
| 引用折叠生效 | 摘要行出现 | `q:1:引用一` | ✓ |
| 标题折叠不污染 quoteFolds | headingFolds 有 `2:引用章节`、quoteFolds 无 | `headingFolds:["2:引用章节"]` / `quoteFolds:["q:1:引用一"]` | ✓ |
| 引用折叠不污染 headingFolds | quoteFolds 有 q 键、headingFolds 无 | 同上（互斥） | ✓ |
| 标题展开后引用折叠独立存活 | q 摘要行仍在 | `["q:1:引用一"]` | ✓ |
| 引用展开还原 | 摘要行消失 | `[]` | ✓ |
| .md 不变 | getDoc()===原文 | `equal:true` | ✓ |

## 7. S7 大纲跳转自动展开（NAV §3.5）

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 前置：Alpha 已折叠 | folded 含 `2:Alpha 章节` | `["2:Alpha 章节"]` | ✓ |
| 跳转目标在折叠区 → 先展开祖先 | folded 不再含 Alpha | `[]`（jumpExpandKeys → expandFolds） | ✓ |
| 目标标题可见 | 「Alpha 子节 A」出现 | 可见 | ✓ |
| 光标落目标标题 | cursor = 目标标题偏移 | `48 === 48` | ✓ |

## 8. S8 e2e 缝契约未破坏（AC-RULE-17）

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| `__veloxP18.getRanges` 形状 | `{key,from,to,lines}` 全 number/string | 命中（FoldRange.from/to/lines 值口径未变） | ✓ |
| `getHeadingKeys` | 10 个 foldKey（含空章节） | 10/10 | ✓ |
| `getSessionFolds`/`benchToggle`/`restoreKeys`/`toggleKey`/`getFoldedKeys`/`restoreFromSession` | 可用 | 全部可用 | ✓ |
| 收尾无 toast | `null` | `null` | ✓ |

## 9. 静态门禁

| 门禁 | 结果 |
|---|---|
| `npm run typecheck`（tsconfig.web + tsconfig.node） | 0 error |
| `npm run test:unit` | 63 文件 / 805 测试全过（`fold.test.ts` 25/25，含「全部子章节区间」断言） |
| `grep -rn headingFolds` | 仅既有读写点（useFoldSync / store / p18 seam / 注释）——无新增并行键 |
| 死引用检查 | `foldGutterExtension`/`FoldArrowMarker`/`foldPlaceholderClickExtension`/`.cm-md-fold-placeholder|-arrow|-gutter` 全部清除；`fold.toggle` i18n key 故意保留（零新增优先，冻结区不动） |

## 10. 动态发现（已回写 FE-07.md frontmatter）

1. **折叠占位行新文案** `fold.collapsedLine`（zh/en 双字典）——`render.fold.*` 为冻结文案区，设计稿「（N 行内容已折叠 · 与大纲双向同步）」无法由既有冻结 key 拼出，按「新 key 必须双字典对齐」规则落在非冻结 `fold.*` 命名空间。
2. **P18 折叠槽（fold gutter）整体移除**：三角改为标题文字左侧行内 widget（ui_06 区块 D），删除 `foldGutterExtension`/`FoldArrowMarker` 及 `.cm-md-fold-gutter/-arrow/-placeholder` 死样式；`.cm-md-fold-caret` 基类保留给 FE-08 引用折叠共用。
3. **折叠 replace 跨行内换行会把标题行与下一行拼接**——replace 只吃正文体（`foldReplaceSpan` 保标题尾 `\n` 与节末分隔 `\n`），占位行独立成行；空行正文退化为 `Decoration.widget` 点位（CM6 禁止零长 replace）。
4. **大纲三角保留全部行**（含无子级/空章节行）：ui_05 的 twisty 语义（叶子隐藏三角/树折叠）不在 FE-07 页面元素表内，本任务只做镜像 + 双向同步；空章节正文侧无入口（空态），大纲侧三角点击会写 key 但无视觉效果（清理归 IT-02/FE-09 持久化清洗）。
5. **FoldRange.from/to/lines 值口径不变**（逻辑节区间），仅装饰 replace span 经 `foldReplaceSpan` 收窄——`__veloxP18.getRanges` 输出值与形状双稳定。
6. **装饰计算限 viewport**：视口外标题无 caret DOM；自动化点击前必须 `scrollIntoView`/滚动取并集（本报告驱动已按此实现，后续任务驱动沿用）。
