# STORE 存储契约（veloxmark.preferences / veloxmark.session）

## 1. 概述

| 项 | 内容 |
|---|---|
| 接口域职责 | 渲染进程 localStorage 双键 schema 契约：`veloxmark.preferences`（用户偏好）与 `veloxmark.session`（高频会话态）的字段形状、默认值、sanitizer 白名单、读写模式；本需求唯一 schema 变更 = `quoteFolds` 平铺追加 |
| 通道类型 | localStorage（JSON 双键）/ store 读写 API（pub/sub + `useSyncExternalStore`）/ sanitizer（逐字段白名单） |
| 类型 | **修改**（SessionState 追加 1 字段 + sanitizer 白名单扩展 + store.test 用例）+ **复用**（headingFolds、tableColWidths、既有键位全部不动） |
| 裁决来源 | Q10（新增持久化态双键平铺追加、camelCase、不改既有字段形状、sanitizer 逐字段扩展）、PEND-09（quoteFolds 承载长引用折叠）、AC-RULE-14 / AC-NF-14（键位向后兼容） |
| 代码真源 | `src/renderer/src/preferences/store.ts`（Preferences / SessionState 接口 + 逐字段 sanitizer + pub/sub）、`preferences/useStore.ts`（useSyncExternalStore 模式）、`preferences/store.test.ts` |
| 存储设计真源 | `process-docs/ui-ux-redesign/design/db/db.md`（本需求零 DDL、去重校验记录） |

> 桌面适配口径：无 MySQL/无后端；「DB」= localStorage 双键 JSON。本需求**零 DDL、零迁移脚本**（additive 字段，缺省降级）。

---

## 2. 契约清单

| 契约标识 | 通道类型 | 类型 | 说明 | PRD 来源章节 | AC 条目 | 裁决来源 |
|---|---|---|---|---|---|---|
| `store:preferences` | localStorage | 复用 | `veloxmark.preferences`：Preferences 接口，本需求**无字段变更**（Q6 撤键只影响快捷键注册，不影响 theme 字段） | PRD M10、PRD 10 | AC-NF-14 | Q10 |
| `store:session` | localStorage | 复用 | `veloxmark.session`：SessionState 接口，本需求追加 1 字段 | PRD M10 | AC-NF-14 | Q10 |
| `session:quoteFolds` | localStorage 字段 | **新增** | `quoteFolds: Record<filePath, string[]>`，默认 `{}`；每文档的长引用折叠块 id 集 | PRD 6.4、PRD M10 | AC-FN-16, AC-RULE-14 | Q10 / PEND-09 |
| `session:headingFolds` | localStorage 字段 | 复用 | `headingFolds: Record<filePath, string[]>`（`level:text` id 集）：标题折叠记忆直接复用，不新增平行键 | PRD 6.3、PRD M10 | AC-FN-25/30, AC-RULE-14 | Q10 |
| `session:tableColWidths` | localStorage 字段 | 复用 | `tableColWidths: Record<filePath, Record<tableFrom, number[]>>`：列宽显示态持久化直接复用（吸收规则在消费侧） | PRD 6.1、PRD 5.1 | AC-OP-11, AC-ERR-03 | Q10 |
| `store:flat-append` | 约定 | 修改 | 双键平铺追加约定：新态平铺进对应键（camelCase），不嵌套新容器、不改既有字段形状 | PRD M10 | AC-NF-14 | Q10 |
| `store:sanitizer-whitelist` | 校验 | 修改 | normalize 白名单逐字段扩展 `quoteFolds`（沿用 headingFolds 同款逐文件过滤），脏数据丢弃不抛错 | PRD 10 | AC-NF-14 | Q10 |
| `store:useSyncExternalStore` | 读写模式 | 复用 | 新状态读写经 `preferences/useStore.ts` 的 `useSyncExternalStore` + 模块级 pub/sub（宪法规定模式） | —（宪法） | AC-NF-16 | CLAUDE.md 规范 |

---

## 3. 行为语义明细

### 3.1 双键总览与本需求动作

| 键 | 承载 | 持久性 | 本需求动作 |
|---|---|---|---|
| `veloxmark.preferences` | 用户偏好（主题/语言/编辑器外观/自动保存策略等，Preferences 接口） | 跨重启 | **零字段变更** |
| `veloxmark.session` | 高频会话态（侧栏布局/最近文件/打开标签/折叠态/列宽等，SessionState 接口） | localStorage 落盘即跨重启 | **追加 1 字段：quoteFolds** |

### 3.2 `quoteFolds` 新增字段契约（Q10 / PEND-09）

| 项 | 契约 |
|---|---|
| 字段名 | `quoteFolds`（camelCase，平铺于 SessionState 顶层） |
| 形状 | `Record<filePath, string[]>`：键=文档绝对路径，值=该文档已折叠长引用块的 id 数组 |
| 块 id 口径 | 引用块稳定 id（按文档内源码位置/内容派生的折叠键，实现细则随 quoteFold 装饰模块定稿；id 变更后失效项被 sanitizer/清洗丢弃，不影响其他条目） |
| 默认值 | `{}`（旧版本存盘的 session JSON 无该键时按默认值降级读取，不抛错） |
| 写入时机 | 用户折叠/展开长引用块（>5 行阈值，REN §3.5）时写回；签名门控 + 防抖（沿用 `useFoldSync` 同款写回纪律，防高频写盘） |
| 读出时机 | 文档载入/切换标签时读取该文档条目，恢复折叠态；跨重启持久 |
| 与正文关系 | 显示态，**不写 .md 正文**（AC-RULE-14） |

**sanitizer 白名单扩展**（`normalizeSession` 逐字段白名单）：

| 规则 | 口径 |
|---|---|
| 顶层形状 | 值须为对象（Record），否则按 `{}` 丢弃 |
| 逐文件过滤 | 条目键须为非空 string；值须为 Array，否则整条丢弃 |
| 元素过滤 | 数组元素仅保留 string 类型，非 string 元素丢弃（不抛错） |
| 空条目 | 过滤后为空数组的文件条目可保留或剪除（与 headingFolds 现行口径一致即可，store.test 钉住实际行为） |
| 失败策略 | 任何脏数据降级为缺省/丢弃，**不抛错、不阻塞启动**（AC-NF-14-3） |

**测试**：`preferences/store.test.ts` 追加 quoteFolds sanitizer 用例（沿用 headingFolds 既有用例风格）：合法值透传、非对象/非数组/非 string 元素丢弃、缺键默认 `{}`、脏数据不抛错。

### 3.3 复用字段（不新增平行键）

| 字段 | 形状 | 消费方 | 复用点 |
|---|---|---|---|
| `headingFolds` | `Record<filePath, string[]>`（元素 `level:text`） | `hooks/useFoldSync.ts`、`editor/livePreview/fold.ts`、Outline 折叠三角 | 标题折叠记忆 + 大纲双向同步（NAV/REN 域）；Q10：折叠态继续用本字段，localStorage 天然跨重启 |
| `tableColWidths` | `Record<filePath, Record<tableFrom, number[]>>` | `editor/table/widget.ts` col-grip、`normalizeColWidths` sanitizer（7F） | 列宽显示态持久化（AC-OP-11）；PEND-10 右邻列吸收规则写在**消费侧**，存储形状不变 |

### 3.4 双键平铺追加约定（Q10）

1. 新持久化态一律**平铺**进 `veloxmark.preferences` 或 `veloxmark.session` 顶层（camelCase 命名），与该键既有字段同级；
2. **不改既有字段形状**（不重命名、不改嵌套结构、不改语义）；
3. 新字段必须在 sanitizer 白名单**逐字段扩展**（默认显式登记，禁止整体透传 raw）；
4. 新字段缺省（旧存盘 JSON 无该键）→ 默认值降级读取，向后兼容（AC-NF-14）；回滚策略为保留旧键读取降级，无需迁移脚本；
5. 落位判别：视图显示态（折叠/列宽/面板尺寸）进 session；用户显式配置（主题/语言/编辑行为）进 preferences；
6. 每次追加同步 `preferences/store.test.ts` 用例与 `design/db/db.md` 变更清单（去重校验先行：能复用不新增）。

### 3.5 读写模式（useSyncExternalStore）

| 项 | 规则 |
|---|---|
| 订阅 | 组件经 `preferences/useStore.ts` 的 `useSyncExternalStore` 接入 store（宪法规定模式，不引 Context.Provider 旧写法） |
| 写入 | 单一写入口（store 的 patch 函数）+ pub/sub 通知；新状态不另起平行 store |
| 单测 | store 逻辑为纯函数（normalize/默认值）配 `store.test.ts`；不测 React 渲染 |
| e2e 缝 | `window.__veloxPrefs` 既有 seam 不破坏；quoteFolds 属 session 读写面，不新增 window 契约 |

### 3.6 键位兼容与迁移声明

| 项 | 声明 |
|---|---|
| 历史数据兼容 | **无迁移需求**：唯一变更为 additive 字段 `quoteFolds`，旧 JSON 缺键按 `{}` 降级（AC-NF-14-3） |
| 既有键位 | 语义不变（含 sidebar*/recentFiles/lastCursor/openTabs/activePath/headingFolds/tableColWidths 等全部） |
| DDL | **零 DDL**：存储介质为 localStorage JSON，schema 真源是 TypeScript 接口 + sanitizer（`design/db/db.md` §6 声明） |
| 与主题撤键的关系 | Q6 切换主题撤键不触碰 `preferences.theme` 字段（仅快捷键注册面变更） |

---

## 4. 与现有实现差异（现状 → 目标）

| # | 现状 | 目标 | 涉及文件 |
|---|---|---|---|
| 1 | `SessionState` 无 `quoteFolds` 字段（store.ts ~L104-128） | 追加 `quoteFolds: Record<string, string[]>` 平铺字段，默认 `{}` | `src/renderer/src/preferences/store.ts` |
| 2 | session 初始化器/`normalizeSession` 白名单未含 quoteFolds（store.ts ~L376-416） | 白名单逐字段扩展 quoteFolds（headingFolds 同款过滤：值须 string[]，脏数据丢弃不抛错） | `src/renderer/src/preferences/store.ts` |
| 3 | `store.test.ts` 无 quoteFolds 用例 | 追加 sanitizer 用例（合法/脏数据/缺键默认，沿用 7F 风格） | `src/renderer/src/preferences/store.test.ts` |
| 4 | 长引用折叠不存在（无消费方） | quoteFolds 消费方随 REN §3.5 引用折叠落地；写回沿用 useFoldSync 同款签名门控+防抖纪律 | `src/renderer/src/editor/livePreview/`（quoteFold）、`hooks/`（写回接线） |
| 5 | headingFolds / tableColWidths 已有完整实现（字段+sanitizer+消费方） | 零变更复用；吸收规则（PEND-10）写在 widget 消费侧不动存储形状 | `src/renderer/src/preferences/store.ts`、`editor/table/widget.ts` |
| 6 | `DEFAULT_SESSION` 常量缺 quoteFolds 默认项 | DEFAULT_SESSION 补 `quoteFolds: {}` | `src/renderer/src/preferences/store.ts` |
| 7 | design/db/db.md 已登记 quoteFolds 为「确认新增」 | 随实现落地勾销变更清单；store.test 同步 | `process-docs/ui-ux-redesign/design/db/db.md`（登记联动） |

---

## 5. 验收映射（AC 条目 → 本域判据）

| AC 条目 | 本域判据 |
|---|---|
| AC-RULE-14 | §3.2/§3.3 显示态写本地偏好键、跨重启持久、不写正文、既有键位不变、新增键向后兼容 |
| AC-FN-16 | §3.2 quoteFolds 承载长引用折叠态，展开还原无字节差异 |
| AC-FN-25 | §3.3 headingFolds 折叠态标签切换/重启保持；.md 逐字节一致 |
| AC-FN-30 | §3.3 折叠状态写偏好键跨重启；.md 无字节变化 |
| AC-OP-11 | §3.3 tableColWidths 列宽写入会话/偏好存储（不写 .md） |
| AC-ERR-03 | §3.3 列宽结构变化钳制/重置（消费侧规则，存储形状不变） |
| AC-NF-13 | .md 唯一数据源不变：存储面仅显示态/偏好，无新增数据实体 |
| AC-NF-14 | §3.4/§3.6 既有键位语义不变、新增键向后兼容、缺键默认降级不抛错 |
| AC-NF-16 | §3.5 store 纯逻辑单测 + converge（typecheck + Vitest）通过 |
| AC-PEND-09 → 转正 | §3.2 quoteFolds 字段形状随阈值冻结落盘 |
