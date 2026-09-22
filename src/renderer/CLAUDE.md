# src/renderer/ — 渲染进程子模块

React 19 + CodeMirror 6 的编辑器 UI 全部。入口 `index.html` → `src/main.tsx` → `App.tsx`。

## 目录职责

| 目录/文件 | 职责 |
|---|---|
| `App.tsx` | 外壳与状态装配（⚠ 2642 行已知债务，见下） |
| `components/` | UI 组件，App 一层星型分发（props 不钻透） |
| `commands.ts` | 命令注册表（id/label/shortcut/run），MenuBar + 全局快捷键 + mac 原生菜单三消费方 |
| `hooks/` | `useFileOps`(多标签+文件IO)、`useAutoSave`、`useWorkspaceTree`、`useExport`、`useAppTheme`、`useMenus` |
| `editor/setup.ts` | CM6 扩展组装（Compartment 管主题/行号/辅助开关 live 热切换） |
| `editor/livePreview/` | 装饰引擎：`build.ts` 调度 → `handlers.ts` 各语法 enter*/collect* → fold/callout/linkNav/extendedSyntax/hljsTokens |
| `editor/widgets.ts` | 全部渲染类 WidgetType（代码/公式/mermaid/图片/任务/脚注/front-matter） |
| `editor/table/` | 交互式 GFM 表格（parse/ops/state/widget/lifecycle，单元格内嵌 CM6 编辑会话） |
| `editor/contextMenu/` | 右键菜单：detect(识别)/transforms(变换)/opsBlocks(注册)/registry(装配) |
| `editor/assists/` | 编辑辅助：列表续接、htmlPaste→md、wrap 等 |
| `export/` | 静态渲染 `renderDoc.ts`（HTML/PDF/复制富文本共用）+ exportCss/palette/inlineStyles |
| `outline/extract.ts` | 语法树提取标题大纲（有单测） |
| `preferences/store.ts` | 偏好+会话 store（localStorage，sanitize 校验，pub/sub） |
| `i18n/` | en/zh 扁平字典 + `t()` + `useTranslation()` |
| `styles.css` | 全部样式（3131 行单文件，按注释分区；拆分在 backlog） |
| `statusbar/` `content.ts` | 状态栏统计、欢迎文档 |

## 核心设计（改动必须遵守）

1. **Markdown 文本是唯一数据源**。任何"所见"都是 Decoration/Widget 投影，不引入第二份文档模型。
2. **装饰重建时机**：文档/选区变化 → `buildDecorations`（语法树 iterate 的 enter* handlers + 数学/扩展语法两个正则 pass）。**正则 pass 必须在树 pass 之后执行**（跳过代码内部），顺序契约写在 handlers 文件头。
3. **Widget 纪律**：WidgetType 实现 `eq`（相等不重建 DOM）与 `ignoreEvent`；块级 widget 继承 `BlockWidget` 基类（工具栏/点击跳源/右键菜单标准挂法）。`table/widget.ts` 事件闭包**不得捕获 cell 偏移**，事件时 `resolveTableModel` 重解析（stale-instance 纪律）。
4. **状态接入**：外部 store 用 `useSyncExternalStore`（照 `preferences/useStore.ts`）；模块单例 bus（Dialog、ctxMenu registry、mermaidLightboxBus）是既定模式，编辑器层经 `getCtxRuntime()?.toast` 反向调 UI 也是既定 seam。
5. **文案**：一律 `t('ns.key')`，新 key 必须**同时**加 `i18n/en.ts` 与 `i18n/zh.ts`（key 全对齐有测试守护）；动态 key 用模板拼接时在测试白名单登记前缀。
6. **样式**：token 唯一声明点 `:root`，主题只翻 `.theme-light`/`.theme-dark` token 值；间距/圆角用 `--space-*`/`--radius-*`；**不新增**选择器级 `.theme-dark` 补丁、不新增平行按钮皮肤（用现有 `.dialog-btn` 族）。
7. **跨进程类型**：只 import `electron/shared/api.ts`，不重声明 `window.api` 形状（`env.d.ts` 已挂钩）。

## 测试

- Vitest node 环境，`*.test.ts` 同目录共置；只测纯函数/纯逻辑（outline、table/parse、livePreview/build、format、stats 等已有 16 个测试文件）
- 重浏览器依赖走 `src/test-stubs/`（如 mermaid stub，由 `vitest.config.ts` alias 接管），单测不渲染 widget
- CDP 验收钩子（硬契约，重构不得破坏）：`window.__veloxTable`（`scripts/cdp-p10.mjs`）、`window.__veloxP12`–`__veloxP29`、`window.__veloxCtxDebug`/`__veloxCtxLastHit`、`window.__veloxPrefs`、`window.__veloxTableCellView`

## 已知债务与互斥模式（新代码用哪边）

- **App.tsx 是瓶颈**（2642 行：~284 行 e2e 类型 + ~300 行 seam effect + 业务回调）：新功能逻辑放 `hooks/` 或独立模块，App 只接线
- **主题色 4 处手工同步**：styles.css / `export/exportCss.ts` / `export/palette.ts` / `editor/livePreview/hljsTokens.ts`——改色必须四处同改
- **commands 双源快捷键** + command id 字面量被 cdp 探针扫描，id 不可改
- **大文件只做局部小改**：`editor/widgets.ts`（1445）、`editor/table/widget.ts`（1142）、`hooks/useFileOps.ts`（1018）、`editor/livePreview/handlers.ts`（907）——结构性拆分按 [docs/refactor-tasks.md](../../docs/refactor-tasks.md) 走 SDD 流程
- **循环依赖** `livePreview/build → handlers → table/widget → livePreview/field` 现存，import 时绕开加剧
- `useFileOps` 的 dirty 三轨（dirtyRef/tab.dirty/setDirty state）与 savedContent 双写勿扩散到新代码，新状态单一真源
- `table/widget.ts` 的 `pendingHandoff`（destroy→remount 未提交文本交接）correctness-critical，动它先读文件头设计注释
