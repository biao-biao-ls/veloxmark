# IT-02/FE-09 代码审查报告（折叠记忆口径统一）

**得分：** 96/100（阈值：90）
**状态：** ✅ 通过（无 Important；3 Minor 入收口批候选，不阻塞）
**基线规范：** code-review/SKILL.md + rubric-code-review.md + reviewer.md（前端通用 rubric，无后端专项）
**评审对象：** 任务 FE-09 对应实现（useFoldSync.ts / store.ts / fold.ts / store.test.ts，工作目录 `src/renderer`）
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）

**已有代码风格**（最高优先，已核 5+ 同类文件）：useFoldSync 的镜像族 useQuoteFold.ts / useTableWidthSync.ts 均为「签名门控 + suppressDirty 换文保护 + live-key 过滤 + restore 重置 sig」同一写回纪律，新代码逐条一致；sanitize 族与 normalizeColWidths 同为白名单重建、脏数据不抛错；测试体例与 store.test.ts/fold.test.ts 既有 describe/断言风格一致。
**CLAUDE.md 约定**：纯逻辑带同目录单测、hook 不渲染 widget、契约头注释体例、i18n key 双字典对齐——全部符合。
**结论**：无风格扣分项；客观问题（测试/安全边缘）单列如下。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 需求合规-功能实现 | 10 | 10 | 双族清洗统一/跨重启口径/sanitizer/测试全落地（store.ts:402-411,444-445；useFoldSync.ts:87-92,105-109） | — |
| 需求合规-遗漏 | 7 | 8 | -1：store.ts:137 残留 "(session-only)" 注释与新口径相悖 | 客观（注释口径残留） |
| 需求合规-多做 | 8 | 8 | 无越界（normalizePerFileIds 共用在 implementation-notes 范围内） | — |
| 需求合规-理解正确 | 7 | 7 | live-key 基线=collectFoldSections 可折叠章节（空章节不入簿，fold.ts:67-70）与 discovered-dependency 合同一致 | — |
| 需求合规-边界异常 | 7 | 7 | Symbol/非数组/空键/旧键缺失/污染样本全覆盖（store.test.ts:164-217） | — |
| 代码质量-职责分离 | 10 | 10 | 清洗双层（storage 白名单 / 语义 live 过滤）分工清晰 | — |
| 代码质量-错误处理 | 10 | 10 | normalizeSession 全字段重建、脏数据永不抛错 | — |
| 代码质量-风格 | 8 | 8 | 与镜像 hook/既有注释体例一致 | — |
| 代码质量-测试 | 7 | 8 | -1：hook 层 live 过滤无直接断言（见问题 3） | 客观（测试） |
| 代码质量-安全 | 6 | 8 | -2：`__proto__` 路径键原型写入边缘（见问题 1） | 客观（安全边缘） |
| 代码质量-性能 | 8 | 8 | 签名门控早退防刷；collectFoldSections 仅写回/恢复时运行 | — |
| 代码质量-DRY | 4 | 4 | normalizePerFileIds 两族共用（store.ts:395-411） | — |
| 代码质量-YAGNI | 4 | 4 | 零平行键（key-set 钉死测试 store.test.ts:221-239） | — |
| **合计** | **96** | **100** | | |

### 问题清单

| severity | item | detail | location | suggestion |
|---|---|---|---|---|
| Minor | sanitizer 原型写入边缘 | `out[path]=clean` 当 path==='__proto__'（JSON.parse 可造自有键）触发 Object.prototype setter，out 的 [[Prototype]] 被置为数组，`headingFolds['0']` 类查找会穿透原型链。不抛错但违背"脏数据丢弃"精神 | preferences/store.ts:408 | `const out = Object.create(null)` 或显式跳过 `__proto__`/`constructor`/`prototype` 键，补 `normalizeSession(JSON.parse('{"__proto__":["2:x"]}'))` 用例 |
| Minor | 口径注释残留 | `mermaidPreviewPin (session-only)` 与同接口新口径（store.ts:10-14「localStorage 跨重启、session 是命名空间」）相悖——该字段同样落盘跨重启 | preferences/store.ts:137 | 括注改为 "(session namespace, cross-restart)" 或删除 |
| Minor | hook 层失效清洗缺直接断言 | 写回/恢复的 live-key `valid` 过滤（ghost key 清洗）仅在注释约定（store.test.ts:200-202），fold.test.ts:214-230 只断言 foldField 层丢键；删除/改名 AC 路径已被 foldField 层覆盖，ghost 路径无单测 | hooks/useFoldSync.ts:89-92,106-107 | 按 useOutlineNav.test.ts 模式抽纯函数（如 `pickLiveFoldKeys(keys, live)`）补 2-3 条断言；或接受"hook 不单测"惯例记档 |
| Info | 「防抖」以签名门控兑现 | 任务交互表写"签名门控写回（防抖）"，实现无定时器防抖，靠 sig 早退防刷（fold 集变化立即落盘，更利跨重启正确性，意图为达标） | hooks/useFoldSync.ts:72-78 | 无需改码；文案可改「（签名防刷）」 |
| Info | 验收 checkbox 未勾、frontmatter AC 全「未验证」 | 属验收流程状态非代码缺陷 | tasks/IT-02/FE-09.md:10-14,116-141 | converge/QA 阶段勾销并回填 |

### 契约一致性与专项核对（未扣分项）

- **FE-07/FE-08 合同比对通过**：collectFoldSections 空章节跳过（fold.ts:67-70 + fold.test.ts:88-92）；toggleFold effect→foldField（fold.ts:114-118）；restoreFolds 整组替换防串写（fold.ts:122-125）；jumpExpandKeys 仅开目标+祖先（useOutlineNav.test.ts:69-95）未受本任务影响。
- **AC-RULE-14 不写正文**：fold.test.ts:232-253 断言 toggle/restore/expand 全程 doc 字节恒等。
- **AC-FN-15 粒度**：fold.test.ts:109-118 断言折叠覆盖全部子章节、标题行保留（foldReplaceSpan body-only，fold.ts:96-100）。
- **AC-NF-14**：store.test.ts:153-217 覆盖脏数据丢弃/旧键缺失降级/永不抛错；跨重启读写 round-trip store.test.ts:255-265。
- **i18n**（scope 附加核对）：本任务零新增文案；fold 三键 en.ts:489,589-590 ↔ zh.ts:484,583-584 对齐且被 i18n.test.ts:202-203 frozen 钉住；字形 `▸`/`▾` 正文 fold.ts:222 与大纲 Outline.tsx:167 一致，title 共用 render.fold.* 单源；AC-FN-07/AC-RULE-11 快捷键回显与本任务无涉（无命令面）。
- 并发修复批文件（outlineKeys/keyboardNav 等）按 scope 约定未下重结论。

### 结论

96/100 ≥ 90，**通过**。实现与 FE-07/FE-08 已核合同一致，清洗口径双族统一扎实、测试覆盖核心逻辑；3 个 Minor（`__proto__` 边缘、注释残留、hook 胶水断言）入收口批候选，不阻塞。
