## 代码审查报告 · IT-03/FE-08 长引用折叠

**得分：96/100（阈值：90）　状态：✅ 通过（无 Critical/Important；3 Minor 入收口批候选 + 2 Info）**
**基线规范：** rubric-code-review.md + code-review/SKILL.md（前端，阈值 90）
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）

最高层=同族已有代码（`editor/livePreview/fold.ts` + `hooks/useFoldSync.ts` 的 P18 折叠族：StateEffect 三件套、内容派生 key、签名门控写回、eq/ignoreEvent、tr.selection 自动展开）——本任务为逐模式镜像，一致性极高；次层=项目 CLAUDE.md（Widget 纪律/i18n 双字典/token 布局/纯函数单测）全遵守；三层=本 rubric 无额外冲突。客观项（性能/测试/正确性）照常核。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|---|---|---|---|---|
| 功能实现（AC-FN-16/AC-RULE-14/UI-IXD-14/AC-PEND-09 全落地） | 10 | 10 | — | — |
| 需求遗漏 | 8 | 8 | — | — |
| 超范围 | 8 | 8 | 零新增 i18n key/零 e2e 缝/无 toast/不进 undo 栈，均核实 | — |
| 需求理解（>5 阈值单点、N=隐藏行数≡全块行数、id 口径 STORE 委派定稿） | 7 | 7 | — | — |
| 边界场景 | 6 | 7 | 展开态 caret 横向余量未见核验（-1） | 客观（观感边界） |
| 职责分离 | 10 | 10 | — | — |
| 错误处理 | 10 | 10 | 空 excerpt/脏 id/缺键降级/null view 均覆盖 | — |
| 风格一致 | 8 | 8 | — | — |
| 测试覆盖（33 项纯逻辑含字段语义/N2 契约/widget eq） | 8 | 8 | — | — |
| 安全（全部 textContent，无 innerHTML/无用户可控串出域） | 8 | 8 | — | — |
| 性能 | 7 | 8 | 重建热路径双重语法树遍历（-1） | 客观 |
| DRY | 3 | 4 | collect 二次副本（fold.ts 明文警示过）（-1） | 客观 |
| YAGNI | 3 | 4 | expandQuoteFolds 零 dispatch 死 API（-1） | 客观 |
| **合计** | **96** | **100** | | |

### i18n 专项（scope 附加）

零新增 key，消费 FE-01 `render.fold.collapse/restore/lines`；en/zh 对齐且 `i18n.test.ts:277` 钉住 `{n}` 占位符；本任务无快捷键面，AC-FN-07/AC-RULE-11 不适用。doc-drift（restore title 用冻结「展开还原」替代任务表「展开还原完整引用」）已登记，代码与登记一致。

### 问题清单

| 级别 | 项 | 详情 | 位置 | 建议 |
|---|---|---|---|---|
| Minor | 性能/DRY | `applyQuoteFoldDecos` 每次装饰重建跑两遍语法树收集（blocks 直接收集 + `collectQuoteFoldRanges` 内部再 collect），fold.ts 同族特意用可选预计算参数避免"second copy to drift" | quoteFold.ts:142,321-324 vs fold.ts:86-92,328 | 仿 fold.ts 签名 `collectQuoteFoldRanges(state, keys, blocks = collectQuoteFoldBlocks(state))`，applyQuoteFoldDecos 传入已收 blocks → 收口批候选 |
| Minor | 观感边界 | 展开态 ▾ 绝对定位 `right: var(--space-2)`，`.cm-md-quote` 无右内边距（ui_06 原型 `.md-quote` 有 `padding-right: var(--space-4)`）；文本列止于 16px（--editor-gutter）而 caret 盒约达 17px，长首行行尾与字形余量仅 0~2px，横向未见 PIL 核验（r3 只测了纵向 N1/N2） | render-zone.css:355-359、markdown.css:206-211 | 首行/块补右内缩（如 `.cm-md-quote-first` padding-right 或 caret right 对齐 gutter），按 N1/N2 同款 PIL 帧补测长首行场景 → 收口批候选 |
| Minor | YAGNI | `expandQuoteFolds` 有定义/字段处理/setup 侦测但全仓零 dispatch、单测未覆盖（对照 `expandFolds` 有 viewCmds/useOutlineNav/opsBlocks 三消费方） | quoteFold.ts:148,171、setup.ts:236 | 删除，或补消费方（如「展开全部」命令）并补字段用例 → 收口批候选 |
| Info | 口径表述 | implementation-notes「callout 不参与引用折叠（体内引用跳过）」实际口径=callout 本体排除（`parseCalloutMarker`）+ **折叠态** callout 体内跳过（`calloutFoldRanges` 过滤）；展开态 callout 体内嵌套 `> >` 引用仍可折叠 | quoteFold.ts:114,321-323 | 确认口径后在模块头/REN §3.5 固化表述，避免误读 → doc-reconcile 登记候选 |
| Info | 继承风险 | restore/sync 的 `liveKeys` 过滤依赖语法树即时解析进度，超大文档深处块 id 可能在树未覆盖时被当失效丢弃——与 useFoldSync 完全同款（已核合同镜像，不归本任务） | useQuoteFold.ts:46-50,73-84 | 后续族内统一修（过滤前 `ensureSyntaxTree`），勿单侧改口径 → 登记候选 |

### 衔接面比对（与已核结论一致性）

build 管线 callout-fold → quote-fold → heading-fold、正则 pass 在树 pass 之后未破坏（build.ts:118-120,162-173）；field 身份信号/点击扩展/会话写回与 fold 族逐条同构；store 仅消费 FE-02 字段无重声明；CSS 全 token 无新裸 px；e2e 缝零变更。均一致，未扣分。并发在途分支（fix-cr-IT03FE06/05、fix-biz-PATH04-05）均不触及本任务文件，无中间态干扰。

### 结论

✅ **通过（96 ≥ 90）**：AC-FN-16（可折叠/可展开/内容不丢失，零字节结构性成立——全模块无任何 ChangeSpec）、AC-RULE-14（quoteFolds 落 session + sanitizer 降级 + 跨重启）、UI-IXD-14（两态）、AC-PEND-09（阈值单点 quoteFold.ts:30，5/6 边界有测）全部满足；quoteFold.test.ts 33 项单测覆盖阶段 1 门禁四判据（5 行不折/6 行可折/摘要截断与「N 行」尾标/块 id 派生稳定）。3 项 Minor 均为可选优化，不阻塞收口，入收口批候选（「双重 collect」与「caret 横向余量」建议合并一次小修 + PIL 帧补证）。
