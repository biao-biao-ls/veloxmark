# IT-03-FE-02 自测报告 — SessionState.quoteFolds 字段与 sanitizer 白名单扩展（含 store.test 用例）

- **任务ID**: IT-03/FE-02（SessionState.quoteFolds 字段与 sanitizer 白名单扩展）
- **测试时间**: 2026-10-02 23:30–23:42（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段 localStorage 实测存档。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；本任务为纯存储底座（SessionState 字段 + sanitizer），验证面 = store.test 全量重跑（脏数据清洗/零 schema 变更/跨重启往返）。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-03/FE-02.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-RULE-14 | 显示态持久化：折叠/列宽等不写 .md、写本地偏好键；跨重启持久；既有键位不变、新增键向后兼容 | ✅ 通过 | ① 零 schema 变更（Q10）：`store.test.ts` > `fold-memory storage shape (AC-RULE-14 / Q10 零 schema 变更)` 3 用例：`pins the SessionState key set — no parallel fold keys may appear`（quoteFolds 平铺追加，禁并行折叠键）/ `types headingFolds as Record<string, string[]> at runtime` / `survives the localStorage serialize→parse→normalize round-trip (跨重启读路径)` 本轮重跑 25/25 ✓；② 不写 .md：quoteFolds 只落 SessionState/localStorage（DevTools Application 面板截图 `IT-03-FE-02-impl.png` 含 quoteFolds 键）；③ 既有键语义不变：`leaves every other session key semantically unchanged` ✓ + headingFolds 合法值 `passes a valid headingFolds map through untouched` ✓ |
| AC-NF-14 | 升级读既有键：①既有键位语义不变 ②新增键向后兼容 ③新键缺失按默认降级不抛错 | ✅ 通过 | ① 缺失降级：`defaults quoteFolds to {} when the key is missing (old session JSON)` + headingFolds 同名用例 ✓；② 向后兼容/不抛错：`never throws on arbitrary garbage (AC-NF-14-3)`（quoteFolds/headingFolds 双场）✓ + `discards a non-object … value without throwing` ×2 ✓；③ 语义不变：`leaves every other session key semantically unchanged` ✓；④ 脏数据全清洗：`drops every polluted entry of the AC-NF-14 pollution sample`（quoteFolds/headingFolds 双场）+ `drops non-string elements and prunes entries that filter empty` + `drops empty-string file keys` + `drops entries whose value is not an array/string[]` ✓（dev 自测报告含脏数据输入/输出对照表） |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| store.test 全量（quoteFolds sanitizer/headingFolds 统一清洗/fold 形状/往返） | ✅ 25/25 | `npx vitest run src/renderer/src/preferences/store.test.ts` | 2026-10-02 23:30 重跑 |
| quoteFolds sanitizer 9 用例（≥5 要求达成） | ✅ | `normalizeSession quoteFolds` 组 | 合法透传/缺失默认/非对象丢弃/非数组条目丢弃/非 string 元素剪除/空键丢弃 |
| normalizeColWidths 非回归（同 store 共享 helper 面） | ✅ 5/5 | `normalizeColWidths` 组 | MIN_COL_WIDTH 钳制/列不移位 |
| 跨重启读路径（serialize→parse→normalize） | ✅ | `survives the localStorage serialize→parse→normalize round-trip` | 旧会话 JSON 缺新键降级在场 |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（在案备忘非缺陷：阶段 3 联调（FE-08 useQuoteFold 消费方写回）待 FE-08 落地后进行——FE-08 自测时核验；STORE §3.2『可保留或剪除』裁决=剪除已钉住。）

## 结论

**通过**。AC-RULE-14 / AC-NF-14 两条全过。本轮 store.test 25/25 全绿（含 quoteFolds 9 条 sanitizer、AC-NF-14 污染样本全清洗、零 schema 变更钉住、跨重启往返），零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| quoteFolds 读写（含旧会话降级） | — | ✅ | ✅ | ✅（不抛错） | ✅ |
| 脏数据清洗（污染样本） | — | ✅ | ✅ | ✅ | ✅ |
| 零 schema 变更（键集钉住） | — | — | ✅ | — | ✅ |
| 跨重启往返持久 | — | ✅ | ✅ | — | ✅ |

覆盖率: 8/12 (67%)（纯存储底座，「渲染」列不适用）
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest store 单测 + DevTools localStorage 存档，桌面适配口径）

## 证据来源存档

- 本轮重跑：`preferences/store.test.ts` 25/25（2026-10-02）
- dev 存档：`IT-03-FE-02-selftest.md`（脏数据输入/输出对照表）、`IT-03-FE-02-impl.png`（localStorage 含 quoteFolds 键）
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
