# 2C 拆 registry.ts（532 行 → 4 模块）

## What / Why

`editor/contextMenu/registry.ts` 532 行混四件事：runtime/store 单例、delta 注册表、菜单骨架装配、表格 delta 自举（+编辑器面入口）。按职责切四模块，registry.ts 收为 re-export barrel + `handleEditorContextMenu` 入口。以机械搬运为主，与 1D 同纹理。

## 验收标准（AC）

1. 四模块落位，**原样平移**（含注释与侧效块）：
   ```
   editor/contextMenu/
     ctxMenuStore.ts    L37–81   runtime 单例（setCtxRuntime/getCtxRuntime）+ menuState/listeners + 焦点归还策略（FOCUS_RETURN_SEL、closeContextMenu 的 focus 合同）
     deltaRegistry.ts   L83–99   CtxOpFactory + blockDeltas + registerContextMenuOps + __veloxCtxDebug e2e 缝（模块级副作用原位平移）
     menuSkeleton.ts    L101–310 sep/cmdItem/paragraphSubmenu/formatSubmenu/insertSubmenu/copyAsSubmenu/linkDelta + buildContextMenu + __veloxCtxLastHit 缝
     opsTable.ts        L312–512 TableDeltaDeps + tableDeltaItems + 9 个 op 适配器 + registerContextMenuOps('table-cell') 自举（模块级副作用）；UX-P28 B3 的 setActiveCell 语义注释随之迁移
   ```
2. `registry.ts` 收为 re-export barrel + `handleEditorContextMenu` 入口（L514–532 平移）；**8 个消费方 import 零改动**（App/setup/widgets/table.widget/widgetEntry/opsBlocks/EditorContextMenu×1 组）
3. e2e 契约不变：`__veloxCtxDebug`（deltaKinds/deltaCount）、`__veloxCtxLastHit`（kind/pos/deltaCount）形状不变；`data-op` id、菜单项 id 字面量（`insertRowAbove`/`cutCell`/`heading${n}` 等）不变
4. 行为不变：`npm run typecheck && npm run test:unit` 全绿；`npx madge --circular src/renderer/src` **0 cycles**（拆前拆后各跑一次）

## 不做

- **2.17 opsBlocks 整理**（低优先）：blockHelpers 抽取 / dispatch 约定去重 / transforms 表格段迁移——另立单元
- 菜单项结构优化、helper 导出面调整（sep/cmdItem 等保持模块私有）
- registry API 形状变化（`TableDeltaDeps`/`tableDeltaItems` 虽无外部消费者，保持导出不动）

## 方案（Plan）

- **纯平移为主**，唯一微调：`buildContextMenu` 内 `const rt = runtime` → `const rt = getCtxRuntime()`（`runtime` 私有随迁 ctxMenuStore；行为等价，与 1A 的 deps 传参同理）
- `blockDeltas` 以 `export const` 导出（deltaRegistry 内）：menuSkeleton 的 buildContextMenu/`__veloxCtxLastHit` 缝与 deltaRegistry 自身的 `__veloxCtxDebug` 缝消费；**barrel 不再导出**（模块间细节）
- **侧效时序保持**：`__veloxCtxDebug` 赋值（deltaRegistry 加载时）与 `registerContextMenuOps('table-cell')`（opsTable 加载时）都经 registry barrel 的 re-export 链触发——与现状「registry 首次 import 即注册」同点
- 依赖方向（无环）：ctxMenuStore → types；deltaRegistry → types；menuSkeleton → ctxMenuStore/deltaRegistry/transforms/i18n；opsTable → deltaRegistry/transforms/table.* /i18n；registry → 全部 + detect

## 任务拆分

1. ctxMenuStore.ts + deltaRegistry.ts（互不依赖，先行）
2. menuSkeleton.ts（依赖 1）
3. opsTable.ts（依赖 1，含表格 delta 自举侧效）
4. registry.ts 收口 barrel + 入口；converge（typecheck + unit + madge 0 cycles + 行数记录）
