# IT-03-FE-10 自测报告 — 公式/代码/mermaid 块观感审计微调与非回归（Phase 2 selfTest 复核）

- **任务ID**: IT-03/FE-10（公式/代码/mermaid 块观感审计微调与非回归）
- **测试时间**: 2026-10-03 10:15–10:40（Asia/Shanghai）
- **测试方式**: 采认 dev 阶段完整自测（`IT-03-FE-10-self-test.md`，CDP **98/98 checks passed**）+ Phase 2 本轮真实重跑相关纯逻辑单测（桌面适配口径）。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；本任务为零契约观感审计（PEND-14 豁免幅度），验证面 = CDP 全判据走查存档 + last-good/围栏定位/导出代码面单测复核 + 色值逐字节一致静态断言。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-03/FE-10.md`

## AC 验证结果（dev 自测 §9 映射 + Phase 2 复核）

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-FN-20 | 公式/代码/mermaid 编辑形态保持既有收敛；错误后退出无残留 | ✅ 通过 | ① CDP 存档 §4（S4 深浅主题观感走查，AC-FN-20 判据 + PEND-14）+ §2（S1 双区编辑）；② 观感微调面收敛为 token 三件（--errbar-*/code-chrome token 化），色值与改前**逐字节一致**零视觉变化——「编辑形态保持既有收敛」非回归（dualPane.ts/codeBlockUi.ts/render-zone.css/export/ 全部零 diff，impl 1）；③ S6 非回归契约扫描（AC-RULE-17 切片，dev 自测 §7） |
| AC-OP-18 | 全要素编辑确认后经导出入口导出：内容/样式/交互态正确联动 | ✅ 通过 | ① CDP 存档 §5（S5 导出三通道：HTML/PDF 渲染/富文本，`IT-03-FE-10-export-*.html` 三份产物 + FE-05 链接段三通道一致性复验闭环）；② 导出代码面单测本轮重跑 `export/renderDoc/code.test.ts` 2/2（`renders the bare rounded-box shape with highlight passthrough (9B)`/indented-code 同形）✓；③ 列宽导出零 width attr/三路断言（impl 3） |
| AC-OP-20 | 双区面板源码区输入合法源码随动预览；退出回渲染态 | ✅ 通过 | ① CDP §2（S1 双区编辑 + AC-OP-20/UI-IXD-15）；② 退出落点纯函数本轮重跑 `codeEdit.test.ts` **9/9**（`fenceExitAnchor（退出落点，exitMathEdit 同构）` 3 用例：闭合块落闭栏行后/文末未闭合退回首行前/闭合块卡文末同样退回——退出无残留落点钉死）✓；③ 上下双区布局零 diff 保持（doc-drift 措辞修正后仍布局正确） |
| AC-ERR-10 | 双区输入语法无效公式：预览区错误态标识不显乱码、跳源码定位保留输入 | ✅ 通过 | ① CDP §3（S2 公式错误态全判据，`IT-03-FE-10-impl-math-error.png`/`-impl-dualpane-math-error.png`）；② 错误条 token 化 `--errbar-fg/bg/border`（theme-split，删错误条 .theme-dark 补丁——其他存量白名单补丁不动）色值逐字节一致；③ 浅色错误条对比度 4.513:1 原值边界通过（零改色保持 last-good 观感，impl 5） |
| AC-ERR-11 | mermaid 语法错误：保留 last-good 不白屏、显示错误条、修复后重渲染 | ✅ 通过 | ① last-good 记忆单测本轮重跑 `mermaid/errMemory.test.ts` **11/11**：`remapMermaidLastGood (AC-ERR-11 判据 1)` 8 用例（前插/删文位置漂移后仍命中、fence 内改语法键不动、assoc=1 整行前插、**防串图**删除丢弃/起点已亡丢弃、StateField 挂接钉）+ 跨标签文档隔离 3 用例（B 事务不动 A 命名空间/不串图）✓；② CDP §4（S3 mermaid last-good 全判据，`IT-03-FE-10-impl-mermaid-lastgood.png`）；③ 错误条 + 修复重渲染同场 |
| UI-IXD-15 | 双区编辑退出控件：退出后回渲染态、双区面板消失无残留 | ✅ 通过 | ① CDP §2（退出无残留实测）；② fenceExitAnchor 3 用例（退出落点全形态）✓；③ mermaid svg 点击=lightbox、进源码手势=wrap padding/错误条/placeholder（impl 2，AC-RULE-13 裁决面） |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| errMemory last-good 全量（remap/防串图/跨标签隔离） | ✅ 11/11 | `npx vitest run src/renderer/src/editor/mermaid/errMemory.test.ts` | 2026-10-03 10:15 重跑 |
| codeEdit 围栏定位 + 退出落点 | ✅ 9/9 | `npx vitest run src/renderer/src/editor/codeEdit.test.ts` | exitMathEdit 同构 |
| 导出代码面（renderDoc/code） | ✅ 2/2 | `npx vitest run src/renderer/src/export/renderDoc/code.test.ts` | AC-OP-18 切片 |
| CDP 全判据走查（S1–S6 + 契约扫描） | ✅ 98/98（存档） | `IT-03-FE-10-cdp-data.json` + `IT-03-FE-10-run.log` | dev 存档（本任务验收证据本体） |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（历史移交已闭环：FE-05 链接段三通道一致性构造性保证——本任务阶段 3 实测复验闭环（三通道 href 集合一致且源自 .md，dev 自测 §6）；收口批勘误：旧「错误条全仓唯一 .theme-dark 补丁」表述不成立（callout×8/.katex/buttons/overlays 存量白名单不动），勿据此判仓库状态。在案非缺陷：浅色错误条 4.513:1 为原值边界通过（改色须走 4 副本同步纪律）；`__veloxTableCellView` 懒装缝白名单增量。）

## 结论

**通过**。AC-FN-20 / AC-OP-18 / AC-OP-20 / AC-ERR-10 / AC-ERR-11 / UI-IXD-15 六条全过。本轮 errMemory 11/11 + codeEdit 9/9 + 导出 code 2/2 全绿，dev CDP 98/98 存档证据链在场（双区/错误态/last-good/导出三通道/非回归扫描），观感微调色值逐字节一致零契约变更，零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 双区编辑随动预览 + 退出无残留 | ✅ | ✅ | ✅ | ✅（退出落点） | ✅ |
| 公式错误态（标识/保留输入/定位） | ✅ | — | ✅ | ✅ | ✅ |
| mermaid last-good/错误条/修复重渲染 | ✅ | — | ✅ | ✅（防串图） | ✅ |
| 导出三通道联动 | ✅ | — | ✅ | — | ✅ |

覆盖率: 10/12 (83%)
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest last-good/围栏/导出单测 + CDP 实测存档，桌面适配口径）

## 证据来源存档

- 本轮重跑：`editor/mermaid/errMemory.test.ts` 11/11、`editor/codeEdit.test.ts` 9/9、`export/renderDoc/code.test.ts` 2/2（2026-10-03）
- CDP 存档（dev 阶段实测，验收证据本体）：`IT-03-FE-10-self-test.md`（S1–S6 + AC 逐条判定 §9）、`IT-03-FE-10-cdp-data.json`、`IT-03-FE-10-cdp-driver.mjs`、`IT-03-FE-10-run.log`（98/98）；导出产物 `IT-03-FE-10-export-html.html`/`-export-pdf-render.html`/`-export-rich.html`；截图 `IT-03-FE-10-impl-*.png`（math-error/dualpane/mermaid-lastgood）
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
