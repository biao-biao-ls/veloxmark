# P15 工程质量加固

优先级：P15 | 类别：工程 | 预估规模：M

## 背景

差距分析中沉淀的工程问题：① 数学渲染用正则每次 transaction 全文档
`sliceDoc + matchAll`（`editor/livePreview/handlers.ts` 的 math 正则
pass），大文件输入性能隐患；
② 无自动化测试，验证靠手动 + CDP 截图；③ ImageWidget 缓存不过期（已归
入 P05）；④ dirty 判定全文比较（已归入 P12）。本需求聚焦性能与测试基建。

## 目标

消除已知性能热点，建立可持续的回归验证手段（单测 + CDP 冒烟），为
P09/P10 这类高风险改造提供安全网。

## 功能需求

### 性能
- [x] 基准脚本：构造 1k/5k/10k 行混合内容文档，测量连续输入 100 字符的
      装饰重建耗时（CDP Performance 或直接 `buildDecorations` 计时），
      记录基线
- [x] 数学扫描范围收窄：按语法树跳过 FencedCode/InlineCode/URL 节点覆盖
      的区间后再跑正则；或按行增量维护 math ranges（StateField 缓存
      未变更区间）
- [x] `buildDecorations` 遍历确认无整树重复 resolve；`update` 中
      `syntaxTree` 比较已是引用比较，核实 treeChanged 触发频率
- [x] Mermaid 渲染限流：并发渲染队列（避免大文档多个图同时渲染阻塞主线程）
- [x] 大目录 watch 推送防抖（若 P07 未做，此处补齐）

### 测试
- [x] 纯函数单测（vitest，node 环境）：`outline/extract.ts`、
      `widgets.ts` 的 `splitRow`/`alignmentOf`/`renderInlineCell`、
      P01 新增的列表辅助逻辑
- [x] 装饰快照测试：给定文档 + 光标位置 → `buildDecorations` 输出的
      装饰区间/类型断言（P00 已把可测内核与 EditorView 解耦，直接测
      纯函数即可）
- [x] CDP 冒烟脚本化：现有 `scripts/cdp-test.mjs` 扩为场景集（打开欢迎页、
      输入标题、切换主题、打开文件夹、截图对比），`npm run test:smoke`
      一键跑
- [x] CI 预留：typecheck + unit + smoke 的 npm scripts 串联（GitHub
      Actions 配置可后补）

## 实现要点

- 基准与优化前后对比数据记录进本目录 `P15-benchmarks.md`（验收依据）。
- 装饰测试的前置条件已由 P00 就绪：`buildDecorations(state, config)`
  是纯函数（`editor/livePreview/build.ts`），配置经参数注入（Facet），
  可在 node 环境以 `EditorState.create` 直接调用——本需求只需接入
  vitest 建快照，无需再改被测函数签名。
- vitest 进 devDependencies，配置独立于 electron-vite（node env 即可，
  不需要 DOM 的部分不引 jsdom）。

## 验收标准

1. 5k 行含 20 个公式的文档，连续输入的单次装饰重建 P95 < 16ms（优化前
   基准写入记录，目标劣化消除 ≥50%）。
2. `npm run test:unit` 覆盖上述纯函数，全部通过。
3. `npm run test:smoke` 在无头环境跑通 5 个核心场景并输出截图。
4. typecheck 在 CI 脚本中失败即红。

## 非目标

- E2E 全量测试框架（Playwright）、渲染像素级对比。

## 实施状态（已完成）

提交：`feat(P15): test infra (vitest + smoke) + math-scan & mermaid perf`
（分支 `feat/P11-P26-scenarios`）。

### 测试基建

- vitest 进 devDependencies；`vitest.config.ts`（node 环境，include
  `src/**/*.test.ts`，mermaid 以测试桩替身隔离浏览器全局）。
- package.json 新脚本：`test:unit`（vitest run）、`test:smoke`
  （scripts/cdp-smoke.mjs）、`test`（typecheck + unit + smoke 串联 = CI 脚本）。
- 单测 6 文件 50 用例全绿：`outline/extract.test.ts`、
  `editor/table/parse.test.ts`（splitRowWithOffsets/alignmentOf/
  renderInlineCell/formatTable/parseTsv）、`editor/assists/lists.test.ts`
  （P15 抽出的纯函数 computeIndentChanges/collectRenumberChanges）、
  `editor/livePreview/build.test.ts`（EditorState.create + buildDecorations
  装饰区间/类名/widget 断言，含 P09 mark 规则与源码模式短路）、
  `editor/livePreview/extendedSyntax.test.ts`（P11 parseFrontMatter/
  summarizeYaml/collectFootnoteDefs/parseAttrString/正则）、
  `statusbar/stats.test.ts`（P14 字数口径 100 汉 + 50 词 = 150）。
- 配套产品侧 DOM-less 适配（守卫，不改行为）：preferences/store 的
  migrateLegacyKeys / applyPreferencesCssVars / __veloxPrefs、
  table/widget 的 __veloxTable 挂载；字数统计抽到纯模块
  `statusbar/stats.ts`（StatusBar.tsx 原路径 re-export，App 导入不变）。
- CDP 冒烟：`scripts/cdp-smoke.mjs` 端口 9232，5 场景全 PASS
  （欢迎页、标题装饰、主题切换、文件夹文件树、源码模式往返），
  截图落 scripts/tmp-p15/。

### 性能

- 数学扫描收窄：collectMathDecos 一次 syntaxTree.iterate 收集
  FencedCode/InlineCode/CodeText/URL skip-ranges，正则命中改区间相交测试，
  替代逐命中 resolveInner 父链遍历；块级公式同步跳过代码区间。
- Mermaid 渲染限流：renderMermaid 并发上限 2 + FIFO 队列 + cache 命中
  直返不入队。
- 基准：`scripts/bench-decorations.mjs`（端口 9244，经 `__veloxP15.bench`
  在构建产物内计时）；数据与遍历核实结论见 `P15-benchmarks.md`。
  验收门槛 5k 行 / 20 公式 P95 = **4.60ms < 16ms PASS**（基线 4.90ms）。
- 大目录 watch 防抖：核实已由 P07 的 watchRefreshTimer(200ms) 完成。

### 验收对照

1. 5k 行 20 公式 P95 4.60ms < 16ms（前后数据入 benchmarks 文档）✓
2. `npm run test:unit` 覆盖需求列出的纯函数，50/50 通过 ✓
3. `npm run test:smoke` 5 场景 + 截图 ✓
4. `npm run test` 串联 typecheck + unit + smoke，typecheck 红即整体红 ✓
