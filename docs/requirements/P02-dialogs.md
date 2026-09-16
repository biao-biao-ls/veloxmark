# P02 自绘模态对话框

优先级：P02 | 类别：UX/工程 | 预估规模：S

## 背景

`App.tsx` 中大量使用 `window.confirm` / `window.prompt` / `window.alert`
（放弃修改确认、重命名、新建文件、删除确认等）。frameless 暗色应用里弹出
系统原生亮色对话框，观感割裂，且 macOS/Windows 行为不一致、无法定制按钮
文案与主题。

## 目标

用应用内自绘模态组件全面替代三种原生对话框，跟随明暗主题，支持 Promise
式调用。

## 功能需求

- [ ] 通用 `<Dialog>` 组件：标题、正文、任意数量按钮，Enter/Esc 键盘导航，
      焦点锁定在对话框内
- [ ] 三种命令式 API（挂到一个 React context 或全局 store）：
      `confirm(opts): Promise<boolean>`、`alert(opts): Promise<void>`、
      `prompt(opts): Promise<string | null>`（带输入框、默认值、占位符）
- [ ] 明暗主题各一套样式，与 `styles.css` 现有变量体系一致
- [ ] macOS 风格差异：按钮顺序（确认在右）随平台调整
- [ ] 破坏性操作（删除）确认按钮用危险色
- [ ] 替换点清单（全量替换，不留原生调用）：
  - `confirmDiscard`（放弃未保存修改）
  - `treeNewFile` / `treeRename`（prompt）
  - `treeDelete`（confirm）
  - 名称非法时的 `alert`

## 实现要点

- 新组件：`src/renderer/src/components/Dialog.tsx` + 样式段加入
  `styles.css`。
- 命令式 API 用模块级 singleton + React state 挂载在 `App` 根部；调用方
  `await dialog.confirm({...})`，无需改调用点的控制流结构（现有
  `confirmDiscard` 已经是同步布尔返回，需改为 async 并上溯 await——注意
  `newFile` 等同步回调链）。
- 阻止对话框背后的编辑器接收键盘事件（遮罩层 `keydown` stopPropagation）。

## 验收标准

1. 全代码库 `grep -E 'window\.(confirm|prompt|alert)'` 零匹配。
2. 暗色主题下所有对话框为暗色；Ctrl+Shift+T 切换主题即时跟随。
3. Esc 关闭 = 取消语义，Enter = 默认按钮；Tab 不会跑到遮罩外。
4. 删除文件夹确认框按钮为危险色。

## 非目标

- 文件选择/保存对话框仍用 Electron 原生 `dialog`（系统文件管理器体验
  更好，无需自绘）。
