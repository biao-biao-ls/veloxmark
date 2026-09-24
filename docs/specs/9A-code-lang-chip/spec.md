# 9A spec — 代码块语言 chip 右下角化 + 可点击切换语言（含 9.3 显示名）

> 看板任务：⑦ 9.1（`docs/markdown-ux-optimization.md` P1，**代码块核心交互缺口**），**含 9.3**（语言 id → 可读名称）。依赖无（语言列表将供 ⑪ 10.3 mermaid chip 复用）。spec id `9A-code-lang-chip` 与批次号绑定。

## 背景 / 差距（what & why）

对照基准截图 `temp/typora/code-focus.png`：Typora 聚焦态代码块右下角有「typescript」语言 chip，点击弹出语言列表，选择后改写 fence info 串、高亮即时切换。

VeloxMark 现状（P28/P29 面板已领先部分）：聚焦面板开栏 fence 被 `CodeLangChip` 替换（左上角纯展示、raw id、不可点）；闭栏 fence 用 `hide` 隐藏；**无语言切换 UI**——只能手改 ```` ``` ```` 后的 info 串；chip 文本是 raw id 且 CSS `text-transform: lowercase`。**What**：语言 chip 移到面板右下角（末行）、变为可点击按钮，点击弹语言选择弹层（常用语言 + 搜索），选择即改写 info 串；chip 与列表以可读名称显示（`typescript` → `TypeScript`），未知 id 原样。**Why**：语言切换是代码块最高频元操作，补上可发现的直达入口；可读名称降低 id 记忆成本。

## 布局归属（红线 10 / 与 8B chip 约定的同构论证）

- chip = **闭栏 fence 的 replace widget**（与开栏 `CodeLangChip` 现状同型：replace 占位，零新增行/块）。CSS 绝对定位于末行右下：行 class `.cm-md-code-src-last` 加 `position: relative`，chip `position:absolute; right/bottom`——**与 8B `dualPane.ts` chip 约定同构**（「行 class `position: relative` + chip `position: absolute`——零布局成本」），只是锚点从首行右上换到末行右下（对照基准图）。纯 paint，零布局抖动（红线 10）。
- 末行（闭栏 fence 行）经 `hide` 语义本就视觉空白（```` ``` ```` 被 replace 掉），chip 叠在其右端不压正文。
- 未闭合 fence（单 CodeMark、无闭栏）：无 chip——瞬态输入，闭合即现；开栏行此时本就显形 ```` ```lang ````（P09 触碰语义），无丢失入口。
- 弹层 = body 级 fixed popover（gridPicker 同款 DOM 单例）：语言列表是临时 UI，不进文档布局流。

## AC（可测试）

1. **显隐**：chip 仅聚焦态（`blockTouched` 面板分支）可见；静息渲染块无 chip；光标落在闭栏 fence 行上时 fence 显形、chip 让位（P09 mark 触碰语义不变）。
2. **位置**：面板右下角（末行），对照 `code-focus.png`；进/出聚焦正文零位移。
3. **点击弹层**：点击 chip 弹出语言列表——**常用语言优先** + 其余 hljs 注册语言（按显示名排序）+ 顶部搜索框（打字即时过滤）；item 显示可读名称 + raw id 副行。
4. **切换语义**：选择后改写 fence info 串（一次 transaction，userEvent `input.code.lang`），语法高亮即时跟随；选同语言为 no-op（零改动）；改写在事件时按 fence 起点 hint 重解析（红线 4），hint 失效则零改动。
5. **9.3 显示名**：`typescript` → `TypeScript` 等 hljs 规范名正确；未知 id（如 `mermaid`、自造词）原样显示；空 info chip 显示 `text`（与静息 label 契约一致）。
6. **非法/未知语言不崩**：源码里手写未知 id 时 chip/渲染均原样回退（既有 `highlightCodeHtml` 回退不动）。
7. **键盘可达**：弹层 ↑↓ 移动高亮、Enter 确认、Esc 关闭、输入框打字过滤；外部点击关闭、零改动取消。
8. **开栏 fence chip 退役**：开栏 fence 未触碰时改为 `hide`（与闭栏原语义对称）；闭栏 chip 承接语言展示 + 切换。光标触碰开栏行显形 ```` ```lang ````（P09 不变）。
9. **e2e 缝不破坏**：`__velox*`/`data-op`/命令 id 零改动；`.cm-md-code-src-chip` class 与 `CodeLangChip` widget 名**保留**（位移而非消灭——build.test 反射与未知外部探针的兼容面）；新 DOM class 为 add-only。
10. **Widget 纪律**（红线 3/4）：`eq` 含 `lang`/`fenceFrom`/`i18nEpoch`；`ignoreEvent: true`（chip 自持事件，防点按落进文档触碰 fence）；按钮 mousedown `preventDefault + stopPropagation`。

## Out of scope（明确不做）

- 静息态语言顶栏（`.cm-md-code-lang` label）与导出面 `export-code-lang` 文本——⑬ 9B 归口（顶栏将降级/并入本 chip）。
- ⑪ 10.3 mermaid 专属 chip 形态：本 spec 对**全部**聚焦 fence（含 mermaid）通用挂载——⑪ 的「chip + 语言列表」前置达成，剩余（mermaid-focus.png 位置微调、切走/切回图表语义冒烟）归 ⑪ 收口。
- ListPickDialog 组件改造（搜索框等）——见 plan 决策。
- 语言列表的用户自定义/排序持久化。

## 约束引用（红线逐条对应）

1（e2e 缝）→ AC9：命名缝零触碰，chip class/widget 名保留；3（Widget 纪律）→ AC10；4（stale-instance）→ AC4 事件时重解析；5（i18n）→ 新 key `codeLang.*` 同落 en/zh（语言名称本身不翻译——既有契约）；6（按钮皮肤）→ 列表 item 复用 `.list-pick-item` 族；chip 保留既有 `.cm-md-code-src-chip` 皮肤仅加 hover/pointer 态；10（零布局抖动）→ AC2 布局归属节。
