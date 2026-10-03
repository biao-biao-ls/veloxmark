# IT-02 FE-10 自测报告 — 侧栏视觉 token 化审计（深浅主题走查）

- 任务：`process-docs/ui-ux-redesign/tasks/IT-02/FE-10.md`
- 验收：AC-FN-12（深浅两遍对照走查全过）、UI-ELEM-01（样式类元素全 token 化）
- 工作目录：`projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`
- 浏览器验证：全新 Electron 实例（CDP 端口 9555、独立 user-data-dir `frontend/fe10-userdata`，验证后废弃）；`Page.bringToFront` + `Page.setWebLifecycleState({state:'active'})` + `Emulation.setFocusEmulationEnabled({enabled:true})`；`Runtime.evaluate` 全程 15s 超时；草稿恢复对话框未出现（全新 user-data-dir），出现也一律点「稍后」
- 质量门禁：`npm run typecheck` 0 error；`npm run test:unit` **701/701 通过**（含新增 `styles/sidebarTokens.test.ts` 4 例）；`npm run build` 成功

---

## 1. 阶段 1 — 扫描断言（UI-ELEM-01）

TDD 先红后绿：`src/renderer/src/styles/sidebarTokens.test.ts` 先写扫描测试（3 失败/1 通过）→ 实施 token 化 → 4/4 绿。扫描范围 = 侧栏分区（`chrome.css` 侧栏/大纲规则 + `filetree.css` 全文件 + `markdown.css` `.outline-fold` + `FileTree.tsx` 行内样式），判定 = 分区内裸 px/裸色值计数 0（自定义属性声明行与非侧栏规则不计入）。

| file | rawValues | tokensUsed（抽样） |
|------|-----------|-------------------|
| `styles/tokens.css` | 0（唯一声明点） | 新增侧栏 metrics 族：`--sidebar-width` `--tree-row-h` `--tree-indent` `--tree-accent-bar` `--sidebar-back-bleed` `--dot-size` `--ops-menu-min-w` `--ops-menu-max-h` `--tree-menu-min-w` `--tree-menu-item-pad-y/x` `--hit-box-sm/md/lg/xl` `--space-half` `--space-hairline` `--text-glyph/micro/caption/meta/icon` |
| `styles/chrome.css`（侧栏/大纲节） | 0 | `--sidebar-width` `--border-width` `--space-1/2/3/4` `--space-half` `--sidebar-back-bleed` `--text-caption/icon/ui` `--hit-box-md` `--radius-sm` `--tree-accent-bar` `--accent` `--code-bg` `--bg-inset` `--focus-ring-width/offset` |
| `styles/filetree.css` | 0 | `--tree-row-h` `--tree-indent` `--space-half/hairline/1/2/3/7` `--text-ui/meta/caption/micro/icon` `--hit-box-sm/md/lg/xl` `--dot-size` `--ops-menu-min-w/max-h` `--tree-menu-min-w` `--tree-menu-item-pad-y/x` `--radius-sm/md` `--border-width` `--accent` `--code-bg` `--bg-inset` `--focus-ring-width/offset` `--shadow-pop` |
| `styles/markdown.css`（`.outline-fold`） | 0 | `--hit-box-lg` `--hit-box-sm` `--space-half` `--text-glyph` |
| `components/FileTree.tsx` | 0（无 px 字面量 padding） | 行缩进经行内自定义属性 `--tree-depth`（无单位）传递，CSS 侧 `calc(var(--space-3) + var(--tree-indent) * var(--tree-depth, 0))` |

- **零裸值**：上述分区扫描断言在 `sidebarTokens.test.ts` 常驻（裸 px / 裸色值两例扫描 + tokens.css 唯一声明点例）。
- **零新增 `.theme-dark` 补丁**：`styles/tokens.test.ts`（FE-11 守护）主题选择器白名单断言通过，本任务未新增任何 `.theme-*` 选择器；深浅差异全部走 `themes.css` 既有 token 翻值。
- 既有 token 复用优先：间距/圆角/字阶在既有 `--space-*`/`--radius-*`/`--text-ui|body` 可表达处一律复用；仅度量不在既有词表时新增具名 token（沿用 `--img-resize-*`/`--grid-cell-*`/`--link-pop-*` 先例），并全部落在 `:root`。

## 2. 阶段 2 — 深浅主题对照走查（AC-FN-12，两遍）

测量数据：`IT-02-FE-10-cdp-data.json`（主扫描）+ `-final.json`（补测）+ `-followup.json`；驱动脚本 `IT-02-FE-10-cdp-driver*.mjs`。夹具 `frontend/fe10-fixture/`（intro.md 含 h1–h4、docs/deep/nested.md 三级树）。

### 2.1 浅色主题走查清单

| # | 清单项 | 结果 | 证据（计算值） |
|---|--------|------|----------------|
| 1 | 侧栏容器宽/边框/背景 token | ✅ | width `240px`（`--sidebar-width`）、border-right `1px`（`--border-width`）、bg `#fafafa`（`--bg-sidebar`） |
| 2 | tab 三态 token 化且可区分 | ✅ | 默认 `#6b6b6b`（`--fg-dim`）/ hover `#333`（`--fg`）/ 激活 `#0969da`+600+`--tree-accent-bar` 下划线；对比度 4.97 |
| 3 | 树行 hover 填充取 token | ✅ | 真实鼠标移入 → `rgba(175,184,193,0.2)` = `--code-bg`（与静息 `transparent` 区分） |
| 4 | 树行激活态 token 化 | ✅ | `.filetree-active`：color `#0969da`（`--accent`）+ 600 + `--accent-soft` 12% 底（`filetree-selected`） |
| 5 | 树行键盘焦点环 token 化 | ✅ | 真实 ArrowDown 导航 → `outline: 2px solid #0969da`、`outline-offset: -2px`（`--focus-ring-width/offset`）+ `--bg-inset` `#f2f2f2` 填充 + `data-nav-focus`（FE-06 缝） |
| 6 | 三态可区分 | ✅ | hover=仅填充、active=accent 文字+粗体+软底、focus=环+inset 底（环是焦点唯一线索） |
| 7 | 大纲缩进 token 化 | ✅ | l1–l4 `padding-left` = 12/24/36/48px = `--space-3` × level |
| 8 | 大纲 active-follow 高亮 token 化 | ✅ | `.outline-active`：accent 文字 + `inset 2px 0 0 var(--accent)`（`--tree-accent-bar`），无边框位移 |
| 9 | 大纲三态（hover/active/kbd-focus） | ✅ | hover `--code-bg` / active 见上 / kbd-focus 同树行环（2px/-2px/`--bg-inset`，`outline-kbd-focus`，FE-08 缝），真实 ArrowDown 验证 |
| 10 | 折叠三角图标把手 token 化 | ✅ | `.outline-fold` 22×22px（`--hit-box-lg`）、glyph 9px（`--text-glyph`）、左拉 `calc(var(--hit-box-sm)*-1)`（共 5 枚在大纲面板渲染） |
| 11 | 正文/辅助文字对比度 ≥4.5:1 | ✅ | 树行 12.1 / 目录名 5.11 / tab 4.97 / 活动文件 4.97 / 大纲行 12.1 / 大纲 active 4.97 / 焦点行 11.29 / hover 合成底 10.77 |
| 12 | 深浅差异仅 token 翻值 | ✅ | `.app.theme-light` 类 + token 计算值与 dark 仅色值不同，几何 token 两主题一致 |

### 2.2 深色主题走查清单

| # | 清单项 | 结果 | 证据（计算值） |
|---|--------|------|----------------|
| 1 | 侧栏容器 token | ✅ | width `240px`、border `1px`、bg `#252526`（`--bg-sidebar` dark 翻值） |
| 2 | tab 三态 | ✅ | 默认 `#9a9a9a` / 激活 `#58a6ff`+600；对比度 6.06 |
| 3 | 树行 hover | ✅ | `rgba(110,118,129,0.25)` = `--code-bg` dark |
| 4 | 树行激活态 | ✅ | `#58a6ff`（`--accent` dark）+ 600 + accent-soft 底 |
| 5 | 树行键盘焦点环 | ✅ | `outline: 2px solid #58a6ff`、offset `-2px`、底 `#2a2a2b`（`--bg-inset` dark），真实 ArrowDown |
| 6 | 三态可区分 | ✅ | 同浅色三条线索结构（填充/文字/环） |
| 7 | 大纲缩进 | ✅ | 12/24/36/48px（与浅色同一套 `--space-3` 步进，几何 token 主题无关） |
| 8 | 大纲 active-follow | ✅ | `#58a6ff` + `inset 2px` accent 条 |
| 9 | 大纲三态 | ✅ | 同浅色（kbd 环 `#58a6ff`/2px/-2px/`--bg-inset`），真实 ArrowDown |
| 10 | 折叠三角 | ✅ | 22×22px / 9px（几何 token 主题无关，图标色走 `--fg`） |
| 11 | 对比度 ≥4.5:1 | ✅ | 树行 10.33 / 目录名 5.44 / tab 6.06 / 活动文件 6.06 / 大纲行 10.33 / 大纲 active 6.06 / 焦点行 9.67 / hover 合成底 7.81 |
| 12 | 仅 token 翻值 | ✅ | 同浅色 |

对比度口径：文本色 vs 有效底色（半透明 hover 填充先与父底 alpha 合成再算，WCAG 相对亮度公式）。全部文本对 ≥ 4.5:1；焦点环对底色为非文本线索（2px 实心环，远超 3:1 非文本对比）。

### 2.3 行几何溯源（主题无关 token，两主题各测一遍）

| 度量 | token 表达式 | 实测（浅/深） |
|------|--------------|----------------|
| 行高 | `--tree-row-h` | 25px / 25px（`.filetree-item-fixed` 规则强制类名探测；小夹具不触发虚拟化） |
| 深度 0 行左缩进 | `--space-3` | 12px / 12px |
| 深度 1 行左缩进 | `calc(--space-3 + --tree-indent×1)` | 26px / 26px |
| 深度 2 行左缩进 | `calc(--space-3 + --tree-indent×2)` | 40px / 40px |
| `--tree-indent` | token | 14px / 14px |
| 命中盒（`.sidebar-action`/`.filetree-bar-btn`） | `--hit-box-md`/`--hit-box-xl` | 20px / 24px（两主题一致） |

## 3. 阶段 3 — 焦点环与主题切换（FE-06/FE-08 键盘面）

| 项 | 浅色 | 深色 | 结果 |
|----|------|------|------|
| 文件树键盘焦点环（FE-06 缝：`data-nav-focus` + `.filetree-kbd-focus`） | 2px `#0969da` / offset -2px / 底 `#f2f2f2` | 2px `#58a6ff` / offset -2px / 底 `#2a2a2b` | ✅ 两主题 |
| 大纲键盘焦点环（FE-08 缝：`outline-kbd-focus`） | 2px `#0969da` / -2px / `#f2f2f2` | 2px `#58a6ff` / -2px / `#2a2a2b` | ✅ 两主题 |
| 均为**真实键盘导航**（Input.dispatchKeyEvent ArrowDown，roving tabindex 行 .focus() 后导航） | ✅ | ✅ | 环出现于导航目标行，鼠标点击不落环（pointerdown 清 `kbdNav`，符合 FE-06 设计） |
| Titlebar 主题键即时翻转 | — | — | ✅ 点击前后**零 sleep** 同轮读数：`.app` 由 `theme-light`/`--bg #ffffff` 立即变为 `theme-dark`/`--bg #1e1e1e`（token 翻值，非选择器补丁） |

## 4. 设计稿差异说明（token 溯源，非基线变更 → 不记 change-log）

审计口径是「渲染值的 token 溯源」，不重排版面；以下取值沿用改造前渲染契约，与 `ui_05_sidebar.html` mock 的差异如下：

1. **`--tree-row-h: 25px`（mock 28px）**：25px 是 `FileTree.tsx` `ROW_HEIGHT` 虚拟化契约（行高等差滚动数学），先于 UI 改版；token 注释与 TS 常量双向注明 lockstep。改 28 需联动窗口化数学，属布局变更任务，不在审计范围。
2. **`--tree-indent: 14px`（mock 16px）/ 行基础 pad `--space-3` 12px**：保持改造前缩进数学（12+14n），mock 的 16px 步长会整体加宽层级差。大纲缩进走 `--space-3`×level（12px/级，FE-08/5D 既定），亦非 mock 16px。
3. **圆角 4px→`--radius-sm`(3px)、6px→`--radius-md`(8px)**：按 tokens.css 迁移规则（3→sm、8→md 最小集收敛）向 token 词表靠拢，视觉差异 ≤1–2px。
4. **hover 填充保留 `--code-bg`（mock 用 `--bg-inset`）**：`--code-bg` 是全仓 chrome hover 惯用色（标题栏/菜单/工具条同源）；`--bg-inset` 留给键盘焦点填充，保证 hover（填充）/ active（accent 文字）/ focus（环）三线索互不混淆——与任务「三态可区分」判定一致。

## 5. 产物清单（`reports/IT-02-FE-10/`）

| 文件 | 说明 |
|------|------|
| `IT-02-FE-10-self-test.md` | 本报告 |
| `IT-02-FE-10-impl-light.png` | 浅色主题实现图（全窗，文件树+活动行+底栏） |
| `IT-02-FE-10-impl-dark.png` | 深色主题实现图（全窗；含键盘焦点环在 `root.md` 行、活动行 `intro.md` accent 态，三态同框实证） |
| `IT-02-FE-10-impl-light-outline.png` / `IT-02-FE-10-impl-dark-outline.png` | 大纲面板补充图（缩进+折叠三角） |
| `IT-02-FE-10-cdp-data.json` | 主走查测量数据（token/几何/三态/对比度/主题翻转） |
| `IT-02-FE-10-cdp-data-final.json` / `-followup.json` | 补测数据（活动行/深度 2/合成对比度） |
| `IT-02-FE-10-cdp-driver.mjs` / `-followup.mjs` / `-final.mjs` | CDP 驱动脚本（可复跑） |

## 6. 浏览器验证 harness 备注（供后续 FE 复用）

1. 加载文件夹无需原生对话框：e2e 缝 `window.__veloxP13.openFolder(path)` 直调 `workspace.loadFolder`；打开文档 `window.__veloxP26.openPath(path)`。
2. **路径分隔符**：树 `node.path` 为 Windows 反斜杠，与正斜杠路径**全串等值比较**时不匹配（`activePath === node.path`）——真实用户点树行打开时两端同为 `node.path` 不受影响；harness 侧用 `title.endsWith('intro.md')` 点树行复现激活态。
3. 目录展开是 toggle：夹具树小不虚拟化，`.filetree-item-fixed` 规则用临时加类探测行高；重复点击目录会收起，脚本需 hasChild 守卫。
4. 主题切换按钮为标题栏最后一个 `.tb-btn`（`title=t('tb.theme')`）；`__veloxP26.setPrefs({theme})` 可做确定性起点。
