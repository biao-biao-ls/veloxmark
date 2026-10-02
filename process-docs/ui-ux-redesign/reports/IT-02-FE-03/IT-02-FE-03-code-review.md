## 代码审查报告 — IT-02/FE-03 键位归属清理与补注册（Q6/Q7 注册表侧）

**得分：** 96/100（阈值：90）　**状态：** ✅ 通过
**基线规范：** code-review/SKILL.md + rubric-code-review.md（前端 90 分档）；评审规范 reviewer.md 流程
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02
**裁定：** Important-1（合流断言标记单点）判**必修-低**——BE-01 合流前必须落地，入收口批候选，不阻塞本任务（测试护栏缺口，非行为缺陷）。

### 风格归因（前置）
- **已有代码风格**（最高优先）：命令条目 `id/label/shortcut/bindGlobal/run` 对象式 + 中英混注（viewCmds 既有 foldSection/globalSearch 同构）；回显单源 `commandItem` 派生（menuLayout.ts:170）；测试共置 + `stubCommandOps` 真实注册表装配——新代码全部一致。
- **CLAUDE.md 约定**：i18n key 必须 en/zh 双写（i18n.test.ts 守护，已核对）；命令 id 字面量为 e2e 硬契约（未改动）；不向 App.tsx 堆逻辑。
- **结论**：无风格类扣分；客观项（测试覆盖/需求一致性）照常扣。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 功能实现 | 10 | 10 | — | |
| 遗漏需求点 | 8 | 8 | 涉及文件 5 处全落地（viewCmds/tabsCmds/zh/en/shortcutSync.test 逐文件已核） | |
| 超范围多做 | 8 | 8 | Q7 补 `bindGlobal: true` 为 AC-PEND-02 实触发必要（shortcutMatch.ts:27 拾取前提），已文档化，非 scope creep | |
| 需求理解 | 6 | 7 | -1 任务页元素表 mac 回显形态与 FE-02 单源派生口径不一致（见 Info-1） | 客观（文档一致性） |
| 边界/异常 | 6 | 7 | -1 合流半落地态防护有缺口（见 Important-1） | 客观（测试） |
| 职责分离 | 10 | 10 | — | |
| 错误处理 | 10 | 10 | isDisabled 前置灰显保留（tabsCmds.ts:29）；run 闭包零改动 | |
| 编码风格 | 8 | 8 | build.ts 头注释历史化（Minor，见下） | |
| 测试覆盖 | 6 | 8 | -2 Important-1（合流标记单点）+ Minor-2（pending 例外失效不设防） | 客观 |
| 安全 | 8 | 8 | 无（纯键位/文案/注册表数据） | |
| 性能 | 8 | 8 | 无 | |
| DRY | 4 | 4 | Q7 表测试钉住属断言性重复，正常 | |
| YAGNI | 4 | 4 | 无冗余功能 | |
| **合计** | **96** | **100** | | |

### 需求合规核验（独立读码，非采信任务自述）
- **Q6**：toggleTheme 无 shortcut/无 bindGlobal（viewCmds.ts:165-169），id/run 不变；reopenClosedTab 独占 `Ctrl+Shift+T`+bindGlobal（tabsCmds.ts:25-31）；生产面全仓检索无第二绑定点。
- **Q7**：四命令补 `Ctrl+=`/`Ctrl+-`/`Ctrl+0`/`F12` + bindGlobal（viewCmds.ts:134-161），run 复用 `window.api.windowZoom/windowToggleDevTools`（api.ts:337 签名相符）。
- **i18n**：`tb.theme` zh「切换主题」/en「Toggle theme」无键位残留（zh.ts:434 / en.ts:439），key 双侧对齐有 i18n.test.ts 守护；「▸」为 MenuBar 既有子菜单指示符（MenuBar.tsx:534），字典无滥用。`app.searchInFolder` 键面双源为存量债（zh.ts:430，按调度约定不深挖）。
- **AC-FN-07/AC-RULE-11 回显单源**：`commandItem` 由 `Command.shortcut` 派生、无键留空无占位（menuLayout.ts:170 + MenuBar.tsx:401-402）；shortcutMatch.test.ts:166-210 全量注册表回显↔触发互检（Q7 四键自动纳入，合成事件可触发）。
- **shortcutSync.test.ts**：Q6 唯一归属 + 反向钉住、Q7 键值/绑定钉住、darwin 过渡态双分支、例外机制卫生、AC-NF-06 比对记录——与 implementation-notes 一致且实测可达（当前 darwin 残留 `toggleTheme:'Cmd+Shift+T'`、无 zoom 条目，过渡分支全绿路径成立）。

### 问题清单

| 级别 | 项 | 详情 | 位置 | 建议 |
|------|-----|------|------|------|
| Important | 合流自升格断言标记单点 | 仅以 `DARWIN_COMMAND_ACCELERATORS.zoomIn !== undefined` 作 BE-01 落地标记；若 BE-01 只迁入 zoomOut/zoomReset/toggleDevTools 漏 zoomIn 且保留 toggleTheme 残留，Q7 逐值钉住与 Q6 严格断言均被跳过、全绿放行 | shortcutSync.test.ts:164,188 | 改 all-or-none 标记：四键任一在表则断言四键全在并逐值钉住 + toggleTheme 加速键必须消失 |
| Minor | pending 例外合流后失效不设防 | toggleTheme 过渡例外（:56-60）在 BE-01 删条目后成死条目而卫生用例（:122-127 仅查 non-pending）不报；zoomIn/toggleDevTools 的 `pending:true` 合流后未翻正，后续误删 darwin 条目无守护 | 同上 shortcutSync.test.ts:37-61,122-127 | 合流收尾：zoomIn/toggleDevTools 去 pending 转正式例外、删 toggleTheme 条目；或加「pending 例外须在表或带失效标记」用例 |
| Minor | build.ts 头注释仍述同键遮蔽历史态 | 「reopenClosedTab 必须先于 toggleTheme（view，同键）」在 Q6 后失真（concat 序本身仍是行为契约）；implementation-notes 5 已声明合流后更新 | commands/build.ts:4-6 | 合流收尾改为现口径注释（保留 concat 序契约表述） |
| Info | 任务页元素表 mac 回显形态与派生口径不符 | 表称「macOS 显示 ⌘+/⌘-/⌘0/⌘⌥I」，实际 FE-02 派生（键名段不动）为 ⌘=/⌘-/⌘0/F12；代码遵循 AC-RULE-11 例外登记口径（正确优先级），文档表述宜修订 | tasks/IT-02/FE-03.md:55、shortcutDisplay.ts:21-27 | 文档改为「mac 回显 ⌘=/⌘-/⌘0/F12；⌘+/⌘⌥I 为 darwin 触发键面（CHANGE-7 例外）」→ 归 doc-reconcile 登记候选 |
| Info | 存量债/文档漂移（不深挖） | `app.searchInFolder` tooltip 键面双源（zh.ts:430）；主仓 README 仍述 Ctrl+Shift+T=切换主题 | — | 跨任务债清单跟踪 |

### 结论

✅ **通过（96 ≥ 90）**。Q6/Q7 注册表侧实现正确且与 AC-RULE-11 单源派生闭环，i18n 双语干净，测试覆盖扎实（真实注册表、非 mock）。两条测试护栏缺口（Important-1/Minor-2）建议在 BE-01 合流前顺手加固，不阻塞本任务；阶段 3/4（与 BE-01 合流联调、三消费方一致）按任务清单仍待执行，darwin 侧 `commandAccelerators.ts:21` toggleTheme 残留与 darwin.ts 手写加速键属 BE-01 在途范围，测试已按过渡态精确容忍（仅原键位），不作本任务扣分。
