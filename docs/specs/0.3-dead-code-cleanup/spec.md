# 0.3 清理疑似死代码

## What / Why

架构评估发现 4 处零引用/半死出口，误导后来者（如以为 barrel 是官方入口、以为 `commitActiveCell` 是 lifecycle API）。删除死出口、收窄过度导出，让模块 API 面与真实消费一致。

## 背景与现状（已 Grep 复核，2026-09-22）

| 目标 | 位置 | 现状 |
|---|---|---|
| `commitActiveCell` | `editor/table/widget.ts:405` | `export` 包装函数，全仓零引用（内部用的是 `commitActiveOnly`） |
| `clearMermaidLastGood` | `editor/widgets.ts:269` | `export` 函数，全仓零引用（注释称 test/theme hook 用，实际未接线） |
| `resolveTableModel` | `editor/table/widget.ts:59` | `export` 但仅文件内使用（L94/97/229 + testHook L1087） |
| `table/index.ts` | `editor/table/` | barrel 全仓零 import（消费方直连 `table/widget`、`table/state` 等） |

## 验收标准（AC）

1. 删除 `commitActiveCell`（函数 + 若其注释块独立成段一并清理）
2. 删除 `clearMermaidLastGood`（连同其注释；`rememberMermaidGood`/`mermaidLastGood` 状态本身保留——被 `MermaidWidget` 使用）
3. `resolveTableModel` 收为模块内部（去掉 `export` 关键字，函数体不动）
4. 删除 `editor/table/index.ts`
5. `npm run typecheck && npm run test:unit` 全绿（类型系统是本次删除的安全网：若有隐藏引用，编译期即暴露）
6. 行为不变：不触碰 testHook 契约（`window.__veloxTable` 的 `resolve`/`commit` 等方法照常工作，内部实现路径不变）

## 约束

- 只删已复核的 4 项，不做其他「顺手清理」（评估中提及的其他候选不在本单范围）
- 不改 `tableTestHook` 结构

## 方案（轻）

- 3 处编辑 + 1 处删文件；无 import 改动面（零引用即证明）；typecheck 兜底
