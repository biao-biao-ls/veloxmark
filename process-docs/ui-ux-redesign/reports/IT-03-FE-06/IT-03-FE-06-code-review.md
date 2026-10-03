## 代码审查报告 — IT-03/FE-06 列表拖拽排序与任务勾选

**得分：92/100（阈值：90）　状态：✅ 通过**
**基线规范：** rubric-code-review.md + code-review/SKILL.md（前端 90 阈值）；风格归因已完成
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）
- 已有代码：纯规划层+同目录单测（同 table/parse、outline/extract 模式）；WidgetType `eq`/`ignoreEvent` 齐备；`getCtxRuntime()?.toast`/`assertWritable` 复用既定 seam（readOnlyGuard.ts:10 显式点名 FE-06 消费者）；CSS 全 token（--handle-*/--drop-indicator 已登记 tokens.css:145/themes.css:64）；registerHoverContent 侧效注册=FE-03 既定合同；e2e 缝零新增（仅 data-testid）。
- CLAUDE.md：strict TS、`t('ns.key')` en/zh 双词典、纯函数配测、大文件仅局部小改——全部符合。
- 客观类问题（正确性/健壮性/测试/性能）按 rubric 必扣，不受归因保护。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 功能实现 | 10 | 10 | 无（拖拽/指示线/灰显单例/勾选/只读拦截/toast/一步 undo 全实现，AC-OP-15/16、UI-IXD-08/09 对照通过） | — |
| 遗漏需求点 | 7 | 8 | 多行任务项删除线仅覆盖 marker 行（#3） | 客观 |
| 无多做 | 8 | 8 | 无 | — |
| 需求理解 | 7 | 7 | 钳制/空行缝固定/loose 同组口径与任务声明一致；`[X]` 边界见 #2 | — |
| 边界与异常 | 5 | 7 | 窗外释放拖拽会话残留+误提交（#1）；coordsAtPos 空退化（#8 Info） | 客观 |
| 职责分离 | 10 | 10 | 纯层/闸门/呈现/装饰四层清晰 | — |
| 错误处理 | 8 | 10 | 会话无 buttons 校验/无 pointer capture（#1，对照 table/widget.ts:245 既有惯例） | 客观 |
| 编码风格 | 8 | 8 | 一致 | — |
| 测试覆盖 | 7 | 8 | 19 纯测覆盖佳，但 lazy continuation/blank-后接深层 blockEndAt 分支、拖拽会话无守护（#4 连带） | 客观 |
| 安全 | 8 | 8 | textContent、无 innerHTML/用户可控串外发 | — |
| 性能 | 7 | 8 | 每 pointermove 全量重解析（#4） | 客观 |
| DRY | 3 | 4 | canReorderListItem/docLines 重复（#5） | 客观 |
| YAGNI | 4 | 4 | 无 | — |
| **合计** | **92** | **100** | | |

### 问题清单

| severity | item | detail | location | suggestion |
|----------|------|--------|----------|------------|
| Important | 拖拽会话窗外释放残留+误提交 | onMove/onUp 不查 `ev.buttons`、未 `setPointerCapture`；窗外松开时 pointerup 不达 window，ghost/指示线/hover pin 残留，此后窗口内任意 click 的 pointerup 触发 onUp 将列表项**提交到误落点**（有 toast 可 undo，但属非预期写入）。table/widget.ts:245 已有 capture 惯例未沿用 | components/ListDragHandle.tsx:128-145 | onMove 开头 `if (ev.buttons === 0) { cleanup(); return }`；pointerdown 时 `setPointerCapture` 并在 cleanup release → **裁定必修，fix-cr-IT03FE06-drag** |
| Minor | `[X]` 大写完成态识别缺失 | `text.includes('x')` 对 `[X]` 判未完成：框未选中、无删除线、首击写 'x' 呈"从未选→选中"假象；与 contextMenu/detect.ts:84 `toLowerCase()==='x'` 口径不一致（预览/导出 listTable.ts:42 同口径，疑存量，FE-06 新增的删除线继承之） | editor/livePreview/handlers-tree.ts:316 | `/\[x\]/i` 或首字符 lower-case 判定；写回归一 'x' 已正确 → **随 fix-cr-IT03FE06-drag 顺带（同任务行为面）** |
| Minor | 多行任务项删除线只覆盖首行 | task-done mark 仅 node.to..line.to，续行不带删除线，完成态视觉不完整 | editor/livePreview/handlers-tree.ts:327-339 | 对块内后续行 trim 后逐行追加同 mark → 收口批候选 |
| Minor | 拖拽中每事件全量重解析 | place() 每个 pointermove 执行 docLines 全量复制 + planListMove 全 parseListItems，大文档拖拽可掉帧 | components/ListDragHandle.tsx:34-38,99-111 | rAF 节流 place；行快照拖拽开始时缓存（commit 仍走 dropListMove live re-plan）→ 收口批候选 |
| Minor | 谓词/行快照小重复 | draggable 内联 `planListMove(...) !== null` 而非已导出 canReorderListItem；docLines 循环两处各写一份 | components/ListDragHandle.tsx:50 / editor/listDrag.ts:313-314 | 复用 canReorderListItem；docLines 收进 listDrag.ts 导出 → 收口批候选 |
| Minor | i18n 守护清单漏登记 | RENDER_STATIC_KEYS 无 `render.list.dragHandle`（对称性测试兜住双语存在，非空守护未锁） | i18n/i18n.test.ts:184-210 | 补进 RENDER_STATIC_KEYS → 收口批候选（与 FE-03 审查同项，勿双记） |
| Info | 相邻异类列表同组口径 | 换 bullet 字符/有序↔无序、仅空行相连者 CommonMark 属不同 list，此处按同组互排（notes ② 已声明选定行为） | editor/listDrag.ts:170-208 | 文件头补一行口径差异注释，防后人当 bug 修 |
| Info | indicator 几何退化 | coordsAtPos 空（行滚出渲染区）退化到起点 rowRect；left/width 为 pointerdown 快照，拖拽中滚动横向不跟 | components/ListDragHandle.tsx:67-78 | place 时重取 anchor.getBoundingClientRect() |

### i18n 专项（AC-FN-07/AC-RULE-11/PEND-15）
- `render.toast.listMoved`/`render.list.dragHandle` en+zh 双词典齐全（zh.ts:556/581、en.ts:564/589），文案与 AC 冻结句「已移动列表项（Ctrl+Z 可撤销）」逐字一致，i18n.test.ts:219-268 全句冻结 + UNDO_SUFFIX 单常量合成（已收口项未重复计）。
- PEND-15 差异声明齐（zh.ts:551-552/en.ts:558-560），i18n.test.ts:250 锁 `render.toast.*` 恰四键、无 taskChecked——勾选全程无 toast 落实于 widgets-extended.ts toggleTaskAt（无 toast 调用）。快捷键回显单源问题不在本任务触面，未发现新增双源。

### 结论

✅ **92/100 通过**。AC-OP-15/16、AC-RULE-04、AC-ERR-08（assertWritable 闸门零写入）、UI-IXD-08/09 均落地且带冻结守护；纯规划层测试矩阵扎实（19 用例含围栏伪列表/钳制/undo 逆计划），自测证据（reports/IT-03-FE-06/ impl.png+self-test+cdp log）在案。唯一 Important 为拖拽会话健壮性（#1，裁定必修，fix-cr-IT03FE06-drag，含 [X] 大写识别顺带）；其余 Minor/Info 入收口批候选。只读评审未复跑 typecheck/test:unit，以静态审查+在案报告为准。
