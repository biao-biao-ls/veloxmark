---
iteration: IT-01
task-id: INFRA-01
task-name: "e2e 契约 delta 探针同步（data-table-handle 删4留1 登记与断言迁移）"
role: 基础设施
page: "全局域基建（e2e 契约面/探针断言）"
project-dir: "projects/typora/src/renderer"
depends-on: "FE-03（去增删把手与 data-op 契约迁移（删4留1/左侧留白清零/工具栏⋮挂 data-op））、FE-04（表格工具栏与⋮/右键同源菜单（五组分组/回显单源/禁用规则/键盘通道兜底））"
acceptance-criteria:
  - AC-RULE-17: 未验证
ui-designs:
  - "../../../../docs/requirements/ui-ux-redesign/ui/ui_02_table_edit.html"
tech-design-sections:
  - "tech-design.md#3-api-接口设计命令契约面"
  - "tech-design.md#83-组件结构"
api-docs:
  - "../../design/api/TBL-table-ops.md"
tech-design-section-hashes:
  "tech-design.md#3-api-接口设计命令契约面": "ContractSet 演进须登记：data-table-handle 删 4 留 1（ADR e2e-contract-delta.md），其余挂 data-op"
  "tech-design.md#83-组件结构": "e2e/seams + scripts/cdp-*.mjs 契约 delta 删4留1 探针同步"
skipped-gates: []
discovered-sections: []
discovered-dependencies: []
spawned-tasks: []
implementation-notes: "scripts/cdp-*.mjs 探针脚本不在本仓工作区（package.json test:smoke 引用 cdp-smoke.mjs，探针脚本随外部 e2e 环境提供）；本任务交付物为 e2e/seams 与 handles.d.ts 契约登记 + 探针断言变更清单，验收以 npm run test:smoke + 契约面断言测试为准。"
doc-drift: []
---

# INFRA-01 - e2e 契约 delta 探针同步（data-table-handle 删4留1 登记与断言迁移）

<!-- REQUIRED:任务目标 -->
## 任务目标

**UI 设计稿路径**：`../../../../docs/requirements/ui-ux-redesign/ui/ui_02_table_edit.html`（把手/工具栏契约面）

> 来源：[prd.md#61-表格交互](../../requirement/prd/PRD.md#61-表格交互) / [tech-design.md#3-api-接口设计命令契约面](../../design/tech-design.md#3-api-接口设计命令契约面)

按 ADR `e2e-contract-delta.md`（Q2 裁决：删 4 留 1）同步 e2e 契约面：`data-table-handle` 删除 `row-insert`/`row-delete`/`col-insert-left`/`col-delete` 四值断言、保留 `col-grip`；工具栏/⋮ 控件断言改挂统一 `data-op`（与 opsTable 19 项同源，id 字面量不变）；`window.__velox*` 系列、命令 id 字面量零改动。交付：e2e seams 契约登记（handles.d.ts/契约清单）、探针断言变更清单（cdp-p10/cdp-p27 契约扫描正则口径）、契约面断言测试同步，`npm run test:smoke` 全绿。契约演进有 ADR 登记，AC-RULE-17 按「登记的契约集演进」口径验收。

### 页面元素

| 区域 | 元素 | 类型 | 位置与尺寸 | 样式与文案 | 默认值/初始状态 | 状态变化 |
|------|------|------|-----------|-----------|---------------|---------|
| 契约面 | `data-table-handle` 属性集 | DOM 契约 | 表格把手/抓手 | — | 现状 5 值 | 收敛为 `{col-grip}`（删 4 留 1） |
| 契约面 | `data-op` 属性集 | DOM 契约 | 工具栏按钮/⋮ 菜单项 | 19 op id 字面量 | opsTable 既有集合 | 工具栏/⋮ 挂载同源 id，集合不变 |
| 契约面 | `window.__velox*` 缝 | JS 全局 | e2e/seams/* | handles.d.ts 类型 | 既有系列 | 零改动 |
| 契约清单 | e2e/seams 登记 | ContractDoc | `src/renderer/src/e2e/` | delta 清单 | 现状含 5 值把手 | 登记删4留1 演进（AC-RULE-17） |

### 交互操作

**1. 契约面 DOM 集合核对（删4留1）**
- 来源：[prd.md#61-表格交互](../../requirement/prd/PRD.md#61-表格交互) / [tech-design.md#3-api-接口设计命令契约面](../../design/tech-design.md#3-api-接口设计命令契约面)
- 触发：契约面断言测试 / cdp 探针扫描
- 前置条件：FE-03 把手移除已合入
- 操作：断言 DOM `data-table-handle` 值集合 = `{col-grip}`；`row-insert`/`row-delete`/`col-insert-left`/`col-delete` 断言从探针清单移除并登记于 delta 清单
- Loading 状态：无
- 期望效果：契约集合与 ADR 登记一致；旧 4 断言不再 fail（口径已迁移）
- 空态处理：无表格文档扫描集合为空，断言按空集通过

**2. data-op 断言上线（工具栏/⋮ 同源）**
- 来源：[prd.md#61-表格交互](../../requirement/prd/PRD.md#61-表格交互) / [tech-design.md#3-api-接口设计命令契约面](../../design/tech-design.md#3-api-接口设计命令契约面)
- 触发：cdp-p10/cdp-p27 契约扫描（探针正则扫描 data-op id）
- 前置条件：FE-04 工具栏/⋮ 挂 data-op
- 操作：探针断言工具栏 + ⋮ 扫描到的 data-op 集合与 opsTable 19 项一致；id 字面量零改动
- Loading 状态：无
- 期望效果：四面（快捷键/工具栏/⋮/右键）同 op id 可被探针断言；命令 id 与 `window.__velox*` 断言原样通过
- 空态处理：不适用

**3. seams/handles 契约登记**
- 来源：[prd.md#61-表格交互](../../requirement/prd/PRD.md#61-表格交互) / [tech-design.md#3-api-接口设计命令契约面](../../design/tech-design.md#3-api-接口设计命令契约面)
- 触发：契约演进登记流程（AC-RULE-17）
- 前置条件：ADR `e2e-contract-delta.md` 已锁定
- 操作：`src/renderer/src/e2e/` seams 契约清单与 `handles.d.ts` 同步删4留1；探针断言变更清单落文档（含旧断言→新断言迁移对照）；`npm run test:smoke` 验证
- Loading 状态：无
- 期望效果：契约演进可审计（ADR + 登记清单 + 断言三方一致）
- 空态处理：不适用

### 涉及文件

| 文件路径 | 修改内容简述 |
|----------|--------------|
| `src/renderer/src/e2e/handles.d.ts` 及 seams 契约清单 | `data-table-handle` 类型/登记删4留1；data-op 集合登记（19 项不变） |
| `src/renderer/src/e2e/`（seams/p12..p26 等既有缝） | 与把手相关的缝声明核对（`window.__velox*` 零改动，仅确认无旧把手依赖） |
| 契约面断言测试（widget/opsTable 同目录 `*.test.ts`） | DOM `data-table-handle` = `{col-grip}`、工具栏/⋮ data-op 集合 = opsTable 19 项 断言 |
| 契约 delta 登记文档（`design/adr/e2e-contract-delta.md` 附录口径） | 探针断言变更清单（旧 4 断言下线/新 data-op 断言上线对照表） |

<!-- REQUIRED_END -->

<!-- REQUIRED:关联接口 -->
## 调用接口

| 接口 | 文档路径 | 调用说明 |
|------|---------|---------|
| `data-table-handle` delta（删4留1） | [../../design/api/TBL-table-ops.md](../../design/api/TBL-table-ops.md) | 验证方式：契约面断言测试 + `npm run test:smoke`（cdp 探针扫描 DOM 属性集），输出集合 `{col-grip}` |
| `data-op` 契约面（19 op id） | [../../design/api/TBL-table-ops.md](../../design/api/TBL-table-ops.md) | 验证方式：探针正则扫描工具栏/⋮ 控件 id 集合与 opsTable 一致；id 字面量零改动 |
| `window.__velox*` e2e 缝 | [../../design/api/TBL-table-ops.md](../../design/api/TBL-table-ops.md) | 验证方式：`npm run test:smoke` 既有断言原样通过（零改动契约不破坏） |

<!-- REQUIRED_END -->

<!-- REQUIRED:验收标准 -->
## 验收标准

每条标准必须是 Agent 可通过命令自动判定通过/失败的。按阶段组织，前一阶段全部通过后才可进入下一阶段。

### 阶段 1：开发验收

- [ ] `npm run typecheck` 输出 0 Error
- [ ] `npm run test:unit` 中契约面断言用例全部通过（`{col-grip}` 集合 / data-op 19 项集合）
- [ ] grep 断言：`src/renderer/src/e2e/` 内不存在 `row-insert`/`row-delete`/`col-insert-left`/`col-delete` 契约登记，存在 `col-grip`

### 阶段 2：自测验收

- [ ] 契约断言：DOM `data-table-handle` 值集合 = `{col-grip}`（空文档空集亦通过）
- [ ] 契约断言：工具栏 + ⋮ data-op 扫描集合与 opsTable 19 个 op id 逐项一致
- [ ] 契约断言：`window.__velox*` 系列与命令 id 字面量断言全部通过（零改动）
- [ ] 自测报告含探针断言变更清单（旧 4 断言下线 / 新 data-op 断言上线对照表）

### 阶段 3：联调验收

- [ ] 与 FE-03/FE-04 联调：把手移除与工具栏 data-op 挂载合入后全量契约断言通过
- [ ] `npm run test:smoke`（cdp 冒烟）通过，无旧把手断言 fail
- [ ] ADR `e2e-contract-delta.md` 登记清单与实现/断言三方一致

### 阶段 4：QA 验收

- [ ] 对照 `ui_02_table_edit.html` 契约面标注（零把手带/col-grip 保留/工具栏 data-op）走查
- [ ] AC-RULE-17（契约集演进已登记口径）人工核验通过，acceptance-criteria 勾为已验证

<!-- REQUIRED_END -->
