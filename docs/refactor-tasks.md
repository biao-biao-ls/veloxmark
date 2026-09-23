# VeloxMark 重构任务清单（四阶段）

> 依据 2026-09-22 架构评估产出。目标：在不改变行为的前提下拆分大文件、收敛重复真源，支撑可持续迭代。
>
> **每阶段完成后回归**：`npm run typecheck && npm run test:unit`（含 i18n/CSS 相关新增测试）。
> **拆分硬约束（全程）**：
> - e2e 缝不可破坏：`window.__velox*` 系列钩子（`__veloxP12`–`__veloxP29`、`__veloxTable`、`__veloxCtxDebug`、`__veloxCtxLastHit`、`__veloxPrefs`、`__veloxTableCellView`）
> - cdp 探针契约：`data-op` id 字面量、`id: 'heading1'` 等命令 id 字面量（探针正则静态扫描）
> - `scripts/cdp-*.mjs` 若扫描文件路径，拆分后需同步更新扫描范围

---

## 阶段 0 — 止血（零行为风险）

> ✅ 已收敛（2026-09-22，SDD 单元 0.1/0.2/0.3，规格见 [docs/specs/](specs/)）。
> 收敛记录：typecheck + 183 unit 全绿；顺手修复收敛中暴露的既有缺陷 1 处（`table/widget.ts` blur 守卫误用 CM6 不存在的 `EditorView.isDestroyed`，改为 `!main.dom.isConnected`）；环境修复：`npm install` 补齐缺失的 vitest 等 265 个包（此前 typecheck 长期红）。

- [x] **0.1 补声明缺失的 CSS 变量**
  - `src/renderer/src/styles.css`：`--bg-inset`、`--fg-muted` 被消费但从未在 `:root` / `.theme-light` / `.theme-dark` 声明
  - 消费点：`.vm-mermaid-lightbox-zoom`（约 L3125）、`.tb-autosave-error`（约 L232）、表格插入对话框（约 L2784）
  - 按现有 token 语义补齐 light/dark 两套值

- [x] **0.2 增加 i18n key 对齐测试**
  - 新建 `src/renderer/src/i18n/i18n.test.ts`
  - 断言：EN/ZH key 集合相等、无重复 key、`{placeholder}` 集合两侧一致
  - 动态 key 前缀白名单：`callout.${type}`、`cmd.heading${n}`、`tableInsert.${k}` 等（避免误报死 key）
  - 可选：断言静态 `t('…')` 引用 ⊆ EN ∪ 白名单

- [x] **0.3 清理疑似死代码（先 Grep 复核再删）**
  - `src/renderer/src/editor/table/widget.ts`：`commitActiveCell`（无外部引用）
  - 同文件 `resolveTableModel`：仅 testHook 内用，可降为内部（不导出）
  - `src/renderer/src/editor/table/index.ts`：无人消费的 barrel，删除或让 `livePreview/handlers.ts` 改走 barrel 二选一
  - `src/renderer/src/editor/widgets.ts`：`clearMermaidLastGood` 注释称被 test/theme hook 用，实际未接线——确认后删除或接线

---

## 阶段 1 — 高收益低风险（机械搬运为主）

### 1A. 拆 App.tsx（2642 行 → 目标 < 2000 行）

- [x] **1.1 e2e 类型声明外移**：`declare global` 的 `__veloxP12`–`__veloxP29` 等约 284 行（App.tsx 约 L100–384）→ `src/renderer/src/e2e/handles.d.ts`
- [x] **1.2 e2e seam useEffect 外移**：约 300 行 seam 装配（约 L720–2300 区间内）→ `src/renderer/src/e2e/seams/`，按 P 编号分组（如 `p26.ts`…`p29.ts`），App 只保留统一装配入口
- [ ] **1.3 复核剩余业务回调**，如有明显独立域（如折叠同步、会话持久化 effect 群）可顺势下沉到 hooks（可选）

> ✅ **1A 收敛记录（2026-09-22）**：App.tsx 2642 → 1702 行。`declare global` 块（285 行）**原样平移**至 `e2e/handles.d.ts`（import-type 头 + 全局类型即 e2e 契约，编译器守护）；18 行 null 初始化 → `e2e/seams/index.ts` 模块副作用（import 时执行）。15 个 seam effect 体**逐字节平移**至 `e2e/seams/`（p12–p26、p24-p29）：P12 特例——`installP12Handle` 只外提 handle 字面量，`onQueryClose` 订阅 effect 留 App 原位；P24/P28/P29 三 handle 共享单 effect 原状保持（`useP24P29Seam`）；P28/P29 两份同体 `themeToken` 提为模块私有 `probeThemeToken`（spec 授权同文件去重），其余零改动。dep 数组逐项保持（含 exhaustive-deps 抑制位）。ref 归属 grep 复核：**seam-only 随迁** statsRef/loadContentRef/mermaidDialogOpenRef/calloutDialogOpenRef；**业务共用留 App 走 deps** sidebarModeRef（修正规格「随迁」假设——`openGlobalSearch` 消费）/toastRef/tableDialogRef/tableFormRef/lastFormatRef/formatWarningsRef/mpProbeRef/openExternalImplRef/restoreFoldsForRef/lastAutoSaveAtRef（P12 install 非 hook，ref 留 App 传入）。App 唯一装配入口 `useE2eSeams`（hook 序 = 原 effect 序 P14→P20）；`__veloxEditor` 赋值留 create-editor effect（编辑器生命周期非 seam）。顺手清除 20 个 seam 独占 import、折叠切口空行。收敛：typecheck 双配置 + 190 unit 全绿（18 文件）。1.3 复核完成：按 [1A spec](specs/1A-split-app/) 不做业务下沉，若做另立单元（同 1.7 处理）。

### 1B. 拆 styles.css（3131 行 → styles/ 目录）

- [x] **1.4 按注释 section 切文件**（切割线即现有注释边界）：
  ```
  src/renderer/src/styles/
    tokens.css           L7–78    :root 词表
    themes.css           L80–156  .theme-light/.theme-dark + .app
    chrome.css           L158–530 标题栏/菜单栏/窗口控制/布局骨架
    filetree.css         L532–650 文件树 + 树菜单
    context-menu.css     L652–733 编辑器右键（与 .velox-ctx-menu / .tree-menu 共享皮肤）
    overlays.css         L735–920 对话框 + Quick Open（+ L1791 ListPickDialog + L2745 表格插入）
    forms.css            L922–1076 .prefs-* 家族（被 Preferences/ExportDialog/TableInsertDialog 共用，故不叫 preferences.css）
    editor-modes.css     L1078–1222 写作模式 + 编辑器内查找面板
    markdown.css         L1224–2211 Markdown 渲染（可后续再细分）
    ext-syntax.css       L2213–2319 P11 扩展语法
    global-search.css    L2321–2621 P13 全局搜索面板
    statusbar.css        L2623–2743 状态栏
    code-chrome.css      L2789–2880 P24 代码块增强 + P28 聚焦面板
    mermaid-preview.css  L2882–2992 P25 mermaid 预览面板
    tabs.css             L2994–3116 P26 标签栏
  ```
  - 原 `styles.css` 改为按序 `@import`（或由 `main.tsx` 依次 import），对外零改动
  - 把文件尾游离的 `.vm-mermaid-lightbox-zoom`（L3118–3131）归还到 lightbox 区
- [x] **1.5 提取阴影/焦点环 token**：`--shadow-pop`（3 处重复）、`--shadow-modal`（2 处）、`--focus-ring`（2 处）
- [x] **1.6 收敛 `.theme-dark` 旁路补丁**（约 6 处选择器级暗色补丁 + callout 色 light/dark 整段复制 ×2）：能翻转成 token 的翻转进 `.theme-dark`，不能的在所属模块内就近保留 theme 段
- [ ] **1.7 按钮皮肤归并（可选）**：5 套平行按钮（`.dialog-btn` / `.cm-search .cm-button` / `.sidebar-mode-seg button` / `.sb-stat-btn` / `.mermaid-preview-bar button` / `.tab-context-menu button`）抽共享 primitives（`.btn` / `.btn-primary` / `.btn-danger`），注意 `.dialog-btn-primary` 的暗色特例（L917–919）

> ✅ **1B 收敛记录（2026-09-22）**：3141 行 → `styles/` 15 文件（tokens 84 / themes 92 / chrome 374 / filetree 120 / context-menu 83 / overlays 289 / forms 156 / editor-modes 146 / markdown 946 / ext-syntax 108 / global-search 302 / statusbar 122 / code-chrome 93 / mermaid-preview 112 / tabs 124）+ barrel 15 行 `@import`（`main.tsx` 零改动）。moved 块（ListPickDialog、表格插入、lightbox-zoom 尾块）选择器均组件私有，已验证无第二落点；`scripts/cdp-*.mjs` 不扫 styles.css。1.5：3 个 token 进 `:root`，7 处字面量改引用。1.6：callout 图标 16 行主题复制 → `var(--co-bar)` + 8 行主题无关 glyph；katex 暗色 `#d4d4d4` → `var(--fg)`；lightbox 遮罩 → `--lightbox-scrim`（themes 双套）；lightbox svg 暗补丁（== dark `--bg`）删除；`.dialog-btn-primary` 暗补丁归位基础规则旁；mermaid-error 琥珀三色 / `.list-pick-item.is-active`（#111 vs #1e1e1e 值不同）按判定表就近保留。收敛：typecheck + 183 unit + `npm run build`（CSS 产物 `index-*.css` 正常）。规格：[docs/specs/1B-split-styles/](specs/1B-split-styles/)。1.7 未做（可选，另立单元）。

### 1C. 主题色单源化

- [x] **1.8 确立唯一色值源**：以 `src/renderer/src/export/palette.ts` 为单一定义（或新建 `src/renderer/src/theme/tokens.ts`）
  - `styles.css`（→ `themes.css`）的 `.theme-light/.theme-dark` 消费同一套值（构建期注入或手工对照 + 测试守护二选一）——**取「手工对照 + 测试守护」**（不做构建期注入，见 [1C spec](specs/1C-theme-palette/spec.md) 不做）
  - `export/exportCss.ts` 的 `lightVars/darkVars` + callout 色（L308–315）改为从 palette 引用——callout 16 行 → `calloutCss(…)` 生成；`inlineStyles.ts` 的 `co` 字面对象 → `DARK_CALLOUTS`/`LIGHT_CALLOUTS`（tuple 形状不变）
  - `editor/livePreview/hljsTokens.ts` 的 hljs 映射表标注引用关系——上游 `highlight.js/styles/github*.css` 由 widgets.ts/buildDocument.ts scope 注入，不走 palette
  - 注意导出侧 class 名 `.export-theme-light/.export-theme-dark` 与运行时 `.theme-*` 的对应关系一并文档化——palette.ts 文档头 + 导出 `RUNTIME_CSS_VAR`（含 `bgAlt` → export `--bg-alt` vs runtime `--bg-sidebar` 错位）
- [x] **1.9 加一致性测试**：断言 palette 值与 styles.css 声明一致（读文件解析或快照），杜绝再次漂移——新增 `export/palette.test.ts`

> ✅ **1C 收敛记录（2026-09-22）**：palette.ts 成为唯一色值源——新增 `CalloutType`/`CalloutColors`/`LIGHT_CALLOUTS`/`DARK_CALLOUTS`/`RUNTIME_CSS_VAR`（8 型 × bar/bg × light/dark，值取自原三处手工同步）；`exportCss.ts`/`inlineStyles.ts` callout 字面 hex 全部消失（引用生成，生成规则行逐字节等价有测试钉住）；hljsTokens.ts 头部标注色源关系。`palette.test.ts`（+7 用例）读 `styles/themes.css`/`styles/markdown.css` 断言 10 token × 2 主题 + callout 16 行 == palette，改色流程：改 palette → 跑测试 → 同步被点名的 CSS 行。游离 hex（mermaid-error `#d1242f`、katex `#d4d4d4`）按 spec 不做，另立清理项。收敛：typecheck + 190 unit 全绿（18 文件）。规格：[docs/specs/1C-theme-palette/](specs/1C-theme-palette/)。

### 1D. 拆 handlers.ts（907 行，TS 侧最安全的首个拆分）

- [x] **1.10 抽共享层** `editor/livePreview/handlers-ctx.ts`：`BuildCtx`、`PendingDeco`、6 个 Decoration 单例（`hide`/`markEm`/`markStrong`/`markDel`/`markCode`/`markLink`/`markLinkBroken`）、小工具（`nodeText`/`hideMarkerWithSpace`/`listDepth`/`quoteDepth`）
- [x] **1.11 拆 tree handlers** `handlers-tree.ts`：全部 `enter*`（行内/标题/链接/图片/列表/引用/callout/hr/任务）
- [x] **1.12 拆表格+围栏代码** `handlers-code.ts`：`enterTable`、`enterFencedCode` + 私有 `buildFocusedCodePanel`（唯一同时碰 table/state 与 codeBlockUi/hljsTokens 的段，文件头注明「装饰层感知编辑会话」语义）
- [x] **1.13 拆数学 pass** `handlers-math.ts`：`collectMathDecos` + `MATH_SKIP_NODES`（文件头注明「须在树 pass 之后跑」契约；与 `export/renderDoc.ts` renderTextRun 是手工平行实现，语法改动双处同步）
- [x] **1.14 拆扩展语法 pass** `handlers-extended.ts`：`collectExtendedDecos`（front matter/脚注/highlight·sup·sub/缩写/定义列表/属性）。~~把局部闭包 `inInlineSyntax`/`inlineMarkPass`/`bodyFrom` 提升为参数化工具~~ **plan 修订**：整函数纯平移、局部闭包原样保留，零代码形状变化（见 [1D spec](specs/1D-split-handlers/spec.md) AC4）
- [x] **1.15 保留 `handlers.ts` 作 re-export barrel**（下游 `build.ts` 零改动），或直接改 `build.ts` import；**解开循环依赖** `build → handlers → table/widget → livePreview/field`

> ✅ **1D 收敛记录（2026-09-22）**：907 行 → `handlers-ctx`(81) + `handlers-tree`(315) + `handlers-code`(169) + `handlers-math`(124) + `handlers-extended`(269) + barrel(19)。解环走注入缝 `setNestedPreviewField`（`table/widget.ts` 消费、`editor/setup.ts` 装配时接线，`mountCellEditor` 内嵌套编辑器行为不变）。收敛：typecheck 绿、183 unit 全绿（build 快照 = 装饰输出行为基线）、`npx madge --circular` **0 cycles**（解环前 1 环）。规格：[docs/specs/1D-split-handlers/](specs/1D-split-handlers/)。

---

## 阶段 2 — 结构性拆分

### 2A. 拆 widgets.ts（1445 行）

- [x] **2.1 前置：抽 `editor/blockWidget.ts`**：`BlockWidget` 基类 + `BlockToolbarItem`（`table/widget.ts` 也依赖）
- [x] **2.2 抽纯函数层** `editor/render-helpers.ts` + `editor/image-parse.ts`：`highlightCodeHtml`、`renderKatexHtml`、`parseImageMarkdown`、`flipTransform`、`splitHighlightedLines`（零状态、DOM-less 可测；让 `export/renderDoc.ts` 脱离 widgets 大文件）
- [x] **2.3 拆 mermaid 管线** `editor/mermaid/`（约 450 行）：渲染核心 + 并发闸 + 缓存 + 错误态记忆 + 导出 IO seam + `MermaidWidget`。**`mermaidCache`/`mermaidLastGood`/`mermaidIoOverride` 等模块状态必须与消费方单一归属**；同步更新 5 处 import（MermaidPreviewPanel / opsBlocks / App / renderDoc / handlers）
- [x] **2.4 拆图片组** `editor/image-widget.ts`（约 380 行）：`ImageWidget` + `imageCache` + 选中态/缩放工具栏；`closeAllImageSelections` 被 `editor/images.ts` 引用需改路径
- [x] **2.5 拆代码块组** `editor/codeBlock-widget.ts`（约 220 行）：`CodeBlockWidget`、`CodeLangChip`、scoped CSS 注入（`ensureScopedCss` 一次性守卫随之迁移）
- [x] **2.6 小 widget 归并**：`FrontMatterWidget`/`FootnoteRefWidget`/`FootnoteDefBackWidget`/`TaskWidget` → `editor/widgets-extended.ts`；`MathBlockWidget`/`InlineMathWidget` → `editor/widgets-math.ts`
- [x] **2.7 widgets.ts 收尾**：仅留 barrel 或删除；补/迁移 `widgets.p24.test.ts` 的导入路径

> ✅ **2A 收敛记录（2026-09-23）**：widgets.ts 1445 → 32 行纯 barrel；实现落 11 模块：`blockWidget`(125) / `render-helpers`(78) + `image-parse`(42) / `mermaid/`{render 77, exportIo 134, errMemory 30, widget 177, index 8} / `image-widget`(350) / `codeBlock-widget`(191) / `widgets-math`(63) / `widgets-extended`(229)。body 原样平移（含注释），**模块状态单一归属**：`mermaidCache`→`mermaid/render`、`mermaidLastGood`→`mermaid/errMemory`、`mermaidIoOverride`→`mermaid/exportIo`、`imageCache`/选中态→`image-widget`、scoped CSS 一次性守卫→`codeBlock-widget`。消费方全部改道直连（table/widget、renderDoc、MermaidPreviewPanel、opsBlocks、useAppTheme、p16、handles.d.ts、handlers-code/tree/math/extended、images.ts、App、widgets.p24.test），barrel 仅作兼容兜底（`widgets.p24.test.ts` 已迁 `render-helpers`）。非平移点 3 处（行为等价/可见性）：① `IMAGE_MARKDOWN_RE` 从 image-parse 导出（`rewriteImageNode` 回写需原始捕获组）；② `mermaidLastGood` 经 `getMermaidLastGood` 访问器读取（widget 不直接摸 Map）；③ mermaid 消费方 import 改 `editor/mermaid` 桶（handlers-code 的 CodeBlockWidget/MermaidWidget 分两路）。收敛：typecheck 双配置 + 201 unit 全绿（20 文件）；`npx madge --circular --extensions ts,tsx` **双侧 0 cycles**（renderer 176 文件 / electron 18 文件）；`window.__velox*` 缝形状零改动（`setMermaidExportIo` 类型链经 mermaid 桶钉住）。行为不变类——建议人工冒烟：mermaid 渲染/导出 SVG·PNG/灯箱、代码块折叠·复制·行号换行、聚焦代码面板 chip 与 P29 高亮、图片缩放/翻转工具栏与缓存刷新、任务勾选、front-matter/脚注跳转。规格：[docs/specs/2A-split-widgets/](specs/2A-split-widgets/)。

### 2B. 拆 commands.ts（874 行）

- [x] **2.8 零风险外提**：`fmtShortcut` → `commands/shortcutDisplay.ts`；`matchGlobalShortcut` → `commands/shortcutMatch.ts`（顺手补单测）；`MENU_LAYOUT` + `buildMenus` + `buildRecentSubmenu` → `commands/menuLayout.ts`
- [x] **2.9 `buildCommands` 按域拆**：`commands/fileCmds.ts` / `editCmds.ts` / `formatCmds.ts` / `tabsCmds.ts` / `viewCmds.ts` / `insertCmds.ts`，各返回 `Command[]` 后 concat。**命令 id 字面量不可改**（cdp 探针契约），拆后同步探针扫描文件范围
- [x] **2.10 `CommandOps` 拆域接口**（28 字段 → `FileOps & EditOps & ViewOps & …`）；同步 `useMenus.Args` 与 App.tsx 的 `commandOps` 对象字面量
- [x] **2.11 命令表缓存**：App.tsx `setCtxRuntime` 中 `runCommand`/`isCommandDisabled` 每次重建全表 `buildCommands().find(id)` → 改 Map 缓存（热路径）
- [x] **2.12 快捷键双源治理**：`commands.ts` 的 `shortcut` 与 `electron/main.ts` 的 `DARWIN_COMMAND_ACCELERATORS` 加一致性测试，或改为单源派生

> ✅ **2B 收敛记录（2026-09-23）**：commands.ts 874 行 → `commands/` 13 模块（types 111 + 六域 builder file 77/edit 160/format 194/tabs 33/view 147/insert 33 + build 25 + shortcutDisplay 10/shortcutMatch 47/menuLayout 168 + commandCache 27 + index barrel 36）。`from './commands'` 两消费方（App/useMenus）import 零改动。**concat 序是行为**：file → edit → format → tabs → view → insert 保持 `reopenClosedTab`（Ctrl+Shift+T）遮蔽 `toggleTheme`（同键）的现状。2.10：`CommandOps` = `FileCmdOps & EditCmdOps & FormatCmdOps & TabsCmdOps & ViewCmdOps & InsertCmdOps`（`Cmd` 后缀避让 seams 的 `FileOps`），28 字段集不变 → App `commandOps` 字面量/`useMenus.Args` 零改动；跨段归属：showHelp→file、copyAs*→edit、formatDocument+链接命令→format（`openLinkAtCursor`/`copyLinkAddressAtCursor` 随之入 `FormatCmdOps`）。2.11：`commands/commandCache.ts` 按 ops 身份缓存 Map（run 闭包新鲜度与逐次 buildCommands 等价），App 热路径两处 `.find` 替换为 `cmdCache.get`。2.12：`DARWIN_COMMAND_ACCELERATORS` 平移 `electron/shared/commandAccelerators.ts`（纯数据，main.ts 改 import）+ `shortcutSync.test.ts` 双源守护（派生规则 `Ctrl+→Cmd+`，例外登记 `copyRichText → CmdOrCtrl+Shift+C`，钉住 bold/italic/inlineCode 故意无加速键）——2.18 抽 `menu/darwin.ts` 时 `commandItem` 从 shared 取表。新单测 shortcutMatch 8 用例（chord/Shift 精确/Bare-F/Option 字符 code 兜底）+ shortcutSync 3 用例。顺手修复：`Dialog.tsx` 的 CDP 缝 `window.dialog` 加 `typeof window` 守卫（node 单测可引 build 链，渲染进程行为不变）。收敛：typecheck 双配置 + 201 unit 全绿（20 文件）；renderer madge 0 cycles（164 文件）；electron madge 现存 4 环（`ipc/index` ↔ files/folder/image/window barrel 环）为**既有债**（2B 未动 ipc/*，记录备查）。**契约同步项**：cdp 探针正则扫描范围需覆盖 `src/renderer/src/commands/**`（探针脚本不在本仓库）。行为不变类——建议人工冒烟菜单栏/全局快捷键（Ctrl+Shift+T 行为=重开标签页）。规格：[docs/specs/2B-split-commands/](specs/2B-split-commands/)。

### 2C. 拆 registry.ts（532 行）

- [x] **2.13** `ctxMenuStore.ts`：runtime 单例 + menuState + listeners + 焦点归还策略（registry L39–81）
- [x] **2.14** `deltaRegistry.ts`：`blockDeltas` 注册表 + `registerContextMenuOps` + `__veloxCtxDebug` e2e 缝（L83–99）
- [x] **2.15** `menuSkeleton.ts`：`sep`/`cmdItem`/各 submenu helpers + `buildContextMenu` + `__veloxCtxLastHit` 缝（L101–310）
- [x] **2.16** `opsTable.ts`：表格 delta 自举段（L312–512，`TableDeltaDeps` + 9 个 op 适配器 + `table-cell` factory）；`data-op` id 不可改；UX-P28 B3 的 `setActiveCell` 语义注释随之迁移

> ✅ **2C 收敛记录（2026-09-23）**：registry.ts 532 行 → `ctxMenuStore`(54) + `deltaRegistry`(28) + `menuSkeleton`(235) + `opsTable`(234) + barrel/入口(54)。四段 body 原样平移（含注释与侧效块）；`registry.ts` 收为 re-export barrel + `handleEditorContextMenu` 入口，**8 个消费方 import 零改动**。非平移点 3 处（均为行为等价）：① `buildContextMenu`/`handleEditorContextMenu` 的 `runtime` 私有态访问改 `getCtxRuntime()`（随迁 ctxMenuStore）；② `sep` 提为 menuSkeleton 导出供 opsTable 共用（单源，不进 barrel）；③ `blockDeltas` 提为 deltaRegistry 导出供 menuSkeleton（barrel 不再导出）。侧效时序经 barrel re-export 链等价（`__veloxCtxDebug` 先于 `table-cell` 注册，与拆分前同序）。收敛：typecheck 双配置 + 190 unit 全绿（18 文件）、`npx madge --circular --extensions ts,tsx` 0 cycles（149 文件）、`__veloxCtxDebug`/`__veloxCtxLastHit` 形状与菜单 id 字面量核验在位。行为不变类——建议人工冒烟右键菜单（普通块/表格单元格/链接）。规格：[docs/specs/2C-split-registry/](specs/2C-split-registry/)。2.17 未做（低优先，另立单元）。
- [ ] **2.17 opsBlocks 整理（低优先）**：抽 `blockHelpers.ts`（L25–94）；让 opsBlocks 复用 `transforms.ts` 的 dispatch 约定，消除重复的 `view.dispatch` 模式；`transforms.ts` 表格段（L133–181）可迁 `editor/table/source.ts`

### 2D. electron 小手术

- [x] **2.18 抽 macOS 原生菜单**：`NATIVE_MENU_STRINGS` + `buildDarwinMenu` + `rebuildDarwinMenu` + `recentFilesSubmenu` + `commandItem` + `NATIVE_CHECKBOX_COMMANDS`（约 280 行）→ `electron/menu/darwin.ts`
- [x] **2.19 游离 ipc handler 归位**：`app:rendererReady` / `app:setRecentFiles` / `app:setMenuCheckedIds` / `app:setLanguage` / `app:closeResponse`（main.ts whenReady 内联）→ `ipc/` 对应域模块，落实 `registerAllIpc` 的「按域分组」注释
- [x] **2.20 IPC channel 字符串收口**：`shared/api.ts` 增加 `export const IpcChannels = { … } as const`，preload 与 ipc/* 都从常量取值（补上类型契约唯一的洞）；`onMenu(channel: string)` 收窄为 `onMenu(id, …)` + `menu:` 前缀函数
- [x] **2.21 `ipc/window.ts` 域归位**：`clipboard:*`（6 个）、`shell:openExternal`、`app:setState` 拆出或挪至正确域模块

> ✅ **2D 收敛记录（2026-09-23）**：按 2.20 → 2.18 → 2.19+2.21 动刀（契约先行）。**2.20**：`IpcChannels` 55 个固定 channel（key = `domainAction` 骆峰，值一字节不动）+ `menuChannel(id)` 落 `shared/api.ts`；preload/`ipc/*`/`main.ts` 裸字面量全量改常量引用（含多行 handle 注册）；`onMenu` 收窄为裸 id（preload 内部 `menuChannel(id)` 前缀），消费方 useMenus（`onMenu(cmd.id)`）+ App 6 处（`'openRecent'`/`'clearRecent'`/`'closeTab'`/`'reopenClosedTab'`/`'nextTab'`/`'closeTabOrWindow'`）同步。**2.18**：`menu/darwin.ts`（~330 行）收纳菜单全量 + 菜单状态随迁（`recentFiles`/`nativeCheckedIds`/`uiLang` + 持久化）+ `setRecentFiles`/`setMenuCheckedIds`/`setUiLanguage`（状态+rebuild）+ `initDarwinMenu(getWindow)`/`installApplicationMenu`；main.ts 只剩生命周期/协议/open-queue/close 拦截（579 → 233 行）。**2.19+2.21**：新建 `ipc/app.ts`（`AppIpcDeps` 注入 `onRendererReady`/`approveClose`/菜单三同步，`closeApproved` 留 main 闭包，`app:setState` 一并归位，`app:setLanguage` 仍 `return true`）、`ipc/clipboard.ts`（6 个）、`ipc/shell.ts`（`openExternal` + 顺带收 image.ts 的 `showItemInFolder`）；window.ts 只剩 `window:*` 5 个 + `zoomBy`。**顺带解既有债**：`GetWindow` 迁叶子 `ipc/getWindow.ts`（files/folder/image/window/app type import 改走叶子，index re-export 兼容）——2B 记录的 electron 侧 4 个 madge 环消除。收敛：typecheck 双配置 + 201 unit 全绿（20 文件）；`npx madge --circular --extensions ts,tsx` **双侧 0 cycles**（electron 18 文件 / renderer 164 文件）；channel 值 diff = ∅（精确字符串替换，值全部不变）；`window.api` 面唯一变化 = `onMenu` 签名收窄（task 2.20 明示）。**遗留缺陷（行为变更，另立）**：App 的 `closeTab`/`reopenClosedTab`/`nextTab` 三监听与 useMenus 全命令 `menu:<id>` 订阅双派发（原生菜单单击会双执行，reopenClosedTab 会重开两张）——本单元机械收窄保持原状。行为不变类——建议人工冒烟：窗口关闭拦截（脏文档三选一对话框）、文件打开队列（启动期 open-file）、菜单栏/快捷键（mac 原生菜单项）。规格：[docs/specs/2D-electron-surgery/](specs/2D-electron-surgery/)。

---

## 阶段 3 — 先立契约再动刀

### 3A. useFileOps.ts（1018 行）

- [x] **3.1 前置：dirty/savedContent 单一真源**：三轨（`dirtyRef` / `tab.dirty` / `setDirty` state）与 savedContent 双写收敛到 tab store；消除 4 处散落的 `isActive ? dirtyRef.current : tab.dirty` 判断
- [x] **3.2 抽公共类型/工具**：`docTabs.ts`（`DocTab`/`DocTabInfo`）——先统一与 `preferences/store.ts` 重复定义的 `SidebarMode`（两处同名类型）；`pathUtil.ts`（`baseDirOf`/`baseNameOf`，App.tsx 内另有手写同逻辑，一并去重）
- [x] **3.3 拆 `useTabStore.ts`**：Map CRUD（`initTabs`/`activateTab`/`closeTab`/`reorderTab`/`reopenClosedTab`/`listTabs`/`tabOrder`/`findTabIdByPath`/`tabContent` 等，约 300 行）；`makeState` 注入 `extensionsRef`
- [x] **3.4 拆 `useDocIo.ts`**：`openDocPath`/`loadContent`/`saveFile`/`saveFileAs`/`saveAllDirtyTabs`/`reloadTabFromDisk`/`maybeFormatForSave`/`markActiveSaved`（约 250 行）
- [x] **3.5 拆 `tabClosePolicy.ts`**：`confirmDiscard`/`queryClose` + `closeTab` 的 dirty 分支（P12 三选一对话框语义一起搬）
- [x] **3.6 保持 facade 兼容**：返回对象是 App/useAutoSave/useWorkspaceTree 共用接口，保留兼容壳或同步改 3 处绑定

> ✅ **3A 收敛记录（2026-09-23）**：useFileOps.ts 996 行（3.1/3.2 后）→ **facade 138 行**，落 4 模块：`pathUtil.ts`(14+测试 5 用例) / `docTabs.ts`(类型叶) / `tabClosePolicy.ts`(144，纯函数叶) / `useTabStore.ts`(544) / `useDocIo.ts`(497)。**3.1** 真源契约：`DocTab.dirty`/`savedContent` 为真源，`dirtyRef`/`dirty` state/`savedContentRef` 为活动 tab 投影，只经 `setActiveDirty`/`setSavedBaseline`/`projectActiveMirrors` 写入；grep 断言写点仅 useTabStore 两 mutator（4 行），`isActive ? dirtyRef` 残留 0。三元/直写收口逐点等价（App 草稿恢复 ×2、onChange、useAutoSave 未命名存盘 → `markActiveSaved(content, null)`，见 plan 等价表）；`savedContentRef` 零读者，refreshTabs 陈旧回写竞态修正不可见。**3.2** `SidebarMode` 收敛 `preferences/store.ts` 单源 + re-export；pathUtil 去重 App ×3/useExport ×1（`getBaseDir` 尾分隔符变体有意不合并且已注释；L1472 `[\/]`-only → `baseNameOf` 为超集修复已文档化）。**3.3–3.5** body 原样平移（含注释）；结构偏差（行为等价）：① `reopenClosedTab` 落 `useDocIo`（复用 openDocPath，落 store 会反向 store→io），闭栈经 `popClosedStack`；② 建 tab 收口 `addTab`/`nextUntitledNo` 原语（原各创建点内联 id 写入）；③ closeTab dirty 分支委托 `resolveTabCloseDirty`（content 提取提前到对话框前，原 lazy 提取——untitled-active Save As 分支 `tab.path/name` 突变原样保留）；④ useAutoSave 绑定面收窄为 `markActiveSaved`（savedContentRef/setDirty/syncAppState 三参删除）。**3.6** facade 返回 key 集逐字保留（42 key 顺序不变，含 3.1 新增 `markActiveSaved`）；`confirmDiscard`/`queryClose` 包装 policy 纯函数注入依赖；回调全部 `useCallback` 稳定身份（App effect deps 契约）。模块 DAG 无环：useFileOps → {useTabStore, useDocIo, tabClosePolicy}，useDocIo → useTabStore，useTabStore → tabClosePolicy。收敛：typecheck 双配置 + 211 unit 全绿（21 文件，pathUtil +5）；`npx madge --circular --extensions ts,tsx` **0 cycles**（192 文件）。行为不变类——建议人工冒烟：多标签 开/关/切换/拖拽排序/重开关闭标签；脏关三选一（单文档命名版 + 多文档列表版）；关末标签关窗；autosave（含未命名草稿）；草稿恢复两条（磁盘优先/草稿优先）；Save / Save As；外部文件变更 reload（活动/非活动 tab）；会话恢复。规格：[docs/specs/3A-split-usefileops/](specs/3A-split-usefileops/)。

### 3B. table/widget.ts（1142 行，耦合最重，最后动）

- [x] **3.7 前置：立 `nestedSession` API**：收拢 `nestedViewInstance` + `pendingHandoff`/`handoffKey` + `activeNestedView` + `mountCellEditor`，提供 `get/commit/mount/destroyHandoff` 显式接口。**destroy↔mountCell 的 handoff 协议两端不可拆散**（correctness-critical，UX-P28 D1）
- [x] **3.8 拆 `resolve.ts`**：模型重解析纯函数（`resolveTableModel`/`resolveWithFallback`，L56–98）
- [x] **3.9 拆 `commands.ts`**（table 域）：`moveCell`/`runTableOp`/`commitActiveOnly`/`exitTableEdit`/`activateCellAt`/`clearTableEditAndFocusSource`/`handleTsvPaste`/`cellClipboard`/`openTableContextMenu`（约 370 行）；**顺带合并三份重复的「提交 pending」逻辑**（勿原样复制）
- [x] **3.10 拆 `keymap.ts`**：`cellKeymap`/`boundaryNav`/`nestedCellTheme` + TSV paste handlers
- [x] **3.11 `widget.ts` 只留 `TableWidget` + 行列把手 + 列宽拖拽 + `tableTestHook`**：testHook 调用 7 个内部函数，拆分后须保持 `window.__veloxTable` 契约（`scripts/cdp-p10.mjs` 依赖）
- [x] **3.12 修复 barrel 状态**：`table/index.ts` 要么成为真实入口（`livePreview/handlers.ts` 改走 barrel），要么删除

> ✅ **3B 收敛记录（2026-09-23）**：table/widget.ts 1151 行 → 残壳 445 行（`TableWidget` 整类 + handleBtn/widthsEqual + tableTestHook + 公共入口 re-export），落 4 模块：`resolve`(61) / `keymap`(123) / `nestedSession`(242) / `commands`(406)（含文件头共 1277 行）。**3.7** handoff 协议两端同模块收拢：`getHandoff`（mount 端 one-shot 消费）/`destroyHandoff`（destroy 端全逻辑：捕获→置 handoff→`commitHandoff` microtask 回写→拆 view→清 `__veloxTableCellView`）/`mountCellEditor`；isRetarget 跳过（diag-P28）与 key 公式 `${t}:${r}:${c}`、one-shot 清除、多拍聚焦、失焦即退场全部原样。**3.8** 重解析原样平移，`resolveTableModel` 补 export（testHook 消费，可见性偏差）。**3.9** 三份「提交 pending」合并为 `pendingCommitChanges`（sentinel 策略参数化：`activateCellAt` 取 `rewrite` 整表重写、`commitActiveOnly`/`clearTableEditAndFocusSource` 取 `skip`；等价表见 plan；guard/比较/文案全同，dispatch 合并方式留调用点）；**死代码删除**：`cellClipboard` 零调用点（活路径是 `contextMenu/opsTable.ts` 注册闭包内联版，跨模块平行语义另立不并）。**3.10** 键位/主题/TSV paste 纯工厂化，`Dir`/`NestedNavFns` 词汇表落 keymap.ts；**环破缝**：keymap 不 import commands，move/exit/tsv 经 `NestedNavFns` 注入（先例 1D `setNestedPreviewField`），DAG 无环：resolve ← nestedSession ← commands ← widget，keymap 为叶。**3.11** `TableWidget` 整类不动，仅 destroy() 一行委托 `destroyHandoff`、toDOM 挂载点改 `getHandoff`+带 nav 的 `mountCellEditor`；`__veloxTable` 九方法（nested/resolve/activate/move/setCellDoc/commit/clearEdit/op/pasteTsv）形状与 userEvent 字面量不变。**3.12** barrel 已在阶段 0 删除（fca74ae）——核验不复活，`widget.ts` 为唯一公共入口，三消费方（handlers-code/setup/lifecycle）import **零改动**。非平移点另有：testHook `resolve` 返回类型钉为 `TableModel | null`（保持 cdp 契约）；`own` 参数类型 `{row;col}|null`（避免 widget 反向 import）。收敛：typecheck 双配置 + 211 unit 全绿；`npx madge --circular --extensions ts,tsx` **0 cycles**（196 文件）；grep 断言：`pendingHandoff` 读写仅 nestedSession、`__veloxTableCellView` 写点/清点各 1、`td.__cellView` 写点 1。行为不变类——建议人工冒烟：点格进编辑/Tab/Shift-Tab/Enter/Esc、末格 Tab 追加行、行列把手增删、对齐、列宽拖拽、右键表格菜单（增删行列/对齐/剪贴板三项）、TSV 粘贴、**主题/列宽/语言切换 rebuild 时编辑中 pending 文本不丢**（handoff）、**hop 换格不串文本**（diag-P28）、失焦即退场、参差表格 sentinel 格跳过/激活时整表重写。规格：[docs/specs/3B-split-table-widget/](specs/3B-split-table-widget/)。

### 3C. renderDoc.ts（712 行）

- [x] **3.13 抽 `export/renderDoc/ctx.ts`**：`RenderCtx`/`RenderDocOptions`/`ImageMode`/`textOf`/`escapeHtml`
- [x] **3.14 拆纯函数块**：`inlineText.ts`（`renderTextRun`/`escapeWithAbbrs`/`asMathBlock`）、`blockAttrs.ts`（`attrsFromTrailing`/`stripTrailingAttrs`/`splitDefinitionList`/`isDefLineText`）——约 250 行零依赖，先行
- [x] **3.15 拆 dispatch 模块**：`block.ts`/`inline.ts`/`listTable.ts`/`code.ts`/`image.ts`/`callout.ts`（递归 walk 互调，从主文件注入或同模块内聚）
- [x] **3.16 文件头固化平行契约注释**：与 `handlers-math.ts` 的正则同步约束、与 livePreview 的 class 契约（`markdown-image-ext`/`callout`/`inlineStyles` 注释提及处）

> ✅ **3C 收敛记录（2026-09-23）**：renderDoc.ts 708 行删除，落 `export/renderDoc/` 10 模块（含 import 头/横幅共 781 行）：`ctx`(39) / `inlineText`(83) / `blockAttrs`(61) / `callout`(31) / `code`(34) / `image`(22) / `inline`(109) / `listTable`(110) / `block`(208) / `index`(84)。body 原样平移（含注释）；模块 DAG 取「inline 不回调 block」的无环切法（block → {inline,code,listTable,callout}，listTable → {inline,code}，inline → {inlineText,image}），免注入缝。非平移点（行为等价/可见性）：① 跨模块声明补 `export`（可见性）；② `RenderCtxParts`/`renderInline`/`renderListItem`/`renderDefinitionList`/`renderBlock`/`escapeWithAbbrs` 留各自模块私有；③ `index.ts` 本地 `import type RenderDocOptions`（re-export 不进本地作用域）；④ 三处平行契约注释旧路径 `export/renderDoc.ts` 校正到新落点（callout.ts/handlers-math.ts/markdown-image-ext.ts，3.16 随行）。3.16：`index.ts` 文件头固化平行契约——数学正则 ↔ `handlers-math.ts`（renderTextRun 现址 `inlineText.ts`）、`export-*`/`export-callout*` class ↔ `exportCss.ts`+`inlineStyles.ts`、`imageSizeMarkdown` ↔ `markdown-image-ext`。消费方 3 处（buildDocument/copyRichText/useExport）`from './renderDoc'` 解析到 `index.ts` **零改动**。收敛：typecheck 双配置 + 206 unit 全绿（20 文件）；`npx madge --circular --extensions ts,tsx` **0 cycles**（186 文件）。行为不变类——建议人工冒烟：导出 HTML / 导出 PDF / 复制富文本 各一（覆盖 callout/mermaid/代码块/图片/列表/表格/脚注/缩写/定义列表/数学）。规格：[docs/specs/3C-split-renderdoc/](specs/3C-split-renderdoc/)。

### 3D. 字典分裂治理（i18n 收尾）

- [x] **3.17 `NATIVE_MENU_STRINGS` 并入统一 key 空间**：从共享 key 派生或让 0.2 的对齐测试覆盖第三份字典
- [x] **3.18 删除 `DEFAULT_CALLOUT_TITLES` 重复**：`editor/livePreview/callout.ts` 的 zh/en × 8 型与 i18n `callout.*` 语义完全重叠，统一走 `t('callout.'+type)`（二选一，删一份）
- [x] **3.19 i18n 读源统一**：`i18n/index.ts` 的 `langFromStorage` 自读 `veloxmark.preferences`，与 `preferences/store.ts` 存在启动时双读源——改为从 store 单一读取

> ✅ **3D 收敛记录（2026-09-23）**：**3.17** 取「对齐测试覆盖第三份字典」方案（main/renderer 双 bundle 无法运行时共享 `t()`）：`NATIVE_MENU_STRINGS`（zh/en × 67 key）迁 `electron/shared/menuStrings.ts` 纯数据叶模块（仿 2.12 `commandAccelerators` 先例，一字一行供 key 字面量扫描），`menu/darwin.ts` 改 import；0.2 对齐测试扩展第三份字典守护（zh/en key 集相等 + 无重复 key 字面量 + `{placeholder}` 一致，按语言分段扫描防跨语重复误报）。**3.18** 删 `DEFAULT_CALLOUT_TITLES`（值已与 `callout.*` 8 键逐字一致，已核对）；`calloutDefaultTitle` → `t('callout.'+type)`；动态 key 以「CALLOUT_TYPES × callout.* 存在性」直接断言登记（替代前缀白名单）；`callout.test.ts` 值钉迁双语 `calloutDefaultTitle` 断言（zh+en 各 1 例）。**3.19** `i18n/index.ts` 启动语言改读 `getPreferences().language`（store 的 `readJson` try/catch 兜底，missing/garbage → `'system'`，与原 `langFromStorage` 等价）；`LanguagePref` 收敛 store 单源声明 + i18n re-export（消费方零改动）。收敛：typecheck 双配置 + 206 unit 全绿（21 文件，+5 用例）。行为不变类——建议人工冒烟：Preferences 切语言 → 原生菜单/callout 默认标题/欢迎文档同步；`> [!note]` 显示 Note/注意；启动语言 = 上次偏好。规格：[docs/specs/3D-i18n-dictionaries/](specs/3D-i18n-dictionaries/)。

---

## 遗留记录（本轮评估发现、未列入手术项）

- [ ] `preferences/store.ts`：**暂不拆**（418 行、分节清楚）。可选远期项：31 字段 schema 化（一处声明驱动 default+sanitize+类型）；`sanitizeSession()` 与 prefs 模式对齐
- [ ] 组件层轻度「直达编辑器」导入（`Outline` 的 `foldKey`、`TableInsertDialog` 的 `sniffDelimiter`）：可接受，若收紧由 App 传入即可
- [ ] `preferences/store.ts` 的 `applyPreferencesCssVars()` 是 `:root` 唯一声明点规则的明文豁免（runtime inline 覆盖 `--editor-max-width` 等 4 个 token），双通道现状保留但需知情
