---
iteration: IT-04
task-id: DOCF-01
task-name: "文档对齐（前端变更）"
role: 前端
depends-on: "无"
acceptance-criteria: []
---

# DOCF-01 - 文档对齐（前端变更）

<!-- REQUIRED:对齐基线清单 -->
## 对齐基线

| 文档 | 路径 |
|------|------|
| PRD | docs/requirements/ui-ux-redesign/prd/PRD.md |
| AC | docs/requirements/ui-ux-redesign/ac.md |
| tech-design | process-docs/ui-ux-redesign/design/tech-design.md |

<!-- REQUIRED_END -->

<!-- REQUIRED:变更来源 -->
## 变更来源

- change-log: process-docs/ui-ux-redesign/design/change-log.md（开发期由 frontend 流程沉淀 pending 条目）
- 变更条目: 仅列 CHANGE-XXX 中关联任务为 FE 的条目（IT-01/IT-02/IT-03 全部 FE 任务，含 IT-04.FE-01 验收基线修订、IT-04.FE-02 全域对照走查）

<!-- REQUIRED_END -->

<!-- REQUIRED:对齐流程 -->
## 对齐流程

1. 加载 skill `doc-reconcile` 并严格遵循执行
2. 按 skill 流程执行：读取 change-log → 兜底检测 → 变更清单 → 人工审核 → 合并/驳回基线文档
3. 变更结果写回 change-log 状态（merged/rejected）

<!-- REQUIRED_END -->

> 对齐完成判据在 doc-reconcile skill Step 6 收尾（输出对齐报告），本模板不重复。
> DOC 任务创建即 done（存在性探针），不走 dev/selfTest 流程，无验收标准区块。
