# 6A 文件/大纲双 tab 信息架构（任务 6.1 + 6.2）

## What / Why

侧栏头部改为「文件 | 大纲」双 tab 并列切换（对齐 Typora，`temp/typora/typora-2.png` / `typora-3.png`）；点击文件树文件打开文档后侧栏**驻留**文件 tab，不再自动跳大纲。现状三模式互斥、files 头部无去大纲入口、每打开一个文件侧栏就切走一次——浏览目录连开文件时反复丢树上下文，是左侧导航最大交互硬伤（评估 P0-1）。

## 背景与现状

- 三模式互斥渲染：`SidebarMode = 'outline' | 'files' | 'search'`（`preferences/store.ts:17`），`App.tsx:1413-1518` 按 `sidebarMode` + `folderPath` 条件三选一；无 folder 时 files 条件失败回落大纲分支（无空文件树页）。
- 唯一切换 UI 是 SearchPanel 头部三段控件 `sidebar-mode-seg`（`SearchPanel.tsx:268-300`）；files 头部（`App.tsx:1428-1443`）只有「目录名 + 搜索 + +」无去大纲入口；outline 头部（`App.tsx:1479-1498`）只有单向「‹ 文件」。
- 点文件即 `setSidebarMode('outline')`：`useWorkspaceTree.ts:94-114`（树点击）与 `useDocIo.ts:113,152`（openDocPath 非 quiet 路径）。
- session 已记忆 `sidebarMode`（`useSessionPersist.ts:46-57`）。

## 验收标准（AC）

1. 侧栏头部常驻「文件 | 大纲」双 tab（文字 + 下划线指示，同 Typora），点击互切，当前 tab 有明确指示态。
2. 打开文档（树点击 / QuickOpen / 搜索 / 命令任意路径）后侧栏**不**自动改 `sidebarMode`（**行为变更**）：浏览文件 tab 连开文件不丢树上下文；搜索面板停留语义同理不被打开动作打断。
3. 搜索入口不劣化：用户能从侧栏进入全局搜索/QuickOpen 并返回原 tab。
4. `sidebarMode` session 记忆沿用（重启回到上次 tab）。
5. 无工作区/无根时文件 tab 显示合理空态（引导「打开文件夹」），而不是静默回落大纲。
6. 深浅主题正常；`sidebar-resizer` 宽度拖拽不回归。

## 约束

- e2e 缝：`__veloxP13.getSidebarMode()` 语义保持（仍返回当前模式字符串）；命令 id `toggleOutline` 不改（仍翻侧栏可见性）。
- **行为变更契约同步项**：外部探针若断言「点文件后 `getSidebarMode() === 'outline'`」需随 6.2 更新（探针脚本不在本仓库，收敛记录注明）。
- class 契约：`sidebar-mode-seg`（SearchPanel）本单元零触碰（plan D2）；`outline-fold` / `filetree-*` / `sidebar-resizer` 不在 diff。
- i18n 纪律：新 key（tab 标签、空态）同加 `i18n/en.ts` + `i18n/zh.ts`。
- 6.2 属行为变更：收敛记录注明 + 人工冒烟必做。
