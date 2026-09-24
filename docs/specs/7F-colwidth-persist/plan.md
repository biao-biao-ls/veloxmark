# 7F 实施方案

## 技术决策与理由

- **存储 = `SessionState.tableColWidths: Record<string, Record<string, number[]>>`**（外键文件路径、内键 `String(tableFrom)`）：与 `headingFolds` 逐字段同构（spec 决策记录）。内键取 `tableFrom` 偏移与内存 `Map<number, number[]>` 同构——键身份脆弱度与 `headingFolds` 的 `level:text` 键同级（内容变了键失效→消费口容错），先例可接受；不发明内容哈希身份（过度设计，AC2 未要求）。
- **写口 = 新 hook `hooks/useTableWidthSync.ts`，照 `useFoldSync` 镜像**：`syncColWidths()` signature-gated（宽度 Map 序列化签名去重，防拖拽高频刷 localStorage）；`suppressDirtyRef` 门（文件加载期 doc 整替会 mapPos 扰动映射，跳过写——useFoldSync 同因注释）；路径取 `filePathRef`，null 不写（AC4）。App 接线点 = `syncFoldedKeysRef.current()` 的 4 处同位旁注（事务收敛点，拖宽的 `setColWidth` 事务即触发）。
- **读口 = `restoreColWidths` 全量替换 StateEffect**（`state.ts`）：文件打开/切换时把该路径的记忆灌入并**整体替换**内存 Map——天然清掉上一文件 mapPos 残留（AC5）。语义对齐 `restoreFolds`（"Replace the whole folded set"）；save-as/改名时路径变而文档未替 → 现状宽度被空记忆替换（folds 同款弱点，**已知局限记录**，不在 AC 内）。
- **清洗 = `normalizeColWidths(raw: unknown)` 纯函数**（`preferences/store.ts` 导出，session 初始化器复用）：`Record<path, Record<tableFrom, number[]>>` 逐层 typeof 收窄；宽度值保留 `Number.isFinite(w) && w > 0`，`Math.max(40, Math.round(w))`（与拖拽下限 `Math.max(40, …)` 同界）；无上限（与拖拽同则）。配 `preferences/store.test.ts` 单测（新文件；store.ts 无 DOM 依赖可直接 import——applyPreferencesCssVars 的 P15 guard 既有）。
- **消费口容错 = 既有实现已达标，零改动**：`TableWidget.toDOM` colgroup 装配按 `model.colCount` 循环取 `colWidths?.[c]`（缺省不设宽、多余忽略）——AC2 列数不符退化天然成立；非法数值已被 normalize 挡在存储边界。
- **`preferences/store` 不 import `editor/*`**（normalize 留 store 侧）；hook 单向依赖 store + table/state + seams 类型——madge 0 环保持。
- **i18n 零新 key；e2e 零字面量**（不扩 `__veloxP18` 缝——无探针依赖）。

## 文件切法

| 源 | 改动 |
|---|---|
| `preferences/store.ts` | `SessionState.tableColWidths` + DEFAULT `{}` + 导出 `normalizeColWidths` + session 初始化器接线 |
| `preferences/store.test.ts` | **新建**：`normalizeColWidths` 单测（形状收窄/非法值清洗/40 下限/嵌套容错） |
| `editor/table/state.ts` | `restoreColWidths = StateEffect.define<Map<number, number[]>>()` + update 分支全量替换 |
| `hooks/useTableWidthSync.ts` | **新建**：`syncColWidthsRef` + `restoreColWidthsForRef`（useFoldSync 镜像：签名门 + suppressDirty 门 + [filePath] 恢复 effect） |
| `App.tsx` | `useTableWidthSync` 装配（viewRef/filePathRef/suppressDirtyRef/filePath 同 useFoldSync 入参）+ `syncFoldedKeysRef` 4 处调用点旁注 `syncColWidthsRef.current()` |

## 状态/契约归属

唯一真源 = `SessionState.tableColWidths`（localStorage）；内存投影 = `tableEditField.colWidths`（既有）。恢复 = effect 全量替换；写回 = sync 钩子。e2e 契约零改动。

## import 改动面

`hooks/useTableWidthSync` → `preferences/store` + `editor/table/state` + `e2e/seams/types`（useFoldSync 既有面）；`App` → 新 hook；`store` 零新 import。`npx madge --circular --extensions ts,tsx` 守护 0 cycles。

## 任务拆分

1. store 字段 + `normalizeColWidths` + 单测 [先行]
2. `state.ts` `restoreColWidths` effect [依赖 1 的类型面]
3. `useTableWidthSync` hook + App 接线 [依赖 1、2]
4. 收敛

## 验证方案

- `npm run typecheck && npm run test:unit`（normalize 单测全绿）
- `npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles
- e2e 缝：diff 零既有字面量改动
- 人工冒烟（**待运行时冒烟补签**）：
  1. 拖列宽 → 关闭文件 → 重开：宽度保持（多表各保持）
  2. 拖列宽 → 重启应用 → 重开：宽度保持（跨会话 AC1）
  3. 持久化宽度后增删列：旧宽度不越界（缺列默认/多余忽略），不畸形
  4. 标签 A↔B 切换：各回各的记忆，互不串扰（AC5）
  5. Untitled 拖宽：不写存储；保存为文件后行为符合「已知局限」记录
  6. 全程 `.md` 磁盘内容零变化（AC3）

## 实现细化（2026-09-25 implement 时决策）

- **写口收敛点精化（偏离 plan「4 处旁注」）**：改 `setup.ts` updateListener **单点**——新增 `EditorCallbacks.onColWidthsChanged` 缝（`onFoldChanged` 同款可选回调），双探触发：transactions 含 `setColWidth`/`restoreColWidths` effects **或** `getTableEdit(...).colWidths` Map 身份翻转（mapPos 重映射必新建 Map）。理由：col-grip 的 `view.dispatch({ effects })` 是纯 effects 事务，触不到 onChange/onSelectionChanged 任何既有收敛点；身份探针统一覆盖拖宽、恢复、偏移漂移三源。
- **写去抖 500ms + 签名门**：偏移键 map 在表格上方打字时每击键 mapPos 换新 Map——签名（排序键序列化）挡内容不变的空转，去抖合并连续变化（App `lastCursor` 500ms 节流同款）。恢复 effect 先 `clearTimeout` + 重置签名（防旧写毒化新文件条目）。
- **normalize 位置保持语义（精化 plan 的 filter 方案）**：非法槽位折叠为 0（消费口 `w > 0` 默认宽哨兵），**绝不删槽**——filter 会把后续列宽左移错位；合法值 `Math.max(40, Math.round(w))`（拖拽下限 40px 同界，无上限同拖拽）；全非法表/空表丢弃；空路径键丢弃（AC4 读侧防御）。
- **restore 保持 hook 私有**（不暴露 `restoreColWidthsForRef`）：无 P18 式外部缝消费者（YAGNI）；`[filePath]` effect 内自调。
- **消费口零改动**：`TableWidget` colgroup 按 `model.colCount` 循环取 `colWidths?.[c]`（缺省不设宽、多余忽略）——AC2 列数不符退化天然成立，非法值已被 normalize 挡在存储边界。
- **已知局限（计划外补充一条）**：同路径 revert（重载同文件）`[filePath]` 不变 → 不重灌记忆，mapPos 残留靠后续手动恢复；与 save-as/改名弱化一并记档。

## 收敛记录（2026-09-25）

- `npm run typecheck` 双 tsconfig 全过 ✓
- `npm run test:unit`：35 文件 / 337 例全绿（332 → 337，+5 `normalizeColWidths`）✓
- `npx madge --circular --extensions ts,tsx src/renderer/src`：✔ No circular dependency found（store 零 editor import；hook 单向）✓
- e2e 缝：diff 零既有字面量改动（`__velox*`/`data-op`/DOM 探针类名不触碰）✓
- AC1–5 逻辑路径核对全通（AC2 双保险：normalize 边界 + 消费口容错）；待运行时冒烟补签（6 点）：
  1. 拖列宽 → 关闭文件 → 重开：宽度保持（多表各保持）
  2. 拖列宽 → 重启应用 → 重开：宽度保持（跨会话 AC1）
  3. 持久化宽度后增删列：旧宽度不越界（缺列默认/多余忽略），不畸形
  4. 标签 A↔B 切换：各回各的记忆，互不串扰（AC5）
  5. Untitled 拖宽：不写存储；保存为文件后行为符合「已知局限」记录
  6. 全程 `.md` 磁盘内容零变化（AC3）
