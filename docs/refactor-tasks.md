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

- [ ] **1.1 e2e 类型声明外移**：`declare global` 的 `__veloxP12`–`__veloxP29` 等约 284 行（App.tsx 约 L100–384）→ `src/renderer/src/e2e/handles.d.ts`
- [ ] **1.2 e2e seam useEffect 外移**：约 300 行 seam 装配（约 L720–2300 区间内）→ `src/renderer/src/e2e/seams/`，按 P 编号分组（如 `p26.ts`…`p29.ts`），App 只保留统一装配入口
- [ ] **1.3 复核剩余业务回调**，如有明显独立域（如折叠同步、会话持久化 effect 群）可顺势下沉到 hooks（可选）

### 1B. 拆 styles.css（3131 行 → styles/ 目录）

- [ ] **1.4 按注释 section 切文件**（切割线即现有注释边界）：
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
- [ ] **1.5 提取阴影/焦点环 token**：`--shadow-pop`（3 处重复）、`--shadow-modal`（2 处）、`--focus-ring`（2 处）
- [ ] **1.6 收敛 `.theme-dark` 旁路补丁**（约 6 处选择器级暗色补丁 + callout 色 light/dark 整段复制 ×2）：能翻转成 token 的翻转进 `.theme-dark`，不能的在所属模块内就近保留 theme 段
- [ ] **1.7 按钮皮肤归并（可选）**：5 套平行按钮（`.dialog-btn` / `.cm-search .cm-button` / `.sidebar-mode-seg button` / `.sb-stat-btn` / `.mermaid-preview-bar button` / `.tab-context-menu button`）抽共享 primitives（`.btn` / `.btn-primary` / `.btn-danger`），注意 `.dialog-btn-primary` 的暗色特例（L917–919）

### 1C. 主题色单源化

- [ ] **1.8 确立唯一色值源**：以 `src/renderer/src/export/palette.ts` 为单一定义（或新建 `src/renderer/src/theme/tokens.ts`）
  - `styles.css`（→ `themes.css`）的 `.theme-light/.theme-dark` 消费同一套值（构建期注入或手工对照 + 测试守护二选一）
  - `export/exportCss.ts` 的 `lightVars/darkVars` + callout 色（L308–315）改为从 palette 引用
  - `editor/livePreview/hljsTokens.ts` 的 hljs 映射表标注引用关系
  - 注意导出侧 class 名 `.export-theme-light/.export-theme-dark` 与运行时 `.theme-*` 的对应关系一并文档化
- [ ] **1.9 加一致性测试**：断言 palette 值与 styles.css 声明一致（读文件解析或快照），杜绝再次漂移

### 1D. 拆 handlers.ts（907 行，TS 侧最安全的首个拆分）

- [ ] **1.10 抽共享层** `editor/livePreview/handlers-ctx.ts`：`BuildCtx`、`PendingDeco`、6 个 Decoration 单例（`hide`/`markEm`/`markStrong`/`markDel`/`markCode`/`markLink`/`markLinkBroken`）、小工具（`nodeText`/`hideMarkerWithSpace`/`listDepth`/`quoteDepth`）
- [ ] **1.11 拆 tree handlers** `handlers-tree.ts`：全部 `enter*`（行内/标题/链接/图片/列表/引用/callout/hr/任务）
- [ ] **1.12 拆表格+围栏代码** `handlers-code.ts`：`enterTable`、`enterFencedCode` + 私有 `buildFocusedCodePanel`（唯一同时碰 table/state 与 codeBlockUi/hljsTokens 的段，文件头注明「装饰层感知编辑会话」语义）
- [ ] **1.13 拆数学 pass** `handlers-math.ts`：`collectMathDecos` + `MATH_SKIP_NODES`（文件头注明「须在树 pass 之后跑」契约；与 `export/renderDoc.ts` renderTextRun 是手工平行实现，语法改动双处同步）
- [ ] **1.14 拆扩展语法 pass** `handlers-extended.ts`：`collectExtendedDecos`（front matter/脚注/highlight·sup·sub/缩写/定义列表/属性）。唯一需要动代码形状之处：把局部闭包 `inInlineSyntax`/`inlineMarkPass`/`bodyFrom` 提升为参数化工具
- [ ] **1.15 保留 `handlers.ts` 作 re-export barrel**（下游 `build.ts` 零改动），或直接改 `build.ts` import；**解开循环依赖** `build → handlers → table/widget → livePreview/field`

---

## 阶段 2 — 结构性拆分

### 2A. 拆 widgets.ts（1445 行）

- [ ] **2.1 前置：抽 `editor/blockWidget.ts`**：`BlockWidget` 基类 + `BlockToolbarItem`（`table/widget.ts` 也依赖）
- [ ] **2.2 抽纯函数层** `editor/render-helpers.ts` + `editor/image-parse.ts`：`highlightCodeHtml`、`renderKatexHtml`、`parseImageMarkdown`、`flipTransform`、`splitHighlightedLines`（零状态、DOM-less 可测；让 `export/renderDoc.ts` 脱离 widgets 大文件）
- [ ] **2.3 拆 mermaid 管线** `editor/mermaid/`（约 450 行）：渲染核心 + 并发闸 + 缓存 + 错误态记忆 + 导出 IO seam + `MermaidWidget`。**`mermaidCache`/`mermaidLastGood`/`mermaidIoOverride` 等模块状态必须与消费方单一归属**；同步更新 5 处 import（MermaidPreviewPanel / opsBlocks / App / renderDoc / handlers）
- [ ] **2.4 拆图片组** `editor/image-widget.ts`（约 380 行）：`ImageWidget` + `imageCache` + 选中态/缩放工具栏；`closeAllImageSelections` 被 `editor/images.ts` 引用需改路径
- [ ] **2.5 拆代码块组** `editor/codeBlock-widget.ts`（约 220 行）：`CodeBlockWidget`、`CodeLangChip`、scoped CSS 注入（`ensureScopedCss` 一次性守卫随之迁移）
- [ ] **2.6 小 widget 归并**：`FrontMatterWidget`/`FootnoteRefWidget`/`FootnoteDefBackWidget`/`TaskWidget` → `editor/widgets-extended.ts`；`MathBlockWidget`/`InlineMathWidget` → `editor/widgets-math.ts`
- [ ] **2.7 widgets.ts 收尾**：仅留 barrel 或删除；补/迁移 `widgets.p24.test.ts` 的导入路径

### 2B. 拆 commands.ts（874 行）

- [ ] **2.8 零风险外提**：`fmtShortcut` → `commands/shortcutDisplay.ts`；`matchGlobalShortcut` → `commands/shortcutMatch.ts`（顺手补单测）；`MENU_LAYOUT` + `buildMenus` + `buildRecentSubmenu` → `commands/menuLayout.ts`
- [ ] **2.9 `buildCommands` 按域拆**：`commands/fileCmds.ts` / `editCmds.ts` / `formatCmds.ts` / `tabsCmds.ts` / `viewCmds.ts` / `insertCmds.ts`，各返回 `Command[]` 后 concat。**命令 id 字面量不可改**（cdp 探针契约），拆后同步探针扫描文件范围
- [ ] **2.10 `CommandOps` 拆域接口**（28 字段 → `FileOps & EditOps & ViewOps & …`）；同步 `useMenus.Args` 与 App.tsx 的 `commandOps` 对象字面量
- [ ] **2.11 命令表缓存**：App.tsx `setCtxRuntime` 中 `runCommand`/`isCommandDisabled` 每次重建全表 `buildCommands().find(id)` → 改 Map 缓存（热路径）
- [ ] **2.12 快捷键双源治理**：`commands.ts` 的 `shortcut` 与 `electron/main.ts` 的 `DARWIN_COMMAND_ACCELERATORS` 加一致性测试，或改为单源派生

### 2C. 拆 registry.ts（532 行）

- [ ] **2.13** `ctxMenuStore.ts`：runtime 单例 + menuState + listeners + 焦点归还策略（registry L39–81）
- [ ] **2.14** `deltaRegistry.ts`：`blockDeltas` 注册表 + `registerContextMenuOps` + `__veloxCtxDebug` e2e 缝（L83–99）
- [ ] **2.15** `menuSkeleton.ts`：`sep`/`cmdItem`/各 submenu helpers + `buildContextMenu` + `__veloxCtxLastHit` 缝（L101–310）
- [ ] **2.16** `opsTable.ts`：表格 delta 自举段（L312–512，`TableDeltaDeps` + 9 个 op 适配器 + `table-cell` factory）；`data-op` id 不可改；UX-P28 B3 的 `setActiveCell` 语义注释随之迁移
- [ ] **2.17 opsBlocks 整理（低优先）**：抽 `blockHelpers.ts`（L25–94）；让 opsBlocks 复用 `transforms.ts` 的 dispatch 约定，消除重复的 `view.dispatch` 模式；`transforms.ts` 表格段（L133–181）可迁 `editor/table/source.ts`

### 2D. electron 小手术

- [ ] **2.18 抽 macOS 原生菜单**：`NATIVE_MENU_STRINGS` + `buildDarwinMenu` + `rebuildDarwinMenu` + `recentFilesSubmenu` + `commandItem` + `NATIVE_CHECKBOX_COMMANDS`（约 280 行）→ `electron/menu/darwin.ts`
- [ ] **2.19 游离 ipc handler 归位**：`app:rendererReady` / `app:setRecentFiles` / `app:setMenuCheckedIds` / `app:setLanguage` / `app:closeResponse`（main.ts whenReady 内联）→ `ipc/` 对应域模块，落实 `registerAllIpc` 的「按域分组」注释
- [ ] **2.20 IPC channel 字符串收口**：`shared/api.ts` 增加 `export const IpcChannels = { … } as const`，preload 与 ipc/* 都从常量取值（补上类型契约唯一的洞）；`onMenu(channel: string)` 收窄为 `onMenu(id, …)` + `menu:` 前缀函数
- [ ] **2.21 `ipc/window.ts` 域归位**：`clipboard:*`（6 个）、`shell:openExternal`、`app:setState` 拆出或挪至正确域模块

---

## 阶段 3 — 先立契约再动刀

### 3A. useFileOps.ts（1018 行）

- [ ] **3.1 前置：dirty/savedContent 单一真源**：三轨（`dirtyRef` / `tab.dirty` / `setDirty` state）与 savedContent 双写收敛到 tab store；消除 4 处散落的 `isActive ? dirtyRef.current : tab.dirty` 判断
- [ ] **3.2 抽公共类型/工具**：`docTabs.ts`（`DocTab`/`DocTabInfo`）——先统一与 `preferences/store.ts` 重复定义的 `SidebarMode`（两处同名类型）；`pathUtil.ts`（`baseDirOf`/`baseNameOf`，App.tsx 内另有手写同逻辑，一并去重）
- [ ] **3.3 拆 `useTabStore.ts`**：Map CRUD（`initTabs`/`activateTab`/`closeTab`/`reorderTab`/`reopenClosedTab`/`listTabs`/`tabOrder`/`findTabIdByPath`/`tabContent` 等，约 300 行）；`makeState` 注入 `extensionsRef`
- [ ] **3.4 拆 `useDocIo.ts`**：`openDocPath`/`loadContent`/`saveFile`/`saveFileAs`/`saveAllDirtyTabs`/`reloadTabFromDisk`/`maybeFormatForSave`/`markActiveSaved`（约 250 行）
- [ ] **3.5 拆 `tabClosePolicy.ts`**：`confirmDiscard`/`queryClose` + `closeTab` 的 dirty 分支（P12 三选一对话框语义一起搬）
- [ ] **3.6 保持 facade 兼容**：返回对象是 App/useAutoSave/useWorkspaceTree 共用接口，保留兼容壳或同步改 3 处绑定

### 3B. table/widget.ts（1142 行，耦合最重，最后动）

- [ ] **3.7 前置：立 `nestedSession` API**：收拢 `nestedViewInstance` + `pendingHandoff`/`handoffKey` + `activeNestedView` + `mountCellEditor`，提供 `get/commit/mount/destroyHandoff` 显式接口。**destroy↔mountCell 的 handoff 协议两端不可拆散**（correctness-critical，UX-P28 D1）
- [ ] **3.8 拆 `resolve.ts`**：模型重解析纯函数（`resolveTableModel`/`resolveWithFallback`，L56–98）
- [ ] **3.9 拆 `commands.ts`**（table 域）：`moveCell`/`runTableOp`/`commitActiveOnly`/`exitTableEdit`/`activateCellAt`/`clearTableEditAndFocusSource`/`handleTsvPaste`/`cellClipboard`/`openTableContextMenu`（约 370 行）；**顺带合并三份重复的「提交 pending」逻辑**（勿原样复制）
- [ ] **3.10 拆 `keymap.ts`**：`cellKeymap`/`boundaryNav`/`nestedCellTheme` + TSV paste handlers
- [ ] **3.11 `widget.ts` 只留 `TableWidget` + 行列把手 + 列宽拖拽 + `tableTestHook`**：testHook 调用 7 个内部函数，拆分后须保持 `window.__veloxTable` 契约（`scripts/cdp-p10.mjs` 依赖）
- [ ] **3.12 修复 barrel 状态**：`table/index.ts` 要么成为真实入口（`livePreview/handlers.ts` 改走 barrel），要么删除

### 3C. renderDoc.ts（712 行）

- [ ] **3.13 抽 `export/renderDoc/ctx.ts`**：`RenderCtx`/`RenderDocOptions`/`ImageMode`/`textOf`/`escapeHtml`
- [ ] **3.14 拆纯函数块**：`inlineText.ts`（`renderTextRun`/`escapeWithAbbrs`/`asMathBlock`）、`blockAttrs.ts`（`attrsFromTrailing`/`stripTrailingAttrs`/`splitDefinitionList`/`isDefLineText`）——约 250 行零依赖，先行
- [ ] **3.15 拆 dispatch 模块**：`block.ts`/`inline.ts`/`listTable.ts`/`code.ts`/`image.ts`/`callout.ts`（递归 walk 互调，从主文件注入或同模块内聚）
- [ ] **3.16 文件头固化平行契约注释**：与 `handlers-math.ts` 的正则同步约束、与 livePreview 的 class 契约（`markdown-image-ext`/`callout`/`inlineStyles` 注释提及处）

### 3D. 字典分裂治理（i18n 收尾）

- [ ] **3.17 `NATIVE_MENU_STRINGS` 并入统一 key 空间**：从共享 key 派生或让 0.2 的对齐测试覆盖第三份字典
- [ ] **3.18 删除 `DEFAULT_CALLOUT_TITLES` 重复**：`editor/livePreview/callout.ts` 的 zh/en × 8 型与 i18n `callout.*` 语义完全重叠，统一走 `t('callout.'+type)`（二选一，删一份）
- [ ] **3.19 i18n 读源统一**：`i18n/index.ts` 的 `langFromStorage` 自读 `veloxmark.preferences`，与 `preferences/store.ts` 存在启动时双读源——改为从 store 单一读取

---

## 遗留记录（本轮评估发现、未列入手术项）

- [ ] `preferences/store.ts`：**暂不拆**（418 行、分节清楚）。可选远期项：31 字段 schema 化（一处声明驱动 default+sanitize+类型）；`sanitizeSession()` 与 prefs 模式对齐
- [ ] 组件层轻度「直达编辑器」导入（`Outline` 的 `foldKey`、`TableInsertDialog` 的 `sniffDelimiter`）：可接受，若收紧由 App 传入即可
- [ ] `preferences/store.ts` 的 `applyPreferencesCssVars()` 是 `:root` 唯一声明点规则的明文豁免（runtime inline 覆盖 `--editor-max-width` 等 4 个 token），双通道现状保留但需知情
