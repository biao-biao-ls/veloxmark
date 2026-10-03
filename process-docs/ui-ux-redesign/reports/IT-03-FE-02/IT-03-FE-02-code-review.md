## 代码审查报告 — IT-03/FE-02（SessionState.quoteFolds 字段与 sanitizer 白名单扩展）

**得分：** 97/100（阈值：90）　**状态：** ✅ 通过（无 Important；3 Minor 入收口批/登记候选）
**基线规范：** code-review/SKILL.md + rubric-code-review.md + reviewer.md 方法论（已 Read）
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置，已完成）
- 已有代码风格：sanitizer 纯函数 + JSDoc 契约注释 + 同目录 Vitest 真行为断言（`normalizeColWidths`/7F 用例先例，store.ts:375-393、store.test.ts:6-52）；pub/sub + 单一写入口 `patchSession`（store.ts:490-494）；`window.__veloxPrefs` e2e 缝不动（store.ts:510-530）。
- CLAUDE.md：纯逻辑模块同目录 `*.test.ts`、全仓 strict、不加重 App.tsx——均符合。
- 归因结论：新代码与已有代码同型；风格项不扣分，仅客观项计扣。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|---|---|---|---|---|
| 需求合规-功能实现 | 10 | 10 | — | |
| 需求合规-遗漏需求点 | 8 | 8 | — | |
| 需求合规-多做需求之外 | 8 | 8 | headingFolds 脏条目收紧（Info 不扣，见下） | STORE §3.2 授权 + 无真实数据影响 |
| 需求合规-需求理解 | 4 | 7 | 清洗口径严于任务/合同字面（-3） | 客观·精确性 |
| 需求合规-边界/异常 | 7 | 7 | — | |
| 代码质量-职责分离 | 10 | 10 | | |
| 代码质量-错误处理 | 10 | 10 | | |
| 代码质量-编码风格 | 8 | 8 | | |
| 代码质量-测试覆盖 | 8 | 8 | | |
| 代码质量-安全 | 8 | 8 | __proto__ 边缘=FE-09 收口批登记存量（Info） | 登记债不重扣 |
| 代码质量-性能 | 8 | 8 | | |
| 代码质量-DRY | 4 | 4 | | |
| 代码质量-YAGNI | 4 | 4 | | |
| **合计** | **97** | **100** | | |

### 独立核实（不采信自述）
- quoteFolds 落位恰 3 个写点：`store.ts:134`（SessionState 接口）/ `store.ts:203`（DEFAULT_SESSION）/ `store.ts:445`（normalizeSession → normalizePerFileIds:402-411）；全仓唯一消费写回 `hooks/useQuoteFold.ts:67` 经 `patchSession` 单入口（FE-08 域，合同面静态核对一致：id 过滤、签名门控、`?? {}` 兜底）。
- sanitizer 规则逐条对上 STORE §3.2（顶层非对象→`{}`、空键丢条、非 Array 整条丢、非 string 元素丢、不抛错）；AC-NF-14 污染样本 `{a.md:"bad",b.md:[1,{}],"":["x"]}` 由 store.test.ts:102-108 钉死。
- 测试 9（quoteFolds describe）+3（fold-memory shape）条，超 AC ≥5；含缺键默认/合法透传/不抛错/JSON 往返/SessionState 键集钉，全为真行为断言无 mock。
- 交付物实存并核实：`reports/IT-03-FE-02/IT-03-FE-02-impl.png`（内容确为 DevTools Local storage `veloxmark.session` 含 `quoteFolds:{/docs/a.md:…}`，AC 阶段 1 实现图达成；正文 `reports/FE-02/` 为模板路径，与 IT-02 FE-03 已注明的调度覆盖惯例一致）+ selftest.md 含脏数据输入/输出对照表（阶段 2 达成）。
- i18n/快捷键回显（AC-FN-07/AC-RULE-11）：本任务纯存储面，无 en/zh 字面量、无「▸」文案、无 shortcut 改动（N/A，无失分面）。
- headingFolds 收紧无消费方回归：useFoldSync.ts:91-107 写回 valid 过滤 + `?? []`，空条目剪除与「全展开」恢复态等价（已核）。

### 问题清单

| severity | item | detail | location | suggestion |
|---|---|---|---|---|
| Minor | 校验口径严于任务/合同字面 | '' 元素（属 string）被丢弃、过滤后空数组条目剪除；任务写「元素仅 string」、STORE §3.2 写「仅保留 string 类型」「可保留或剪除」。真实数据永不产生 '' id（foldKey=`level:text`、块 id=`q:*`），无行为风险，但属期望数据字面偏差（本项计 -3） | store.ts:407-408 | 将 STORE §3.2 与任务校验规则冻结为「string 且非空、空条目剪除」（已被 store.test.ts:88-93/185-197 钉住），消除文档开口 → doc-reconcile 登记候选 |
| Minor | headingFolds 脏条目口径收紧 | 空键/空数组脏条目由保留→丢弃（normalizePerFileIds 共用所致）；对 Q10「不改既有字段语义」字面收紧。实现注已披露、store.test 已改钉、消费方等价 | store.ts:402-411, 444 | 在 change-log 备注该收紧归 FE-02 收口，避免回看误判 IT-02 FE-09 回归 → 登记候选 |
| Minor | 自测报告 grep 断言不精确 | 称「恰好 3 处（L121/L190/L428）」，实际 grep 4 命中（store.ts:13 头注释亦含 quoteFolds）且行号已漂至 134/203/445 | reports/IT-03-FE-02/IT-03-FE-02-selftest.md:69 | 改为「3 个写点 + 1 处注释」或去注释中 quoteFolds；行号引用改为内容锚点 → 登记候选 |
| Info | __proto__ 键边缘 | `out[path]=` 赋值遇 `'__proto__'` 键改写局部对象原型（JSON.parse 会产出该自有键）——FE-09 收口批已登记存量，本批不扣 | store.ts:408 | 随 FE-09 收口批用 `Object.create(null)`/hasOwn 统一收口 |
| Info | 阶段 3 联调未闭环 | 任务自述待 FE-08；FE-08 消费方 useQuoteFold.ts 已在树且合同面已静态核对一致 | tasks/IT-03/FE-02.md:114-117 | FE-08 过审后补跑阶段 3 勾选（折叠增删/跨重启/正文逐字节不变） |

### 结论

小而完整的存储合同扩展：3 写点落位准确、白名单逐字段、脏数据降级不抛错、测试超配且全为真行为断言、交付物实存并逐项核实。唯一计扣为清洗口径较任务/合同字面更严的精确性偏差（无真实数据影响，文档冻结即可收口）。97 ≥ 90，✅ 通过。
