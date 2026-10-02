# IT-03-FE-06 自测报告 — 列表行首拖拽排序与任务项勾选（把手按需浮现/层级不变/轻量口径）

- **任务ID**: IT-03/FE-06（列表行首拖拽排序与任务项勾选）
- **测试时间**: 2026-10-03 04:10–04:35（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段 CDP Electron 实测存档（S1–S6 场景，`IT-03-FE-06-cdp-data.json` + run.log **62/62 checks passed**）。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；验证面 = listDrag 规划层/会话机纯函数单测 + CDP 实测（拖拽 diff/undo/勾选写回/只读拦截/导出一致）。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-03/FE-06.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-OP-15 | 点击未勾选任务项勾选框：即时切换、中间状态可见性、`.md` `[ ]`→`[x]` 落盘、展示态只来自源 | ✅ 通过 | ① CDP 存档 §3（S3 任务勾选）：勾选 **6ms** 内 `checked=true` + 行 `cm-md-task-done` 即时回显、`.md` 落 `- [x] write docs`、3 项 DOM 勾选态 === 源 `[x]` 槽（展示态只来自源重建）；② 勾选写回面 = TaskWidget click 门（`preventDefault` 回滚原生翻转 → assertWritable → 单 dispatch `input.task.toggle`）——单事务一步 undo 口径；③ 轻量口径 PEND-15：勾选全程无 toast（`render.toast.*` 四键封顶，无 `render.toast.taskChecked`，显式豁免勿补） |
| AC-OP-16 | 按住行首把手拖到目标位置松开：插入指示线、同层级顺序调整、缩进层级不变、`.md` 源码顺序写回、toast 回执、一步 undo | ✅ 通过 | ① 规划层单测本轮重跑 `listDrag.test.ts` **23/23**：同层级移动 3 用例（`moves a block to the drop slot, indent prefixes byte-identical`/反向移动/no-op 判定）+ 缩进保持/子树整体 3 用例（`moves the item block with its nested children, indent untouched`/`keeps loose-list blank gaps fixed while blocks reorder`）+ undo 一步还原 `applying the inverse plan restores the exact source lines` ✓；② CDP 存档 §2b：拖 `gamma`→`alpha` 前——行序 `gamma,alpha,alpha-a1,alpha-a2,beta,…`、全部 item 缩进映射一致（alpha-a1/a2 保持 2 空格）、toast 精确「已移动列表项（Ctrl+Z 可撤销）」原文命中、一次 Ctrl+Z getDoc 与拖前**逐字节相等**；③ 指示线：2px accent（`indicator display:block, w=800, h=2`）+ Esc 取消零写入（§2a） |
| AC-RULE-04 | 任务项状态由 `.md` 任务语法 `[ ]`/`[x]` 承载，勾选写回源码 | ✅ 通过 | ① 源即唯一真源：CDP §3 勾选后源落 `[x]`、DOM 态从源重建（`只来自源重建` 判据 ✓）；② `handlers-tree.ts` 任务行 class（`cm-md-task-item[.cm-md-task-done]`）纯渲染投影；③ 任务行同为列表行（`planListMove — task items … reorders task checkbox lines like plain items` ✓） |
| AC-ERR-08 | 只读文件：拦截不写入、逐字节不变无半提交、冻结提示「文件为只读，无法修改，可另存后编辑」 | ✅ 通过 | CDP 存档 §5（S5 只读拦截，chmod 0o444 + `isWritable` 探针 `{ok:true,v:false}`）：拖拽/勾选双路径均经 `assertWritable` 拒绝、文档逐字节不变、`err.readonly` 冻结文案原文命中、勾选拒绝时 checkbox 保持原态（`preventDefault` 回滚**零瞬时误勾**）；「可另存后编辑」闭环 = 恢复可写后拖拽落位+回执+真实写入 ✓；闸门在 commit（dropListMove）= grab 不设门同 ImageEditFloat resize 口径（impl ③） |
| UI-IXD-08 | 把手 hover 行首浮现、按住拖动排序；把手不常驻、不遮挡正文；拖动时显示插入位置指示线 | ✅ 通过 | ① CDP 存档 §1（S1 hover 把手）：静息 `is-idle` aria-hidden 不渲染、hover 行首浮现、不遮挡正文；② 拖动中把手稳定不消失（`handle=true` mid-drag 采样，会话 pin）+ ghost + 2px 指示线（§2a）；③ 需浮现纪律 = FE-03 hoverDiscipline 频道（无自写显隐定时器，`ListDragHandle` registerHoverContent）；单例列表把手灰显不可拖（§4 空态，`canReorderListItem` 4 用例） |
| UI-IXD-09 | 勾选框点击切换未勾选/已勾选两态；点击后即时回显 | ✅ 通过 | CDP §3：6ms 内两态切换 + ✓ + `task-done` 删除线即时回显；勾选框 `data-testid=task-checkbox` 契约在位（impl ⑤ e2e 缝零新增） |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| listDrag 规划层/会话机全量（解析/单例灰显/同层级/缩进保持/跨父钳制/undo/会话收尾） | ✅ 23/23 | `npx vitest run src/renderer/src/editor/listDrag.test.ts` | 2026-10-03 04:10 重跑（4 组：parseListItems 3 / canReorderListItem 4 / plan+apply 12 / listDragSessionStep 4） |
| S2 拖拽排序（同层换序/子树整体/Esc 取消/一步 undo/toast） | ✅ | CDP 存档 `IT-03-FE-06-cdp-data.json` §2 + `.md` 前后 diff | 62/62 同场 |
| S3 任务勾选（写回/即时回显/源重建/PEND-15 无 toast） | ✅ | CDP 存档 §3 | 轻量口径显式豁免 |
| S5 只读拦截（双路径零写入/零瞬时态/冻结 toast/恢复可写闭环） | ✅ | CDP 存档 §5 | W_OK 真源探针 |
| S4/S6 单例灰显 + AC-OP-18 导出一致性（列表/任务切片） | ✅ | CDP 存档 §4/§6 | 非本任务 AC 顺带 |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（历史移交已闭环：CDP 夹具单例验证须用非空块级内容隔断（实现未改，夹具已修正，impl ②）；hoverDiscipline anchor 重定向使拖拽中把手跟到新行为 FE-03 既有语义、会话/落点不受影响（impl ⑥）。PEND-15 勾选无 toast 为显式产品决策非缺陷。）

## 结论

**通过**。AC-OP-15 / AC-OP-16 / AC-RULE-04 / AC-ERR-08 / UI-IXD-08 / UI-IXD-09 六条全过。本轮 listDrag 23/23 全绿（同层移动缩进前缀字节恒等、跨父级钳制、逆计划一步还原），CDP 62/62 存档证据在场（含 .md 前后 diff、只读双路径零瞬时态、导出一致切片），零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 把手 hover 浮现/拖动 pin | ✅ | — | — | ✅（Esc 清场） | ✅ |
| 拖拽排序写回（同层/子树/undo） | ✅ | ✅ | ✅（跨父钳制） | ✅（窗外释放中止） | ✅ |
| 任务勾选写回（[ ]↔[x]） | ✅ | ✅ | ✅（源重建） | ✅（只读拦截零闪变） | ✅ |
| 单例灰显（canReorder 门） | ✅ | — | ✅ | — | ✅ |

覆盖率: 10/12 (83%)
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest 规划层/会话机单测 + CDP 实测存档，桌面适配口径）

## 证据来源存档

- 本轮重跑：`editor/listDrag.test.ts` 23/23（2026-10-03）
- CDP 存档（dev 阶段实测）：`IT-03-FE-06-self-test.md`（S1–S6 + AC 证据映射 + .md diff + PEND-15 差异声明）、`IT-03-FE-06-cdp-data.json`、`IT-03-FE-06-cdp-driver.mjs`、`IT-03-FE-06-run.log`（62/62）、截图 `IT-03-FE-06-impl.png`
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
