# VeloxMark 重构任务清单（四阶段 + 收尾 + 阶段 5 UI 观感 + 阶段 6 左侧导航）

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

## 阶段 4 — 收尾与缺陷修复（可选项落地，最安全 → 最危险）

> 四阶段（0–3）已收敛；本阶段收尾：可选项落地、遗留处置、2D 遗留缺陷修复。

- [x] **4.1 遗留记录三项处置**：对下方「遗留记录」三项给出决议（保持/收紧/远期登记），勾销并转正为知情记录 — 决议见遗留记录段标注，规格：[docs/specs/4A-legacy-disposition/](specs/4A-legacy-disposition/)
- [x] **4.2 = 1.7 按钮皮肤归并**（原可选项）：5 套平行按钮抽共享 primitives（`.btn`/`.btn-primary`/`.btn-danger`），注意 `.dialog-btn-primary` 暗色特例 — 现状复核后取「皮肤/几何分层 + 别名组」方案（真正平行仅 `.dialog-btn` ↔ `.cm-search .cm-button` 两族），规格：[docs/specs/4B-button-primitives/](specs/4B-button-primitives/)
- [x] **4.3 = 2.17 opsBlocks 整理**（原低优先）：抽 `blockHelpers.ts`；opsBlocks 复用 `transforms.ts` dispatch 约定；`transforms.ts` 表格段可迁 `editor/table/source.ts` — 全部落地，规格：[docs/specs/4C-opsblocks-tidy/](specs/4C-opsblocks-tidy/)
- [x] **4.4 = 1.3 复核剩余业务回调**（原可选项）：审计 App.tsx 残留业务回调，明显独立域（折叠同步、会话持久化 effect 群等）可顺势下沉 hooks — 审计表 17 域决议 + 两域下沉，规格：[docs/specs/4D-app-callback-audit/](specs/4D-app-callback-audit/)
- [x] **4.5 双派发缺陷修复**（2D 遗留，**行为变更**）：App 三监听（`closeTab`/`reopenClosedTab`/`nextTab`）与 useMenus `menu:<id>` 订阅双派发——原生菜单单击双执行（reopenClosedTab 重开两张），收敛为单派发 — 命令侧赢（useMenus 泛化订阅为唯一派发面），规格：[docs/specs/4E-double-dispatch/](specs/4E-double-dispatch/)

> ✅ **4.2 收敛记录（2026-09-23）**：新 `styles/buttons.css`（84 行）单源按钮**皮肤**（color/bg/border/radius/cursor/hover 六声明）；几何留本地（dialog：min-width/5px 14px/13px；cm-button：margin/4px 10px/12px + font-family/line-height + `:active`）。**现状复核关键发现**：6 套按钮皮肤里真正逐字平行的只有 `.dialog-btn` ↔ `.cm-search .cm-button` 两族；其余 4 套（`sidebar-mode-seg` 分段 / `sb-stat-btn` ghost+`--focus-ring` UX-P14 契约 / `mermaid-preview-bar` chip+`.is-on` / `tab-context-menu` 菜单项）是**不同控制族**，强行归并 = 视觉回归，spec 划界不并（头注释点名）。实现取 **comma-selector 别名组**（`.btn, .dialog-btn, .cm-search .cm-button`）而非 TSX 换类名——**DOM class 零变化**（零 TSX 改动、探针/用户脚本零风险），`.btn*` primitives 对新代码可用（constitution 条款已更新）；`.dialog-btn-danger` 从 forms.css 归族迁入；`.theme-dark` 暗色特例（#1e1e1e，1B/1.6 注释）连注释逐字随迁。声明**值逐字迁移**零改色（palette↔CSS 测试未触）；base 规则拆「皮肤组 + 几何组」声明集不重叠、computed style 等价；组内次序保原序（dark 压 primary、active 压 hover）；barrel 注入位置 forms.css 后、editor-modes.css 前（级联次序兜底）。grep 断言：4 类声明只存 buttons.css（overlays/forms/editor-modes 仅剩迁址注释）。收敛：typecheck 双配置 + 211 unit 全绿。行为不变类——建议人工冒烟：对话框按钮三态（普通/primary/danger × 亮暗主题，含 hover/active）、搜索面板按钮（hover/active）、4 个非并控制族各过一眼确认无视觉变化。规格：[docs/specs/4B-button-primitives/](specs/4B-button-primitives/)。

> ✅ **4.3 收敛记录（2026-09-23）**：opsBlocks.ts 438 → **注册器纯注册**（184 行，7 个 `registerContextMenuOps` + 注册器专属常量/内联逻辑 `CALLOUT_TYPES`/fm.edit fence 扫描）；helper 落新 `contextMenu/blockHelpers.ts`（127 行）：六 helper（enclosingNode/mathRange/fenceBody/mermaidSvgAt/deleteRange/confirmDanger）原样平移 + **缩进对合并**（`indentFenceBody`/`indentSelectedLines` 循环体逐字相同 → `indentLines(view,from,to,userEvent)` 单实现 + 两薄包装；change 形状保持 line 首插 `'  '`，不换整行替换）。**dispatch 约定原语化**：`transforms.ts` 导出 `applyLineChanges`（逐行建 changes → 空跳过 → 单 dispatch），`setHeadingLevel`/`toggleBlockquote`/`convertList`（`olIndex` 闭包态随迁）与 `indentLines` 四处复用——userEvent 字面量逐一不变（`input.contextMenu.*`/`delete.*`/`indent.*`/`callout.type` 全集 grep 守）。**表格段归位**：`tableModelOf`/`tableMarkdown`/`formatTableSourceRange`/`deleteTableRange` 迁新 `editor/table/source.ts`（body 含 UX-P28 `setActiveCell.of(null)` 注释逐字），消费方 opsTable 改 `../table/source` import；**死导出 `tableSource` 删除**（零调用点，3.9 cellClipboard 先例）；transforms 甩掉 `table/*`/`format` 依赖成纯段落/行变换模块（`format → table/parse` 方向已核，`source → format` 无环）。`data-op` id 全集与菜单项集合零变化（注册器 body 未动）。收敛：typecheck 双配置 + 211 unit 全绿；`npx madge --circular --extensions ts,tsx` **0 cycles**（199 文件）。行为不变类——建议人工冒烟：代码块右键（复制/缩进块/缩进选区/删除）、mermaid/图片/数学/callout/标题/front-matter 右键各一项、表格右键复制表格/格式化源/删除表格、段落▶/格式▶ 转换各一。规格：[docs/specs/4C-opsblocks-tidy/](specs/4C-opsblocks-tidy/)。

> ✅ **4.4 收敛记录（2026-09-23）**：审计表 17 域（spec 内）逐域 keep/sink 决议——**sink 仅两域**（任务点名）：P18 折叠同步 → 新 `hooks/useFoldSync.ts`（foldedKeys state + foldSigRef + syncFoldedKeys/restoreFoldsFor 双回调 + Ref 镜像对 + filePath effect，body 原样平移；`RestoreFoldsForRef` 契约形状不变，App 透传 `useP18Seam`；`syncFoldedKeysRef` 稳定 ref 身份，create-editor 4 处闭包消费点原样）；P03 会话写侧 → 新 `hooks/useSessionPersist.ts`（3× sidebar `patchSession` + tabs 持久化 + Recent Files 校验 + `setRecentFiles` 推送，body 原样平移；`sessionSynced` 门闩注释随类型迁移；deps 显式 7 参注入，对象字面量不进 dep——3A 纪律）。**keep 理由已档**：showToast/outline 投影（多 hook 共享装配点）、原生菜单订阅 effect（**4.5 双派发现场，本次零触**）、restore effect（boot 编排）、P12 drafts（缝接线）、pref→IPC 桥/Compartment 群/glue（薄）、create-editor/链接导航/插入对话框群（装配/表单本地态）。p18.ts 两处注释校正（App→useFoldSync）。App.tsx 1702→**1619 行**；grep 断言：`headingFolds`/`persistTabsSession()`/`setRecentFiles`/`sidebar` patch 写点 App 原位 0 残留（仅存 hook），ref 消费点全数不变。收敛：typecheck 双配置 + 211 unit 全绿；madge **0 cycles**。行为不变类——建议人工冒烟：折叠几节→切文件回来折叠仍在；侧栏显隐/模式/宽度改后重启保留；tabs 开关后重启恢复；Recent Files 校验（删磁盘文件看菜单项失效）。规格：[docs/specs/4D-app-callback-audit/](specs/4D-app-callback-audit/)。

> ✅ **4.5 收敛记录（2026-09-23，行为变更）**：拓扑核清后取「**命令侧赢**」——useMenus 对全部命令 id 的 `menu:<id>` 泛化订阅是三消费方设计面（MenuBar/全局快捷键/mac 原生菜单，useMenus 文件头明文「nothing is hand-listed」），App 手写三监听是 P26 pre-registry 补丁。删 App `onMenu('closeTab'|'reopenClosedTab'|'nextTab')` 三订阅——逐 id 等价表已核（手写 body ≡ `commandOps` body 逐字同），**单击恰好执行一次**（reopen 恰好重开一张）。`openRecent`/`clearRecent`（带 path 载荷）与 `closeTabOrWindow`（main `before-input-event` 的 Cmd/Ctrl+W 专用路由，非命令 id）**原样保留**（各单注册，双派发不成立）；`closeTabOrWindow` 的 tab-aware 语义（tabs>1 关 tab / 否则 queryClose→关窗）零改动。附带异味清除：effect deps `[fileOps]`（hook 返回对象字面量每 render 新身份 → 订阅每 render 拆装）收窄为五个稳定 useCallback 字段路径，churn 消失。影响面：仅 macOS 原生菜单点击路径双发（MenuBar/键盘本就单发）。grep 断言：三手写监听 0 命中、三专用通道各恰 1、useMenus 泛化订阅不动；命令 id / `menu:` 通道 / `data-op` 全集零变化。收敛：typecheck 双配置 + 211 unit 全绿；madge **0 cycles**。**行为变更类必做人工冒烟**：macOS 原生菜单 File → Close Tab / Reopen Closed Tab / Next Tab 各单击一次只执行一次；Cmd/Ctrl+W 三态（多 tab / 单 tab / 脏拦截）；MenuBar 点击与 Ctrl+Tab / Ctrl+Shift+T 无回归。规格：[docs/specs/4E-double-dispatch/](specs/4E-double-dispatch/)。

> ✅ **阶段 4 收尾完成（2026-09-23）**：5/5 勾销。4.1 遗留处置（文档）→ 4.2 按钮皮肤归并（视觉不变）→ 4.3 opsBlocks 整理（行为不变）→ 4.4 业务回调审计+两域下沉（行为不变）→ 4.5 双派发修复（**行为变更**）。全程 spec→plan→implement→converge 每单元独立规格档 `docs/specs/4[A-E]-*/`；门禁每单元全绿（typecheck 双配置 + 211 unit + madge 0 cycles）。行为不变类（4.2/4.3/4.4）与行为变更类（4.5）的**人工冒烟清单见各单元收敛记录**，提交前建议按清单过一遍 UI。

---

## 阶段 5 — UI 观感对齐 Typora（截图对比评估）

> 依据 2026-09-23 同文档双端截图对比评估（`temp/typora/typora-1.png` ↔ `temp/veloxmark/veloxmark-1.png`，样稿 `D:/Downloads/untitled.md`）。总评：排版底子（字体/行内样式/KaTeX/代码高亮）已接近 Typora，观感差距约 75%，集中在**列表渲染、版心、区块节奏**三个层面；修掉 P0 后可达 90%+。
> 差距一览（按视觉影响排序）：**列表圆点/缩进缺失 + 任务项残渣**（P0）> **正文通栏不居中**（P0）> 区块间距发虚 + H2 无底线（P1）> 行号常显噪声（P1）> 大纲层级无缩进（P2）> 块级公式纵向留白（P2）。
> 不输项（不许改坏）：行内排版（粗/斜/删/行内代码 chip/KaTeX）、自绘顶栏+Tab、状态栏信息密度、代码块语言标签。
> 本阶段性质：视觉/布局为主；**5.3 为行为变更**（默认值），其余行为不变类按各单元收敛记录注明人工冒烟项。

### 5A. 列表与任务列表渲染修复（P0）

- [x] **5.1 恢复列表视觉体系 + 清除任务项残留**：无序圆点/有序编号 marker、悬挂缩进、嵌套层级缩进全数恢复；任务项复选框后的 `+•` 残渣清除；P09 marker 显隐语义不变 — 规格：[docs/specs/5A-list-rendering/](specs/5A-list-rendering/)

> ✅ **5A 收敛记录（2026-09-23）**：T1 CSS 体系重建（特异度修复 `.cm-editor .cm-line.cm-md-list` + 悬挂缩进 `--list-indent` 阶梯）→ T2 `cm-md-task-item` 压制 CSS 圆点 → T3 有序列表构建期重编号（`orderedListIndex` + `data-vm-n`，CSS counters 在 CM6 扁平行 DOM 下不可用）→ T4 单测（build 5 例 + handlers-ctx 4 例）。**顺手修复既有缺陷 1 处**：`listDepth` 检查不存在的节点名 `'List'`（解析器实际产出 `BulletList`/`OrderedList`），深度恒钳 1、`cm-md-list-d2+` 从未发出。收敛：typecheck 双配置 + **220 unit 全绿**；`npx madge --circular`（202 files）**0 cycles**；e2e 缝零触碰（`window.__velox*`/命令 id/`data-op` 均未出现在 diff）。
> 人工冒烟清单（行为不变类）：① 无序圆点正常渲染且不压正文（重点看任务行、含拉丁字符行——原 `left:34px` 残渣场景）；② 嵌套列表逐级缩进（d2+）；③ 任务项仅复选框、无 `+•` 残渣；④ 光标进入列表行 → marker 源码显形且 CSS marker 隐藏，移开恢复（P09）；⑤ `1. 1. 1.` 显示 1/2/3，嵌套有序各自从 1 起编；⑥ 暗色主题同过一遍。

### 5B. 阅读版心与行号（P0 + P1）

- [x] **5.2 正文居中窄栏版心**：正文行与全部块 widget 统一到居中内容列（`editorMaxWidth` 偏好语义保持），F05 同列契约保持 — 规格：[docs/specs/5B-reading-measure/](specs/5B-reading-measure/)
- [x] **5.3 行号默认关闭**（**行为变更**）：`showLineNumbers` 默认 `true` → `false`，偏好保留可开；F06 gutter 对齐契约保持 — 同 5B 规格

> ✅ **5B 收敛记录（2026-09-23）**：T1 store（0 值软上限 `min(90%, 1200px)`、`showLineNumbers` 默认关 + sanitize 翻 `=== true`——本文件默认关布尔的既定形态，存储显式 `true` 不受影响）→ T2 tokens.css 默认值同步 + 删 `.cm-md-table-wrap` 的 `max-width`（% 基准陷阱）→ T3 i18n `prefs.widthUnit` 0 值语义文案 en+zh。零新 import；`gutterCompartment`/`toggleLineNumbers`/F01 归零通道未触碰。收敛：typecheck 双配置 + **220 unit 全绿**；e2e 缝零触碰（`__velox*`/`data-op`/命令 id/`toggleLineNumbers`/`gutterCompartment` 均不在 diff）。
> 人工冒烟清单（**行为变更单元，必做**）：① 偏好滑杆三档——0（≈1200px 居中软上限）/ 800（800px 居中）/ 4000（通栏），块 widget（表格/代码/公式/mermaid/callout/图片）与正文同列左缘；② 行号开关来回切 + 重启保持（默认关、开启后 F06 对齐、折叠 gutter 贴列）；③ 嵌套表格单元格编辑器不被列宽约束（F01）、写作模式/查找面板不回归；④ 窗口缩放 / 侧栏拖宽后列仍居中；⑤ 同视口复拍对照 `temp/typora/typora-1.png`（AC1/2）。

### 5C. 标题体系与区块节奏（P1 + P2）

- [x] **5.4 H2 底线统一 + 垂直节奏收敛**：H1/H2 统一浅色底线（token 化）；空行占位与块间距不叠加，同视口节奏对齐 Typora — 规格：[docs/specs/5C-block-rhythm/](specs/5C-block-rhythm/)
- [x] **5.5 块级公式留白收紧**：`MathBlockWidget` 上下空档收敛到约一行量级，居中/点击编辑行为不变 — 同 5C 规格

> ✅ **5C 收敛记录（2026-09-23）**：T1 H2 底线同 H1（`1px solid var(--border)`，H3–H6 不加）+ exportCss 平行 → T2 `katex-display` margin 归零（编辑侧 + 导出侧双处，katex.css 自带 1em 是公式发飘主因）+ math/block-gap 收敛到 `--space-2` 档（合计 ≈32px≈1 行）→ T3 标题阶梯微调（top 0.8/0.7/0.6 → 0.7/0.6/0.5em，h4–h6 未动）。`widgets-math.ts`/handlers 零触碰，**装饰快照零 diff**（AC7）；`--border` 现成 token，palette 4 处副本零触碰。inlineStyles 核对结论：class map 不表达后代选择器、富文本目标剥 `<style>`（katex margin 随 css 一起消失），无需平行。收敛：typecheck 双配置 + **220 unit 全绿**；e2e 缝零触碰。
> 人工冒烟清单（行为不变类）：① H1–H6 目测底线/字号阶梯（仅 h1/h2 有线）；② 块级公式上下 ≈1 行、居中与点击进源码编辑不变；③ 节间/段间/列表前后节奏对照 Typora 截图 ±20% 目测（**T3 阶梯为 implement 窗口微调值，此条为最终校准点，偏差大回报再调**）；④ 空行仍占行不跳行（AC3）；⑤ 导出 HTML/PDF/复制富文本各一：h2 底线、公式间距、callout/表格无回归；⑥ 深色主题底线不刺眼。

### 5D. 侧边栏大纲精致度（P2）

- [x] **5.6 大纲层级缩进与质感**：补齐 `outline-l2`–`outline-l6` 缩进样式（现仅 `outline-l1` 有样式），hover/active 质感对齐 Typora 大纲 — 规格：[docs/specs/5D-sidebar-outline/](specs/5D-sidebar-outline/)

> ✅ **5D 收敛记录（2026-09-23）**：T1 `.outline-l2`–`l6` 缩进阶梯（每级 `--space-3`，12px/级）+ active 左侧强调条（`inset 2px` box-shadow，非 border-left 防 hover 抖动）→ T2 `title` 提示。**plan 现状核实偏差修正**：`Outline.tsx` 自 first commit 即有 `title={item.text}`（D3 已满足，未改）与**内联裸 px 缩进** `12+(level-1)*14`（plan 漏看 L34）——本次迁入 CSS 阶梯并删内联（Constitution `--space-*` 纪律），实际缩进 14→12px/级仍在 AC1 的 12–16px 带内。P18 折叠钮/hover 与文件树一致性未动。收敛：typecheck 双配置 + **220 unit 全绿**；e2e 缝零触碰（`outline-fold`/`__velox*`/`data-op` 不在 diff）。
> 人工冒烟清单（行为不变类）：① 六级标题缩进一眼可辨；② 大纲点击跳转、折叠/展开（P18 三角方向）、滚动跟随 active 切换无抖动；③ active 左侧强调条 + 加粗/强调色在深浅主题均不刺眼；④ 长标题截断 + hover `title` 全文；⑤ 文件树模式无回归。

---

## 阶段 6 — 左侧导航区对齐 Typora（文件树/大纲，功能与交互）

> 依据 2026-09-23 左侧导航专项评估（`temp/typora/typora-2..4.png` ↔ `temp/veloxmark/veloxmark-2.png` + 代码探查）。总评：功能面不薄（CRUD/拖拽/watcher/P18 折叠俱全），但信息架构与交互模型是两套范式，左侧导航约 Typora 的 55–65%，是当前落差最大区域。
> 差距一览（按交互影响）：**无「文件/大纲」双 tab 且点文件即把侧栏切到大纲**（P0）> **树默认深展全开、无 reveal**（P0）> **树根=显式工作区而非当前文件所在目录**（P0·产品语义，用户已拍板跟随 Typora）> 底部栏全缺（P1）> 排序不可选（P1）> 无最近目录/列表视图（P1）> 右键缺项、新建 prompt 化（P1）> 行图标/键盘导航/大纲排序（P2）。
> 已对齐不许改坏：目录只留含 md 子目录、当前文件高亮、大纲缩进 + active（5D）、P18 折叠、宽度拖拽持久化、虚拟滚动、watcher 自动刷新、`outline-fold`/`filetree-*` class 契约。
> 本阶段性质：**行为变更密集**（6.2/6.3/6.4/6.5），每单元收敛记录必带人工冒烟。底部栏语义来源 `temp/typora/typora-2.png`/`typora-4.png`（用户 2026-09-23 描述确认：`+`=新建文件、右 1=「操作」弹出面板、右 2=切换列表/树视图、中目录名点击=弹「操作」面板；面板含 操作组 + 排序行 + 最近使用的目录）。
> 推进顺序 6A→6G（6D 依赖 6A/6B 的面板落点，6F 依赖 6D 面板容器与 6B 显式根通道）；6.15–6.18 可选不阻塞收敛；6E 交互模型已决（2026-09-23）。

### 6A. 文件/大纲双 tab 信息架构（P0）

- [x] **6.1 「文件 | 大纲」双 tab 栏落地**：侧栏头部双 tab（下划线指示）并列互切；搜索入口收编不劣化；session 记忆沿用；files 空态（无根引导「打开文件夹」）— 规格：[docs/specs/6A-sidebar-tabs/](specs/6A-sidebar-tabs/)
- [x] **6.2 打开文档不自动切换侧栏模式**（**行为变更**）：树点击/QuickOpen/搜索/命令任意打开路径后侧栏驻留当前 tab；「‹ 文件」单向返回由双 tab 取代 — 同 6A 规格

> ✅ **6A 收敛记录（2026-09-23）**：T1 `useDocIo`（`OpenDocPathOpts.quiet` 删除——e2e 缝 `openPath` 本就不传 opts；`setSidebarMode`/`restoringRef` 参数删除；两处 `setSidebarMode('outline')` 删除，打开路径全程不再触碰侧栏模式）→ T2 `useFileOps` 透传面收窄（`SidebarMode`/`DocTabInfo` 单源再导出保留）+ `useWorkspaceTree.openFileFromTree` 删 3 处切模式（`loadFolder` 的 `setSidebarMode('files')` 保留——显式打开文件夹仍进文件 tab）→ T3 App 三区：restore 静默 opts 收为 `{ activate: false }`、`restoringRef` 清尸（唯一读者已删，`useSessionPersist` 注释同步）、aside 双 tab 化（`sidebar-tabs`/`sidebar-tab` role=tab、搜索入口收编到 tab 行右侧、outline 头部与「‹ 文件」钮删除、files 无根空态卡）→ T4 i18n 新 4 键（`sidebar.tabs`/`sidebar.tab.files`/`sidebar.tab.outline`/`sidebar.filesEmpty`，en+zh）+ 删孤儿键 `app.filesBack`（SearchPanel 用的是 `search.backFiles`，未动）→ T5 `chrome.css` `.sidebar-tab` 族（透明底线占位防 active 抖高）+ `.sidebar-empty`。D2 纪律：SearchPanel/`sidebar-mode-seg` 零触碰；`toggleOutline`/`getSidebarMode` 语义保持。收敛：typecheck 双配置 + **220 unit 全绿**；`npx madge --circular` 0 环（import 有变动）；e2e 缝零触碰（`__velox*`/`data-op`/命令 id 均不在 diff；grep 命中的 `openFolder` 系 `cmd.openFolder` i18n key 与既有 `workspace.openFolder` 调用）。
> **探针契约同步项（外部 cdp 仓库）**：原「任一路径打开文件后 `getSidebarMode()==='outline'`」断言与新语义相反，需改为「侧栏驻留原 tab（files 打开树文件后仍为 files）」；「点 outline 的『‹ 文件』返回」类步骤改为直接点「文件」tab。
> 人工冒烟清单（**行为变更单元，必做**）：① 任意路径打开文档（树点击 / QuickOpen / 搜索结果 / 命令 openFileByPath）后侧栏驻留当前 tab——文件 tab 点文件**不再**跳大纲；② 双 tab 下划线互切即时，active 强调色与 5D 大纲 active 语言一致，切 tab 不丢树展开态/滚动位；③ 搜索入口不劣化：tab 行放大镜（有工作区才显示）进全局搜索，SearchPanel 内 seg/返回钮行为原样；④ files 空态（无工作区）：引导文案 + 「打开文件夹…」按钮真的拉起目录对话框；有工作区时目录名头部 + 「+」新建文件不回归；⑤ 大纲 tab：无头部返回钮后列表/active 跳转/P18 折叠无回归；⑥ 会话记忆：侧栏设 outline → 重启回 outline，设 files → 重启回 files（restore 顺序：文件集恢复后再落 `saved.sidebarMode`）；⑦ 深浅主题下 tab 下划线/hover 可辨、侧栏拖宽（resizer）不回归。

### 6B. 树根跟随当前文档（P0·产品语义，行为变更）

- [x] **6.3 树根 = 激活文档所在目录**：随 tab 激活/打开文件换根（跟随制）；~~无文档/未命名回落最近根~~（**2026-09-24 契约修订废止**，由 6.4a 取代） — 规格：[docs/specs/6B-tree-root/](specs/6B-tree-root/)
- [x] **6.4 边界收编**：「打开文件夹…」显式根与跟随制优先级（`resolveTreeRoot`）、watcher 随根换靶竞态守卫、扫描深度 8→20、QuickOpen/全局搜索范围随根收窄（行为变更注明） — 同 6B 规格
- [x] **6.4a 未落盘文档树根 = 空**（**行为变更**，2026-09-24 契约修订）：激活文档未落盘（启动默认 untitled-2.md 等）且无显式根 → files tab 空态卡「当前文档未落盘」+「打开文件夹…」引导（保留双 tab，大纲照常）；`resolveTreeRoot` 删 lastRoot 回落档；启动会话恢复不再自动挂载 `lastFolderPath`（写侧保留作最近根槽/6F 数据源）— 规格：[docs/specs/6B-tree-root/](specs/6B-tree-root/) 修订记录

> ✅ **6B 收敛记录（2026-09-23）**：T1 `hooks/useTreeRoot.ts` 纯函数（`resolveTreeRoot` 优先级 显式根→激活文档 dirname→最近根 / `isPathInside` 边界安全（`C:\proj` vs `C:\project` 前缀陷阱有专门用例）/ `explicitRootAfterActivate` D1 失效规则）+ 15 条单测 → T2 `useTreeRoot` hook 组合进 `useWorkspaceTree`（`applyTreeRoot` 单漏斗：换靶 watch/unwatch + `lastFolderPath` 最近根写侧收编 D5；`loadFolder` 显式化 = 切文件 tab + `setExplicitRoot` 钴住）+ `electron/ipc/folder.ts` `MAX_SCAN_DEPTH` 8→20（D4）→ T3 watcher 竞态守卫。**plan 实现修正 3 处（AC 不变）**：① D2 竞态守卫从「渲染侧 rootPath 世代号」改为主进程 `watchEpoch`（`stopFolderWatcher` 递增，扫描前后核对，过期树/旧 watcher 迟到 error 全部丢弃）——零 API 面变化（`folder:*` payload/RendererApi 均不动），修掉既有 in-flight `pushFolderTree` 跨换靶陈旧推送缺口；② D2 接线从「App +10 行」改为 `useWorkspaceTree` 内部组合（App 仅 +1 行 `activePath: filePath` 透传），显式根通道 `setExplicitRoot` 挂 workspace 返回面（6D/6F 直接消费）；③ D5 写侧在 `applyTreeRoot`（每次根应用写 `lastFolderPath`）而非 plan 表中点名的 `useSessionPersist`（该文件本就不写 `lastFolderPath`，零改动）。**模型语义核销**：`temp/typora/typora-2.png` 裁决根 = 当前文件 dirname 严格语义（当前文件平铺根层、子目录折叠为孩子）——树内点开子目录文件会下钻换根，与6C「祖先链 reveal」的适用面（显式根内的深路径文件）自洽。**行为变更注明（AC6）**：QuickOpen/全局搜索扫描范围 = 当前树根（随激活文档收窄，不再固定为打开的工作区）。**已知角落**：显式根钴住 + 激活文档在根外的状态跨重启恢复后转跟随（重启过程的激活事件触发 D1 失效，与现场钉住语义有一档偏差）；`lastFolderPath` 死目录启动 → 6A 空态引导（无 mount 自动应用，恢复路径 `pathExists` 守卫保持）。`baseDir` 链、P13 缝（`openFolder` 钴住语义反而更稳——根外文档激活前树立即显示 path）、P26 面、`folder:*` channel 面零触碰。收敛：typecheck 双配置 + **235 unit 全绿**；`npx madge --circular` 0 环；e2e 缝零触碰。
> 人工冒烟清单（**行为变更密集，必做**）：① 打开 A 目录文件 → 树根 = A；切到 B 目录文件的 tab → 树根 = B；切回 A 恢复（快速连切 3+ tab 树不错闪旧内容——AC5 竞态守卫）；② 树内点开子目录文件：根下钻为该子目录（严格「当前 md 所在目录为根」，typora-2.png 同构；**如需「树内导航不缩根」规则请反馈**）；③ 关闭全部 tab / 切到未命名草稿：树回落最近根不消失；④ 「打开文件夹…」钉住根，打开根**内**文件钉保持，打开根**外**文件转跟随（D1 失效规则）；⑤ 外部增删改 md 文件 watcher 仍自动刷新；QuickOpen/全局搜索范围 = 当前树根（行为变更）；⑥ 深层目录（>8 级）文件可见（D4）；⑦ 6A 不回归：双 tab 互切/打开文档不切模式/files 空态引导/重启 tab 与侧栏模式记忆。

> ✅ **6.4a 收敛记录（2026-09-24，契约修订）**：T1 `useTreeRoot.ts`（`ResolveTreeRootInput` 删 `lastRoot`、`resolveTreeRoot` 第 3 档恒 `null`、effect 不再读 `getSession().lastFolderPath`（`getSession` import 一并清尸））→ T2 `useTreeRoot.test.ts`（回落用例翻转为「未落盘/无文档 → `null`」，全部输入面删 `lastRoot`；`nothing at all` 用例与之合并，净 -1 条）→ T3 `useWorkspaceTree.applyTreeRoot` 注释（`lastFolderPath` 仅写侧，6F 显式跳转源）→ T4 `App.tsx` 恢复链删 `loadFolder(saved.lastFolderPath)` 分支（原经显式根通道钉住，是启动误显树的主因；恢复落盘 tab 后激活事件自然走跟随制重建根）+ 空态卡文案按未落盘场景选 key → T5 i18n en+zh 同步：`sidebar.filesEmpty` **改名** `sidebar.filesEmptyUntitled`（单读者随迁，无孤儿键）。`lastFolderPath` 写侧保留（D5）；e2e 缝零触碰（`openFolder`/`getSidebarMode`/`data-op`/命令 id 均不在 diff）。收敛：typecheck 双配置 + **246 unit 全绿**；`npx madge --circular` 0 环（hooks import 面变化）。
> 人工冒烟清单（**行为变更，必做**）：① 冷启动（默认 untitled-2.md）：files tab 空态卡「当前文档未落盘」+「打开文件夹…」按钮，**不显任何目录树**，「文件 | 大纲」双 tab 保留、大纲 tab 照常出该文档大纲；② 打开落盘文件 → 树根 = 其目录；切回 untitled tab → 回空态（不残留旧树）；③ 「打开文件夹…」钉住根后切 untitled tab → 树保持显式根（D1 不变）；④ 重启：落盘 tab 会话恢复后树根 = 激活文档目录（不再自动挂载 `lastFolderPath`）；纯 untitled 会话重启仍空态；死目录 `lastFolderPath` 不再致启动误挂/报错；⑤ 6A/6C 不回归：双 tab 互切、打开文档不切模式、reveal 定位、空态「打开文件夹…」钮真拉起对话框、深浅主题。（原 6B 冒烟 ③「树回落最近根不消失」随契约废止，以本清单 ①–④ 取代。）

### 6C. 树展开定位与行质感（P0 + 5D 遗留）

- [x] **6.5 展开策略反转**（**行为变更**）：默认全折；激活文件祖先链自动展开 + 滚动 reveal 进视口；tab/换根同步；用户手动展开不被收回 — 规格：[docs/specs/6C-tree-reveal/](specs/6C-tree-reveal/)
  > ✅ **6C 收敛记录（2026-09-23）**：T1 纯逻辑 `components/filetreeRows.ts`（`visibleRows` 深度优先拍平 / `ancestorDirPaths` 严格祖先链（win32+POSIX 双分隔符、无分隔符输入守卫）/ `isDirOpen` 优先级 rename 强制 > 用户态 > reveal 默认开 > 折叠）+ **12 条单测**（默认全折、<100 子项也折——启发式核销、reveal 不写 expanded、用户手动展开/收起均不被 reveal 收回、rename 链强开过显式收起）→ T2 `FileTree.tsx` 收编：删 `COLLAPSE_CHILDREN_OVER` 与 size 启发式、删 `isAncestorOfRenaming`（前缀法 → 祖先链集合，语义等价且与 reveal 同源）、`rows` 换 `visibleRows`（eslint exhaustive-deps 直闭，去掉 disable 注释）→ T3 reveal 滚动：`lastRevealRef {path, found}` 防抖，仅「目标变化 / not-found→found」时把 active 行滚到视口**中部**（25px 行坐标系 + `treeTop` 偏移，虚拟/非虚拟共用），树数据晚到后补 reveal（先 not-found 再 found 触发补滚）。**plan 实现修正 2 处（AC 不变）**：① D2 「scrollIntoView 中部」改为手算 `side.scrollTop` 偏移——scrollIntoView 会滚动任意祖先且无法精确居中，且与虚拟滚动 spacer 行高模型不匹配；② 换根默认折叠的实现从「effect 重置 expanded」改为 App 侧 `<FileTree key={workspace.folderPath}>` 换根重挂载（状态自然复位，少一条 effect；副作用：换根同时复位树内滚动，随即被 reveal 补滚到 active 行，观感正确）。**模型语义**：reveal = 派生态不写用户 `expanded`（手动收起祖先后 active 行暂不可见是**符合预期**——用户态优先，再次展开即恢复链）；toggle 写入 = `!effectiveOpen`（reveal 默认开的目录首次点按即显式收起）。**已知角落**：rename 强开目录在 rename 中被点收起时视觉仍开（强制态盖过，rename 结束按写入态收起）——既有语义保持；侧栏「文件↔大纲」双 tab 切换会重挂载 FileTree 导致展开态复位（6A 信息架构既有行为，未在本单元扩大；如需跨侧栏 tab 记忆展开态另立小项）。T4 6.6：`Icons.tsx` 同源新增 `FolderIcon`/`FolderOpenIcon`/`FileMdIcon`（Lucide 几何、currentColor 描边，无图标字体/emoji），`.filetree-icon` 基色 `--fg-muted`、行 hover 提亮 `--fg`、active 行 `--accent`（hover 层次 = 既有 `--code-bg` 背景 + 图标态两级）；`filetree-item-fixed` 下 svg `display:block` 钉死行高 25px 不破虚拟滚动契约。收敛：typecheck 双配置 + **247 unit 全绿（+12）**；`npx madge --circular` 0 环；e2e 缝零触碰（`filetree-*`/`outline-fold` class、`ROW_HEIGHT`/`VIRTUALIZE_AT` 语义、`__velox*` 面均未动）。
  >
  > 人工冒烟清单（**行为变更密集，必做**）：① 打开含多级子目录的目录：子目录**默认全折叠**（含 <100 子项的目录——不再自动展开）；② 打开深路径文件（如 `docs/deep/a.md`）：祖先链自动展开 + 行滚动到视口中部且 `filetree-active` 高亮；快速连切 3+ tab 每次都定位到对应行不错位；③ 手动展开某无关目录 → 切 tab 再切回：手动展开**不被收回**；手动收起 reveal 链上的目录后 active 行暂时藏起是预期（用户态优先），再展开恢复；④ 换根（树内点开子目录文件 / 打开文件夹…）：新根默认全折叠 + reveal 定位到 active 行；⑤ 图标与 hover：目录开/合两态图标、md 文件文档图标，hover 背景 + 图标提亮两级层次，深浅主题均清晰无 emoji；行高观感无错行/图标不撑破 25px 行；⑥ 大树（>500 行触发虚拟滚动）下 reveal 仍准确定位；⑦ 回归：点击打开/chevron 折叠/拖拽移动/右键菜单/内联重命名（含深路径新建后 rename 行可见）/active 高亮均不回归。

- [x] **6.6 行图标与 hover 层次**：目录/文件 SVG 图标（非 emoji）+ hover 分层，修 5D 记录「文件树偏平」 — 同 6C 规格

### 6D. 底部栏与「操作」面板（P1）

- [x] **6.7 底部栏框架**：左「+」新建（落点 = 选中目录→激活文件目录→根）/ 中当前目录名 / 右「操作」+「列表/树」两按钮 — 规格：[docs/specs/6D-bottom-bar-ops/](specs/6D-bottom-bar-ops/)
- [x] **6.8「操作」面板顶部操作组**：新建文件 / 搜索（QuickOpen）/ 在资源管理器中显示 / 打开文件夹… / 刷新（watcher 降级兜底） — 同 6D 规格

> ✅ **6D 收敛记录（2026-09-24）**：T3 先行——D6 核实 `showItemInFolder` 已完整 expose（`shared/api.ts`/`preload.ts`/`ipc/shell.ts`），**零 electron 改动**；`refreshTree()` = 对当前根重发 `folder:watch`（强制重扫走 `folder:tree` 订阅通道推树，**顺带复活降级/失效 watcher**，`watchEpoch` 守卫原样覆盖——plan 实现修正①：比直读 `folder:list` 更贴「watcher 降级兜底」语义）；`folder.ts` recursive-watch 静默降级补 `console.warn`（勿扩面）。T1/T2/T4：`filetree-bottombar` sticky 底栏四槽（`+` | 目录名（title=全路径）| `⋮` | 列表/树图标，对齐 typora-2.png；**滚动父不换**，6C 虚拟化/reveal 的 offsetTop 数学零影响）+ `SidebarOpsPanel` + `sidebarOpsBus`（mermaidLightboxBus 同构模块单例，面板自持开合态；Esc/外点/resize/⊗ 关闭；外点判定跳过 `[data-op="sidebar.ops.open"]` 触发钮保 toggle 可关；与 TreeMenu 靠外点 mousedown 天然互斥）；D3 选中态上提 `useWorkspaceTree.selection {path,isDir}` + FileTree 受控 `selectedPath`/`onSelect`（6G 复用）+ 纯函数 `resolveNewFileTarget`（**6 条单测**：选中目录优先/选中文件→dirname/激活文档→dirname/根兜底/POSIX/全空 null），**头部「+」同接落点解析**（行为改进，头部版式不动），换根复位选中态；store 增 `fileTreeView: 'tree'|'list'` + sanitize（D7，渲染分叉待 6.12）；i18n 新 6 key（`ops.bar/title/search/reveal/refresh/toggleView`，en+zh），「新建文件」「打开文件夹…」「关闭」复用 `app.newFile`/`cmd.openFolder`/`mermaidPreview.close`（不造重复 key）。**D8 探针面登记（只增不改）**：class `.filetree-bottombar`/`.sidebar-ops`/`.sidebar-ops-item`/`.sidebar-ops-close`/`.sidebar-ops-header`/`.filetree-bar-btn`/`.filetree-bar-dir`/`.filetree-selected`；`data-op` `sidebar.ops.open`（目录名与 `⋮` 两触发钮共用，AC3 同一面板语义）|`sidebar.ops.newFile`（底栏「+」+ 面板项）|`sidebar.ops.search`|`sidebar.ops.reveal`|`sidebar.ops.openFolder`|`sidebar.ops.refresh`|`sidebar.ops.toggleView`|`sidebar.ops.close`。**AC8（6.4a 联动）**：底栏仅 files tab **有树根**时显示（未落盘空态卡原样、不装工作区面）；面板容器预留 6E 排序行 / 6F 最近目录段插入位（typora-4.png 形态：标题+⊗+五项）。**已知角落**：钉住根 + 激活文档在根外时，「激活文件目录」档落点在树外（AC2 字面语义，文件正确创建但行暂不可见）。收敛：typecheck 双配置 + **252 unit 全绿（+6）**；`npx madge --circular` 0 环（import 面变化）；e2e 缝零触碰（既有 `__velox*`/`data-op`/命令 id 不在 diff）。
> 人工冒烟清单（**AC2 落点为行为变更，必做**）：① 底栏四槽布局对齐 typora-2.png（左中右），树滚动时底栏固定不随滚；目录名 = 根名、悬停 title=全路径；② 「+」三种落点：选中子目录行 → 建在子目录；点过文件行 → 建在其所在目录；无选中 → 激活文档目录/根；`.md` 自动后缀 + 建后内联改名不回归；③ 目录名与 `⋮` 开**同一**面板（标题「操作」+ ⊗ + 五项）；Esc / 外点 / ⊗ / 再点触发钮均关闭；与树右键菜单互斥（先开菜单纯点击不叠层）；④ 五操作各触发一次：新建 / 搜索开 QuickOpen / 资源管理器定位树根 / 打开文件夹对话框 / 刷新（外部删文件后点刷新树恢复）；⑤ 列表/树按钮：图标随当前视图态切换 + 重启保持（列表**渲染**待 6.12，本单元只切偏好）；⑥ 未落盘空态：空态卡与「打开文件夹…」原样、**无底栏**（AC8）；⑦ 选中行浅 accent 底色与 active 高亮可区分、同时命中不冲突；⑧ 深浅主题下底栏/面板/图标清晰无 emoji。

### 6E. 文件树排序体系（P1）

- [x] **6.9 排序状态机**：按文件夹分组（toggle，**默认开**，2026-09-23 拍板）+ 自然排序 / 按文件名 / 按修改时间 / 按创建时间（四键互斥单选，点按翻转升降）— 规格：[docs/specs/6E-tree-sort/](specs/6E-tree-sort/)
- [x] **6.10 时间数据与持久化**：`DirNode` 增 `mtimeMs`/`birthtimeMs`、自然序/字典序比较器单测、排序偏好持久化 — 同 6E 规格

> ✅ **6E 收敛记录（2026-09-24）**：T1 新叶模块 `filetree/sort.ts`（`TreeSortOptions`/`DEFAULT_TREE_SORT`（分组默认开、natural、asc）+ `compareNatural`/`compareName`（`Intl.Collator` numeric on/off，同 `sensitivity:'base'`）+ `sortTreeNodes`（递归每层排序；`groupFolders` 目录组**恒在前**（desc 亦然）、关 = 文件目录混排；缺省时间戳**恒排后**（升降皆是）；同键同戳 `tieBreak`（name→path）收尾保证确定性；换新数组、入参不动）+ 状态机 `pressSortKey`（互斥单选：未选中 → 选中保持升降 / 已选中 → 翻转升降）/ `toggleGroupFolders`）+ **13 条单测**（验证表全项：`2.md`<`10.md` 自然 vs `10.md`<`2.md` 字典、mtime/birthtime 升降、缺省排后双方向、groupFolders on/off/desc、递归子层、空目录、纯函数、状态机 3 条）。T2 [P] `shared/api.ts` `DirNode` **只增**可选 `mtimeMs`/`birthtimeMs` + `folder.ts` `listMarkdownTree` 逐条 `stat` 采集（扫中消失 → 双字段缺省 = 排后；watcher 重扫天然刷新时间戳，比较器不回主进程重扫）。T3 store 增 `fileTreeSort` + `sanitizeTreeSort` 宽容回退（缺省/非法 → 拍板默认值）；`FileTree` 在 6C `visibleRows` 接缝前插 `sortTreeNodes` 纯前排（AC2 树/列表共用——6.12 分叉零改）；排序随偏好 store 响应式**即时重排** + localStorage 持久化（AC1/AC6）。T4 `SidebarOpsPanel` 五项后插「排序」行（label + 分组 FolderIcon toggle + 四键钮：dir 箭头 ↑↓ 随翻转同步 + `123`/`A`/ClockIcon/FileIcon 字形，激活 = accent 蓝，对齐 typora-4.png 排序行**语义**，像素级复刻不强求——plan D9）；排序钮为 toggle 交互**不关面板**（与五操作 action 语义区分）；`Icons.tsx` 补 `ClockIcon`/`FileIcon`（Lucide 几何）；i18n 新 6 key（`ops.sort` + `ops.sort.groupFolders|natural|name|mtime|birthtime`，en+zh 同加）。**plan 实现修正 1 处（AC 不变）**：`sortTreeNodes` 首版只克隆子层未排序，递归单测逮住修正为「先递归 children 再排当前层」（plan D10）。**D8 探针面登记（只增不改）**：`data-op` `sidebar.ops.sort.groupFolders|natural|name|mtime|birthtime`。QuickOpen/搜索排序、IPC channel 面、watcher 零触碰。收敛：typecheck 双配置 + **265 unit 全绿（+13）**；`npx madge --circular` 0 环（import 面变化）；e2e 缝零触碰（`DirNode` 增可选字段属 API 面只增；既有 `__velox*`/`data-op`/命令 id 不在 diff）。
> 人工冒烟清单（**状态机 + 持久化，必做**）：①「操作」面板「排序」行五控件可视：分组 toggle 默认激活（accent），四键钮带 ↑ 箭头、自然排序默认激活；② 点「按文件名」→ 树**即时**按字典序（`10.md` 排在 `2.md` 前）；再点同一键 → 升降翻转、箭头变 ↓ 且四键箭头同步；点其他键改键后升降保持；③ 分组 toggle 关：文件目录按当前键混排（目录不再恒在前）；再开：目录组回到最前（desc 亦然）；④ 按修改/创建时间：同层按时间戳排、缺时间戳条目**恒在最后**（升降皆是）；⑤ 排序点击**不关面板**，连点多键后面板仍开、五操作项点击照常关闭；⑥ 重启：分组态 / 排序键 / 升降全部保持（AC6）；⑦ 切「列表/树」视图按钮排序设置一致生效（列表渲染待 6.12）；⑧ 大目录切换排序无卡顿（纯内存）；深浅主题下排序行清晰无 emoji。

### 6F. 最近使用的目录与列表/树视图（P1）

- [ ] **6.11「最近使用的目录」面板段**：目录列表 + 当前根蓝点 + 置顶/移除，持久化（`lastFolderPath` 收编迁移）— 规格：[docs/specs/6F-recents-views/](specs/6F-recents-views/)
- [ ] **6.12 列表/树视图渲染分叉**：列表 = 扁平文件列表（相对目录副标题）；切换即时 + 持久化；共用 6E 排序 — 同 6F 规格

### 6G. 右键菜单补齐与新建内联输入（P1）

- [ ] **6.13 右键菜单补齐**：在新标签打开（P26 去重语义）/ 在资源管理器中显示 / 刷新；三档分组重排 — 规格：[docs/specs/6G-menu-inline-new/](specs/6G-menu-inline-new/)
- [ ] **6.14 新建内联输入框**：树内输入名 Enter 确认/Esc 取消（复用 `filetree-renaming` 机制），`.md` 自动后缀保持，prompt 对话框退役 — 同 6G 规格

### 可选（P2，不阻塞本阶段收敛；做时再立 spec）

- [ ] **6.15 大纲排序切换（文档顺序|字母序）与条目右键**（可选）
- [ ] **6.16 树键盘导航 / 多选**（可选·远期）
- [ ] **6.17 链接指向目录时侧栏定位**（可选·6B 落地后可做；原 `App.tsx:1130` 低优注释场景）
- [ ] **6.18 SearchPanel `sidebar-mode-seg` 与头部双 tab 冗余消除**（可选·远期；6A/D2 有意零触碰）

---

## 遗留记录（本轮评估发现、未列入手术项）

- [x] `preferences/store.ts`：**已决（4.1）：保持不拆**（418 行、分节清楚）；31 字段 schema 化 / `sanitizeSession()` 对齐登记为**远期备选**（不进本清单）
- [x] 组件层轻度「直达编辑器」导入（`Outline` 的 `foldKey`、`TableInsertDialog` 的 `sniffDelimiter`）：**已决（4.1）：接受现状不收紧**（纯工具直引，经 App 传参反而加 props 面）
- [x] `preferences/store.ts` 的 `applyPreferencesCssVars()` 是 `:root` 唯一声明点规则的明文豁免（runtime inline 覆盖 `--editor-max-width` 等 4 个 token）：**已决（4.1）：知情保留**（偏好滑杆必须 runtime 写入，双通道是设计）
