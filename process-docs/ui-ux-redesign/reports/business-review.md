# 业务流评审报告 — ui-ux-redesign 后端迭代（Phase 1 Step 4 右轨）

**评审时间：** 2026-09-29
**评审范围：** 后端迭代（BE-01/BE-02 已实现）；e2e-paths 共 26 条，其中仅 IT-02/PATH-01 步骤显式涉及 BE 任务，本轮评审该路径（BE 范围）。其余 25 条路径为 FE 范围，FE 任务未开发属预期，留待 `/zcode:frontend` 右轨评审，不计入未对齐点。
**基线：** design/tech-design.md · design/ac.md（requirement/ac.md）· design/change-log.md

## 评审路径

| 路径 | 名称 | 类型 | 结果 |
|---|---|---|---|
| IT-02/PATH-01 | 菜单快捷键发现与执行 | happy | 1 个未对齐点（P2）→ 已修复 → 重审「无未对齐点」 |

## 未对齐点清单（首轮）

- 路径: PATH-01
- 任务: BE-02
- 严重度: P2
- 期望: BE-02 核心流程 1「差异处保留并在附录 A 登记理由」；implementation-notes 称历史组（undo/redo）/折叠组（foldAll/unfoldAll）空组省略已「按 menu-tree 附录 A 登记为原生差异」
- 实际: menu-tree 附录 A 为「只读现状对照」，无历史/折叠组省略的差异登记行；该决策仅存在于实现侧自登记（darwin.ts 注释、darwinMenu.test.ts、implementation-notes），change-log 亦无对应条目。行为受 AC-FN-09 冻结 id 集合（35 项）约束属合理取舍，但「已登记」声明与载体不符
- 建议: 将「原生菜单空组不渲染分组头、冻结 id 集不含 undo/redo/foldAll/unfoldAll」补入登记载体，使声明与载体一致

## 修复闭环

- 修复动作: design/change-log.md 新增 **CHANGE-4 原生菜单空组省略登记**（状态 pending）；BE-02.md implementation-notes 表述同步为「已登记于 design/change-log.md CHANGE-4」
- 重审结果: **无未对齐点**（定向重审仅覆盖修复点，修复成立且无新偏离）
- business-history: 已写入 tasks/IT-02/BE-02.md frontmatter（pathId=PATH-01, severity=P2, verdict=fixed）

## 降级标注

无降级（IT-02 e2e-paths 存在且非空）。IT-01/IT-03/IT-04 路径本轮未评（FE 范围），非降级模式，留待前端迭代右轨。
