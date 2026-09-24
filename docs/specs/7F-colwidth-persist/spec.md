# 7F spec — 表格列宽跨会话持久化（7.7 / ⑫）

> 看板任务：⑫ 7.7（`docs/markdown-ux-optimization.md` 实施优先级 P1，标注「决策后实施」）。本文件含决策记录（看板 `[NEEDS CLARIFICATION]` 的收口）。

## 背景 / 差距（what & why）

看板表格对照表：「列宽 | 表头缘拖拽，跨会话记住 | 有 col-grip 拖拽，但 `colWidths` 仅存 `tableEditField`，重开即丢 | `editor/table/state.ts`」。`colWidths: Map<number, number[]>`（键 = `tableFrom` 文档偏移）是 CM StateField 会话态——关闭文件/重启即失。Typora 列宽跨会话保持。

**What**：列宽按文件持久化，重开文件（及标签切换回归）宽度恢复；陈旧宽度合理失效或钳制；**绝不**向 `.md` 写入非 Markdown 内容。

**Why**：列宽是高频手工调整的展示态，每次重开归零是持续性摩擦。

## 决策记录（NEEDS CLARIFICATION 收口，先于实施）

看板两案：元数据侧车 vs preferences store 按文件路径；侧车形态与 .gitignore 策略标了产品决策。

**决策：session store（localStorage `veloxmark.session`）按文件路径持久化——不走侧车。**

理由（按权重）：

1. **房内先例决定性**：`SessionState` 已持久化同类「按文件的展示/编辑态」——`headingFolds: Record<路径, 折叠键[]>`（P18，`useFoldSync` 同步域 hook）、`lastCursor`（P12）。列宽与折叠同级：个人展示态、不得入 `.md`、按文件路径键控。走同一存储、同一 hook 模式，架构零新增概念。
2. **侧车的产品决策被绕开**：看板 NEEDS CLARIFICATION（侧车形态 + .gitignore 策略）只在选侧车时存在——不选即消解，无需再决。侧车还带来正文目录污染（阅读器应用的文件夹整洁是产品面）、团队共享个人观感的错配、以及独立文件（未开工作区）的落点难题。
3. **「Markdown 唯一数据源」天然满足**（AC3）：零 `.md` 触碰、零文件系统写入、零 IPC 面。
4. localStorage 容量无忧（每表每列一数字，重度用户亦 <1MB 量级）。

代价显式记录：列宽随本机 profile（换机器/清存储不迁移）；文件改名/移动后按新路径找不到旧宽度（宽度失忆，非损坏）。两者均与 `headingFolds` 现状同级，可接受。未来若要跨机器同步，属新任务（侧车或导出），不进本 spec。

## AC（可测试）

1. **重开保持**：设置列宽 → 关闭文件/重启应用 → 重开该文件，列宽恢复（含多表分别保持）。
2. **陈旧失效/钳制**：持久化的宽度与表格现状不匹配时合理退化——数值非法（非有限/≤0）被清洗；列数不符时消费口不越界（缺列走默认宽、多余宽忽略）；不崩、不画出畸形表。
3. **零正文污染**：全程不向 `.md` 写入任何非 Markdown 内容（本方案零文件写入，天然成立）。
4. **无路径不持久化**：Untitled（未落盘）文档不写存储（与 folds 同则）。
5. **切换防串扰**：文件/标签切换（文档整体替换）后，宽度映射不把 A 文件的宽度套到 B 文件的表上（恢复为 B 的记忆或空）。

## Out of scope（明确不做）

- 侧车文件 / 跨机器同步 / git 共享（决策记录已论证，将来另立）。
- 列宽随内容列数变化的自动换算（增删列后旧宽度按 AC2 退化即可，不做智能重排）。
- e2e 探针扩展（无探针依赖本能力；`__veloxP18` 折叠缝不外扩）。
- 行高/单元格内边距等其它表格展示态（只做列宽）。

## 约束引用

1（e2e 缝）→ 零字面量触碰；3（Widget 纪律）→ 消费口容错在既有 `TableWidget` colgroup 装配（按 `colCount` 取值，本就容错）；5（i18n）→ 零新 key；7（循环依赖）→ `preferences/store` 不 import `editor/*`（normalize 纯函数留 store 侧），hook 单向；9（单测纯逻辑）→ `normalizeColWidths` 配单测；「Markdown 唯一数据源」→ AC3。
