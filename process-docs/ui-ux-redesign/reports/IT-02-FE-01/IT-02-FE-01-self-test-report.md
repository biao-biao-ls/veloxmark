# IT-02-FE-01 自测报告 — 菜单信息架构重排（menuLayout 五根菜单分组/插入域去重/命名统一，命令 id 不变）

- **任务ID**: IT-02/FE-01（菜单信息架构重排）
- **测试时间**: 2026-10-02 22:40–22:55（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段 CDP 批面验证存档 + 设计文档对照记录。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；本任务为菜单呈现层重排，验证面 = menuLayout 契约单测（id 集合冻结/分组/去重/命名）+ i18n 双字典单测 + batch-c-verify.mjs CDP 实测存档。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-02/FE-01.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-FN-09 | 菜单 IA 重排后命令 id/data-op 集合与重排前完全一致（变化仅呈现层） | ✅ 通过 | `menuLayout.test.ts` > `AC-FN-09` 3 用例：`buildMenus 输出的命令 id 集合（含子菜单）与基线数组深比较一致`（menu-tree §9 48-id 基线）、`命令 id 无重复（insertTable 去重后全菜单唯一）`、`真实注册表交叉：BASELINE 全在真实注册表中，且 buildMenus(真实注册表) id 集 === BASELINE` 本轮重跑 11/11 ✓；契约红线（id 字面量一个不改）同源钉住 `contract.test.ts` data-op 组 8/8 ✓；macOS 空组省略口径 = CHANGE-4（merged 登记） |
| AC-FN-35 | 与 Typora/常见编辑器对照走查核心命令位置/命名/快捷键，差异处留对比记录与理由 | ✅ 通过 | 对照走查记录 = `design/api/MENU-menubar.md` §3.1「分组对照（现状 menuLayout.ts → 目标 menu-tree §3）」表格逐菜单留「关键变更」理由（标签页成组任务序/插入类迁出插入域/视图 6 组频次降序/帮助不过度设计），命名差异「文件夹内搜索…」统一理由（搜索范围=文件夹），根菜单名不改注明「行业习惯对齐」——差异均有记录与理由；实现侧：`menu:ia-reorder — 五根菜单分组/位次与 menu-tree §3 完全一致` ✓ + `menu:rename-consistency` 2 用例（globalSearch id 不变/文案统一）✓；任务清单阶段 2「自测报告含分组对照走查记录」已勾销 |
| AC-FN-28 | en→zh→en 切换新增文案对应语言无 key 裸露；en/zh key 集合完全一致；原生菜单/callout 标题同步 | ✅ 通过 | ① `i18n.test.ts` 本轮重跑 14/14 ✓：`EN and ZH define the same key set`、`every static t('…') key resolves against EN`（无裸 key）、`native menu strings (third dictionary)` 组 3 用例（NATIVE_MENU_STRINGS zh/en 同集+占位符一致）、`callout.* dynamic key family` ✓；② 分组名专测：`menuLayout.test.ts` > `AC-FN-28 — 新分组名 i18n 双字典对齐：menu.grp.* key 在 en/zh 双字典齐全且无裸 key 文案` ✓ |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| menuLayout 全量（IA 重排/id 冻结/去重/命名/分组标题呈现） | ✅ 11/11 | `npx vitest run src/renderer/src/commands/menuLayout.test.ts` | 2026-10-02 22:40 重跑 |
| i18n 双字典 + 原生菜单第三字典 | ✅ 14/14 | `npx vitest run src/renderer/src/i18n/i18n.test.ts` | key 对齐/占位符/callout/render.* 全绿 |
| 分组标题呈现（每组 1 标题、组间 1 分隔线、帮助无标题） | ✅ | `buildMenus — 分组标题呈现` 3 用例 | 含 FE-01#2 仅文件菜单 wide |
| 批 C 菜单面 CDP 实测（存档） | ✅ 34/34 | dev 阶段 `batch-c-verify.mjs`（截图落 `shots/`） | 勾选列 per-panel/260-292 宽/键盘激活环/子菜单几何 |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（历史遗留已按批 C 合并修复闭环（FE-01#1~#8 等，implementation-notes 存证）；AC-FN-09 的 cdp 探针扫描阶段 4 留待 QA 联调补跑，单测 id 集合冻结已等价钉住——登记于任务清单阶段 4。）

## 结论

**通过**。AC-FN-09 / AC-FN-35 / AC-FN-28 三条全过。本轮 menuLayout.test 11/11 + i18n.test 14/14 全绿，CDP 批面存档 34/34，对照走查记录在案（MENU-menubar §3.1），零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 五根菜单分组重排呈现 | ✅ | — | ✅ | — | ✅ |
| 命令 id 集合冻结（48-id 基线） | — | — | ✅ | — | ✅ |
| 插入域去重/命名统一 | — | ✅ | ✅ | — | ✅ |
| 双语文案切换（含原生菜单） | ✅ | — | ✅ | ✅（无 key 裸露） | ✅ |

覆盖率: 9/12 (75%)（菜单呈现层，「CRUD/错误处理」列部分不适用）
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest 契约/i18n 单测 + CDP 批面存档，桌面适配口径）

## 证据来源存档

- 本轮重跑：`commands/menuLayout.test.ts` 11/11、`i18n/i18n.test.ts` 14/14（2026-10-02）
- CDP 存档（dev 阶段实测）：批 C `batch-c-verify.mjs` 34/34，截图 `reports/IT-02-FE-01/shots/`
- 对照走查记录：`design/api/MENU-menubar.md` §3.1；登记面 CHANGE-4（merged）
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
