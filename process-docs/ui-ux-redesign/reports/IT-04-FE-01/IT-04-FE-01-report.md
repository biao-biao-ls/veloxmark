# IT-04-FE-01 交付报告 · 验收基线修订与文档收敛

> 任务：ui-ux-redesign/IT-04/FE-01「验收基线修订与文档收敛（ac.md PEND 转正/附录别名对账/总看板收敛）」
> 角色：前端（纯文档域）｜ 日期：2026-09-30 ｜ 状态：开发完成，待 QA 验收
> 约束遵守：未执行任何 git commit/push；未修改 process-docs 下 task-list.json；未裁定 change-log 既有 pending 项（CHANGE-1/2/5/6/8/9）与 CHANGE-3/9 指名项。

---

## 1. 交付物清单

| 产物 | 路径 | 动作 |
|---|---|---|
| ac.md v1.4（验收真源） | `docs/requirements/ui-ux-redesign/ac.md`（LF）｜`projects/.worktrees/typora/ui-ux-redesign/frontend/docs/requirements/ui-ux-redesign/ac.md`（CRLF）｜`process-docs/ui-ux-redesign/requirement/ac.md`（LF） | 修订（三副本同步，保行尾） |
| 总看板 | `docs/ui-redesign-tasks.md` + worktree 副本（CRLF） | 新建 |
| markdown-ux 看板收敛标注 | `docs/markdown-ux-optimization.md` + worktree 副本 | 头部注记 + 11.1~11.8 行内去向标记 |
| refactor 看板收敛标注 | `docs/refactor-tasks.md` + worktree 副本 | 头部注记 + 6.15~6.18 行内去向标记 |
| 期 1 门禁留档 | `process-docs/ui-ux-redesign/reports/IT-04-FE-01/IT-04-FE-01-period1-gate.md` | 新建 |
| ac.md 修订记录登记 | `process-docs/ui-ux-redesign/design/change-log.md` CHANGE-10 | 追加（状态 merged，修订记录登记，非偏离裁定） |
| 任务动态发现 | `process-docs/ui-ux-redesign/tasks/IT-04/FE-01.md` frontmatter | implementation-notes / discovered-sections 更新（task-list.json 未动） |
| 本报告 | `process-docs/ui-ux-redesign/reports/IT-04-FE-01/IT-04-FE-01-report.md` | 新建 |

## 2. 工作项完成情况（对照任务交互操作 1-5）

### 2.1 PEND 转正（交互 #1）✅

- §5.1 由「[PENDING] 待确认条目」表重写为 **16 条正式 Given-When-Then 条目**（| 编号 | Given | When | Then | 来源 |），标题改「裁决转正条目（AC-PEND-01..16 · 原待确认豁免项）」。
- **编号决策：保留 AC-PEND-NN**（原地转正、不换正式前缀）——task-list.json `acRef: "ac.md#AC-PEND-01/02"` 与 BE-01/FE-03/FE-11/FE-01 frontmatter 已引用该编号，重编号会造成禁改文件中的永久悬空引用；§0 编号规范行改为「已转正，计入」，作任务 acRef 稳定锚点。
- `[PENDING]` 标记清零：正文 15 处交叉引用（AC-RULE-06/07/09/15、AC-FN-05/13/16/21、AC-OP-02/03/04/10/11/12、AC-ERR-01/03）全部收口为指向对应裁决判据的正常引用；残留的 3 处 `[PENDING]` 字样仅在版本状态/头注/§5.1 引言的历史说明中（描述清零事实本身）。
- 16 条判据与 grill-rulings 逐条一致：01→Q6（Ctrl+Shift+T 归重开标签页）、02→Q7（四键补注册+派生例外清单含 CHANGE-7）、03→Q4（selection.empty 上下文分流）、04→PEND-04（模态叠加）、05→PEND-05（toast 5s+撤销按钮）、06→Q8（不补专键、Shift+F10 键盘兜底）、07→PEND-07（单事务补齐矩形）、08→Q9（三项取舍）、09→PEND-09（>5 行折叠/摘要=首行截断+「N 行」尾标）、10→PEND-10（右邻吸收/最右列增减钳制）、11→Q5（表头身份迁移）、12→PEND-12（表头下移/表头末行禁删）、13→PEND-13（Ctrl+Enter 专职插行/Shift+Enter 换行/Tab 跳格）、14→PEND-14（显式豁免）、15→PEND-15（轻量不回 toast）、16→Q3（仅删表确认）。

### 2.2 措辞对齐 4 处（交互 #2）✅

| 条目 | 对齐后口径 | 冻结文案影响 |
|---|---|---|
| AC-RULE-15 | 确认流收窄为**仅删表**；删行/列可逆操作不弹确认框，toast 回执 + 一步 undo | 删表文案「删除后可用一步撤销还原，确认删除该表格」逐字保留；删行/列确认文案随确认流退出（Q3 裁决生效，非改写） |
| AC-RULE-17 | 「已登记的契约集演进为准入变更（删 4 留 1…CHANGE-3 登记）；此后契约集变更须走登记流程，禁止静默破坏」 | 无（CHANGE-3 尾注完整保留） |
| AC-OP-10 | 删行/列无确认框直接执行 + 表头身份下移 + toast「已删除第 i 行/第 j 列（Ctrl+Z 可撤销）」 | toast 逐字保留 |
| AC-FN-05 | ⋮ 菜单五组「行操作/列操作/对齐/单元格/结构删除」（含单元格组）；UI-IXD-03 联动对齐 | 无 |

其余冻结中文文案（undo「已撤销」、只读、autosave 失败、插删移缩放对齐回执族）逐字未动。AC-NF-06 未改（「一致率 100%」在派生例外登记后仍字面成立）；AC-RULE-11 补派生例外清单指针（CHANGE-7，已裁定非新裁定）。

### 2.3 别名对账（交互 #3）✅

- 附录 A：AC-01..22 → 正式 id 逐条核对 **22/22 无悬空**（AC-01→AC-FN-01 … AC-22→AC-OP-18，全部存在于正文）；反向「正式 id → 承载任务」由任务 frontmatter `acceptance-criteria` + task-list.json 承载（check-tasks「AC 全覆盖」口径守护）。
- 附录 B/C 引用 id 全部存在，无悬空。
- 三处附录各加「别名对账（2026-09-30，IT-04/FE-01）」留痕注；**无悬空映射需修正**（预核结论与终核一致）。

### 2.4 总看板收敛 AC-FN-34（交互 #4）✅

- 新建 `docs/ui-redesign-tasks.md`（main + worktree）：期 1 门禁（已闭）/期 2（IT-01 12 任务）/期 3（IT-02 13 任务）/期 4（IT-03 10 任务）/期 5（IT-04 4 任务）分组，每任务挂关键裁决/AC，头部溯源 PRD 5.3 **E 步骤**→F→G→H→I。
- 「既有看板收敛对账」逐项去向表：
  - markdown-ux：①~⑱ 已完成基线（+演进收敛指针）；11.1~11.5 **收敛入期 4**（IT-03/FE-04/05/08/06/07）；11.6~11.8 **另立需求**（PRD M05 Out of Scope）。
  - refactor：阶段 0~6 已完成基线（4.2/4.3/4.4 落地原可选 1.7/2.17/1.3）；6.16 键盘导航部分收敛入期 3（FE-06/FE-08）、多选显式不实现（Q9 留档）；6.15/6.17/6.18 **另立需求**。
- 「迭代池（另立需求清单）」节汇总 6 项另立 + Q9 两项显式不实现说明。
- 两既有看板头部加收敛声明 blockquote，未勾项行内加「→ 去向」标记（main + worktree 同步）。

### 2.5 期 1 门禁留档（交互 #5）✅ → `IT-04-FE-01-period1-gate.md`

- AC-FN-27：原型用户评审通过——`ui/ui-ux-redesign-ui-test-report.md` v2.0-final，58/60（96.7%），「✅ 通过 — 放行进入下一阶段」；评审 2026-09-28 先于期 2+ 实现启动，前置门禁满足。
- AC-FN-26：五部分定稿评审——**如实登记为分布式载体**（视觉原则=proposal.md+tokens/themes+7 页原型；交互模式库=PRD 5.5/6.x+原型；chrome 规范扩展=markdown-ux 附录 11A；快捷键总表=menu-tree 键位矩阵+MENU-menubar §3.4+commandAccelerators 单源=AC-RULE-11 唯一派生源；信息架构=menu-tree+function-tree），证据链=grill-rulings（2026-09-28 用户全锁）+ 原型报告设计规范维度 9/10 + PRD 修订记录人工评审。
- **缺口注记（不杜撰）**：无单一归档《UI/UX 设计规范》文档、无五部分集中签核单——留档含处置建议（随期 5/doc-reconcile 归并升级），门禁按证据链判定通过。

## 3. 验收核验结果

| 核验 | 结果 |
|---|---|
| check-tasks.js 7 项自检（node，tasks-dir=tasks，ac-file=requirement/ac.md） | **全 PASS**（完整性/依赖无环/AC 全覆盖/功能点覆盖/e2e-paths 结构/角色契约/依赖引用可解析） |
| `[PENDING]` 标记 | 条目级清零（仅存历史说明文字） |
| ac.md 三副本一致性 | main==process-docs 字节全同（LF）；worktree 内容全同（CRLF，395 行） |
| 别名对账 | 22/22 双向可追，附录 B/C 无悬空 |
| change-log | 新增 CHANGE-10（merged，修订记录登记）；CHANGE-1/2/5/6/8/9 pending 与 CHANGE-3/9 指名项未触碰 |
| 冻结中文文案面 | 删表/toast/只读/落盘失败/undo 回执族逐字未动；仅删行/列确认文案按 Q3 裁决退出（AC-RULE-15/AC-OP-10 联动） |
| typecheck / test:unit | N/A（纯文档域，零代码改动）；以文档一致性校验 + check-tasks 代替 |

## 4. 偏离与风险

- **无实现偏离**（纯文档任务）；CHANGE-10 为阶段 4 要求的修订记录登记（类型 Updated，非待裁决偏离）。
- 已知残留风险：AC-FN-26 集中签核缺口（§2.5 注记，建议期 5 归并）；ac.md 修订后 tech-design.md §1.2 仍写「ac.md v1.3…待按 grill-rulings 修订转正」——属 tech-design 陈旧描述，未在本任务唯一改动面内擅动（已记 FE-01 doc-drift，doc-reconcile 期一并翻到 v1.4）。

## 5. 建议 QA 验收动作

1. 人工复核 ac.md v1.4 与 grill-rulings.md 无口径漂移（重点：16 条 GWT + AC-RULE-15/17、AC-OP-10、AC-FN-05）。
2. 核对总看板收敛对账表与两看板标注一致（AC-FN-34 三项判据）。
3. 门禁留档与 ui-test-report/grill-rulings 证据链对照（AC-FN-26/27）。
4. 勾销 FE-01.md 阶段 1-4 checkboxes；任务状态经 task-cli 统一翻转（本报告未动 task-list.json）。
