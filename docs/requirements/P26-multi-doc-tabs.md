# P26 多文档标签页

优先级：P26（**后置：V2 候选，当前不排期**） | 类别：UX/工程 |
预估规模：L

状态说明：对标对象 Typora 本身是单文档窗口模型，本项不是"对标差距"
而是工作区体验的超越项。P13 全局搜索、P17 链接导航落地后，跨文件
工作流会频繁切文档，届时单文档模型的摩擦显著上升——按此依赖关系
后置立项。本文档先固化架构方向，供 V2 评估。

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
- [ ] 编辑器上方标签栏：文件名 + dirty 圆点 + 关闭按钮；溢出时横向
      滚动或折叠
- [ ] 打开文件的统一规则：树双击 / Quick Open / 搜索结果 / P17 链接 /
      拖入文件——已打开则激活该 tab，未打开则新建 tab 并激活
- [ ] New（无路径文档）以 "untitled-N" tab 呈现；保存后 tab 重命名为
      文件名
- [ ] 关闭：按钮 / 中键 / 右键菜单（Close / Close Others / Close
      Right）；关闭 dirty tab 先确认；关最后一个 tab 回欢迎页
- [ ] 拖拽排序 tab
- [ ] 快捷键：`CmdOrCtrl+Tab` 下一 tab；macOS 原生菜单 Cmd+W 语义
      改为"关 tab"（仅在 tabs>1 时，否则保持关窗口——实现时评估平台
      惯例）

### 文档状态模型
- [ ] 每 tab 独立保留：CM6 EditorState（含 selection、history、
      fold/table 等 StateField）、滚动位置、savedContent、outline
      缓存、`baseDir`（图片相对路径解析依赖打开时的文档目录）
- [ ] 切换 tab：当前 `view.state` 存回 tab 条目，目标 state
      `view.setState(...)` 装载——live preview 装饰随 state 重建
- [ ] dirty 判定 per-tab：`tab.savedContent !== doc.toString()`；窗口
      标题与 `setAppState` 反映**活动** tab
- [ ] P12 自动保存覆盖**全部 dirty tab**（非仅活动）；崩溃恢复按 tab
      列表还原
- [ ] 文件外部变更（P07 watcher）：命中已打开 tab 时按现有"重载/提示"
      策略处理，逐 tab 生效
- [ ] 会话持久化（对接 P03 SessionState）：`openTabs: string[]` +
      `activePath` + 每 tab 的滚动/折叠摘要；重启恢复（文件已删则跳过
      并提示）

### 菜单与命令
- [ ] File 菜单：Close Tab、Reopen Closed Tab（栈，最近 10 个）
- [ ] Open Recent 打开为 tab（现有行为的自然延伸）
- [ ] 关闭窗口时若有多个 dirty tab：对话框逐个列出（改 P02 单确认
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
