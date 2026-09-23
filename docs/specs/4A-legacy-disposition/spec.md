# 4.1 遗留记录三项处置

## What / Why

对「遗留记录」三项（评估期登记、未列入手术项）给出明确决议，转正为知情记录并勾销——避免开放项无限悬挂，收尾阶段的看板只留真实待办。

## 决议（AC）

| 项 | 决议 | 理由 |
|---|---|---|
| `preferences/store.ts` 暂不拆 + 31 字段 schema 化 / `sanitizeSession()` 对齐 | **保持不拆；schema 化登记为远期备选**（不进本清单） | 418 行分节清楚，拆分收益低于风险；schema 化是增强非债务 |
| 组件层轻度「直达编辑器」导入（`Outline.foldKey` / `TableInsertDialog.sniffDelimiter`） | **接受现状，不收紧** | 两处均为纯工具直引，经 App 传参反而加 props 面；星型分发纪律的核心（组件互引/深层状态）未破坏 |
| `applyPreferencesCssVars()` 双通道（runtime inline 覆盖 4 个 token） | **知情保留**，`:root` 唯一声明点规则的豁免点名维持 | 偏好滑杆（编辑器最大宽度等）必须 runtime 写入；静态声明 + 运行时覆盖是设计而非事故 |

## 约束

- 仅文档决议，零代码改动；三项在遗留记录段就地勾销并标注决议。
