# 9A 实施方案

## 技术决策与理由

- **chip = `CodeLangChip` 就地演进（位移 + 可点击），非新 widget**：类名 `.cm-md-code-src-chip`、widget 名 `CodeLangChip`、`readonly lang` 字段全保留（build.test 反射 + 未知外部探针兼容面，spec AC9）；挂载点从开栏 replace **移到**闭栏 replace（原 `hide` 位），开栏改 `hide`（对称）。toDOM 返回 `<button>`，文本 = `langDisplayName(lang)`（9.3），去 `text-transform: lowercase`。
- **定位**：`.cm-md-code-src-last` 行 class 加 `position: relative`，chip `position: absolute; right: var(--space-2); bottom: var(--space-1)`——8B dualPane chip 约定的同构技术（行锚 + 绝对 chip），零布局成本（红线 10）。
- **弹层 = DOM 单例 popover（gridPicker 模式），不复用 ListPickDialog 组件本体**：看板原文「复用 ListPickDialog **模式**」取键盘优先交互 + `.list-pick-item` 族皮肤；组件本体是 React 模态、`labelKey` 走 i18n，与「语言名不翻译」契约冲突，且 chip 需要锚定下拉而非模态遮罩。新模块 `editor/codeLangPicker.ts` 自持（纯函数 + 单例 + 改写），gridPicker 同款文件形态。
- **语言列表**：`LANG_COMMON_IDS` 策展常用序（ts/js/python/java/c/cpp/csharp/go/rust/php/ruby/swift/kotlin/sql/html/css/scss/json/yaml/xml/bash/shell/markdown/mermaid/diff/ini…）+ `hljs.listLanguages()` 其余按显示名排序；item = 显示名 + raw id 副行（`.list-pick-hint`）；搜索框打字即时过滤（大小写不敏感，匹配 id 与显示名）。
- **9.3 显示名**：`langDisplayName(id)` = `hljs.getLanguage(id)?.name ?? id`，空串回退 `'text'`（与 `CodeBlockWidget` label 契约一致）；`mermaid` 不在 hljs → 原样（正合「未知 id 原样显示」）。highlight.js 是纯 JS，vitest node 直测无 stub。
- **改写 fence info（`switchFenceLang(view, fenceFrom, lang)`）**：`fenceFrom` 只是 hint——事件时 `syntaxTree(state).resolveInner(hint)` 上溯 `FencedCode`，取 `CodeInfo` 子节点整体替换为新 id；无 `CodeInfo`（空 info）则在开栏 `CodeMark.to` 处插入；hint 失效/非 fence → 零改动返回 false；同语言 → no-op。userEvent `input.code.lang`。改写后 decorations 重建，chip/highlight 即时跟随（高亮 token pass 读的本就是新 lang）。
- **弹层键盘语义纯函数 `langPickKey`**：↑↓ clamp、Enter pick、Esc close（gridPickerKey 同型）；搜索框打字不进 key 语义（input 事件过滤），`e.stopPropagation` 防 CM 键位。
- **事件卫生**：chip 按钮 mousedown/click `preventDefault + stopPropagation`（防落进文档触碰 fence 使 chip 自毁、防 wrapWithGap click-to-source）；`ignoreEvent: true`（红线 3）。
- **mermaid fence 同样挂载**（通用分支，不特判）：⑪ 前置达成；切走 mermaid → 按普通代码渲染、切回恢复图表本就是 info 串驱动的既有重建路径。
- **CSS 皮肤**：chip 保留既有皮肤值（Consolas 11px / fg-dim / padding 2px 12px）+ `cursor: pointer` + hover accent——不发明平行皮肤（红线 6）；弹层容器同 gridPicker 盒子（fixed/z-index 2400/widget-surface/border/阴影），item 复用 `.list-pick-item` 族（其选择器无宿主作用域，可跨用）。
- **i18n**：+3 key（`codeLang.title` 选择语言 / `codeLang.search` 搜索语言… / `codeLang.empty` 无匹配），en+zh 同落；语言显示名不翻译（既有契约，`CodeLangChip` 注释明言）。
- **e2e**：命名缝（`__velox*`/`data-op`/命令 id/`data-table-handle`）零触碰；不新增 `data-op` 值（探针面不扩）；build.test.ts 为仓内单测（随语义更新断言位置，widget 名/lang 反射不变）。

## 文件切法

| 源 | 改动 |
|---|---|
| `editor/codeLangPicker.ts` | **新建**：`langDisplayName`/`LANG_COMMON_IDS`/`buildLangItems`/`filterLangs`/`langPickKey`（纯）+ `switchFenceLang`（事件时重解析改写）+ `openCodeLangPicker`（DOM 单例 popover） |
| `editor/codeLangPicker.test.ts` | **新建**：纯函数单测（显示名/列表序/过滤/键位） |
| `editor/codeBlock-widget.ts` | `CodeLangChip` 就地演进：构造 +`fenceFrom`/`i18nEpoch`，`eq` 扩，`ignoreEvent: true`，toDOM 按钮 + 点击开弹层 |
| `editor/livePreview/handlers-code.ts` | 闭栏 replace 从 `hide` 换 `CodeLangChip`；开栏 replace 从 chip 换 `hide` |
| `editor/livePreview/build.test.ts` | P28 断言随语义更新（chip 位=闭栏 range；开栏=hidden range） |
| `styles/code-chrome.css` | `.cm-md-code-src-last` 加定位；chip 绝对右下 + pointer/hover；去 lowercase |
| `styles/overlays.css` | `.code-lang-picker*` 弹层/搜索框/列表容器（item 复用 `.list-pick-item`） |
| `i18n/zh.ts` + `i18n/en.ts` | 各 +3 key（`codeLang.*`） |

## 状态/契约归属

无新状态（无 StateField/无存储；弹层是 DOM 单例瞬态）。chip 显隐完全由既有 P09 触碰语义驱动。语言改写走文档文本（唯一数据源）——info 串变 → 树变 → 高亮/渲染重建。

## import 改动面

`codeLangPicker` → `highlight.js/lib/common`、`@codemirror/view|state|language`（syntaxTree）、`@lezer/common`（SyntaxNode 类型）、`../../i18n`。`codeBlock-widget` → `./codeLangPicker`。`handlers-code` 不新增 import（`hide`/`CodeLangChip` 均已有）。**环检查点**：codeLangPicker 不 import 任何 widget/handler 模块——`npx madge --circular --extensions ts,tsx` 守护。

## 任务拆分

1. `codeLangPicker.ts` + 纯函数单测 [先行]
2. `CodeLangChip` 演进 + handlers-code 挂载点互换 + build.test 更新 [依赖 1]
3. CSS + i18n [依赖 2]

## 验证方案

- `npm run typecheck && npm run test:unit`（i18n 对齐过；纯函数新增单测全绿）
- `npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles
- e2e 缝：diff 内零既有字面量改动；`.cm-md-code-src-chip`/`CodeLangChip`/`lang` 字段存续核对
- 人工冒烟（对照 `code-focus.png`）：
  1. 聚焦代码块：面板右下角现 chip（可读名）；静息块无 chip；开栏无旧 chip、fence 隐形
  2. 点 chip → 弹层（常用优先 + 搜索框）；打字过滤、↑↓/Enter/Esc 可用；外部点击关闭
  3. 选语言 → info 串改写、高亮即时切换；选同语言无变化；undo 一步回退
  4. 手写未知 id（如 `zzz`）：chip 原样显示、渲染回退纯文本、不崩；空 info 显示 `text`，选择后 info 写入
  5. mermaid fence 同样有 chip；切到 `js` 变代码块、切回 `mermaid` 恢复图表
  6. 光标移到闭栏 fence 行：``` 显形、chip 让位；移开恢复
  7. 进/出聚焦正文零位移；深浅主题对照

## 实现细化（2026-09-24 implement 时决策）

- **语言列表源**：`hljs.listLanguages()` + `LANG_EXTRA_IDS = ['mermaid']`（mermaid 不在 hljs，但切换目标需要它）；`LANG_COMMON_IDS` 用规范 id（bash 而非 shell 等），缺席项由 `buildLangItems` 跳过。
- **chip 文本**：`langDisplayName(lang)`——空串走 `'text'`（与旧 `this.lang || 'text'` 契约等价）；CSS 去 `text-transform: lowercase`（9.3 名称保留大小写）。
- **chip 作 `<button>`**：补 `background: none; border: none` 按钮复位（旧 span 皮肤值全保留）；hover 仅 `color: var(--accent)`。
- **弹层定位**：`left = clamp(anchor.right - 240)`（自 chip 向左下展开）、`top = anchor.bottom + 4`，viewport 硬夹；W=240/列表 max-height 260 与 `.code-lang-picker` CSS 对齐。
- **弹层交互细化**：搜索框 `input` 事件过滤后 `index = 0` 重置高亮；item `mouseenter` 高亮跟随；`paint()` 仅切 `is-active` class + `scrollIntoView({block:'nearest'})`；Enter 在空列表/out-of-range 时 `langPickKey` 返回 null（零动作）。
- **build.test 更新点**：P28 三条断言随语义翻转（chip 位=闭栏 range；开栏=hidden range；开栏触碰→chip 仍在闭栏；闭栏触碰→chip 让位+开栏仍隐）；P29 未知语言/mermaid 断言不变（widget 名/lang 反射兼容面验证了 AC9）。
- **`switchFenceLang` 细节**：`resolveInner(fenceFrom, 1)` 上溯 `FencedCode`；`CodeMark` 取 firstChild 序首个；`current === lang` no-op 返回 false；替换/插入均单 change 单 transaction，userEvent `input.code.lang`。

## 收敛记录（2026-09-24）

- `npm run typecheck` ✓（双 tsconfig）
- `npm run test:unit` ✓（32 files / 322 tests；新增 codeLangPicker.test.ts 11 例；i18n 对齐过）
  - 注：`filterLangs` 首版测试断言 `'TS'` 匹配 `typescript` 系测试前提错误（该串不含子串 `ts`），已改用真实子串断言（实现无误）
- `npx madge --circular --extensions ts,tsx src/renderer/src` ✓ 0 cycles（226 files）
- e2e 缝核对 ✓：diff 零既有字面量改动；`.cm-md-code-src-chip` class 存续（CSS+widget）；`CodeLangChip` widget 名 + `readonly lang` 字段存续（build.test 反射面未破坏）；`__velox*`/`data-op`/命令 id/`data-table-handle` 零触碰
- 待运行时冒烟补签（验证方案 1–7）：① chip 右下角显隐 ② 弹层键盘/搜索 ③ info 改写高亮跟随 ④ 未知 id/空 info 回退 ⑤ mermaid 切走/切回 ⑥ 闭栏触碰让位 ⑦ 零位移/双主题
