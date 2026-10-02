# IT-03-FE-08 自测报告 — 长引用折叠（useQuoteFold + 摘要行 + quoteFolds 读写）

- 任务：`process-docs/ui-ux-redesign/tasks/IT-03/FE-08.md`
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend`
- 日期：2026-09-30
- 验收：AC-FN-16 / AC-RULE-14 / UI-IXD-14（+ AC-PEND-09 阈值单点、AC-NF-14 sanitizer、PEND-15 无 toast）
- 实现图：[IT-03-FE-08-impl-expanded.png](./IT-03-FE-08-impl-expanded.png)（展开态：两处 ▾ 折叠入口）/ [IT-03-FE-08-impl-folded.png](./IT-03-FE-08-impl-folded.png)（折叠摘要行：`「首行……」` + 「6 行」尾标 + ▸ 展开还原）/ [IT-03-FE-08-impl.png](./IT-03-FE-08-impl.png)
- 浏览器验收：CDP 驱动 [IT-03-FE-08-cdp-driver.mjs](./IT-03-FE-08-cdp-driver.mjs)，结果 [phase1](./IT-03-FE-08-cdp-data-phase1.json) / [phase2](./IT-03-FE-08-cdp-data-phase2.json) / [phase3](./IT-03-FE-08-cdp-data-phase3.json) — **62/62 checks passed**（37 + 14 + 11）

## 0. 环境与测量口径

| 项 | 值 |
|---|---|
| 被测构建 | `npm run build` 产物 `out/main/index.js`（electron-vite 3，含 render-zone.css 新增 `.cm-md-quote-caret`） |
| 运行实例 | 三阶段独立进程，同一 `--user-data-dir=D:/code/typora/temp/it03-fe08-userdata`（重启持久化可比）；CDP `http://127.0.0.1:9468` |
| 驱动 | Node 22 + WebSocket CDP；`Page.bringToFront` + `Page.setWebLifecycleState(active)` + `Emulation.setFocusEmulationEnabled`（防遮挡拖慢定时器） |
| 草稿对话框 | 一律点「稍后」（**绝不丢弃草稿**）；本次三阶段均未出现草稿对话框 |
| fixture | `it03-fe08-quote-fold-selftest.md`：5 行引用 / 6 行引用（首行 52 字）/ 标题下 6 行引用 / `> [!NOTE]` callout 6 行正文 / 尾段落 |
| .md hash | sha256，全场景前后恒为 `4c25d106f611506948fe972c877d159193849f7847f0121bd8166b0c6266bf9c` |
| 阈值常量 | `QUOTE_FOLD_LINE_THRESHOLD = 5` 仅 `editor/livePreview/quoteFold.ts` 一处定义（grep 核对） |
| 块 id 口径 | `q:{depth}:{去标记首行}`（内容派生、与位置无关；STORE §3.2 委派本模块定稿） |

**组件复用**：无新组件；复用 FE-01 的 `.cm-md-quote-fold / .cm-md-quote-summary / .cm-md-quote-lines / .cm-md-quote-restore / .cm-md-fold-caret` 样式与 `render.fold.*` i18n key（零新增文案 key）；复用 FE-02 `SessionState.quoteFolds` + `normalizePerFileIds` sanitizer；复用 P18 fold StateField 模式（toggle/restore effect + 选区进入自动展开）。**接口对接**：无网络 API（纯本地 CM6 + localStorage）。

## 1. S1 展开态（AC-PEND-09 / UI-IXD-14）

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| >5 行引用有折叠入口 | 6 行引用 + 标题下引用各一 ▾ | `carets.length = 2`，key 分别为 `q:1:这是一段…省略号效果` / `q:1:标题下引用第一行` | ✓ |
| ≤5 行无折叠入口 | 5 行引用无 caret | key `q:1:五行引用第一行` 不在入口列表 | ✓ |
| callout 无折叠入口 | `> [!NOTE]` 块不参与 | 无 `callout` 相关 key | ✓ |
| 入口属性 | `data-testid=quote-fold-caret` + `data-quote-fold-key` + title「折叠本节」+ `▾` | 两个 caret 全部命中，class 含 `cm-md-quote-caret` | ✓ |
| 展开态无摘要行 | `rows = 0` | `[]` | ✓ |

## 2. S2 折叠为摘要行（AC-FN-16 / PEND-15）

点 6 行引用 caret：

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 摘要行出现、key 稳定 | `data-quote-fold-key` = 派生 id | `q:1:这是一段非常非常长的引用首行文本用于验证摘要行的截断规则它肯定超过四十个字符以便在界面上观察到省略号效果` | ✓ |
| 首行截断 | 40 字 + `……`，带引号 | `「这是一段非常非常长的引用首行文本用于验证摘要行的截断规则它肯定超过四十个字符便……」`（regex `^「.{40}……」$` 命中） | ✓ |
| 「N 行」尾标 | N = 折叠隐藏行数 = 全块 6 行 | `6 行`（`render.fold.lines`） | ✓ |
| 「展开还原」入口 | `data-testid=quote-fold-restore` | `▸ 展开还原`，title「展开还原」 | ✓ |
| 5 行引用不被牵连 | 仍展开 | 无其摘要行 | ✓ |
| 折叠入口收起 | 6 行引用 caret 消失，标题下引用仍在 | `carets = [q:1:标题下引用第一行]` | ✓ |
| 无 toast（PEND-15） | toast 空 | `null` | ✓ |
| .md 零字节变化 | getDoc() === 原文；磁盘 hash 不变 | `equal:true`；hash 前后同值 | ✓ |

**摘要行 DOM 实测**（一行六要素）：`▸` caret + `quote-fold-summary`（截断摘录）+ `.cm-md-quote-lines`（`6 行`）+ `quote-fold-restore`（`▸ 展开还原`）。

## 3. S3 展开还原（AC-FN-16 零字节差）

| 路径 | 结果 |
|---|---|
| 点摘要行展开 | 摘要行消失，`getDoc() === 原文` ✓ |
| 再折叠 → 点「展开还原」 | 摘要行消失，`getDoc() === 原文` ✓ |
| 全程 toast | `null`（无 toast）✓ |
| 磁盘 .md hash | 前后恒等 ✓ |

## 4. S4 会话写入 + tab 切换（AC-RULE-14 / UI-IXD-14）

两块均折叠后：

**quoteFolds JSON 快照**（`__veloxPrefs.getSession().quoteFolds`）：

```json
{
  "D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/it03-fe08-quote-fold-selftest.md": [
    "q:1:这是一段非常非常长的引用首行文本用于验证摘要行的截断规则它肯定超过四十个字符以便在界面上观察到省略号效果",
    "q:1:标题下引用第一行"
  ]
}
```

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 按 filePath 写入 | `Record<filePath, string[]>` | 上例 | ✓ |
| 只含稳定块 id | 无 5 行/callout/幽灵条目 | 仅两个有效 key | ✓ |
| 两态可辨（UI-IXD-14） | 展开态 ▾ 入口 vs 折叠态摘要行 | 折叠态摘要行 ×2（短首行块为 `「标题下引用第一行」` 无截断） | ✓ |
| tab 切走再切回 | 折叠仍在、正文不变 | `newUntitled` → `activateIndex` 回来后两条摘要行俱在，`getDoc() === 原文` | ✓ |
| 切换不清 session | quoteFolds 保留 | 切换后读回同上快照 | ✓ |

## 5. S5 重启持久化（AC-RULE-14）

同 user-data-dir 杀进程重启（phase 2）：

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 启动自动恢复折叠 | 两条摘要行 | session 两 key 全恢复为折叠态 | ✓ |
| 恢复不改 .md | `getDoc() === 原文`；磁盘 hash 不变 | `equal:true`；hash 同值 | ✓ |
| 无 toast | `null` | `null` | ✓ |
| session 读回 | 含稳定块 id | 同 S4 快照 | ✓ |

## 6. S6 FE-02 sanitizer 互操作（AC-NF-14）

污染 payload（phase 2 收尾写入 localStorage，重读后仍为污染态再杀进程）：

```json
{
  "quoteFolds": {
    "…/it03-fe08-quote-fold-selftest.md": ["q:1:这是一段…省略号效果", 123, null, "q:99:ghost", ""],
    "other/path.md": "not-an-array",
    "": ["stale-empty-path"],
    "bad/shape.md": { "nested": true }
  }
}
```

重启（phase 3）后：

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 应用不崩溃 | 缝照常可用 | `p12/p13` 均 true | ✓ |
| 非数组条目剔除 | `other/path.md` / `bad/shape.md` / `""` 消失 | `paths` 仅剩 fixture 路径 | ✓ |
| 元素类型清洗 | `123/null/""` 滤除 | 条目为纯字符串数组 | ✓ |
| 合法稳定 id 存活 | `q:1:这是一段…` 保留 | 存活 | ✓ |
| UI 恢复 | 合法键呈折叠摘要行 | 摘要行在 | ✓ |
| 陈旧 id 不生效 | `q:99:ghost` 无摘要行 | 无（并被后续写回剔除） | ✓ |
| .md 不变 | `getDoc() === 原文` | `equal:true` | ✓ |
| 无 toast / 无阻塞对话框 | 全空 | `toast=null`，`dialog.present=false` | ✓ |

## 7. S7 与 FE-07 标题折叠共存

| 判据 | 期望 | 实测 | 结果 |
|---|---|---|---|
| 标题折叠生效 | `headingFolds` 含 `2:标题下的引用` | 命中（`__veloxP18.toggleKey`） | ✓ |
| 折叠/展开后 quoteFolds 独立存活 | 两条摘要行俱在 | 展开标题后 `q:1:这是一段…` + `q:1:标题下引用第一行` 均在 | ✓ |
| 面隔离 | 标题折叠只写 headingFolds | quoteFolds 条目无 `2:标题下的引用` | ✓ |

## 8. 质量门禁

| 门禁 | 结果 |
|---|---|
| `npm run typecheck`（web + node 双 tsconfig） | 0 Error |
| `npm run test:unit` | **769/769 passed**（含 `quoteFold.test.ts` 27 项：阈值 5/6 边界、摘要截断、「N 行」模板、块 id 稳定性/嵌套/位置无关、field 两态/恢复/自动展开/改稿掉键、widget eq/ignoreEvent） |
| lint | 项目无 lint script（跳过） |
| `npm run build`（electron-vite） | 成功 → `out/` |
| 阈值常量单点 | `QUOTE_FOLD_LINE_THRESHOLD = 5` 仅 quoteFold.ts 一处 |
| e2e 缝 | 未新增/未破坏 `window.__velox*` 契约（验证全走 DOM data-testid + `__veloxPrefs` + localStorage） |

## 9. 动态发现（实现决策摘要）

1. **块 id 口径定稿**：`q:{depth}:{去标记首行}` — 内容派生、位置无关（STORE §3.2 委派本模块）；内容改动导致 id 漂移时旧 id 静默丢弃，符合 STORE 失效清洗口径。
2. **N = 全块源码行数**（不是「首行之外」），摘要尾标「6 行」与任务「N 行=折叠隐藏行数」在整块替换下同值。
3. **callout 不参与引用折叠**（P21 已有折叠面）；被折叠 callout 体内的引用块跳过（外层 replace 已覆盖）。
4. **不挂 atomicRanges**：与 P18/P21 fold 族一致，靠「选区进入折叠区自动展开」解除光标陷阱。
5. **零新增 i18n key / 零新增 `__velox*` 缝**：文案全消费 FE-01 `render.fold.*`；验证走 DOM testid + `__veloxPrefs`。
6. **装饰管线顺序**：callout fold → quote fold → heading fold（build.ts），三族 replace 互不重叠。
