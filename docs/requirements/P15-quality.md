# P15 工程质量加固

优先级：P15 | 类别：工程 | 预估规模：M

## 背景

差距分析中沉淀的工程问题：① 数学渲染用正则每次 transaction 全文档
`sliceDoc + matchAll`（`livePreview.ts` L283+），大文件输入性能隐患；
② 无自动化测试，验证靠手动 + CDP 截图；③ ImageWidget 缓存不过期（已归
入 P05）；④ dirty 判定全文比较（已归入 P12）。本需求聚焦性能与测试基建。

## 目标

消除已知性能热点，建立可持续的回归验证手段（单测 + CDP 冒烟），为
P09/P10 这类高风险改造提供安全网。

## 功能需求

### 性能
- [ ] 基准脚本：构造 1k/5k/10k 行混合内容文档，测量连续输入 100 字符的
      装饰重建耗时（CDP Performance 或直接 `buildDecorations` 计时），
      记录基线
- [ ] 数学扫描范围收窄：按语法树跳过 FencedCode/InlineCode/URL 节点覆盖
      的区间后再跑正则；或按行增量维护 math ranges（StateField 缓存
      未变更区间）
- [ ] `buildDecorations` 遍历确认无整树重复 resolve；`update` 中
      `syntaxTree` 比较已是引用比较，核实 treeChanged 触发频率
- [ ] Mermaid 渲染限流：并发渲染队列（避免大文档多个图同时渲染阻塞主线程）
- [ ] 大目录 watch 推送防抖（若 P07 未做，此处补齐）

### 测试
- [ ] 纯函数单测（vitest，node 环境）：`outline/extract.ts`、
      `widgets.ts` 的 `splitRow`/`alignmentOf`/`renderInlineCell`、
      P01 新增的列表辅助逻辑
- [ ] 装饰快照测试：给定文档 + 光标位置 → `buildDecorations` 输出的
      装饰区间/类型断言（把 livePreview 的可测内核与 EditorView 解耦）
- [ ] CDP 冒烟脚本化：现有 `scripts/cdp-test.mjs` 扩为场景集（打开欢迎页、
      输入标题、切换主题、打开文件夹、截图对比），`npm run test:smoke`
      一键跑
- [ ] CI 预留：typecheck + unit + smoke 的 npm scripts 串联（GitHub
      Actions 配置可后补）

## 实现要点

- 基准与优化前后对比数据记录进本目录 `P15-benchmarks.md`（验收依据）。
- 装饰测试的关键重构：`buildDecorations(state)` 已是纯函数（依赖
  `livePreviewConfig` 全局——改为参数注入以便测试）。
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
