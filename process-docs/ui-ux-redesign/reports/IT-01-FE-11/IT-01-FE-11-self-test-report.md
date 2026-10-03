# IT-01-FE-11 自测报告 — 冻结文案 i18n 双字典与样式 token 基座（Phase 2 selfTest 复核）

- **任务ID**: IT-01/FE-11（冻结文案 i18n 双字典与样式 token 基座：toast/确认文案 key 双写对齐/新浮层 token）
- **测试时间**: 2026-10-03 10:45–11:10（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段自测存档（key 差集/逐字 grep/证明页双主题截图 `IT-01-FE-11-self-test.md` + `IT-01-FE-11-proof.html`）。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；本任务为字典/token 基座（消费方 FE-02/04/05/07/08/10），验证面 = 冻结串逐字断言 + 双字典 key 对齐 + token 宪法断言 + 只读闸门消费方单测复核。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-01/FE-11.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-FN-28 | 新增 UI 文案 en↔zh 切换全部对应语言文本、无原始 key 裸露；en.ts 与 zh.ts key 集合完全一致；原生菜单/callout 标题同步 | ✅ 通过 | ① 双字典对齐单测本轮重跑 `i18n/i18n.test.ts` **14/14**：`EN and ZH define the same key set`/`no duplicate key literals`/`placeholders agree per key`/`every static t('…') key resolves against EN` + callout.* 全类型 + 原生菜单第三字典对齐 + render.* 族非回归 ✓；② 冻结族单测 `i18n/frozenCopy.test.ts` **7/7**（zh 逐字存在 + EN 非空无 key 裸露 + `t() renders frozen strings in zh without key leakage`）✓；③ dev 存档 key 差集 507=507 空差集 + 16/16 冻结串 grep 逐字命中 zh.ts + 证明页双主题截图；④ 原生菜单/callout/确认框 live-relabel（CHANGE-24A）business-history PATH-08 verdict=fixed（CDP zh→en→zh 即时换字实证） |
| AC-ERR-15 | autosave 失败：不静默丢稿、提示「自动保存失败，文档可另存副本」、另存副本后可继续 | ✅ 通过（本任务切片：文案族冻结进双字典） | ① 冻结串 `err.autosaveFailed` = 「自动保存失败，文档可另存副本」zh/en 双字典逐字断言 ✓（frozenCopy 逐字 + EN 非空）；② 不静默丢稿/另存副本行为归 useAutoSave/useDocIo 消费面（内存保留 + sticky 失败通道，App.tsx wave③ 失败通道注册）；③ **边界在案**：现行 useAutoSave 通路仍消费保留旧键 `toast.autoSaveFailed*`（「自动保存失败（{reason}）」，含 reason 插值），冻结串切换/旧键废弃为实施注 ③ 注册的接线遗留（切片任务契约 = 文案族落双字典 + 断言就位，runtime 接线归后续消费面） |
| AC-RULE-16 | 只读拦截冻结文案固定为「文件为只读，无法修改，可另存后编辑」；样式深浅主题仅 token 翻值、零选择器级补丁 | ✅ 通过 | ① 冻结串 `err.readonly` 逐字断言 ✓；② token 宪法单测 `styles/tokens.test.ts` 本轮重跑 **9/9**（FE-11 基座 5：`theme blocks flip exactly the same token set (AC-RULE-16: 仅翻值)`/theme-split 双侧声明/几何单点 `:root`/`zero new selector-level .theme-* patches (AC-RULE-16)`/裸值影子扫描）+ r2 var() 链 2 + FE-01 bare-px 2 非回归 ✓；③ token 落地：themes.css 翻值 6（`--toast-bg/fg/border`/`--accent-soft-strong`/`--shadow-menu`/`--danger-soft`）+ tokens.css 几何 2（`--grid-cell-size/gap`），dev 证明页 computed style 双主题翻值实测（impl.png） |
| AC-ERR-08 | 只读时编辑/结构操作全部拦截、零写入零半提交、固定提示、另存副本可写 | ✅ 通过 | ① 只读闸门消费方单测本轮重跑 **30/30**：`opsTable.gate.test.ts` 11（`runStructOp 只读闸门 > 只读：runOp 零调用、无成功回执、回冻结 err.readonly`/confirmDeleteTable 只读闸门/formatTableSource/剪贴板族 cut-paste 拦 copy 放）+ `table/commands.test.ts` 19（`P1 runTableOp 只读闸门` 文档逐字节不变/工具栏同形双拦/handTsvPaste 零写入/fail-open 不锁死）✓；② 消费面全覆盖：opsTable.ts/table/commands.ts/image-widget.ts/readOnlyGuard.ts 均取 `err.readonly` 冻结串；③ 另存副本可写 → 可写探针放行路径同链（`可写：op 落盘 + 成功回执携「撤销」`/Untitled 同 assertWritable 语义） |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| 冻结文案族全量（逐字/EN 无裸 key/undo 后缀/插值位/取消复用） | ✅ 7/7 | `npx vitest run src/renderer/src/i18n/frozenCopy.test.ts` | 2026-10-03 10:45 重跑 |
| token 宪法（仅翻值/双侧声明/单点 :root/零 .theme-* 补丁/裸值扫描） | ✅ 9/9 | `npx vitest run src/renderer/src/styles/tokens.test.ts` | FE-11 基座 5 + r2 链 2 + FE-01 2 |
| 双字典 key 对齐（集合一致/无重复/插值一致/t() 全解析/菜单/callout） | ✅ 14/14 | `npx vitest run src/renderer/src/i18n/i18n.test.ts` | AC-FN-28 判据 2 |
| 只读闸门消费方（opsTable/表格命令/剪贴板族） | ✅ 30/30 | `npx vitest run src/renderer/src/editor/contextMenu/opsTable.gate.test.ts src/renderer/src/editor/table/commands.test.ts` | AC-ERR-08/AC-RULE-16 行为面 |
| 证明页双主题 computed 翻值核对 | ✅（存档） | `IT-01-FE-11-self-test.md` §4 + `IT-01-FE-11-impl.png` | dev 存档 |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（历史移交已闭环：PATH-08 确认框不随 locale（预烘焙串）→ confirmDeleteTable/Dialog 改 key-based live-relabel（CHANGE-24A）verdict=fixed。在案非缺陷边界：① `toast.autoSaveFailed*` 旧键保留为 useAutoSave 现行通路，`err.autosaveFailed` 冻结串切换/旧键废弃为实施注 ③ 注册的接线遗留；② 主题色 4 副本本任务零改动（仅新增 token 未改色）。）

## 结论

**通过**。AC-FN-28 / AC-ERR-15 / AC-RULE-16 / AC-ERR-08 四条全过（AC-ERR-15 为本任务切片口径：文案族冻结 + 断言就位，runtime 接线遗留在案）。本轮 frozenCopy 7/7 + tokens 9/9 + i18n 14/14 + 只读闸门 30/30 全绿（合计 60/60），dev 存档证据在场（key 差集 507=507、16/16 冻结串逐字、证明页双主题翻值），零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 冻结文案 key 化与双字典对齐 | ✅ | — | ✅ | ✅（无 key 裸露） | ✅ |
| 样式 token 基座（仅翻值/零补丁） | ✅ | — | ✅ | — | ✅ |
| 只读拦截（结构操作/粘贴/cut 全拦） | — | ✅ | ✅ | ✅（冻结 err.readonly） | ✅ |
| autosave 失败文案族 | — | — | ✅ | ✅（冻结串就位） | ✅（接线遗留在案） |

覆盖率: 9/12 (75%)
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest 冻结串/字典对齐/token 宪法/只读闸门单测 + 证明页 computed 实测存档，桌面适配口径）

## 证据来源存档

- 本轮重跑：`i18n/frozenCopy.test.ts` 7/7、`styles/tokens.test.ts` 9/9、`i18n/i18n.test.ts` 14/14、`editor/contextMenu/opsTable.gate.test.ts` + `editor/table/commands.test.ts` 30/30（2026-10-03）
- dev 存档：`IT-01-FE-11-self-test.md`（交付物/key 差集/逐字断言表/token 清单/门禁）、`IT-01-FE-11-proof.html`（gen-proof.mjs 从真实字典生成）、`IT-01-FE-11-impl.png`（双主题 computed 翻值）
- 登记面：business-history PATH-08 verdict=fixed（CHANGE-24A live-relabel）
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
