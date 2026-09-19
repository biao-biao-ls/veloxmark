# P21 Callout 提示块

优先级：P21 | 类别：功能 | 预估规模：S

## 背景

GitHub / Obsidian 生态通用的 callout 语法（`> [!NOTE]`）在中文技术写作
中使用频率高，当前 VeloxMark 按普通 blockquote 渲染（`handlers.ts` 的
`enterQuoteMark` 只做 `>` 显隐 + `cm-md-quote-dN` 深度着色）。Typora
原生也不支持，属于对标之外的低成本高辨识度补齐。渲染策略沿用行装饰
路线（非整块 Widget），保持"源码即唯一数据源"下的原位编辑手感。

## 目标

`> [!TYPE]` 引用块渲染为带图标/配色/标题的 callout 卡片，输入体验与
普通引用一致，导出结果同构。

## 功能需求

### 语法
- [x] 首行匹配 `>[!TYPE]`（`>` 后可有空格；TYPE 大小写不敏感）：
      支持 GitHub 五型 `NOTE / TIP / IMPORTANT / WARNING / CAUTION`
      + `INFO / SUCCESS / DANGER`（Obsidian 常用扩展）
- [x] 可选自定义标题：`> [!WARNING] 磁盘空间` ——TYPE 后同行文字作为
      标题；无则显示类型默认名（中文：注意/提示/重要/警告/谨慎等，
      i18n 由 P14 统一后接入，首版硬编码中文）
- [x] 可选折叠标记：`> [!NOTE]-` 默认折叠、`> [!NOTE]+` 默认展开
- [x] 未知 TYPE：按 NOTE 样式渲染，标题显示原文
- [x] 块内嵌套列表/代码/链接按普通 markdown 规则 live preview（callout
      只是容器样式）

### 渲染
- [x] callout 块整体着色：左侧色条 + 浅色底（明暗主题各一套，类型
      区分主色）
- [x] 首行：隐藏 `[!TYPE]` 标记，替换为行首图标 + 标题（line decoration
      + CSS `::before`，颜色/图标按类型 class 切换）
- [x] 折叠态：正文行 replace 装饰隐藏，标题行尾显示行数占位；点击标题
      行或图标切换展开
- [x] 光标进入 callout 首行时（P09 touched 规则）`[!TYPE]` 标记显示，
      离开隐藏——与引用/列表标记同一套显隐语义
- [x] 点击 callout 区域行为与普通文本一致（定位光标，无 click-to-source）

### 输入与导出
- [x] 手输 `> [!NOTE]` + 空格 + 回车：下一行自动带 `> ` 前缀（引用续行
      逻辑已覆盖则无需新做，验收确认）
- [x] （低优）Insert 菜单：插入 callout 模板（类型选择，同 P16 模板
      对话框模式）
- [x] P04 导出 / P20 复制富文本：callout 块输出
      `<div class="export-callout export-callout-note">` 等结构 +
      对应样式（`exportCss.ts` 增补），折叠标记导出为展开态
- [x] 大纲：callout 不产生大纲条目（除非内含标题，标题正常参与）

## 实现要点

- 纯函数判定 `editor/livePreview/callout.ts`：
  `parseCalloutMarker(firstLine): { type, title, fold } | null`——单测
  进 P15 清单。
- 树遍历：`build.ts` 分发处增 `if (name === 'Blockquote') return
  enterCallout(node, ctx)`——先 `parseCalloutMarker` 取首行；命中则：
  - 首行 marker 区间 `hide` + 全块行 class
    `cm-md-callout cm-md-callout-<type>`（首行加 `…-head`）
  - `> ` QuoteMark 的显隐继续走 `enterQuoteMark` 既有逻辑
  - 未命中 callout 的 Blockquote 行为完全不变
- 折叠：折叠集合存 StateField（同 P18 fold 模式，可共用
  `editor/livePreview/fold.ts` 的机制或并列一个轻量 field）；正文区间
  多行 replace 装饰由 StateField 提供（CM6 限制）。默认折叠态解析自
  源码标记，用户点击产生的切换以 effect 覆盖（键：块 from 的映射值 +
  marker 文本）。
- P09 协同：marker 显示判定复用 `ctx.markTouched`/`touched`，新增
  mark 类型遵守同一规则（P09 需求文档已约定）。
- 样式：`styles.css` 增 `.cm-md-callout*` 系列，8 类型 × 明暗两主题；
  CSS 图标用 Unicode 字符（ℹ ✓ ⚠ ⛔ 等），不引图标库。
- 导出：`export/renderDoc.ts` 的 blockquote 分支识别 callout marker
  输出 div 结构；inlineStyles（P20）同步补映射。

## 验收标准

1. 输入 `> [!WARNING] 磁盘不足`：渲染为警告色卡片，标题 "磁盘不足" +
   警告图标；`[!WARNING]` 不可见；光标移入首行时标记现身。
2. `> [!NOTE]-` 默认折叠，正文隐藏；点击标题行展开。
3. 未知类型 `> [!FOO] x` 按 NOTE 样式渲染，标题 "x"。
4. 导出 HTML 中 callout 为带样式的 div，微信粘贴（P20）色条可见。
5. 普通 `> 引用`（无 marker）渲染与改造前完全一致。
6. 暗色主题下 8 种类型均可见、可辨。

## 非目标

- 用户自定义 callout 类型注册表、自定义图标上传
- Callout 出现在大纲/导出目录
- 非 GitHub/Obsidian 兼容的私有语法

---

## 实施状态（已完成）

**交付**（commit `feat(P21)`，分支 `feat/P11-P26-scenarios`）：

- 纯函数 `src/renderer/src/editor/livePreview/callout.ts`：
  `parseCalloutMarker(firstLine)` → `{type, title, fold, unknown, rawType,
  markerText, markerStart, markerEnd}`；8 类型大小写不敏感；`title` 仅为
  源码自定义标题（空串=无），展示回退（未知→原文 TYPE / 已知→本地化默认名）
  统一走 `calloutDisplayTitle`。
- 渲染：`build.ts` Blockquote 分发 → `handlers.ts enterCallout`（恒返回
  true，QuoteMark/嵌套列表/代码/链接 live preview 零改动）；全块行 class
  `cm-md-callout cm-md-callout-<type>`（首行 `-head`）；P09 规则复用
  `markTouched`——光标进首行 `[!TYPE]` 现身并加 `cm-md-callout-src`（CSS
  同时抑制 `::before` 图标防双显）；无自定义标题时 marker 区间 replace 为
  `CalloutTitleWidget`（默认名/未知类型原文）。
- 折叠：并列轻量 `calloutFoldField`（`Map<key, folded>`，键 =
  `line.from|TYPE` 的映射值）；默认态解析自源码 `+/-`，点击 effect 覆盖；
  docChanged 时键重映射，块不再是同 TYPE callout 则丢弃；**光标/选区进入
  块内时构建期临时展开**（不写 override，移开恢复默认态——与 P18 会话
  语义不同，刻意保持：`+/-` 源码标记才是持久意图）。**无会话持久化**。
- 点击语义：折叠态点标题行或 `⋯ N 行` 芯片 → 展开；展开态仅点首行图标区
  （左缘 28px）→ 收起，避免与标题文本的光标定位/编辑冲突；其余区域点击
  与普通文本一致（仅定位光标）。
- 样式：`styles.css` 8 类型 × 明暗主题（`.theme-light/.theme-dark` 下
  `--co-bar/--co-bg` + `::before` Unicode 图标 ℹ💡❗⚠⚡📌✅⛔）；明暗色值
  与 export 侧共用一套 token（styles.css / exportCss.ts / inlineStyles.ts
  三处同值）。
- 导出：`renderDoc.ts` Blockquote 分支识别 marker →
  `<div class="export-callout export-callout-<type>">` + head/body 结构，
  首行 marker+标题从 body `<p>` 中剥离进 head（软换行段落安全处理），
  折叠导出为展开；普通 `> 引用` 仍输出 `<blockquote>`。`exportCss.ts` 增
  `.export-callout*`（含 `.export-theme-dark` 变体）；P20 `inlineStyles.ts`
  `classStyles` 同步映射（微信粘贴色条：`border-left-color` + 背景 per type）。
- 输入验收：lang-markdown `insertNewlineContinueMarkup` 已覆盖引用续行
  （e2e 经 `__veloxP21.pressEnter()` 断言 `> [!NOTE]` 后回车产生 `> ` 行），
  未新做逻辑。
- 低优 Insert 菜单模板**已做**（非推迟）：复用 P16 `ListPickDialog`，8 类型
  选择，插入 `> [!TYPE] \n> \n` 且光标落标题位；`commands.ts` 增
  `insertCallout`，darwin 原生菜单 Insert 组同步加行（en/zh 文案）。
- 大纲：callout 标题不进大纲（extractOutline 只提标题节点）；块内 `##`
  标题正常参与——e2e 经 `__veloxP18.getHeadingKeys()` 断言含「块内标题」、
  不含 callout 标题文本。

**测试证据**：

- vitest：`callout.test.ts` 12 例（marker 变体/未知类型/fold 标记/
  markerStart-End/zh 默认名表）；unit 套件 **128/128**。
- smoke：**5/5**。
- e2e `scripts/cdp-p21.mjs`（端口 9238）：**30/30 ALL PASS** —— 覆盖验收
  ①–⑥ 全部场景 + 嵌套粗体/列表 live preview + zh 默认标题 widget +
  引用续行 + 大纲键 + Insert 模板对话框 + 微信复制色条（真实剪贴板 IPC
  回读，`border-left-color:#9a6700`）+ 暗色 computed style
  （`rgb(58,46,18)`/`rgb(28,43,58)`）。

**未做项**：无（低优项已全部交付）。
