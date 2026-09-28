# 数据库（本地存储）设计 · ui-ux-redesign

> 适配口径：VeloxMark 是 Electron 桌面应用，**无 MySQL/无后端**。本需求「DB」= 渲染进程 localStorage 双键 schema（`veloxmark.preferences` / `veloxmark.session`），真源为 `src/renderer/src/preferences/store.ts`（Preferences / SessionState 接口 + 逐字段白名单 sanitizer）。本需求**零 DDL**（见文末声明）。

## 1. 实体清单

| 序号 | 实体名 | 来源 | 状态 | 说明 |
|------|--------|------|------|------|
| 1 | Preferences | 现有 store.ts `veloxmark.preferences` | 已存在 | 用户偏好（主题/语言等），跨重启；本需求无字段变更 |
| 2 | SessionState | 现有 store.ts `veloxmark.session` | 已存在 | 高频会话态（侧栏/最近文件/折叠/列宽），localStorage 落盘即跨重启；本需求追加 1 字段 |

## 2. 去重校验记录（强制）

| 拟新增字段/实体 | schema 匹配 | 代码匹配 | 数据源复用 | 决策 |
|---|---|---|---|---|
| 标题折叠态 | SessionState.headingFolds: Record<filePath, string[]> 已存在 | store.ts:119 + sanitizer 已覆盖 | 复用 | **改复用**：折叠记忆（AC-RULE-14/AC-FN-25/30）直接复用，不新增 |
| 表格列宽 | SessionState.tableColWidths: Record<filePath, Record<tableFrom, number[]>> 已存在 | store.ts:121 + normalizeColWidths sanitizer（7F） | 复用 | **改复用**：列宽持久化（AC-OP-11）直接复用 |
| 引用块折叠态 | 无 | 无 | 无 | **确认新增**：`quoteFolds` 平铺字段（Q10 裁决：双键平铺追加） |

## 3. 现有 schema 摘要（本需求涉及面）

### 3.1 SessionState（`veloxmark.session`，高频会话态）

| 字段 | 形状 | 语义 | 本需求动作 |
|------|------|------|-----------|
| sidebar / recentFiles / lastPaths 等 | 平铺字段 | 既有会话态 | 不动 |
| headingFolds | `Record<filePath, string[]>` | 每文档的标题折叠 id 集，跨重启、不写 .md | **复用**（折叠记忆/双向同步落此） |
| tableColWidths | `Record<filePath, Record<tableFrom, number[]>>` | 每文档每表的列宽数组 | **复用**（总宽不变、右邻列吸收规则写在消费侧） |
| quoteFolds | `Record<filePath, string[]>` | 每文档的长引用折叠块 id 集（>5 行折叠、摘要行展开还原） | **新增** |

### 3.2 Preferences（`veloxmark.preferences`）

本需求无字段变更。注意：切换主题撤键（Q6）只影响快捷键注册，不影响 theme 偏好字段本身。

## 4. 变更清单

| 表（键） | 变更类型 | 变更内容 | 风险等级 |
|---|---|---|---|
| veloxmark.session（SessionState） | 新增字段 | `quoteFolds: Record<string, string[]>`，默认 `{}` | 低 |

- **sanitizer**：`normalizeSession` 白名单追加 `quoteFolds`（沿用 headingFolds 同款逐文件过滤：值须为 string[]，脏数据丢弃不抛错）。
- **测试**：`preferences/store.test.ts` 追加 quoteFolds sanitizer 用例（沿用 7F 风格）。
- **读写侧**：新状态接入照 `preferences/useStore.ts` 的 `useSyncExternalStore` 模式（宪法规定）。

## 5. 历史数据兼容方案

**本次需求无历史数据兼容需求。** 变更清单仅 1 项低风险 additive 字段：旧版本存盘的 session JSON 无 `quoteFolds` 键，normalize 白名单缺省即 `{}`，无需迁移脚本、无脏数据风险。无中/高风险变更，故不产出 `data-cleaning-plan.md`。

## 6. DDL 声明（零 DDL）

本需求**无任何 CREATE TABLE / ALTER TABLE**：存储介质为 localStorage JSON，schema 真源是 TypeScript 接口 + sanitizer（见上），不适用 MySQL DDL 与 sql-design-spec（必备字段/biz_key/软删除等规范对 localStorage 不适用，此处为整体适配偏差声明，非字段级偏差）。

→ `design/sql/NO-DB-CHANGE.sql` 为注释体声明文件（占位满足交付物门禁），内容为「零 DDL」声明，不含可执行语句。
