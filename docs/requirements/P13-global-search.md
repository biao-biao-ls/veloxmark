# P13 文件夹全局搜索

优先级：P13 | 类别：功能 | 预估规模：M

## 背景

当前只有单文档内搜索（CM6 search panel，Ctrl+F）。打开文件夹工作区后，
Typora/VS Code 用户预期能跨文件查找甚至替换，目前无法做到。

## 目标

侧栏新增 Search 视图：在打开的文件夹内全文查找，结果显示为"文件 → 匹配
行"列表，点击跳转；支持替换（单处/全部）。

## 功能需求

- [ ] 侧栏第三个模式（files / outline / **search**），View 菜单 + `Ctrl+Shift+F`
      唤起，聚焦搜索框
- [ ] 搜索范围：当前文件夹工作区全部文本文件（沿用 P07 忽略规则；
      默认扩展名 md/markdown/txt，可扩展）
- [ ] 输入即搜（debounce 200ms）：结果显示文件名 + 命中行号 + 行内容
      高亮片段；每文件默认显示前 10 条，可展开
- [ ] 大小写切换、全词匹配、正则模式三个 toggle
- [ ] 点击结果：打开对应文件并把光标定位到命中行（已打开的文件直接跳）
- [ ] 替换：单条结果替换、按文件替换、全部替换（替换前可展开预览）
- [ ] 结果计数、搜索中/无结果状态展示

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
