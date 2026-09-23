# 6B 树根跟随当前文档（任务 6.3 + 6.4）

## What / Why

文件树根从「显式打开的工作区文件夹」改为 **激活文档所在目录**（用户 2026-09-23 拍板对齐 Typora）：树显示当前 md 所在目录的文件与含 md 的子目录，打开/切换不同目录下的文档时根随之切换。替代现在一窗单工作区的 VS Code 式模型，消除「导航上下文与阅读上下文脱节」的产品语义分歧（评估 P0-3）。

## 背景与现状

- 树根 = `folderPath`：显式「打开文件夹」（命令 `openFolder`，Ctrl+Shift+O）或 session `lastFolderPath` 恢复（`useWorkspaceTree.ts:67-83`）；一窗一 watched folder（`electron/ipc/folder.ts:100-113`）。
- **无**「激活文档目录自动作根」机制。`baseDir`（链接/图片相对路径解析）是另一套概念，不动。
- 过滤策略已对齐 Typora：仅 md 族文件 + 目录递归含 md 才保留（`folder.ts:9,67-93`）。
- QuickOpen / 全局搜索 / 文件树共用这棵 `folderTree`（扫描范围 = 树根）。
- watcher：`fs.watch` 递归 + 200ms 防抖整树重推（`folder.ts:129-172`）；recursive 不支持时静默降级。

## 验收标准（AC）

1. 激活文档有路径时树根 = 该文档所在目录；切换 tab / 打开新文件时根随激活文档切换。
2. 树内容 = 根下 md 族文件 + 含 md 子目录（现有过滤不变），递归层级结构不变。
3. 「打开文件夹…」显式设定树根（钉住），与跟随制的优先级可预期（plan D1 规则）。
4. 无激活文档 / 未命名草稿：树根回落最近一次根，树不消失。
5. watcher 随根换靶无泄漏（旧根解除监听、新根即时推树）；快速切 tab 时过期树不闪错（竞态守卫）。
6. QuickOpen / 全局搜索扫描范围 = 当前树根（**行为变更注明**：不再固定为打开的工作区）。
7. `__veloxP13.openFolder(path)` 调用后树显示 path 内容（缝行为保持）。
8. 扫描深度上限复核（现状 8，`folder.ts:10`）：放宽或可配置，深树不再静默截断（或截断可感知）。

## 约束

- IPC channel 名不改（`folder:*`）；`DirNode` 只增字段不删改；「一窗一 watched folder」单 watcher 约束保持（换靶不换模型），多根工作区不在范围。
- e2e 缝：`__veloxP13.openFolder` / `getSidebarMode`、P26 tabs 面、命令 id `openFolder` 均不改。
- `baseDir` 语义零触碰（链接/图片解析契约）。
- **行为变更密集单元**：收敛记录 + 人工冒烟必做。
- 新逻辑落独立 hook（App.tsx 不再堆——宪法禁忌）。

## [NEEDS CLARIFICATION]

无——根模型已由用户拍板「跟随 Typora 当前 md 所在目录为根」；边角规则（显式根优先级、回落）由 plan D1 拍板，implement 前可改。
