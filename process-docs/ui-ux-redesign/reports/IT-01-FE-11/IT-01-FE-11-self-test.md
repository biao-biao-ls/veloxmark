# IT-01 FE-11 自测报告 — 冻结文案 i18n 双字典与样式 token 基座

- 任务：IT-01/FE-11（冻结文案 i18n 双字典与样式 token 基座）
- 工作目录：`D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`
- 日期：2026-09-29
- 实现图：`IT-01-FE-11-impl.png`（双主题并排：冻结文案表 + toast/菜单/网格/确认 token 色板，全部活体取自 tokens.css+themes.css）；证明源 `IT-01-FE-11-proof.html`（`gen-proof.mjs` 从真实字典生成，防漂移）

## 1. 交付物

| 文件 | 变更 |
|---|---|
| `src/renderer/src/i18n/zh.ts` | 冻结回执族 19 key（3 改写 + 16 新增）+ 确认族 2 key（1 改写 + 1 新增）+ 异常族 2 key 新增 |
| `src/renderer/src/i18n/en.ts` | 同 key 英文对照，集合与 zh 全对齐 |
| `src/renderer/src/styles/tokens.css` | `:root` 新增网格几何 token：`--grid-cell-size: 22px`、`--grid-cell-gap: 2px` |
| `src/renderer/src/styles/themes.css` | `.theme-light`/`.theme-dark` 各新增 6 个翻值 token：`--toast-bg/fg/border`、`--accent-soft-strong`、`--shadow-menu`、`--danger-soft` |
| `src/renderer/src/i18n/frozenCopy.test.ts`（新增） | 冻结中文串逐字断言 + undo 后缀 + 插值位 + 双语非空 |
| `src/renderer/src/styles/tokens.test.ts`（新增） | token 宪法：theme 块 key 对称、单一声明点、零新增 `.theme-*` 选择器补丁、裸值/影子声明扫描 |

## 2. key 对齐差集结果（AC-FN-28）

- EN keys = **507**，ZH keys = **507**（含本任务新增 20 组）
- missingInZh = `[]`，missingInEn = `[]`（差集为空）
- 插值位跨语言一致（既有 i18n.test.ts 全量守护，425 用例全绿）
- 占位符冻结位：`toast.rowDeleted`={i}、`toast.colDeleted`/`toast.colAlign*`={j}、`toast.tableResized`={R}×{C}

## 3. 冻结文案逐字断言（AC-FN-28 / 阶段 1 grep）

zh.ts 全部逐字存在（grep -F 计数=1）：

| key | zh 冻结串 | 来源 |
|---|---|---|
| `toast.rowInsertedAbove` | 已在上方插入行（Ctrl+Z 可撤销） | AC-OP-02 |
| `toast.rowInsertedBelow` | 已在下方插入行（Ctrl+Z 可撤销） | AC-OP-01 |
| `toast.rowDeleted` | 已删除第 {i} 行（Ctrl+Z 可撤销） | AC-OP-10 |
| `toast.colInsertedLeft` | 已在左侧插入列（Ctrl+Z 可撤销） | AC-OP-04 |
| `toast.colInsertedRight` | 已在右侧插入列（Ctrl+Z 可撤销） | AC-OP-03 |
| `toast.colDeleted` | 已删除第 {j} 列（Ctrl+Z 可撤销） | AC-OP-10 |
| `toast.rowMovedUp/Down` | 已上移该行/已下移该行（Ctrl+Z 可撤销） | AC-OP-05 |
| `toast.colMovedLeft/Right` | 已左移该列/已右移该列（Ctrl+Z 可撤销） | AC-OP-06 |
| `toast.colAlignLeft/Center/Right` | 第 {j} 列对齐：左对齐/居中/右对齐（Ctrl+Z 可撤销） | AC-OP-08 |
| `toast.tableResized` | 表格缩放为 {R}×{C}（Ctrl+Z 可撤销） | AC-OP-07 |
| `toast.tableDeleted` | 已删除表格（Ctrl+Z 可撤销） | AC-OP-09 |
| `toast.undone` | 已撤销 | AC-OP-12 / AC-ERR-04 |
| `toast.undoBtn` | 撤销 | GLB §3.7（PEND-05） |
| `ctx.deleteTableConfirm` | 删除后可用一步撤销还原，确认删除该表格 | AC-RULE-15（改写自旧「确定删除该表格？此操作无法撤销。」） |
| `ctx.deleteTableConfirmOk` | 确认删除 | AC-OP-09 按钮（取消复用 `dialog.cancel`「取消」） |
| `err.readonly` | 文件为只读，无法修改，可另存后编辑 | AC-RULE-16 / AC-ERR-08 |
| `err.autosaveFailed` | 自动保存失败，文档可另存副本 | AC-ERR-15 |

另锁定既有键（TBL §3.1 #16/#17）：`toast.copiedTable`「表格已复制」、`toast.tableFormatted`「表格源码已格式化」、`toast.tableUnchanged`「表格无需格式化」。

字面量落盘（不用 UNDO_SUFFIX 常量拼接）：阶段 1 的 zh.ts 逐字 grep 断言依赖源文件含完整冻结串。

## 4. token 清单（AC-RULE-16）

| token | 声明点 | theme-light | theme-dark | 用途 / 来源 |
|---|---|---|---|---|
| `--toast-bg` | themes.css 翻值 | `#1f2328` | `#0d1117` | toast 深底面（ui_07 toast 规范，tooltip 同族语义拆分） |
| `--toast-fg` | themes.css 翻值 | `#e6edf3` | `#e6edf3` | toast 文字 |
| `--toast-border` | themes.css 翻值 | `#30363d` | `#30363d` | toast 边框 |
| `--accent-soft-strong` | themes.css 翻值 | `rgba(9, 105, 218, 0.22)` | `rgba(88, 166, 255, 0.26)` | ⊞ 网格选中格填充（ui_02） |
| `--shadow-menu` | themes.css 翻值 | `0 6px 24px rgba(0,0,0,0.12)` | `0 6px 24px rgba(0,0,0,0.45)` | ⋮/右键菜单投影（ui_03，alpha 随主题翻） |
| `--danger-soft` | themes.css 翻值 | `rgba(209, 36, 47, 0.08)` | `rgba(248, 81, 73, 0.1)` | danger 菜单项 hover 填充（ui_03；dark 按 --accent-soft alpha 步长派生） |
| `--grid-cell-size` | tokens.css `:root` | `22px` | （不翻值） | 网格单元格边长（ui_02，几何收口） |
| `--grid-cell-gap` | tokens.css `:root` | `2px` | （不翻值） | 网格单元格间隙 |

复用未新增：间距 `--space-*`、圆角 `--radius-*`、`--shadow-pop`/`--shadow-modal`、`--fg-disabled`/`--danger`/`--on-accent`、`--accent`（撤销按钮/危险按钮）——确认框与 toast 按钮全部走既有 token，无裸值。

**翻值实测**（agent-browser computed style，`IT-01-FE-11-impl.png` 底部同步展示）：两主题 6 个翻值 token 全部按表取值，2 个几何 token 恒定。

**宪法断言**（tokens.test.ts 5 用例）：theme 块 key 集合对称（仅翻值）、新 token 单一声明点、零新增 `.theme-*` 选择器补丁（既有债 allowlist：themes/buttons/markdown/overlays）、overlay 词汇无影子声明。

## 5. 验证结果

| 门禁 | 结果 |
|---|---|
| `npm run typecheck` | 0 Error（双 tsconfig） |
| `npm run test:unit` | **425/425 通过**（42 文件，含本任务新增 12 用例：frozenCopy 7 + tokens 5） |
| `npm run build` | ✓ built in 24.20s |
| lint | 无 lint script（项目未配置） |
| 阶段 1 grep 冻结串 | 16/16 逐字命中 zh.ts |
| 浏览器自检 | 证明页双主题截图 + computed token 翻值核对通过（`IT-01-FE-11-impl.png`） |

## 6. 遗留 / 边界（不在本任务范围）

1. **`toast.autoSaveFailed*` 旧键保留**（「自动保存失败（{reason}）」现行 useAutoSave 通路在用）；AC-ERR-15 冻结文案落 `err.autosaveFailed`，待 FE-07/08 接线时统一切换并废弃旧键。
2. 阶段 2「中英切换 toast/确认框渲染冒烟」与阶段 3/4 联调走查需 FE-07/08 组件落地后执行——本任务为字典/token 基座（消费方：FE-02/04/05/07/08/10），当前无 toast/确认框 UI 可冒烟；文案渲染正确性由 frozenCopy 单测 + 证明页截图承载。
3. 主题色 4 处副本（exportCss/palette/hljsTokens/styles）本任务零改动（仅新增 token，未改色）。
