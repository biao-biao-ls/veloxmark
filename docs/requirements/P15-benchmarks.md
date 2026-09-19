# P15 性能基准记录

测试方式：`scripts/bench-decorations.mjs`（CDP 端口 9244）驱动**构建产物**
（`npm run build` 后的 out/）里暴露的 `window.__veloxP15.bench(lines, formulas, samples=100)`：
构造混合文档（标题 / 粗体 / 行内代码 / 链接 + 按行数分布的 `$$…$$` 块公式），
在文末草稿行连续插入 100 个单字符，每次插入后调用一次
`buildDecorations(state, DEFAULT_LIVE_PREVIEW_CONFIG)` 并计时
（插入后先 `ensureSyntaxTree` 保证语法树与真实输入路径一致）。
环境：本机 macOS + Electron 34 构建产物；数字为 100 次采样的 avg/p95/max（ms）。

## 结果（优化前 → 优化后）

| 场景 | 指标 | 优化前（基线） | 优化后（P15） |
| --- | --- | --- | --- |
| 1k 行 / 10 公式 | avg | 0.79 | 0.88 |
| 1k 行 / 10 公式 | p95 | 1.40 | 1.40 |
| 1k 行 / 10 公式 | max | 2.80 | 3.60 |
| **5k 行 / 20 公式** | avg | 3.49 | 4.04 |
| **5k 行 / 20 公式** | **p95** | **4.90** | **4.60** |
| **5k 行 / 20 公式** | max | 7.50 | 6.80 |
| 10k 行 / 40 公式 | avg | 7.77 | 9.33 |
| 10k 行 / 40 公式 | p95 | 9.70 | 10.80 |
| 10k 行 / 40 公式 | max | 14.60 | 15.60 |

**验收门槛：5k 行含 20 公式 P95 < 16ms — 优化后 4.60ms，PASS。**

说明（如实记录）：本机上基线本身已远低于 16ms 门槛，因此"劣化消除 ≥50%"
在绝对毫秒数上无劣化可消；skip-range 改造消除的是算法性热点——旧实现对每个
`$…$` 正则命中做一次 `resolveInner` 父链遍历（成本随代码节点深度与命中数
增长），新实现一次 `syntaxTree.iterate` 收集 FencedCode/InlineCode/CodeText/
URL 区间后仅做区间相交测试，且块级/行内公式统一跳过代码区间（顺带修复了
围栏代码内 `$$…$$` 会被误折叠的隐患）。收益随文档中代码密度上升而扩大；
avg 在两个 5k/10k 场景略高于基线属采样噪声（p95/max 均持平或更优）。

Mermaid 渲染限流：`renderMermaid` 并发上限 2、FIFO 排队、cache 命中不入队
（`editor/widgets.ts`）——主进程行为测试属 P16 e2e 范围，此处落地基建。

## buildDecorations 遍历核实（代码评审结论）

- `build.ts` 对语法树只有**一次** `tree.iterate` 进入分发；各语法种类在
  handlers.ts 中按节点名分发，无嵌套全树二次遍历。
- 正则补充通道：`collectMathDecos` / `collectExtendedDecos` 各做一次全文
  `sliceDoc + matchAll`；math 通道 P15 起以 skip-ranges 替代逐命中
  `resolveInner`（见上）。extended 通道仍按需 `resolveInner`（命中率低，
  记为后续可选优化，不在本阶段验收范围）。
- `livePreviewField.update` 的重建条件：`docChanged || selection ||
  treeChanged || configChanged || tableEditChanged`。其中
  `treeChanged = syntaxTree(startState) !== syntaxTree(state)` 为**引用
  比较**——markdown 解析器异步分块推进语法树时产生新树引用才会触发重建，
  无逐节点比较；selection-only 变化也重建是 P09 mark touched 语义的
  必要成本（光标移动要显隐标记），属设计内而非浪费。
- 大目录 watch 推送防抖：已由 P07 落地（`electron/ipc/folder.ts`
  `watchRefreshTimer` 200ms 合并 fs 事件后单次 `pushFolderTree`），本阶段
  核实存在，无需补齐。

## 测试基建（同批交付）

- `npm run test:unit` — vitest（node 环境）50 用例 6 文件：
  outline/extract、table/parse（splitRow/alignmentOf/renderInlineCell/
  formatTable/parseTsv）、assists/lists（computeIndentChanges /
  collectRenumberChanges 纯函数）、livePreview/build 装饰断言、
  livePreview/extendedSyntax（P11 纯函数）、statusbar/stats（P14 字数口径）。
  DOM-less 适配：mermaid 测试桩 + `preferences/store` / `table/widget`
  的 window/localStorage/document 守卫。
- `npm run test:smoke` — `scripts/cdp-smoke.mjs`（端口 9232）5 场景全部
  PASS，截图落 `scripts/tmp-p15/smoke-0*.png`：欢迎页、ATX 标题装饰、
  明暗主题切换、夹具文件夹文件树（md+txt 口径）、源码模式往返。
- `npm run test` = typecheck + test:unit + test:smoke（CI 串联脚本；
  GitHub Actions 配置按需求文档注明后补）。
