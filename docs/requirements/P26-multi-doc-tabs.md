# P26 多文档标签页

优先级：P26 | 类别：UX/工程 | 预估规模：L

状态说明：对标对象 Typora 本身是单文档窗口模型，本项不是"对标差距"
而是工作区体验的超越项。原标注 V2 后置；本批实施经用户确认将 P25/P26
一并纳入，已按下方技术方案落地（见文末实施状态）。

## 背景

当前是单文档模型：`useFileOps` 持有唯一 `filePath`/`dirty`/
`savedContentRef`，打开新文件即替换编辑器内容——对照文档需要反复
"重新打开"，未保存切换依赖确认对话框硬扛。文件树/Quick Open/全局
搜索/P17 链接都会打开文件，多文档是这些能力的自然汇聚点。

## 目标

打开的文档以标签页并存：切换零加载、各自保留光标/滚动/折叠状态，
dirty 状态 per-tab 可见，会话重启后恢复标签集合。

## 功能需求

### 标签栏
- [x] 编辑器上方标签栏：文件名 + dirty 圆点 + 关闭按钮；溢出时横向
      滚动或折叠
- [x] 打开文件的统一规则：树双击 / Quick Open / 搜索结果 / P17 链接 /
      拖入文件——已打开则激活该 tab，未打开则新建 tab 并激活
- [x] New（无路径文档）以 "untitled-N" tab 呈现；保存后 tab 重命名为
      文件名
- [x] 关闭：按钮 / 中键 / 右键菜单（Close / Close Others / Close
      Right）；关闭 dirty tab 先确认；关最后一个 tab 回欢迎页
- [x] 拖拽排序 tab
- [x] 快捷键：`CmdOrCtrl+Tab` 下一 tab；macOS 原生菜单 Cmd+W 语义
      改为"关 tab"（仅在 tabs>1 时，否则保持关窗口——实现时评估平台
      惯例）

### 文档状态模型
- [x] 每 tab 独立保留：CM6 EditorState（含 selection、history、
      fold/table 等 StateField）、滚动位置、savedContent、outline
      缓存、`baseDir`（图片相对路径解析依赖打开时的文档目录）
- [x] 切换 tab：当前 `view.state` 存回 tab 条目，目标 state
      `view.setState(...)` 装载——live preview 装饰随 state 重建
- [x] dirty 判定 per-tab：`tab.savedContent !== doc.toString()`；窗口
      标题与 `setAppState` 反映**活动** tab
- [x] P12 自动保存覆盖**全部 dirty tab**（非仅活动）；崩溃恢复按 tab
      列表还原
- [x] 文件外部变更（P07 watcher）：命中已打开 tab 时按现有"重载/提示"
      策略处理，逐 tab 生效
- [x] 会话持久化（对接 P03 SessionState）：`openTabs: string[]` +
      `activePath` + 每 tab 的滚动/折叠摘要；重启恢复（文件已删则跳过
      并提示）

### 菜单与命令
- [x] File 菜单：Close Tab、Reopen Closed Tab（栈，最近 10 个）
- [x] Open Recent 打开为 tab（现有行为的自然延伸）
- [x] 关闭窗口时若有多个 dirty tab：对话框逐个列出（改 P02 单确认
      模式为列表确认）

## 技术方案要点

- 核心改造 `useFileOps` → `useDocs`（或内部重构保持钩子名）：
  ```ts
  interface DocTab {
    path: string | null          // null = untitled
    state: EditorState           // 完整 CM6 状态
    savedContent: string
    scroll: number
    baseDir: string
  }
  const tabs: Map<id, DocTab>; activeId: string
  ```
  - 切换：`const cur = view.state; save(cur); view.setState(next.state)`；
    `view.setState` 保留 extensions（state 外配置不动）
  - history 跟随 EditorState 存放，undo 不串 tab
- App.tsx 波及面（改造清单，实现前逐一核对）：标题栏、MenuBar 禁用项
  （如无文档时）、Outline（读活动 tab）、FileTree 高亮、导出（活动
  tab）、P03 最近文件、状态栏（P14）。
- `imageEpoch`/theme 等 Facet 是 view 级配置：跨 tab 共享合理（theme
  全局）；`baseDir` 是 **per-tab** 值——`LivePreviewConfig` 需在切换时
  以 Compartment 重注入（`setup.ts` 的 `livePreviewConfigCompartment`
  已支持），图片/链接解析才正确。
- untitled tab 的 id 用自增 id 不用 path；保存后迁移 Map 键。
- 性能边界：每 tab 一个 EditorState 常驻内存；>30 tabs 时对不活动
  state 做降级（丢弃 decoration 缓存——CM6 state 自含，主要开销在
  doc 字符串，长文 10MB 级再评估 LRU 卸载，非 v1）。
- 验证：CDP 场景——开 3 个文件输入不同内容、切 tab 校验光标/内容、
  重启恢复、dirty 关闭确认。

## 验收标准

1. 打开 a/b/c 三个文件各输入一行：tab 三个、各有 dirty 点；逐个切换
   光标与滚动位置保持，undo 只影响当前 tab 的历史。
2. 在 b.md Ctrl+P 打开已开的 a.md：激活已有 tab，不新建。
3. 关闭 dirty 的 b：弹确认；保存后关闭：tab 消失，激活相邻 tab。
4. 重启应用：tabs 与活动 tab 恢复；其中已被外部删除的文件 tab 不恢复
   并有提示。
5. 切 tab 后图片/相对路径行为正确（b.md 目录下的图在 b tab 中解析到
   b 的 assets）。
6. 两个 tab 同时 dirty 时 P12 自动保存均落盘。

## 非目标

- 分屏/多窗格同屏编辑（V2+ 另立）
- Tab 分组、固定 tab、预览型 tab（单击预览双击固定）
- 跨窗口拖出 tab 成独立窗口

## 实施状态（已完成）

实施分支 `feat/P11-P26-scenarios`，commit `feat(P26): …`。e2e：
`scripts/cdp-p26.mjs`（端口 9243）ALL PASS——覆盖开多文档/切换隔离/
per-tab undo 与光标、已开路径复用 tab、untitled-N 命名、右键菜单与
中键关闭、关闭 dirty 确认（取消保留/不保存关闭）、Ctrl+Tab、
Ctrl+W 标签感知、多 dirty 关闭列表确认、双 dirty 自动保存均落盘、
per-tab baseDir、32 tab 无淘汰、会话恢复（含缺失文件跳过+提示）、
会话仅存路径不存内容。

落地方式与偏差（对照功能需求逐项）：

- **实现形态**：未重命名钩子——`useFileOps` 内部重构为 DocTab 模型
  （`Map<id, DocTab>` + `activeIdRef`，active tab 的 state=null，view
  即持有），对外惯用名（loadContent/saveFile/queryClose 等）全部保留，
  P07/P12/P18/P23 既有调用方零波及或仅换接线。`TabsBar.tsx` 新增。
- **打开统一规则**：`openDocPath(path)` 单入口——已打开则激活（可带
  光标跳转），未打开则新建 tab 并激活。树/最近文件/外部打开/P07 重载
  已接入；Quick Open/搜索结果走既有 `openFileByPath` 同一入口。e2e 以
  openPath 直接验证"已开复用、不新建"（验收 2 同义路径）。
- **Cmd/Ctrl+W**：main 进程 `before-input-event` 拦截（先于原生菜单
  accelerator）→ `menu:closeTabOrWindow` → 渲染层决策：tabs>1 关活动
  tab，否则 `window:close`（P12 关闭拦截照常询问）。File 菜单另含
  Close Tab / Reopen Closed Tab / Next Tab 命令项（无 accelerator 条目，
  避免与 before-input 双路由）。e2e 驱动渲染层命令路径 + queryClose
  语义；before-input 路由属主进程输入事件，CDP 无法注入，以代码评审
  覆盖（实施状态如实记录）。
- **会话持久化**：`SessionState.openTabs: string[]` + `activePath`
  （P03 store 扩展）；重启恢复循环 `openDocPath(activate:false)`，缺失
  文件跳过并 toast `tabs.missingRestored`；活动 tab/最后光标恢复。
  会话只存**路径**不存内容（e2e 断言 localStorage 无文档正文）。
  ⚠️ e2e 采用进程内 reload 证明恢复路径（与 cdp-p12 同法）：SIGKILL
  会丢未刷盘的 localStorage（p12 已知并有注释），跨进程持久化依赖
  正常退出时 Chromium 的存储刷盘，属运行时存储行为而非本项缺陷。
  滚动/折叠摘要：滚动随 EditorState/scrollDOM 存取 per-tab 生效；
  headingFolds 会话字典仍按 path 键（天然 per-tab），未另造摘要结构。
- **关闭语义**：按钮/中键/右键菜单（关闭/关闭其他/关闭右侧）齐备；
  dirty 关闭弹三选一对话框（保存/不保存/取消）；关最后一个 tab 回欢迎
  页；Reopen Closed Tab 栈容量 10（path tab 从磁盘重开，untitled 保留
  快照内容）。多 dirty 关闭窗口：`queryClose` 改为列表确认（最多列 8
  个 + `… +n`），单 dirty 保持 P02 原文案以兼容 P12 e2e。
- **文件外部变更（P07）**：`reloadOpenFile` → `reloadTabFromDisk(path)`：
  活动 tab 原地重载；非活动且 clean 的 tab 换存 state；非活动且 dirty
  的 tab 保留用户编辑不自动覆盖（偏差：未弹逐 tab 提示，下次激活时
  内容仍为编辑版——如需强制对齐磁盘可关闭该 tab 重开）。
- **自动保存**：`useAutoSave` 增加 `saveAllDirtyTabs`（active 取
  view.state，非活动取 tab.state 落盘；untitled 走 draftWrite 并标
  clean）。e2e 双 dirty debounce 场景两文件均落盘（验收 6 ✓）。
- **per-tab baseDir**：`DocTab.baseDir` 在打开时解析；切换后
  `reapplyViewState` 以 `updateLivePreviewConfig({baseDir})` 重注入
  live preview 配置（theme/行号/编辑辅助同场重应用）。e2e 以
  getActiveBaseDir 在 dirA/dirB 两 tab 间切换断言（验收 5 的可测核
  心；图片解析复用 P16 既有 baseDir 逻辑，未另写图片用例）。
- **>30 tabs**：按方案 v1 不做 LRU/降级（方案已注明非 v1）；e2e 开
  32 个 tab 全部保留且应用响应正常。
- **CM6 契约**：`view.setState` 要求新 state 由**同一 extensions 数组**
  创建——App 编辑器 effect 持有单个 `createExtensions(...)` 实例，同时
  传入初始 `EditorState.create` 与 `fileOps.initTabs`；每次 setState 后
  重应用视图级 prefs（inactive state 可能携带陈旧 facet 值）。
- **dirty 语义**：与单文档时代一致的"自上次保存以来改过"（undo 不自动
  清 dirty）；tabInfos 在 dirty 过渡时刷新，TabsBar 圆点实时。
- **波及核对**：Titlebar（活动 tab 名）、MenuBar 禁用项（nextTab 在
  <2 tab 禁用、reopenClosedTab 无栈禁用）、Outline/FileTree/导出/最近
  文件/状态栏均读活动 tab（经 filePathRef/dirtyRef 活动化保持一致）。
- **已知非目标（未做，与需求一致）**：分屏、Tab 分组/固定、跨窗口拖出。

门禁：typecheck ✓ · unit 154/154 ✓ · smoke 5/5 ✓ · cdp-p26 ALL PASS ✓
