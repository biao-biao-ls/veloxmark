# P08 专注/打字机/源码模式

优先级：P08 | 类别：UX | 预估规模：S–M

## 背景

Typora 的 Focus Mode（非当前段落变灰）、Typewriter Mode（当前行固定在
屏幕垂直居中）是长文写作的标志性体验。VeloxMark 目前完全没有；也没有
"整篇纯源码"视图（只有光标处回源码的局部行为）。

## 目标

提供三种写作视图模式，均可通过菜单/快捷键切换，状态可持久化（对接 P03）。

## 功能需求

### 专注模式（Focus Mode）
- [ ] 开启后：非光标所在顶级块（段落/列表/代码块等）透明度降低
      （如 0.45），光标所在块全亮并平滑过渡
- [ ] 块的定义用语法树顶级节点（`syntaxTree` 顶层 child），装饰由
      StateField 提供（块级 class 装饰，注意 CM6 限制）
- [ ] 快捷键 `F8` 或 `Ctrl+Shift+F`，View 菜单切换

### 打字机模式（Typewriter Mode）
- [ ] 开启后：每次光标移动/换行时滚动使光标行保持在视口垂直居中；
      实现方式为监听 selection 变化后 `scrollIntoView` 带居中偏移，或
      计算滚动补偿
- [ ] 与 Focus Mode 独立开关，可同时开

### 源码模式（Source Mode）
- [ ] 整篇文档显示原始 Markdown（live preview 装饰完全停用），行号保留
- [ ] 与实时预览互斥切换，快捷键 `Ctrl+/`，View 菜单 "Source Mode"
- [ ] 切换时光标位置/滚动位置尽量保持（按行映射）
- [ ] 源码模式下语法高亮仍可用（`@lezer/markdown` 的 highlight style）

## 实现要点

- 文件：`livePreview.ts` 增加 `livePreviewConfig.mode: 'live' | 'source'`
  （source 模式 `buildDecorations` 直接返回空集 + `forceRefresh` 重建）；
  Focus 装饰加进同一 StateField（需在 buildDecorations 里追加当前块高亮
  class）。
- 打字机模式：`EditorView.updateListener` 内检测 `selectionSet &&
  scrollStarted` 后手动 `view.scrollDOM.scrollTop = ...`；注意与用户
  主动滚动的冲突（用户滚动时暂停居中直到下次编辑——Typora 的行为）。
- 开关状态进 P03 的 preferences；无 P03 时先用 localStorage 临时键。
- 菜单入口：View 菜单加三个 toggle（`App.tsx` menus 定义处），macOS 原生
  菜单（`electron/main.ts` buildDarwinMenu）同步加。

## 验收标准

1. Focus Mode 下滚动浏览长文，非当前段落明显变灰，切换段落平滑过渡。
2. Typewriter Mode 下连按回车，当前行始终在视口中部。
3. `Ctrl+/` 切到源码模式显示完整标记（`**`、`#` 等可见），切回后光标仍
   在同一文本位置。
4. 三种状态重启后保持（对接 P03 完成后）。

## 非目标

- 句子级 Focus（当前仅块级）、Zen 全屏（现有全屏已够）。
