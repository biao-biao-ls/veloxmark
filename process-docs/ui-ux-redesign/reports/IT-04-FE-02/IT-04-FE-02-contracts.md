# IT-04-FE-02 契约速查（收集阶段落盘，断点续跑锚点）

> 本文件为「收集 CDP 驱动所需契约细节」阶段产物。重派第 1 轮该阶段看门狗超时中止，本文件将契约一次性落盘，供驱动分段复用。

## 1. 启动与 CDP 连接

- 启动：frontend 根目录（`D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`）执行
  `npx electron-vite dev -- --remote-debugging-port=<N> --user-data-dir=<独立目录>`
  （`npm run dev -- --userDataDir` 被 electron-vite cac 吞参报 CACError——IT-01-FE-07 登记）
- 本任务用独立端口 **9501** + 独立 user-data-dir `it04-fe02-userdata`
- 验证前置：`Page.bringToFront` + `Page.setWebLifecycleState({state:'active'})` + `Emulation.setFocusEmulationEnabled({enabled:true})`（遮挡窗口拖慢定时器）
- 全部 `Runtime.evaluate` 必须带 wall-clock 超时（12s 级）
- 草稿恢复对话框一律点「稍后」，绝不丢弃草稿

## 2. e2e 缝（window.__velox*，冻结契约）

| 缝 | 关键成员（本任务用） |
|---|---|
| `__veloxEditor` | `view`（EditorView）、`applyLivePreviewConfig` |
| `__veloxP04` | `setSaveTarget(path\|null)`、`saveCalls()`（export/e2eSaveDialog.ts） |
| `__veloxP12` | `loadDoc(content,path)`、`getDoc()`、`getFilePath()`、`getDirty()`、`saveFile()`、`getLastAutoSaveAt()`、`runDraftCheck()` |
| `__veloxP15` | `bench(lines,formulas,samples)` 装饰重建耗时 |
| `__veloxP18` | `getFoldedKeys()`、`toggleKey(key)`、`getHeadingKeys()`、`restoreKeys([])`（折叠；per-path 持久化，loadDoc 后须 restoreKeys([])） |
| `__veloxP20` | `copyRichText()`、`getClipboard()`、`getToast()`、`setThemePref('light'\|'dark')` |
| `__veloxP21` | `renderExportHtml()`（P04 渲染整篇导出 HTML）、`getDoc()`、`pressEnter()` |
| `__veloxP23` | `format()`、`loadDoc()`、`saveFile()`、`setFormatOnSave()`、`faultNextFormat()` |
| `__veloxP24` | `codeBlockInfo()`、`clickExpander()`、`clickFold()`、`setPrefs()` |
| `__veloxP26` | `getDoc()`、`loadDoc()`（多标签） |
| `__veloxPrefs` | preferences/store.ts:519 挂载 |
| `__veloxExport` | hooks/useExport.ts:215 挂载（导出通道） |
| `__veloxTable` | 表格 op 探针（`op('insertRow'...)` 等，见 table/ 下探针） |
| `__veloxTableCellView` | 懒装（nestedSession 进入表格编辑态才挂） |

初始化约定：seams/index.ts 在 import 时全部置 null，「未装」≠「stale」。

## 3. data-op 冻结集（editor/table/contract.ts）

- TABLE_MENU_OP_IDS **19 项**：insertRowAbove, insertRowBelow, deleteRow, insertColLeft, insertColRight, deleteCol, moveRowUp, moveRowDown, moveColLeft, moveColRight, alignLeft, alignCenter, alignRight, cutCell, copyCell, pasteCell, copyTable, formatTableSource, deleteTable
- TOOLBAR_DATA_OP 6 键：grid=`resizeTable`、alignLeft/Center/Right 同名、more=`TBL-MOR-OPN`、deleteTable 同名（CHANGE-3：弃原型 TBL-TOOL-GRID，探针以 resizeTable 为准）
- `data-table-handle` 契约集删4留1：仅 **col-grip**
- TABLE_OP_TOAST_KEYS：13 结构操作各有冻结 toast 回执（toast.* key 冻结勿动）

## 4. 冻结文案（只登记不擅改）

- `err.autosaveFailed` = 「自动保存失败，文档可另存副本」（en: "Auto-save failed. Save a copy of the document."）
- `toast.autoSaveFailed` = 「自动保存失败（{reason}）」/ `toast.autoSaveFailedPath`
- 状态栏：`status.savedAt` = 「已保存 {time}」；`.sb-autosave` / `.sb-autosave-dirty` / `.sb-autosave-error`
- toast.*/ctx.*/err.* key 全集冻结

## 5. 已登记差异（按已登记对待，勿报新缺陷）

1. CHANGE-11（pending）两按钮对话框「取消左+确认右」
2. col-grip 常驻 DOM+CSS 零漆（FE-10 方案 A）
3. hover 基线 AC ≥150ms（实测 165ms 级）
4. 进编辑态表后段 +1.28px 亚像素属 P10 度量
5. AC-FN-29 分级退格已修（gap 点击→表格编辑态+工具栏保持）
6. CHANGE-3/CHANGE-9 pending 属 doc-reconcile 裁定项

## 6. 判据真源

- `docs/requirements/ui-ux-redesign/ac.md` **v1.4**（PEND 转正 16 条 GWT、附录别名对账 22/22）
- 7 页原型 `docs/requirements/ui-ux-redesign/ui/ui_01..07`
- `design/api/GLB-global-patterns.md` §3.5/§3.7
- `design/tech-design.md` §6（零 DDL）/§8.4（三平台 token 化）/§10（异常处理）
- 总看板 `docs/ui-redesign-tasks.md`

## 7. 环境限制登记

- 本机 Windows 10 Enterprise 10.0.19045 单机 → AC-NF-10 的 Win11×深浅组合无法实测，按 tech-design §8.4「三平台行为一致（CSS token 化，无平台分支）」推定 + 登记待跨机复验。
