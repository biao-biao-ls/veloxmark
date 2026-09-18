# P13 文件夹全局搜索

优先级：P13 | 类别：功能 | 预估规模：M

## 背景

当前只有单文档内搜索（CM6 search panel，Ctrl+F）。打开文件夹工作区后，
Typora/VS Code 用户预期能跨文件查找甚至替换，目前无法做到。

## 目标

侧栏新增 Search 视图：在打开的文件夹内全文查找，结果显示为"文件 → 匹配
行"列表，点击跳转；支持替换（单处/全部）。

## 功能需求

- [x] 侧栏第三个模式（files / outline / **search**），View 菜单 + `Ctrl+Shift+F`
      唤起，聚焦搜索框
- [x] 搜索范围：当前文件夹工作区全部文本文件（沿用 P07 忽略规则；
      默认扩展名 md/markdown/txt，可扩展）
- [x] 输入即搜（debounce 200ms）：结果显示文件名 + 命中行号 + 行内容
      高亮片段；每文件默认显示前 10 条，可展开
- [x] 大小写切换、全词匹配、正则模式三个 toggle
- [x] 点击结果：打开对应文件并把光标定位到命中行（已打开的文件直接跳）
- [x] 替换：单条结果替换、按文件替换、全部替换（替换前可展开预览）
- [x] 结果计数、搜索中/无结果状态展示

## 实现要点

- 搜索执行放**主进程**：IPC `search:run {rootPath, pattern, options}`，
  新建 `electron/ipc/search.ts` 域模块，遍历目录（复用
  `electron/ipc/folder.ts` 构树的忽略逻辑）逐文件 `readFile` 匹配，
  流式/分批推送结果（`search:results` 事件），避免大仓库阻塞。
- 正则模式需在主进程 try/catch 非法正则并回错误提示。
- 替换走主进程批量写；正在编辑器打开且 dirty 的文件替换需谨慎——首版
  策略：对 dirty 打开文件跳过并提示（避免覆盖未保存内容）。
- UI：`src/renderer/src/components/SearchPanel.tsx`，挂在侧栏
  `sidebarMode` 联合类型旁（`App.tsx` 现有 'outline' | 'files' 扩为三值）；
  顶部/侧栏切换按钮增加搜索图标。
- 结果跳转复用 `openFileFromTree` + `goToHeading` 的 dispatch 模式，需新增
  "打开并定位到 pos"的组合函数。

## 验收标准

1. 打开文件夹，Ctrl+Shift+F 输入关键词，1 秒内在百文件夹出结果；点击
   结果跳到对应文件行。
2. 正则模式 `foo\d+` 正确匹配；非法正则显示错误而非崩溃。
3. 全部替换后文件磁盘内容已更新，打开的文件编辑器内容同步。
4. 搜索遵守忽略规则：`node_modules` 内命中不出现。

## 非目标

- 跨未打开文件夹的全局搜索、搜索结果持久化、语义搜索。

## 实施状态（已完成）

实现与 e2e（`scripts/cdp-p13.mjs`，端口 9230，54/54 PASS）均已落地：

- **主进程**：新建 `electron/ipc/search.ts`（`registerSearchIpc`）。
  `search:run` 编译模式（plain/regex × case/wholeWord；非法正则返回
  `{searchId, error}` 不抛出）、`collectFiles` 复用 `folder.ts` 新导出的
  `applyFolderScanOptions` / `isIgnoredPath`（默认忽略 node_modules/.git/
  dist/out/build + 隐藏目录；默认扩展名 md/markdown/mdown/txt）、逐文件
  匹配后按 ≤50 条 `setImmediate` 分批 `search:results` 流式推送，
  `done` 批次携带 `totalMatches`；行超长/单文件命中设硬上限防病态输入。
  `search:replace` 支持 one/file/all 三作用域：one 以 `{line,col}` 锚定
  原行该次出现（过期命中静默跳过）；file/all 用字面量替换（不展开 `$`）；
  `skipPaths` 命中记入 `skipped[]`；写盘后返回 `written[]`。
- **类型/桥接**：`electron/shared/api.ts` 新增 SearchOptions/SearchMatch
  （`col` 绝对列 + `snippetCol` 片段内偏移双锚点）/SearchFileResult/
  SearchRunPayload/SearchReplaceRequest/SearchReplaceResult 与 RendererApi
  三方法；`preload.ts` 同步桥接；`ipc/index.ts` 注册。
- **渲染层**：`SidebarMode` 扩为 `'outline'|'files'|'search'`（`store.ts`
  session sanitize 同步）；`SearchPanel.tsx` 独立侧栏组件——200ms debounce
  即输即搜、`searchId` 丢弃过期批次、Aa/W/.* 三 toggle、每文件前 10 条
  + 展开、单条/按文件/全部替换（all 走 danger 确认框；dirty 打开文件
  替换后弹「Replace Skipped」提示）、替换写到当前打开且 clean 的文件时
  经 `reloadOpenFile` 重载编辑器保持磁盘/缓冲一致。`App.tsx` 提供
  `openGlobalSearch` / `openSearchResult`（复用 dirty 门 + 光标定位
  dispatch）/ `reloadOpenFile` 与 e2e 钩子 `window.__veloxP13`；
  `useFileOps.ts` 新增 `openFileByPath(path, pos?)`（不改 sidebarMode，
  搜索面板保持可见）；Titlebar 增搜索图标按钮；`commands.ts` View 菜单
  注册 `globalSearch`（Ctrl+Shift+F，`bindGlobal`）；macOS 原生菜单
  `Cmd+Shift+F`。
- **e2e 结果**：IPC 层 needle 计数/忽略规则/正则/非法正则；UI 层模式切
  换/聚焦/计数/10 条截断展开/三 toggle/错误态恢复；点击跳转光标行 6；
  替换单条→磁盘+打开编辑器同步；按文件替换不动其他文件；全部替换跳过
  dirty 打开文件（磁盘与缓冲均保留）并写净其余文件；clean 打开文件全替
  后编辑器与磁盘逐字节一致。稳态搜索（百文件夹具 + 100 bloat 文件）
  311ms ≪ 1s 验收线。
