# UI 复刻评审报告

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修项。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-02-FE-08 |
| 任务文件 | `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-02/FE-08.md` |
| 评审时间 | 2026-09-30 22:50 |
| 评审者 | frontend-replica-review subagent |
| 实现图 | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-02-FE-08/IT-02-FE-08-impl.png` |
| 设计图 | 无 PNG（设计稿为 html，按 skill 取稿表 Read 源直读；禁浏览器故未渲染截图，见「取稿与读图备注」） |
| 设计稿源 | `D:/code/typora/docs/requirements/ui-ux-redesign/ui/ui_05_sidebar.html` |
| 页面路径 | 左侧导航栏大纲面板键盘通道（ui_05_sidebar.html 大纲区） |

## 严重度分布（仅供参考，非通过门槛）

| 严重度 | 数量 | 含义 |
|---|---|---|
| Critical | 0 | 结构缺失 / 主功能元素缺失 / 关键样式严重偏离 / 文案错字 |
| Important | 4 | 次要元素缺失 / 样式明显偏离 / 间距对齐偏差 |
| Minor | 4 | 微小视觉差异 / 装饰元素细节偏差 |
| **合计** | **8** | — |

> 主 agent 逐条判断未对齐点的必修性，严重度仅作参考。

---

## 未对齐点清单（按区域分组）

### 大纲面板 · 键盘焦点环（FE-08 核心元素）

无未对齐点（对齐证据见下方「无偏差确认项」第 1 条）。

### 大纲面板 · active 高亮（联动 FE-07）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 1 | Important | active 项高亮·标题色 | `.outline-row.active-follow .title { font-weight:700; color: var(--fg) }`（亮 `--fg`=#333333）；主色只用于左条与底色 | active 项「下周计划」标题呈 accent 蓝 #0969da（像素实测：标题暗像素 242/260 为 accent 系） | 标题用主色替代 `--fg`，与设计稿「accent-soft 底 + 左条 + 粗体 `--fg`」三要素高亮语义不一致（同 FE-07 #1，仍未修复） | active-follow 标题 `color` 改回 `var(--fg)` 保持 700 粗体；accent 仅出现在 `::before` 左条与 `--accent-soft` 底色 |
| 2 | Minor | active 项高亮·整行底色 | `background: var(--accent-soft)`（亮 `rgba(9,105,218,0.12)`，在 `#fafafa` 上约呈 `#DDEBFA`） | active 行底色实测 `#fafafa`（250,250,250），与相邻行一致，无浅蓝底 | `--accent-soft` 底色缺失（FE-07 #2 曾标疑似，本图像素已证实缺失） | 为 `.active-follow` 行补 `--accent-soft` 整行底色，与左侧条共同构成高亮 |
| 3 | Minor | active 项高亮·左侧条几何 | `::before { width:3px; top:3px; bottom:3px; border-radius:0 2px 2px 0 }`（条高 = 行高-6px） | 左条宽 2px（x0–1），纵向满行无内缩（y190–215 共 26px 全高） | 条宽窄 1px；缺 3px 上/下内缩，观感偏“贴边通栏” | 左条改 `width:3px` 并 `top/bottom:3px` 内缩 |

### 大纲面板 · 节点行（结构与折叠三角）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 4 | Important | 节点折叠三角（UI-IXD-06） | 有子节行 18px 盒内 10px 实心三角：展开 ▾ / 折叠 ▸，指向随折叠态切换；叶子行「·」 | 所有行（含父级「项目周报」「本周进展」与叶子「技术风险」）统一为 ~3–4px 点状「·」字形，父/叶字形几乎相同、无指向差异 | 折叠三角缺失方向指示，键盘/点击折叠无视觉反馈（FE-08 元素表明确「指向随折叠/展开切换」；FE-07 #4 同源问题） | 父级行按展开态渲染 ▾/▸，叶子保留「·」；字形按设计 10px 置于 18px 点击盒内 |
| 5 | Important | 折叠态·子树可见性 | 折叠节点隐藏子行（设计稿「本周进展」▸ 折叠态下不列子节，仅 meta「（含 3 子节 · 折叠已记忆）」） | 正文「本周进展」已折叠（折叠占位「… 11 行」），大纲仍平铺列出其子节「技术风险/进度风险」，无折叠 meta | 大纲折叠未隐藏子树，与设计稿折叠呈现不一致；折叠态在列表中几乎无感。**注**：实现自述「大纲列表保持平铺全量，子树隐藏不在本任务范围」，是否移交/豁免请主 agent 裁定 | 若在范围内：折叠时收起子行并显示折叠 meta；若确认范围外：登记遗留移交后续任务，不在本任务修 |
| 6 | Minor | 层级徽标 `.lv` | 行首 22px 宽徽标「H1/H2/H3」（10px/700、`--fg-disabled` #b0b0b0），排在 twisty 前 | 行首无 Hn 徽标，标题紧跟折叠点 | 层级徽标缺失（同 FE-07 #3，仍未修复） | 行首按设计渲染 lv 徽标；若归属大纲面板基线 UI 可由主 agent 豁免移交 |
| 7 | Important | 层级缩进级差 | `--tree-indent: 16px`/级（dim-chip「树缩进 16px」；设计稿行内 `padding-left: var(--tree-indent)*N`） | ≈12px/级（twisty 中心 x4→16→28，标题左缘 x18→31→42，步距 11–13px） | 每级窄约 4px（-25%），三级累计错位约 8px；任务文案写「--space-* token」，若取 `--space-3`=12px 则与设计 16px 不符 | 缩进步距改 16px（`--tree-indent` 或 `--space-4`），与文件树同值 |
| 8 | Minor | 节点行行高 | `--tree-row-h: 28px`（dim-chip「行高 28px」） | ≈26px（焦点环盒 y111–136=26px；行文本带距 26–27px/档） | 每行矮约 2px（-7%） | 行高改回 `var(--tree-row-h)` = 28px |

---

## 无偏差确认项（要点，供主 agent 参考）

1. **键盘焦点环（FE-08 核心，UI-ELEM-01）完全对齐**：环色 = `--accent` 精确匹配（亮 `#0969da`，像素实测 9,105,218）；环宽 2px（上下左右四边均 2px）；环外缘与行盒齐平（等价设计 `outline-offset:-2px` 语义，与 FE-06 口径一致）；环内行底 = `--bg-inset` 精确匹配（`#f2f2f2`）。与设计 `.tree-row.kbd-focus` 及 dim-chip「焦点环 2px accent」一致。
2. **三态可区分（UI-ELEM-01）**：焦点态（2px accent 环 + `--bg-inset` 底）与 active 态（左缘 accent 条）视觉可区分；hover 态（`--bg-inset` 行底）静态图无法核验。焦点与 active 未同行叠置，无混淆。
3. **结构与嵌套（①结构）**：大纲行顺序 项目周报(H1) → 本周进展(H2) → 技术风险/进度风险(H3) → 下周计划(H2)，层级缩进逐级递进，与设计稿样例结构同构；侧栏宽 240px（面板右缘 x239，dim-chip「左导航宽 240px」一致）；UI 字号 13px 视觉相符。
4. **焦点环演示状态正确**：焦点框落在「本周进展」行，正文未被焦点移动带走（正文停在「本周进展」折叠块 + 「下周计划」段），与「焦点移动不跳转正文」口径的静态证据相容。
5. **折叠演示在场**：正文「本周进展」呈折叠占位「… 11 行」，是 ←/→ 折叠链路的视觉证据；阶段 1 验收要求的「焦点环 + 折叠态」同框满足。
6. **文案 ④**：范围内固定 UI 文案仅 tab「文件」「大纲」，逐字一致；大纲标题与折叠占位文字为文档派生内容（fixture-fe08.md），不计文案偏差。设计稿 bottom 注记/差异注记/标注卡（`outline.fold.*` 说明、Q9 差异注记、kbd-hint、dim-chip）为原型解释层，非产品 UI，实现不包含属预期。

## 取稿与读图备注

- 设计稿类型：html（`ui_05_sidebar.html`，1336 行，含完整 token/CSS）
- 取稿方式：Read 源直读（skill 取稿表 html 行）。取稿前已校验路径存在（43KB），非 fail-closed。按调用方约束禁浏览器、禁写非报告文件，故未产出 `IT-02-FE-08-design.png`；设计侧比对基准 = html 源 CSS 声明值与 dim-chip 标注值。
- 读图方式：Read PNG（实现图，浅色主题 1280×900）+ PIL 像素采样/几何测量（只读分析，未接触实现源码/浏览器/非报告文件）。
- 主题对照：实现图为亮色主题，色值按设计稿 `:root` token 对照（`--accent` #0969da / `--fg` #333333 / `--accent-soft` rgba(9,105,218,0.12) / `--bg-inset` #f2f2f2 / `--bg-sidebar` #fafafa / `--tree-row-h` 28px / `--tree-indent` 16px）。
- 动态行为不可核验：↑/↓ 移动焦点不跳正文、Enter 平滑跳转与点击同路径、←/→ 双向同步（大纲↔正文 gutter）、headingFolds 跨重启持久、.md 零字节变化、折叠不回 toast、roving tabindex（仅焦点行 tabIndex=0）、hover 态——均为动态/前后对比/代码层行为，静态截图无法核验，留自测/QA 阶段（任务实现自述浏览器自测已通过）。
- UI-ELEM-01「token 化、代码无裸值」属代码层验收：本图实测视觉值与 token 值一致（焦点环），但按铁律不读实现源，裸值与否无法核验。
- 交叉印证：#1/#2/#6 与 IT-02-FE-07 评审（`../IT-02-FE-07/IT-02-FE-07-replica-review.md`）#1/#2/#3 同源未修复项，本轮以像素实测加固证据（#2 由「疑似」升级为「证实缺失」）；#4 与 FE-07 #4 同源，但 FE-08 元素表将「指向随折叠/展开切换」列入本任务面，故本轮重列。

---

## 评审者声明

本报告由独立 subagent（frontend-replica-review）基于双图视觉对比与任务「页面元素」表核对产出。评审者未读取实现源码、未启动浏览器、未修改任何文件（本评审报告除外）。
