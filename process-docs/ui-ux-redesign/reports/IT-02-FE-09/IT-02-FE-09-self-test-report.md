# IT-02-FE-09 自测报告 — 折叠记忆口径统一（headingFolds 跨重启持久 + 失效清洗 + 不写正文收口）

- **任务ID**: IT-02/FE-09（折叠记忆口径统一）
- **测试时间**: 2026-10-03 08:00–08:30（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段 CDP Electron 实测存档（三阶段 **63/63 PASS**，独立端口 9473 + 独立 user-data-dir）。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；验证面 = syncGate 签门状态机/store sanitizer/fold 失效清洗单测 + CDP 实测（tab 切换/重启/删标题清洗/.md sha256 恒等）。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-02/FE-09.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-FN-25 | 折叠态写本地偏好键：标签页切换后与重启后均保持；`.md` 正文无折叠状态残留 | ✅ 通过 | ① CDP 存档 §3（S4 tab 切换 + S5 重启，`bootRawSession` 恢复输入证据 + `IT-02-FE-09-impl-restart.png`）；② 写回漏斗 = useFoldSync 签门（`createSigGate` 组：`writes the mirror on a forced re-sync when the target set is empty`/写抖动守卫 ✓）+ `veloxmark.session.headingFolds` localStorage 命名空间（Q10 直接复用不新增平行键）；③ `.md` 无残留：CDP 三阶段 `.md sha256 全程恒等` + `fold memory never mutates the document text (不写正文收口, AC-RULE-14)` ✓ |
| AC-FN-30 | 折叠双向同步（大纲 ⇄ 正文）任一入口变更即更新另一处 | ✅ 通过 | ① CDP §2（S3 双向同步实测）；② 单一漏斗 useFoldSync.syncFoldedKeys 签名门控（大纲/正文/gutter 全入口收敛一写回面）；③ IT-03/FE-07 fold 32/32 同链交叉印证（collectFoldRanges/装饰面） |
| AC-FN-15 | 标题折叠含全部子章节、标题行保留；大纲节点态一致 | ✅ 通过 | ① CDP §1（S2 折叠粒度与显示态）；② live-key 判定基线 = `collectFoldSections` 可折叠章节（有正文行），空章节标题永不入簿（discovered-dependencies 注）——`fold.test.ts` `collectFoldSections > skips headings whose section has no body lines` ✓；③ 失效清洗同口径依赖折叠粒度正确 |
| AC-RULE-14 | 显示态不写 .md、写本地偏好键；跨重启持久；键位向后兼容 | ✅ 通过 | ① 不写正文：CDP sha256 恒等 + fold 单测钉死；② 跨重启：S5 ✓；③ 向后兼容/清洗双族统一：`store.test.ts` > `normalizeSession quoteFolds` 组（missing→{}/non-object 丢弃不抛错）+ 语义层 live-key 过滤（改名/删除/幽灵键——`drops the key of a deleted heading and keeps every other fold (IT-02 FE-09 失效清洗)` + `drops keys whose heading text disappeared on doc change` ✓） |
| AC-NF-14 | 升级前既有会话/偏好键语义不变；新增键向后兼容；脏数据丢弃不抛错 | ✅ 通过 | ① CDP §5（S8/S10 sanitizer 与兼容降级实测）；② 单测：store sanitizer 全量（quoteFolds/colWidths 双族 `discards a non-object quoteFolds value without throwing`/`drops non-object garbage`）本轮重跑 ✓；③ syncGate 修复 '' 哨兵撞车（PATH-03：空折叠集合法签名 `maps the empty set to the legal signature ""` + `applies a forced re-sync for an empty target set (sig "" must not collide with the force path)` ✓）——切无折叠记忆标签镜像残留根治 |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| syncGate 签门状态机（force/sig/写抖动守卫） | ✅ 10/10 | `npx vitest run src/renderer/src/hooks/syncGate.test.ts` | 2026-10-03 08:00 重跑（'' 哨兵废弃后的统一口径） |
| store sanitizer 全量（normalizeSession/normalizePerFileIds/colWidths 地板） | ✅ 25/25 | `npx vitest run src/renderer/src/preferences/store.test.ts` | 脏数据丢弃不抛错 |
| fold 失效清洗 + 不写正文收口 | ✅ 32/32 | `npx vitest run src/renderer/src/editor/livePreview/fold.test.ts` | 含 FE-09 失效清洗专钉用例 |
| CDP 三阶段（tab 切换/重启/删标题清洗/兼容降级） | ✅ 63/63（存档） | `IT-02-FE-09-cdp-data-phase{1,2,3}.json` | .md sha256 全程恒等 |

**三文件合计 67/67**（syncGate 10 + store 25 + fold 32）。

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（历史问题已闭环：PATH-03 切标签折叠态镜像残留（`''` 哨兵与空集签名撞车）verdict=fixed（syncGate force 统一签门，r2 闭合）；PATH-06 折叠记忆口径半同步残留 verdict=fixed（三副本规范化回灌）。在案执行注记：验收驱动删标题行须 `__veloxP26.setCursor` 硬定位（点击落点不稳）；重启验收杀进程前需延迟落盘（impl ④⑤）。）

## 结论

**通过**。AC-FN-25 / AC-FN-30 / AC-FN-15 / AC-RULE-14 / AC-NF-14 五条全过。本轮 syncGate 10/10 + store 25/25 + fold 32/32 全绿，CDP 63/63 存档证据在场（tab 切换/重启保持、删标题失效清洗、`.md sha256 全程恒等`、兼容降级不抛错），零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 折叠记忆持久（tab 切换/重启） | — | ✅ | ✅ | — | ✅ |
| 失效清洗（改名/删除/幽灵键） | — | ✅ | ✅ | ✅（不抛错） | ✅ |
| 签门写回（'' 哨兵根治/写抖动守卫） | — | ✅ | ✅ | ✅ | ✅ |
| 不写正文（sha256 恒等）/兼容降级 | — | ✅ | ✅ | ✅（脏数据丢弃） | ✅ |

覆盖率: 10/12 (83%)
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest 签门/sanitizer/清洗单测 + CDP 实测存档，桌面适配口径）

## 证据来源存档

- 本轮重跑：`hooks/syncGate.test.ts` 10/10、`preferences/store.test.ts` 25/25、`editor/livePreview/fold.test.ts` 32/32（2026-10-03）
- CDP 存档（dev 阶段实测）：`IT-02-FE-09-self-test.md`（验收总览 + AC 证据映射）、`IT-02-FE-09-cdp-data-phase{1,2,3}.json`（63/63）、`IT-02-FE-09-cdp-driver.mjs`；截图 `IT-02-FE-09-impl.png` / `-impl-folded.png` / `-impl-restart.png`
- 登记面：business-history PATH-03/PATH-06 verdict=fixed
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
