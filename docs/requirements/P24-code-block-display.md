# P24 代码块显示增强

优先级：P24 | 类别：UX | 预估规模：S

## 背景

P06 给代码块补了悬停 Copy 与语言标签，但**显示控制**仍缺失：贴一段
百行日志/配置会把文档撑出长滚动；无行号时技术文档引用行不便；长行
默认不换行产生横向滚动。Typora 对超长代码块有折叠渐变，VS Code 有
行号/换行开关。这些都是渲染态显示问题，不动编辑模型（保持 P06 非目标：
"点击回源码"）。

## 目标

代码块可折叠、可选行号、可换行：阅读长文不再被超长代码块劫持滚动，
三项均受偏好控制。

## 功能需求

### 长代码块折叠
- [ ] 行数超过阈值（偏好 `codeBlockCollapseLines`，默认 20；0 = 从不
      折叠）的代码块默认折叠：显示前 N 行 + 底部渐变遮罩 +
      "展开 N 行" 按钮（N = 隐藏行数）
- [ ] 点击按钮/遮罩展开完整代码；工具条新增 "Fold" 按钮手动折叠
- [ ] 展开状态按**代码内容**记忆（内容不变的块在装饰重建/主题切换后
      保持展开）；重启应用重置为默认折叠（不持久化）
- [ ] Copy 行为不变：复制完整代码（折叠不影响）
- [ ] 折叠块的高度计入 CM6 heightmap（展开/折叠后下方文档点击映射
      正确——widget 高度变化需 `requestMeasure`/装饰重建路径验证）

### 行号与换行
- [ ] 偏好 `codeBlockShowLineNumbers: boolean`（默认关）：代码块内左侧
      显示行号列（与编辑器 gutter 行号独立）
- [ ] 偏好 `codeBlockWrap: boolean`（默认开）：长行软换行；关闭时横向
      滚动（现状行为）
- [ ] 行号在折叠态只对可见行编号，展开后完整编号
- [ ] 偏好改动即时生效于所有已渲染块（新装饰重建带新配置，无需重开
      文档）

## 实现要点

- 展开状态存放：新 StateField `codeBlockUiField`（模式同
  `editor/table/state.ts`），存 `Set<string>`（键 = code 内容 hash）+
  `StateEffect` toggle；**不用模块级可变对象**（P00 约束）。field.ts
  的装饰重建条件增加该 field 变化分支（同 `tableEditChanged` 写法）。
- `CodeBlockWidget.toDOM`（`editor/widgets.ts`）：从 `getPreferences()`
  读三项配置（与主题读取同路径）；折叠时只渲染前 N 行 + expander 元素；
  `eq()` 比较增加折叠态/偏好值，确保状态变化触发重建。
- 行号实现：highlight.js 输出 HTML 按行拆分——**注意跨行 span**（字符串
  直接 split 会截断标签）。方案：span-aware 切分器（扫描 `<span`/
  `</span>` 深度，跨行 span 在行边界处闭合/重开，class 原样复制）；若
  实现风险超预期，该项降级为"首版仅对无高亮语言显示行号"并在验收注明
  （降级开关留偏好项）。
- 换行：`.cm-md-code-block pre` 增加
  `.cm-md-code-block-wrap { white-space: pre-wrap; word-break: break-all }`
  类切换；行号列宽用 CSS `counter` 或 grid 布局（选与 wrap 兼容的方案）。
- 高度变化：折叠/展开走装饰重建（field effect → StateField 更新 →
  buildDecorations 重出 widget），CM6 自动重新测量——验证 click-map
  不错位（P00 已有 heightmap 教训注释，CDP 场景覆盖）。
- 偏好：`preferences/store.ts` 增三字段 + 迁移默认值；
  `Preferences.tsx` 编辑器分组增控件（数字输入 + 两个开关）。
- 与 P25（Mermaid 预览）/P18（标题折叠）互不依赖。

## 验收标准

1. 粘贴 50 行代码：块默认折叠显示 20 行 + "展开 30 行"；点击展开完整；
   Copy 内容仍为 50 行全量。
2. 展开后切换明暗主题：块保持展开；改代码一个字符后折叠态按新内容
   判定（超阈值则重新折叠）。
3. 开启行号：块内每行左侧 1..N 编号，高亮着色正确（或按降级方案：纯
   文本块有行号）；关闭偏好后消失。
4. 关闭 wrap：长单行出现块内横向滚动；开启后软换行且行号不错位。
5. 折叠/展开后点击下方文档行：光标落点正确（heightmap 验证）。
6. `codeBlockCollapseLines=0` 时所有块不折叠。

## 非目标

- 渲染态编辑代码块内容（保持点击回源码，见 P06 非目标）
- 运行代码按钮、语言切换点击（P06 可选项）、diff 高亮
- 折叠状态跨会话持久化
