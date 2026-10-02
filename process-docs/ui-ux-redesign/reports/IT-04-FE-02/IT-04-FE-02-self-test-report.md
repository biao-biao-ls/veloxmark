# IT-04-FE-02 自测报告 — 全域对照走查与收尾核验（NF/OP/ERR/ELEM/RULE 专项）

- 任务：`process-docs/ui-ux-redesign/tasks/IT-04/FE-02.md`（33 项 FE 任务最后一项，纯核验）
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`
- 判据真源：`docs/requirements/ui-ux-redesign/ac.md` **v1.4**；7 页原型 `ui_01..07`；`design/api/GLB-global-patterns.md` §3.5/§3.7；`design/tech-design.md` §6/§8.4/§10
- 环境：Windows 10 Enterprise 10.0.19045；Electron/CDP 端口 9501 + 独立 user-data-dir `it04-fe02-userdata`
- 执行日期：2026-09-30

## 一、总判定

**通过（附 1 项 P1 缺陷已修复 + 1 项文案差异登记 + 1 项环境限制登记）**。**批次⑨ 测量证据链补测后追加：2 项 P2 真实缺陷登记待修（#5/#6，本批零产品改动授权未修）**。**批次⑩ 修复收口追加：#5/#6 已由 batch10 修复并复测通过（探针 7/7，`IT-04-FE-02-cdp-batch10-*`），收敛门禁 typecheck 0 Error + test:unit 1066/1066（76 files）；原「登记待修」表述以本追加为准。**

8 个核验域 + 批次⑨ 证据补测全部留档完毕（清单：`IT-04-FE-02-checklist.md`）；收敛三关全绿。本任务 src 产品增量仅 1 处授权修复（导出空单元格），其余零产品改动（批次⑨ 同样零 src 改动）。

| 批次 | 核验域 | 条目 | 结果 |
|---|---|---|---|
| ① | 性能与防抖（AC-NF-01/03/04/05） | 4 | 4/4 通过 |
| ② | 命中区域与提示（AC-NF-07） | 5 | 5/5 通过（可点击控件 17/17=100%） |
| ③ | 对比度与主题色四副本（AC-NF-09/AC-ERR-14/UI-ELEM-06） | 5 | **（batch9 复测改写）** 3.5 过；3.2/3.4 过；3.1 部分过 + 新发现 1；3.3 新发现未适配浅色块 5 处（详见批次⑨） |
| ④ | 平台×主题×分辨率（AC-NF-10/11） | 7 | 5 实测通过 + Win11×深浅 2 项环境限制推定登记 |
| ⑤ | 导出与落盘对账（AC-OP-17/19 + §10 异常断言） | 7 | 7/7 通过（5.1–5.3 为 **P1 修复后回归**；5.6/5.7 重计；**5.4 富文本色值证据链由批次⑨补齐**） |
| ⑥ | 数据层声明（AC-NF-13） | 3 | 3/3 通过（运行时 5 探针） |
| ⑦ | 用户旅程无权限差异（AC-RULE-18） | 5 | 5/5 通过 |
| ⑧ | 双主题走查 + converge（AC-NF-15/16/AC-RULE-17） | 5 | 5/5 通过（含缝扫描 8.5a–d） |
| ⑨ | 测量证据链补测（fix-biz-IT04PATH02-evidence + PATH-04 折入） | 5 | 9.1/9.4/9.5 过；9.2/9.3 如实出新发现 P2×2（#5/#6 登记不修） |
| ⑩ | #5/#6 产品缺陷修复（fix-biz-IT04PATH02-defects，batch10） | 2 | 2/2 修复复测通过（探针 7/7）；收敛门禁 typecheck 0 Error + 1066/1066（76 files） |

## 二、缺陷修复（P1）— 导出丢空单元格（AC-OP-17 判据 2）

> 任务授权：「P0/P1 级真实缺陷可做最小修复（TDD，报告单独列节）」。本节为该专节。

- **现象**（批次⑤首测，5.1b/5.2b/5.3b 三通道 FAIL）：含结构操作（插列产生空列 + 插行产生全空行）的 4×4 表格，编辑视图逐项形态正确，导出物丢空单元格——4 列变 3 列、全空行成 `<tr></tr>`、冒号行右对齐落到中列。
- **根因**：`@lezer/markdown` GFM 解析对空单元格**不产 `TableCell` 节点**（只剩相邻 `TableDelimiter` 管道；全空行零 `TableCell`）。`export/renderDoc/listTable.ts` `renderRow` 只遍历 `TableCell` 子节点计列 → 空列被丢、`aligns[i]` 跟着错位。编辑侧 `editor/table/parse.ts`（`splitRowWithOffsets` + `padRow` 哨兵补空）口径正确，导出侧漏了同口径。
- **修复**（TDD，最小面）：
  1. **RED**：新增 `src/renderer/src/export/renderDoc/listTable.test.ts` 4 用例（空列保列数 / 全空行 4 空 `<td>`+逐列对齐 / 冒号行对齐按列序 / 短行补齐到 rectify 宽度）——首跑 4/4 失败与根因一致；
  2. **GREEN**：`listTable.ts` 新增 `rowCellSlots()`——按行内管道结构数槽位（行首管道不开槽、每后续管道关一槽、无行尾管道收尾补格），非空 `TableCell` 映射到对应位置，空槽输出空 `<td${align}></td>`/`<th>`；行宽 rectify 到全表最大槽位数（与 `padRow` 哨兵补空同口径），`aligns[i]` 按列序兑现冒号行；
  3. **收敛**：`vitest src/export` 26/26 → 全量 `npm run test:unit` **873/873**、`npm run typecheck` 双 tsconfig **0 Error**；
  4. **回归**：CDP 重跑三通道导出比对（`IT-04-FE-02-cdp-batch5-retry2.mjs`）——4×4 含空列/空行表 HTML/PDF/富文本 rows/cols/cells/aligns 与编辑视图逐项一致（对齐 left/center/center/right 兑现冒号行）。
- **涉及文件**：`frontend/src/renderer/src/export/renderDoc/listTable.ts`（修复）、`…/listTable.test.ts`（新增单测）。
- **change-log**：已登记 `CHANGE-12`（pending / Updated / 低风险）。
- **修复前缺陷物证**：`IT-04-FE-02-export.html`（保留 `<tr></tr>` 与 3 列形态）；修复后物证：`IT-04-FE-02-export-fixed{,-pdf,-rich}.html`。

## 三、登记项（不修改代码）

1. **autosave 失败文案与冻结句不一致**（批次⑤ 5.7，只登记不擅改）：实测 `toast.autoSaveFailedPath`「自动保存失败：{path}（{reason}）」+ 常驻槽 `.sb-autosave-error`「自动保存失败 {time}」，与冻结句 `err.autosaveFailed`「自动保存失败，文档可另存副本」措辞不一致；`err.autosaveFailed` 全仓无运行时消费方（仅 `frozenCopy.test.ts` 钉住）。tech-design §10 语义（失败不丢稿 + 失败提示）满足。移交 doc-reconcile 裁定。
2. **Win11 × 浅/深组合**（批次④ 4.3/4.4）：本机 Win10 单机无法实测，按 tech-design §8.4「三平台 CSS token 化、无平台分支」推定一致，登记待跨机复验（不算实测通过）。
3. **探针纪律问题**（批次⑧，非产品缺陷）：CDP 探针手工 `remove()` React 托管的 `.velox-ctx-menu` 节点会引发 React DOMException（无 error boundary）全树卸载；正常交互面未复现。驱动纪律：探针不得手工移除 React 托管 DOM。
4. **已登记差异无回归**：CHANGE-11 按钮序 / col-grip 常驻零漆 / hover 165ms 基线 / +1.28px 亚像素 / AC-FN-29 已修 / CHANGE-3（resizeTable vs TBL-TOOL-GRID）与 CHANGE-9 pending——均按「已登记」对待，本轮无回归，未重复上报。
5. **toast 撤销按钮浅色主题对比度 3.04:1**（批次⑨ 9.2 复测发现，**P2 真实缺陷**，登记不修）：`.toast-undo-btn`（toast.css:46-58）ghost 形态 `color:var(--accent)` on `--toast-bg:#1f2328`（themes.css:83-85，浅色主题即用深色 toast 面，ui_07 设计）——浅色 `--accent:#0969da` 对该面 3.04:1 < 4.5（AC-NF-09 违反）；深色 `#58a6ff` 同面 6.25:1 达标；toast 正文 13.37:1 达标。batch3 七探针面未覆盖撤销钮故未暴露。修复方向：toast 面上用高亮 accent 变体或 toast 专用 token，勿动全局 `--accent`（牵动主题色四副本）。移交后续批次。**【batch10 已修复】**新增 `--toast-accent: #58a6ff`（themes.css 双侧、`--accent` 未动），`.toast-undo-btn` 挂该 token；复测撤销钮双主题 **6.25:1**（浅 3.04→达标）、正文 13.37:1 不降级。证据：`IT-04-FE-02-cdp-batch10-{data.json,run.log}`（10.1 PASS）+ `-toast-{light,dark}.png`。
6. **深色未适配浅色块 5 处（原生 UA chrome）**（批次⑨ 9.3 复测发现，**P2 真实缺陷**，登记不修）：TableInsertDialog 裸 `input[type=number]`×2 + 裸 `button`×2（`.primary` 为死类无 CSS 规则）+ 图片工具栏 `input[type=range]` 无 class（markdown.css:809-812 仅 width/accent-color）——UA 默认浅色 rgb(255,255,255)/rgb(240,240,240) 在深色主题成近白块（AC-ERR-14 判据 2 违反）。旧 batch3 扫描只查 8 根元素自身 background 故漏检。修复方向：补接既有 token 皮肤（`.dialog-input`/`.prefs-input`/`.btn`/`.dialog-btn`）+ range skin。移交后续批次。**【batch10 已修复】**number×2 挂 `.prefs-input`、按钮改 `.dialog-btn`/`.dialog-btn-primary`（`.primary` 死类清账）、range token track/thumb 皮肤 + buttons.css active/disabled 态；复测深色五处 nearWhite offenders=**[]**、浅色无回归、三态可用。证据：`IT-04-FE-02-cdp-batch10-{data.json,run.log}`（10.2/10.3/10.4 PASS）+ `-dialog-{light,dark}.png`/`-image-{light,dark}.png`。

## 四、收敛三关（AC-NF-16 / AC-RULE-17）

| 关 | 命令/方法 | 结果 |
|---|---|---|
| 1 | `npm run typecheck`（tsconfig.web + tsconfig.node） | **0 Error**（修复后 2 次执行）；**批次⑨ 复跑仍 0 Error** |
| 2 | `npm run test:unit` | **66 文件 / 873 用例全绿**（含新增 listTable.test.ts 4 用例）；**批次⑨ 复跑 1066/1066（76 文件）**——数字增量系并发批（fix-biz-IT03PATH08-p2 等）测试在场，本批零 src 改动，零回归 |
| 3 | cdp 冒烟 + e2e 缝契约终态扫描 | **通过**：`__velox*` 26 键全在（含懒装 `__veloxTableCellView`）；data-op 冻结集菜单 19 + 工具栏 6 全在位（`resizeTable` 口径，CHANGE-3 探针基线）；`data-table-handle`={col-grip}；命令 id 字面量 68 项扫描存证，本任务 src 增量仅 `listTable.ts`+`listTable.test.ts` 未触缝面。批次①–⑦ 驱动自检即冒烟载体（`scripts/cdp-smoke.mjs` 不随仓 INFRA-01 已登记）；**批次⑨ 同样零缝面触碰（只读测量 + 报告回填）** |

## 五、阶段验收对照

- 阶段 1（清单就绪）：✅ `IT-04-FE-02-checklist.md` 条目逐条挂 AC 编号，判据取自 ac.md v1.4
- 阶段 2（自测）：✅ 性能/命中/对比度/主题色/组合冒烟/导出落盘/数据层/旅程全过；异常断言 5.6 通过（空栈静默）、5.7 内存态保留通过 + 文案口径**登记**（见三-1）
- 阶段 3（联调）：✅ 深浅两遍 ui_01..07 结构对照全过（AC-NF-15，截图留档）；P1 缺陷已回修并重走 5.1–5.3
- 阶段 4（QA）：✅ converge 三关全绿

## 六、证据索引（均在 `reports/IT-04-FE-02/`）

- 清单与契约：`IT-04-FE-02-checklist.md`、`IT-04-FE-02-contracts.md`
- 批次数据/日志：`IT-04-FE-02-cdp-batch1-data.json`/`-retry.json`、`-batch2-data.json`、`-batch3-data.json`/`-contrast-retry.json`、`-batch4-data.json`、`-batch5-data.json`/`-retry.json`/`-retry2.json`、`-batch6-data.json`、`-batch7-data.json`、`-batch8-data.json` 及对应 `-run.log`/`-retry*.log`
- 驱动脚本：`IT-04-FE-02-cdp-batch{1..8}-*.mjs`（分段可续跑）
- 导出物：`IT-04-FE-02-export.html`（缺陷物证）、`IT-04-FE-02-export-fixed{,-pdf,-rich}.html`、`IT-04-FE-02-journey-export.html`
- 截图：`shots/IT-04-FE-02-light-full.png`、`shots/IT-04-FE-02-dark-full.png`（批次⑧驱动写入）
- 代码增量：`frontend/src/renderer/src/export/renderDoc/listTable.ts`（修复）、`listTable.test.ts`（新增）；change-log `CHANGE-12`
- **批次⑨（fix-biz-IT04PATH02-evidence）产物**：`IT-04-FE-02-cdp-batch9-evidence.mjs`（rev3 主探针）、`IT-04-FE-02-cdp-batch9-data.json`（results.{meta,checks,grid,text,hardcode,rich} 全量实测）、`-run.log`、`-electron.log`、`-grid-light.png`/`-grid-dark.png`（⊞ 弹层实拍）、`-rich-light.html`/`-rich-dark.html`（富文本通道样张，含 1 处 `[elided-for-archive]` 截断注记）；诊断脚本 `IT-04-FE-02-cdp-batch9-diag{,2,3,4,5}.mjs`（⋮/toast 路径、剪贴板 roundtrip、writeProbe、Vite 富文本 import、renderDoc 路径排查）
