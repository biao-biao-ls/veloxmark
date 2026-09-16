# P07 文件夹工作区增强

优先级：P07 | 类别：功能 | 预估规模：M

## 背景

V1 已有文件夹工作区（树侧栏 + fs watch + 新建/重命名/删除，见
`FileTree.tsx` / `hooks/useWorkspaceTree.ts` / `electron/ipc/folder.ts`
的 watcher），但相比 Typora/VS Code：
没有忽略规则（`.git`、`node_modules` 全量显示）、不能新建文件夹、不能拖拽
移动、没有文件快速打开、没有文件夹内搜索（全局搜索另见 P13）。

## 目标

把文件树补到"日常可用"：干净的树（忽略噪音目录）、完整 CRUD、拖拽移动、
按名称快速打开文件。

## 功能需求

### 树内容
- [ ] 内置忽略规则：`.git`、`node_modules`、`.DS_Store`、常见构建目录
- [ ] 忽略规则可配置（设置项，glob 列表，对接 P03）
- [ ] 隐藏文件（`.` 开头）默认隐藏，可切换显示
- [ ] 大目录懒加载/虚拟滚动（>500 项时）；watcher 推送限流防抖

### CRUD 补全
- [ ] 右键目录新增 "New Folder"（新建子目录）
- [ ] 根目录右键菜单（当前根只能靠顶部 `+` 新建文件）
- [ ] 拖拽移动：文件/目录拖到目标目录（跨目录移动，fs.rename；目标在
      其自身子树内时拒绝）
- [ ] 复制路径（右键 "Copy Path" / "Copy Relative Path"）

### 快速打开
- [ ] Quick Open：`Ctrl+P` 弹出模糊搜索框，按文件名匹配工作区内所有
      md/txt，回车打开（Typora 的 "Go to File"）
- [ ] 输入 `:` 或专门快捷键可跳行号（可选，低优）

## 实现要点

- 忽略规则在**主进程**过滤：`electron/ipc/folder.ts` 递归/readdir 构树
  处应用规则后再推送，避免大目录打爆 IPC。
- 新建文件夹 IPC：`folder:mkdir`；拖拽移动 IPC：`path:move`（校验目标
  非自身子树）。handler 落对应域模块，类型扩 `electron/shared/api.ts`。
- Quick Open：树数据已在渲染进程（`hooks/useWorkspaceTree.ts` 的
  `folderTree` state），客户端做模糊
  匹配（子序列匹配 + 打分排序，无需依赖库）；新组件
  `src/renderer/src/components/QuickOpen.tsx`，样式仿命令面板（居中模态、
  键盘上下选择）。
- 拖拽用 HTML5 DnD（`draggable` + dragover/drop），树行上显示落点指示线。
- watcher 推送防抖 100ms 合并，现有实现若全量重扫需注意性能。

## 验收标准

1. 打开含 `node_modules` 的目录，树中不显示它；修改设置可恢复显示。
2. 右键目录出现 New Folder；创建后树即时刷新。
3. 文件 A 拖入目录 B 后，若 A 正打开在编辑器中，标题/保存路径跟随更新
   （复用现有 treeRename 的跟随逻辑）。
4. `Ctrl+P` 输入部分文件名（如 "rea" 匹配 `readme.md`）回车即打开。

## 非目标

- 文件内容全文搜索（属 P13）、git 状态装饰、符号搜索。
