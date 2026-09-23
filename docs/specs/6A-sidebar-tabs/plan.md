# 6A 文件/大纲双 tab 信息架构 实施方案

## 技术决策与理由

- **D1 双 tab 落 `sidebar-header`**：files/outline 两个 `role=tab` 按钮 + 下划线指示（CSS 新 `.sidebar-tab` 族，皮肤对齐 `sidebar-mode-seg` 但独立类名——不复用旧类避免探针误关联）。search 不占 tab：经现有搜索按钮 / 6D「操作」面板进入，返回走 `sidebarBackModeRef` 机制（已有，`App.tsx:738-749`）。
- **D2 SearchPanel 的 `sidebar-mode-seg` 零触碰**：三段控件保留在搜索面板内（它有独立探针面），与头部双 tab 并存语义不冲突（都写同一 `sidebarMode`）。消除冗余 UI 另立远期项。
- **D3 移除打开路径的自动切模式**：直接删 `useWorkspaceTree.openFileFromTree` 与 `useDocIo.openDocPath` 里的 `setSidebarMode('outline')`（各 1 处）——所有打开来源统一驻留（AC2）。不加开关参数：驻留是唯一语义，避免状态组合爆炸。
- **D4 files 空态独立**：`App.tsx` files 分支条件去掉对 `folderPath` 的依赖——`sidebarMode === 'files'` 恒渲染文件 tab（FileTree 或空态卡）；空态含「打开文件夹」按钮（复用 `openFolder` 命令）。
- **D5 tab 标签文案** i18n key `sidebar.tab.files` / `sidebar.tab.outline`（en: Files / Outline；zh: 文件 / 大纲）。

## 文件切法

| 源 | 改动 |
|---|---|
| `App.tsx` | L1413-1518 aside JSX：头部换双 tab（D1）、files 分支去 `folderPath` 条件 + 空态卡（D4） |
| `hooks/useWorkspaceTree.ts` | L94-114 `openFileFromTree` 删 `setSidebarMode('outline')`（D3） |
| `hooks/useDocIo.ts` | L113,152 `openDocPath` 删 `setSidebarMode('outline')`（D3） |
| `styles/chrome.css` | `.sidebar-tab` 双 tab + 下划线 + 空态卡样式（`--space-*` 纪律） |
| `i18n/en.ts` + `i18n/zh.ts` | D5 两个 key + 文件 tab 空态文案 |

不动：`SearchPanel.tsx`（`sidebar-mode-seg` 原样）、`useSessionPersist.ts`（模式记忆已有）、`preferences/store.ts`（`SidebarMode` 类型不变）。

## 状态/契约归属

- `sidebarMode` 真源仍是 App state + session 持久化（不变）；`sidebarBackModeRef` 归属不动。
- 新增 DOM class 契约登记：`.sidebar-tab` / `.sidebar-tab.is-active`（新契约，收敛记录登记入探针可扫描面）。

## import 改动面

无新 import（双 tab 是 JSX 组合）；`useDocIo` 若因删行不再引 `setSidebarMode` 则清 import。

## 任务拆分

| # | 任务 | 依赖 |
|---|---|---|
| T1 | 头部双 tab UI + 切换 + 样式（D1/D5） | [P] T3 |
| T2 | 删两处自动切模式（D3，**行为变更**） | [P] T1 |
| T3 | files 空态卡（D4） | [P] T1 |
| T4 | 人工冒烟（见验证） | T1–T3 |

## 验证方案

```bash
npm run typecheck && npm run test:unit
```

- 人工冒烟（**行为变更单元，必做**）：
  1. 双 tab 互切 + 下划线指示；重启回到上次 tab
  2. 文件 tab 连开 2–3 个文件：侧栏**留在文件 tab**、树上下文不丢（核心回归点）
  3. QuickOpen / 搜索结果打开文件：侧栏模式不变；搜索面板停留不被打断
  4. 无工作区启动 → 文件 tab 空态 + 「打开文件夹」可用
  5. 搜索进出返回原 tab；宽度拖拽/深浅主题
- 契约同步项记录：探针对「点文件后 mode」的断言更新（外部仓库）。
