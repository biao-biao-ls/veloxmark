## 代码审查报告 — IT-01/FE-03（去增删把手与 data-op 契约迁移）

**得分：** 98/100（阈值：90）
**状态：** ✅ 通过
**基线规范：** code-review/SKILL.md + rubric-code-review.md（通用 90 分档，前端）；reviewer.md 方法论
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）

**已有代码风格摘要**（工作目录 `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`）：
- 契约/冻结面：常量模块 + 同目录 `*.test.ts` 冻结钉（对照 `i18n/i18n.test.ts`、`styles/tokens.test.ts` 的源扫描守护先例）——contract.ts/contract.test.ts 与该模式一致
- Widget：事件闭包不捕获 cell 偏移、事件时重解析（stale-instance 纪律），widget.ts:210-325 保持
- i18n：`t('ns.key')` + en/zh 双写（i18n.test.ts key 对齐守护）；CSS：token 化、无新裸色值

**用户 CLAUDE.md 约定**：单测不渲染 widget（故契约面用源扫描断言属合规路径）；e2e 缝（data-op/命令 id）硬契约不得破坏；大文件只做局部小改

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 需求合规-功能全实现 | 10 | 10 | 无：把手家族删净（全仓 grep `row-insert/row-delete/col-insert-left/col-delete` 仅剩 contract.test.ts 负断言）、`col-grip` 唯一写入点 widget.ts:214 | — |
| 需求合规-无遗漏 | 8 | 8 | 无：28px 留白清零（markdown.css:867-881 `margin: 0 var(--editor-gutter)` 与 `.cm-line` 同量）、工具栏 6 键挂 data-op（toolbar.ts:62）、契约测试补齐 | — |
| 需求合规-无超范围 | 8 | 8 | TABLE_OP_TOAST_KEYS 入 contract.ts 属跨任务共享契约收口（有消费方 opsTable.ts:217/commands.ts:267），非超做 | — |
| 需求合规-理解正确 | 7 | 7 | 无：删4留1 与 AC-RULE-17 登记口径一致（CHANGE-3 已 merged，change-log.md:33-46；⊞=resizeTable、⋮=TBL-MOR-OPN 与登记一致） | — |
| 需求合规-边界覆盖 | 7 | 7 | 无：拖拽防误触/捕获失败兜底（widget.ts:239-248,305-315）；1行/1列禁删边界在 opsTable.test.ts:141-149 | — |
| 质量-职责分离 | 10 | 10 | 无：契约面单源 contract.ts，消费方（toolbar/测试）一律引用 | — |
| 质量-错误处理 | 10 | 10 | 无 | — |
| 质量-编码风格 | 8 | 8 | 无 | — |
| 质量-测试覆盖 | 8 | 8 | 无：宪法禁止单测渲染 widget，源扫描冻结钉为项目既有模式；tokens.test.ts:177-205 补 CHANGE-16 链路守护 2 用例 | — |
| 质量-安全隐患 | 8 | 8 | 无：renderInlineCell 先转义 `&<>` 再注入（parse.ts:198-207） | — |
| 质量-性能 | 8 | 8 | 无：grip 仅挂表头行（widget.ts:395） | — |
| 质量-DRY | 4 | 4 | 无：FROZEN_MENU_OP_IDS 测试内重复声明属刻意冻结钉（检测漂移），非重复代码 | — |
| 质量-YAGNI | 2 | 4 | -2：4 个死 key + 1 个未用类型导出（见问题清单 Minor-1/2） | 客观（死代码），部分通过 |
| **合计** | **98** | **100** | | |

### 问题清单

| severity | item | detail | location | suggestion |
|----------|------|--------|----------|------------|
| Minor | 死 i18n key | `tableHandle.insertRowBelow/deleteRow/insertColLeft/deleteCol` 4 键已无任何消费方（仅 `tableHandle.colGrip` 在 widget.ts:213 使用）；implementation-notes 已登记 FE-11 收口，但按 YAGNI 现状是死数据 | `src/renderer/src/i18n/en.ts:540-543`、`src/renderer/src/i18n/zh.ts:535-538` | 按登记计划在 FE-11 一并删除 4 键（en/zh 同步），或提前收口避免字典漂移 |
| Minor | 未用类型导出 | `TableHandleContract` 类型导出后全仓无引用（`TABLE_HANDLE_CONTRACT` 仅 contract.test.ts 消费） | `src/renderer/src/editor/table/contract.ts:15` | 删除该 type 别名，或在 widget.ts 写入点用其标注（如 `const handle: TableHandleContract = 'col-grip'`）使单源真正闭环 |
| Info | 任务文件登记滞后 | implementation-notes 写「CHANGE-3（pending）待主 agent 评审拍板」，但 change-log.md:34 已置 `状态: merged`——文档态漂移（非代码缺陷） | `process-docs/ui-ux-redesign/tasks/IT-01/FE-03.md:30-31` vs `design/change-log.md:34` | 主 agent 收尾时同步任务文件登记状态 |
| Info | 静态断言局限 | contract.test.ts 全部为源文本扫描，不执行 mountTableToolbar/widget 运行时行为（受宪法「单测不渲染 widget」约束，属合规妥协；运行时断言归 INFRA-01 cdp 探针，skipped-gates 已登记） | `src/renderer/src/editor/table/contract.test.ts:53-116` | 无需改；INFRA-01 落地后由 cdp 探针补运行时扫描 |

**i18n 专项（scope-hint 兼核）**：en/zh key 全对齐（i18n.test.ts 守护）；`tableHandle.colGrip` 文案质量/占位符一致；「▸」字形在 MenuBar.tsx:534、EditorContextMenu.tsx:92、fold.ts:222、quoteFold.ts:241 全部一致使用；快捷键回显单源达标——STRUCT_KEYS（keymap.ts:72-81）为唯一源，opsTable.ts:191-193 经 `structShortcut` 派生，opsTable.test.ts:80-117 钉住 8 键全覆盖 + 11 无键项留空（AC-RULE-11/AC-FN-07 口径），无双源手工维护。CHANGE-16 token 链修复（tokens.css:32/:root 补 `--accent` + themes.css:18,107 双主题块重声明 `--focus-ring`）合宪法 token 分层，tokens.test.ts 有链路守护。

### 结论

✅ **通过（98 ≥ 90）**。三项 AC 对应实现均独立读码验证属实（非采信任务自述）：AC-FN-01 左缘 0px 对齐、AC-FN-02 把手删净四面入口收口、AC-RULE-17 契约演进已登记（CHANGE-3 merged）。仅 2 项 Minor 死代码（-2），不阻塞提交；建议随 FE-11 收口清理。
