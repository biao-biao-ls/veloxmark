# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目总览

VeloxMark：类 Typora 的 Markdown 桌面阅读/编辑器。**Markdown 源码是唯一数据源**（存盘即纯 `.md`，零往返失真）；实时预览靠 CodeMirror 6 的 Decoration 引擎——语法标记用 replace 隐藏、代码/公式/图替换为 Widget、光标进入范围时跳过装饰回到源码态。

- 仓库形态：单包（无 workspaces），双进程（Electron main + renderer）
- 语言/构建：TypeScript 5.7（`strict`，双 tsconfig：`tsconfig.web.json`/`tsconfig.node.json`）、electron-vite 3 + Vite 6、React 19
- 测试：Vitest 5（node 环境，只测纯函数）+ `scripts/cdp-*.mjs` CDP 冒烟/验收脚本
- 质量门禁：`npm run typecheck`（两个 tsconfig 全过）+ `npm run test:unit`，改动后必跑

## 技术栈与最新实践规范（新代码必须遵循）

| 栈 | 版本 | 关键规范 |
|---|---|---|
| Electron | ^34 | 保持 `contextIsolation`/`sandbox` 默认开启、`nodeIntegration` 关闭；渲染进程只经 `contextBridge` 拿最小 API，**绝不暴露裸 `ipcRenderer`**；订阅回调要包一层丢弃 `IpcRendererEvent`；外部链接只走 `shell.openExternal` 且不传用户可控串；导航/新窗口用 `will-navigate` + `setWindowOpenHandler` 拦截 |
| React | ^19 | 组件间状态订阅统一 `useSyncExternalStore`（见 `preferences/useStore.ts`）；新组件接受 `ref` 为普通 prop，**不用 `forwardRef`**（已废弃路径）；不用 `<Context.Provider>` 旧写法 |
| CodeMirror 6 | ^6 | Decoration 直供（改变行布局的 block widget/replace）必须用 `EditorView.decorations` 直给并正确 `map(tr.changes)`；WidgetType 必须实现 `eq`（避免 DOM 重建）与 `ignoreEvent`；装饰计算限 viewport；replace 超过 1 字符时同步 `atomicRanges` |
| TypeScript | ^5.7 | 全仓 `strict`；跨进程类型只在 `electron/shared/api.ts` 定义（单一真源），任何一侧不得重声明 |
| CSS | 原生 | `:root` 是 token 唯一声明点，主题差异只翻 `.theme-light`/`.theme-dark` 的 token 值；间距/圆角用 `--space-*`/`--radius-*`，不写裸 px 新值；不新增选择器级 `.theme-dark` 补丁 |
| 测试 | Vitest | 纯函数/纯逻辑模块配 `*.test.ts` 同目录单测；重浏览器依赖（mermaid 等）走 `test-stubs/`，禁止在单测里渲染 widget |

外部资料获取：GitHub/raw 直连被墙时，本机 Clash 代理 `http://127.0.0.1:7890` 可用（`curl -x http://127.0.0.1:7890 …`）；WebFetch/WebSearch 工具不吃本地代理。

## 子模块

| 模块 | 路径 | 职责 | 技术栈 | 文档 |
|---|---|---|---|---|
| 主进程 | `electron/` | 窗口/原生菜单/文件对话框/IPC/`mdres://` 协议 | Electron, Node | [electron/CLAUDE.md](electron/CLAUDE.md) |
| 渲染进程 | `src/renderer/` | 编辑器 UI 全部（React + CM6） | React 19, CM6 | [src/renderer/CLAUDE.md](src/renderer/CLAUDE.md) |

## 架构全景

```
App.tsx (React 外壳/状态装配)
  ├─ components/*        UI 组件（星型一层分发，props 最多 ~11 个）
  ├─ hooks/*             useFileOps(多标签+文件IO) / useAutoSave / useWorkspaceTree / useExport
  ├─ editor/setup.ts     CM6 扩展组装（Compartment 管主题/行号/辅助开关）
  │    └─ editor/livePreview/build.ts  装饰收集调度 → handlers.ts 各语法 enter*/collect*
  │         └─ editor/widgets.ts / editor/table/widget.ts   WidgetType 实现
  ├─ commands.ts         命令注册表（MenuBar/全局快捷键/mac 原生菜单三消费方）
  ├─ export/*            静态渲染 renderDoc.ts（HTML/PDF/复制富文本共用）
  └─ preferences/store.ts + i18n/    偏好与文案（localStorage 持久化）
        │  window.api (类型自 electron/shared/api.ts)
        ▼
electron/preload.ts  contextBridge 显式实现 RendererApi
        ▼
electron/ipc/*       registerAllIpc(getWindow) 按域注册 → electron/main.ts 窗口/菜单生命周期
```

关键数据流：编辑器 doc 变更 → `App` 持有文本 → `useFileOps` 管 tab/dirty → `useAutoSave`/`saveFile` 写盘；装饰引擎在每次文档/选区变化重建 Decoration（语法树迭代 + 数学/扩展语法正则 pass，**正则 pass 必须在树 pass 之后**）。

## 开发速查

```bash
npm install        # Electron 二进制下载失败时: ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/
npm run dev        # 开发热更新
npm run typecheck  # 双 tsconfig 检查（必过）
npm run test:unit  # Vitest 纯函数单测
npm run test       # typecheck + unit + cdp 冒烟
npm run build      # 构建到 out/
```

## 代码健康度（AI 改码前必读）

**保持的好模式**：`electron/shared/api.ts` 类型单一真源 + preload 显式实现（缺方法编译期报错）；`editor/livePreview/` 小文件群职责单一且带单测；`preferences/useStore.ts` 的 `useSyncExternalStore` 外部 store 接入；Dialog/ctxMenu/mermaidLightbox 三个模块单例 bus 模式一致；纯逻辑模块（outline/extract、table/parse、statusbar/stats）全部有测试。

**已知债务与坑（不要加重）**：
- `App.tsx` 2642 行是全仓最大文件（含 ~284 行 e2e 类型 + ~300 行 seam useEffect），新逻辑别再往里堆——放 hooks/ 或独立模块
- 主题色 4 处手工同步副本：`styles.css` token / `export/exportCss.ts` / `export/palette.ts` / `editor/livePreview/hljsTokens.ts`，改色必查全
- i18n 字典 4 份：`i18n/en.ts+zh.ts`（须 key 全对齐）/ `main.ts` `NATIVE_MENU_STRINGS` / `callout.ts` `DEFAULT_CALLOUT_TITLES`
- 快捷键双源：`commands.ts` 的 `shortcut` 与 `electron/main.ts` `DARWIN_COMMAND_ACCELERATORS` 手工同步
- IPC channel 裸字面量双写（preload + ipc/*），改名不会编译报错
- `editor/widgets.ts`（1445 行）/ `editor/table/widget.ts`（1142 行，`pendingHandoff` 跨方法状态 correctness-critical）/ `hooks/useFileOps.ts`（1018 行，dirty 三轨）——只做局部小改，结构性拆分走 SDD 流程
- 存在 1 处循环依赖 `livePreview/build → handlers → table/widget → livePreview/field`，拆分时勿引爆
- e2e 缝是硬契约：`window.__velox*` 系列、`data-op` id、命令 id 字面量（cdp 探针正则扫描），任何重构不得破坏

**互斥模式现状（新代码用哪边）**：样式用 CSS 文件分区 + token（不用 CSS-in-JS）；状态接入用 `useSyncExternalStore` + 模块级 store（新状态照 `preferences/store.ts` 抄）；i18n 文案一律 `t('ns.key')`，新 key 必须同时加 en.ts + zh.ts。

## SDD 驱动的任务落地（本仓库工作方式）

重构等多阶段工作按 **Spec-Driven Development** 推进（对齐 GitHub Spec Kit 的 specify → plan → tasks → implement → converge 循环）：

- **Constitution（项目宪法）**：本文件即宪法——技术栈规范、好模式、禁忌清单。所有 spec/plan 不得与之冲突；冲突时先改这里。
- **Backlog**：[docs/refactor-tasks.md](docs/refactor-tasks.md) 是当前规格化任务清单（4 阶段 38 项）。
- **每项任务/每组任务的推进协议**：spec（what/why）→ plan（how）→ implement → converge（验证收敛），细则与模板见 [docs/sdd-workflow.md](docs/sdd-workflow.md)。
- **Converge 验收恒定为**：`npm run typecheck && npm run test:unit` 通过 + e2e 缝未破坏 + 勾销清单对应 checkbox；行为不变类任务需人工冒烟确认 UI 无回归。
