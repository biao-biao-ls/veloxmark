# P18 标题折叠

优先级：P18 | 类别：UX | 预估规模：S–M

## 背景

长文浏览/写作的核心体验之一——按标题折叠章节——VeloxMark 完全没有：
大纲（`components/Outline.tsx`）只读可跳转，编辑器内所有内容始终展开。
Typora 在标题行左侧提供折叠箭头，Obsidian/VS Code 有 fold gutter。P10
已示范了"StateField 持 UI 状态 + 装饰重建"的模式（`editor/table/state.ts`
的 `tableEditField`），折叠可复用同一模式。

## 目标

ATX 标题可折叠其下辖章节：gutter 箭头与大纲面板双入口，折叠状态跨会话
按文件记忆，搜索/大纲跳入折叠区自动展开。

## 功能需求

### 折叠行为
- [x] 标题行 gutter 出现折叠箭头（hover 显示；已折叠显示展开态）；点击
      切换折叠/展开
- [x] 折叠范围：标题行之后到下一个同级或更高级标题之前（H1–H6 层级
      判定）；文档末尾标题折叠到文档尾
- [x] 折叠态视觉：标题行保持可见 + 折叠指示（箭头方向 + 行尾灰色
      `⋯ N 行` 占位 widget）；被折叠内容整体从视图移除（replace 装饰）
- [x] 光标进入折叠区（搜索命中、大纲跳转、方向键滑入）→ 该章节自动展开
- [x] 选区跨折叠区拖选时同样自动展开
- [x] 父标题折叠时子标题一并隐藏；展开父级恢复子级各自的折叠状态

### 大纲联动
- [x] Outline 面板每个条目左侧加折叠三角（与编辑器 gutter 状态同步）
- [x] 点击三角只切换折叠，不移动编辑器光标；点击条目文本仍跳转
      （跳转目标若折叠则先展开）

### 持久化
- [x] 折叠状态按文件路径存入 session（对接 P03 `SessionState`）：以
      **标题文本 + 层级** 为键（pos 仅作加载时匹配提示），避免编辑后
      位置漂移导致状态丢失
- [x] 重新打开文件：标题文本仍匹配的折叠恢复；已删除标题的条目静默丢弃
- [x] 切换到源码模式（P08）：折叠装饰不生效（源码全展开），切回 live
      模式恢复

## 实现要点

- 新模块 `editor/livePreview/fold.ts`：
  - `foldField: StateField<FoldState>`，`FoldState = Map<string, {pos: number}>`
    （键为 `level:headingText`）+ `StateEffect` toggle；doc 变更时 map
    过滤失效条目。
  - 纯函数 `collectFoldRanges(state, foldedKeys): {from, to, key, lines}[]`
    ——同 P15 装饰测试要求，可直接 vitest。
- 装饰生成：`buildDecorations` 读可选 field
  （`state.field(foldField, false)`，同 `field.ts` 对 tableEditField 的
  容错写法）；对每个折叠区间 push `Decoration.replace({ from: 标题行末,
  to: 区间末, widget: FoldPlaceholder(lines) })`——多行 replace 由
  StateField 提供的装饰集承载（CM6 限制，见 README 通用约束）。
- 自动展开：foldField 的 update 监听 selection——选区/光标与折叠区间
  相交时 dispatch 展开 effect（注意在 field update 内用 effect 声明而非
  嵌套 dispatch）。
- Gutter：新增 CM6 `gutter({ class: 'cm-md-fold-gutter', markers })`，
  与 `gutterCompartment`（`setup.ts`，现管 lineNumbers）并列挂载；marker
  在 buildDecorations 同一 StateField 中产出（fold markers 也须 field
  提供）。
- 大纲联动：`outline/extract.ts` 输出增加 `level`（已有解析路径可复用）；
  `Outline.tsx` 接 `foldedKeys` + `onToggleFold` props；App 持有
  foldField 的读写桥（effect dispatch 经 viewRef）。
- 持久化：`preferences/store.ts` 的 `SessionState` 增
  `headingFolds: Record<filePath, string[]>`；打开文件加载、toggle 时
  写回（沿用 `patchSession`）。
- 性能：折叠只影响可见区渲染，foldRanges 计算在 build 遍历内完成（按
  标题节点 O(headings)），5k 行基准不得劣化（P15 基准脚本覆盖）。

## 验收标准

1. 点击 H2 标题 gutter 箭头：其下内容消失，标题行尾出现 "⋯ N 行"；再点
   恢复，正文位置无跳动。
2. H2 折叠时其下 H3/H4 一并隐藏；展开 H2 后先前单独折叠过的 H3 仍为
   折叠态。
3. 搜索命中折叠区内文字：跳转时该章节自动展开并定位。
4. Outline 点击三角折叠：编辑器同步折叠，光标不动；重启应用打开同一
   文件折叠状态保持。
5. 源码模式下折叠内容全部可见；切回 live 模式折叠恢复。
6. 5k 行文档开启/关闭折叠操作无可感知延迟（对照 P15 基准）。

## 非目标

- 列表/代码块/段落级折叠（代码块折叠见 P24）
- 缩进式（setext/缩进代码）折叠、front matter 折叠（属 P11）
- 折叠状态导出语义（导出永远输出全文）

---

## 实施状态（已完成）

实现与上文"实现要点"的两处偏差（均按要点的意图落地，细节更简）：

- **foldField 存 `Set<string>` 而非 `Map<string, {pos}>`**：pos 在每次
  需要时由 `extractOutline` 现算（foldKey `level:text` 已足够定位），
  doc 变更时只过滤"标题文本不再存在"的 key，无需 map 中的陈旧 pos。
  三个 StateEffect：`toggleFold(key)` / `expandFolds(keys[])`（大纲跳转
  定向展开）/ `restoreFolds(Set)`（文件打开时会话恢复，整体替换）。
- **折叠 gutter 是独立的 `gutter()` 扩展**（`fold.ts` 内
  `foldGutterExtension`，class `cm-fold-gutter cm-md-fold-gutter`），不走
  buildDecorations/markers——CM6 行级 gutter marker 由 gutter 扩展自身的
  `lineMarker` 产出即可，且 `lineMarkerChange` 按 foldSet 身份变化精确重绘；
  lineNumbers 仍在原 `gutterCompartment` 中独立开关。源码模式下
  `lineMarker` 返回 null（无箭头）且 buildDecorations 早退（无装饰），
  fold key 保留，切回 live 恢复。

关键实现位置：

- `editor/livePreview/fold.ts`：foldKey / collectFoldRanges（纯函数，外层
  区间过滤：父子同折只出父 range，防 CM6 重叠 replace 报错）/ foldField
  （selection 相交自动展开 + docChanged 键过滤均在 field.update 内，无嵌套
  dispatch；`tr.selection` 仅在显式选区事务上存在，故 effect-only 的
  gutter 点击不会刚折即展）/ FoldPlaceholder（行尾 `⋯ N 行`，可点击展开）/
  FoldArrowMarker + gutter。
- `livePreview/build.ts`：fold 区间内所有装饰先过滤（同样防重叠），再
  push replace + FoldPlaceholder；由 `livePreviewField`（StateField 提供，
  满足 CM6 多行 replace 限制）在 foldField 身份变化时重建。
- `editor/setup.ts`：foldField + foldGutterExtension + foldPlaceholderClick
  进 createExtensions；updateListener 在折叠 effect 或 foldField 身份变化
  时回调 `onFoldChanged`。
- `App.tsx`：`syncFoldedKeys`（签名门控 setState + patchSession 写
  `headingFolds[filePath]`）/ filePath 变化 effect 用 `restoreFolds` 恢复
  （标题文本仍存在的 key 才应用）/ goToHeading 先 `expandFolds` 目标再跳转
  / Outline 接 `foldedKeys`+`onToggleFold`（三角 click stopPropagation +
  mousedown preventDefault，光标不动）/ `__veloxP18` e2e hook。
- `preferences/store.ts`：`SessionState.headingFolds: Record<filePath,
  string[]>` + 加载 sanitize；`useFileOps.loadContent` **先 setFilePath/
  filePathRef 再 dispatch 换文**，且 `syncFoldedKeys` 在
  `suppressDirtyRef`（程序化加载）期间跳过 session 写回——换文件时
  foldField 丢弃旧文件 keys 是加载语义而非用户展开，否则切换文件会把
  目标文件的会话折叠先清空（e2e 曾复现，已修）。
- `components/Outline.tsx`：条目左侧 `outline-fold` 三角；
  `i18n en/zh`：`fold.placeholder`（`⋯ {n} lines`/`⋯ {n} 行`）、
  `fold.toggle`；`styles.css`：gutter 箭头（hover/折叠态显隐）、
  placeholder、大纲三角样式。

测试证据：

- 单测 `livePreview/fold.test.ts`：15 例——foldKey、collectFoldRanges
  （区间跨度 13 行 / 文末标题 / 父子同折只留外层 / 空章节跳过 / 无
  foldField 纯计算）、foldField（toggle、选入折叠区自动展开、选区停在
  标题行不展开、跨区拖选展开、改标题文本丢键）、buildDecorations×folds
  （replace+FoldPlaceholder 行数对齐、区间内无重叠装饰、源码模式 0 装饰）、
  headingAtLine。`npm run test:unit` 88/88。
- E2E `scripts/cdp-p18.mjs`（端口 9235）57/57 ALL PASS：gutter 折/展 +
  `⋯ 13 行` + DOM 正文隐藏/恢复 + 箭头/大纲三角状态 + 光标不动 + session
  记录；嵌套折叠（H2+H3 同折只出外层、展 H2 保 H3）；搜索跳转/选区跳入
  自动展开；大纲三角折叠不移光标、条目文本跳转先展开目标、跳入折叠父级
  自动展开父级；占位点击展开；会话持久化（renderer reload 后重开文件恢复
  折叠、切走再切回恢复）；源码模式正文全可见且 keys 保留、切回 live 恢复；
  5k 行 100 章节折叠切换平均 ~3ms（<50ms 上限）。
- `npm run test:smoke` 5/5；typecheck 干净。

无低优未做项：功能需求与验收标准 1–6 全部覆盖。
