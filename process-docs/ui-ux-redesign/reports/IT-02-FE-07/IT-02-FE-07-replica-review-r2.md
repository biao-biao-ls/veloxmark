# UI 复刻评审报告（r2 重评）

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修项。
> 本轮为修复后重评（r2，第 1 次重评）。r1 报告：`IT-02-FE-07-replica-review.md`（2026-09-30）。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-02-FE-07 |
| 任务文件 | `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-02/FE-07.md` |
| 评审轮次 | r2（第 1 次重评） |
| 评审时间 | 2026-10-01 17:40 |
| 评审者 | frontend-replica-review subagent |
| 实现图 | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-02-FE-07/IT-02-FE-07-impl.png` |
| 设计图 | 无 PNG（设计稿为 html，按 skill 取稿表 Read 源直读；禁浏览器渲染故未产出 design.png，同 r1 口径） |
| 设计稿源 | `D:/code/typora/docs/requirements/ui-ux-redesign/ui/ui_05_sidebar.html` |
| 页面路径 | 左侧导航栏大纲面板 + 正文滚动联动（ui_05_sidebar.html 大纲区） |
| 前置修复批 | H（active 三件套 `--active-bar-*`、层级缩进 token、折叠三角可见性 showsFoldTriangle） |

## 图源核对（取证纪律）

| 核对项 | 结果 |
|---|---|
| 文件名/尺寸/格式 | `IT-02-FE-07-impl.png`，PNG 1200×800 RGB 非隔行，42998 字节 |
| mtime | 2026-10-01 16:46:14（晚于 r1 报告 2026-09-30 22:40 → 修复批 H 后重新截取，帧已更新） |
| md5 | `5da70c0eb49b1ddc9a37cb767ce1875b` |
| 串图排查 | 同规格 1200×800 邻图 `IT-02-FE-06-impl.png`(md5 `78a145df…`)、`IT-02-FE-08-impl.png`(md5 `bf9ad3cf…`) 哈希均不同；内容为 VeloxMark 深色主题 + 大纲面板 + active 高亮行，与文件名预期一致 → **无一图双命名 / 串图污染，图源可信** |
| 与 r1 帧差异 | 本轮测试文档与 r1 不同（r1=「项目周报 Alpha / 一、进展概览…」；本轮=「主标题 Intro / 第二节 Alpha / 三级小节 Beta / 四级小节 Gamma / 第二节 Delta」H1–H4 层级树）。旧帧已被覆盖，无法同帧像素 diff；收敛判定一律以设计稿声明值 + 本轮像素取证为准 |

## r1 未对齐点逐项标注

| # | r1 未对齐点 | r1 严重度 | 本轮结论 | 新证据（像素取证，深色 token 对照） |
|---|---|---|---|---|
| 1 | active 项标题色用 accent 蓝替代 `--fg` | Important | **收敛** | active 行「三级小节 Beta」标题游程最亮像素 `#d4d4d4` = `--fg`（dark），无 accent 蓝（游程内最蓝值 `#b4d4d4` 系浅色字在蓝调底上的抗锯齿混合）；与设计 `.outline-row.active-follow .title { font-weight:700; color: var(--fg) }` 一致 |
| 2 | active 行整行底色 `--accent-soft` 疑似缺失 | Minor | **收敛** | active 行底色 `#2c3745` = `rgba(88,166,255,0.14)` 叠 `#252526` 的精确合成（R 0.14×88+0.86×37≈44→0x2c；G→0x37；B→0x44/45 三维全中） |
| 3 | 行首 `.lv` 层级徽标缺失 | Minor | **收敛** | 5 行行首均有 H1/H2/H3/H4 徽标（点阵字形逐字可辨），色 `#6a6a6a` = `--fg-disabled`（dark）；几何与设计一致：22px 宽 `text-align:center` 盒（字形居中偏移 +4px）、层级步进 16px。active 行徽标仍为 `--fg-disabled`，符合设计（无 active 覆盖） |
| 4 | 父级行折叠 twisty 未见 | Minor | **收敛** | showsFoldTriangle 规则成立：有子节行「主标题 Intro / 第二节 Alpha / 三级小节 Beta」显实心 ▾（展开态），叶行「四级小节 Gamma / 第二节 Delta」显 `·`；色 `#9a9a9a` = `--fg-dim`（设计 `.twisty{color:var(--fg-dim)}`、`.twisty.empty` 占位）。字形点阵：▾ 为 4×4px 实心下三角、`·` 为 2px 点 |

**结论：r1 四项全部收敛，无残留。**

## 修复批 H 点名项核验

| 修复项 | 结论 | 证据 |
|---|---|---|
| active 三件套 `--active-bar-*` | **对齐** | 左条 3px `#58a6ff`（= `--accent`，x=0–2，高 22px、上下各约 3px 内缩，与设计 `::before{width:3px;top:3px;bottom:3px;background:var(--accent);border-radius:0 2px 2px 0}` 吻合）+ 整行底色 `--accent-soft` + 标题 700/`--fg`，三要素齐备 |
| 层级缩进 token | **对齐** | 徽标左缘 L1=4 / L2=20 / L3=36 / L4=52，步进恰 16px = `--tree-indent`；行带 28px = `--tree-row-h`；徽标 22px / 间隙 4px / twisty 18px / 间隙 4px / 标题起点与设计盒模型逐像素吻合（如 L3：badge 32–54、twisty 58–76、title 起 80，实测 title 游程起 x=80） |
| 折叠三角可见性 showsFoldTriangle | **对齐** | 见 r1 表 #4：仅父行出 ▾、叶行 `·` |

## 本轮未对齐点清单（按区域分组）

### 侧栏面板头（大纲 tab）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 1 | Minor | active tab 下划线宽度 | `.panel-tab.active::after` 两端各内缩 `var(--space-2)`（8px），宽=文字宽 26px（「大纲」文字 x66–91） | 下划线 x58–99 = 整按钮宽 42px（含左右 padding，两端内缩 0） | 两端各多出 8px，呈"整 tab 全宽下划线"而非"文字宽下划线" | `::after` 两端按 `var(--space-2)` 内缩；色/高/竖向位置已对（`#58a6ff` / 2px / 落在 panel-head 底边）。注：面板头/ tab 属侧栏外壳样式，可能归属 IT-02-FE-01/05 等外壳任务，主 agent 可豁免移交 |

### 大纲面板

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 2 | Minor | lvl-4 标题色（「四级小节 Gamma」） | 设计仅定义 `.lvl-3 .title { color: var(--fg-dim) }`，无 lvl-4 规则 → 级联回落 `.outline-row { color: var(--fg) }` = `#d4d4d4` | 标题最亮像素 `#9a9a9a` = `--fg-dim` | 深层（H4）标题比设计级联值暗一档（沿用 lvl-3 的 dim 规则） | 二选一：实现将 dim 限定在 `.lvl-3`；或设计补 lvl-4/深层级规则把"越深越暗"显式化。H4 样本不在设计稿 demo 内（设计仅 H1–H3），主 agent 可按设计未覆盖豁免 |

### 正文区

无未对齐点（详见备注：跳转目标定位与光标落点证据符合口径）。

---

## 取稿与读图备注

- **设计稿类型**：html（`ui_05_sidebar.html`，含完整 CSS）。取稿方式 = Read 源直读（skill 取稿表 html 行），精确样式值以源声明为准；取稿前已校验路径存在（43222 字节，mtime 2026-10-01 11:32），非 fail-closed。按调用方约束禁浏览器渲染、禁写非报告文件，故不产出 design.png（与 r1 同口径）。
- **读图方式**：Read PNG（实现图）+ Python/PIL 只读像素采样（行带检测、色值、字形点阵、几何游程），未写任何临时图。
- **主题对照**：实现图为深色主题，全部比对按 `.theme-dark` token：`--accent` #58a6ff / `--fg` #d4d4d4 / `--fg-dim` #9a9a9a / `--fg-disabled` #6a6a6a / `--accent-soft` rgba(88,166,255,0.14) / `--bg-sidebar` #252526 / `--bg` #1e1e1e / `--tree-row-h` 28px / `--tree-indent` 16px / `--sidebar-width` 240px。实测各值全部命中。
- **动态行为不可核验**：平滑滚动动画（smooth）、动画期间 active 不闪烁、快速连点末击胜出、AC-NF-05 正文 0 位移、折叠自动展开等仍为动态/前后对比行为，静态截图无法核验，留自测/QA 阶段。
- **正面证据（非偏差，供主 agent 参考）**：
  1. **跳转居中（含 clamp）**：滚动条 thumb 顶对齐（scrollTop≈0），跳转目标「### 三级小节 Beta」位于正文视口 y≈335、视口几何中点 y≈426，偏上约 91px。按"目标内容 y 335 − 半视口 351 = −16 → clamp 到 0"复算，与「显式居中 + 文档顶部 clamp」行为一致，**不计偏差**（r1 帧文档更长、目标可达中点；本轮短文档居中被顶部钳制属预期）。
  2. **光标落点**：状态栏「7:1」= 测试文档第 7 行行首，恰为「### 三级小节 Beta」标题行；该标题呈源码态（`###` 可见、其余标题渲染态），系 live-preview 光标进入范围跳过装饰的既有行为，**不计偏差**。
  3. **active 跟随**：大纲 active 项 =「三级小节 Beta」= 视口中部章节 = 光标所在标题，三者一致（AC-FN-11-1）。
  4. **面板 tab 文案**：「文件」「大纲」逐字一致；active tab「大纲」色 `--fg`/600、非 active「文件」色 `--fg-dim`，与设计 `.panel-tab` / `.panel-tab.active` 一致；搜索 icon-btn `⌕` 存在（色 `--fg-dim`）。
  5. **面板宽**：侧栏右缘 x≈239（1px 边框），约 240px = `--sidebar-width`。
- **文案 ④ 适用性**：大纲项标题为文档派生内容（设计稿样例「项目周报/本周进展/…」vs 实现测试文档「主标题 Intro/…」），文档不同属预期，不计文案偏差；范围内固定 UI 文案仅 tab 两项与 Hn 徽标，已逐字核对一致。
- **不作需求（沿用 r1 裁决，未计缺失）**：batch-bar、checkbox、drag-handle、drop-line、diff-note、outline-note、doc-scroll-hint、annotation-panel；panel-foot（＋新建/WORKSPACE/⋮/☰）仅存在于设计稿文件树面板 A，大纲面板 B 自身无 panel-foot，不计缺失。
- **范围说明**：正文标题样式（h1/h2/h3/h4 渲染形态、`###` 源码态）属渲染区/编辑器主题（ui_06）辖域，不在 FE-07 页面元素表内，未计偏差；窗口菜单/标签页/状态栏为应用外壳，未计。

---

## 严重度分布（仅供参考，非通过门槛）

| 严重度 | 数量 | 含义 |
|---|---|---|
| Critical | 0 | 结构缺失 / 主功能元素缺失 / 关键样式严重偏离 / 文案错字 |
| Important | 0 | 次要元素缺失 / 样式明显偏离 / 间距对齐偏差 |
| Minor | 2 | 微小视觉差异 / 装饰元素细节偏差 |
| **合计** | **2** | （r1 四项已全部收敛，本表仅含本轮新发现） |

> 主 agent 逐条判断未对齐点的必修性，严重度仅作参考。本轮两项 Minor 均带豁免/移交建议，无 Critical/Important。

---

## 评审者声明

本报告由独立 subagent（frontend-replica-review）基于双图视觉对比、设计稿 html 源声明值与只读像素取证产出。评审者未读取实现源码、未启动浏览器、未连接 dev server、未修改任何文件（本评审报告除外）。
