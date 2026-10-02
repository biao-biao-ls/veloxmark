# UI 复刻评审报告（r2 · 修复后重评）

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修项。
> 本轮为修复批 H（折叠三角可见性 + 侧栏 token）落地后的第 1 次重评。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-02-FE-08 |
| 任务文件 | `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-02/FE-08.md` |
| 评审轮次 | r2（第 1 次重评；r1 报告：`IT-02-FE-08-replica-review.md`，2026-09-30） |
| 评审时间 | 2026-10-01 |
| 评审者 | frontend-replica-review subagent |
| 实现图 | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-02-FE-08/IT-02-FE-08-impl.png` |
| 设计稿源 | `D:/code/typora/docs/requirements/ui-ux-redesign/ui/ui_05_sidebar.html` |
| 设计图 | 无 PNG（设计稿为 html，按 skill 取稿表 Read 源直读；禁浏览器故未渲染截图） |
| 页面路径 | 左侧导航栏大纲面板键盘通道（ui_05_sidebar.html 大纲区） |

**实现图身份核对（取证纪律）**：文件名 `IT-02-FE-08-impl.png`；格式 PNG 1200×800 RGB；mtime 2026-10-01 16:46；33,493 字节。图内容为 VeloxMark 亮色主题，左侧大纲面板 5 节点 + 正文折叠占位行，与 FE-08「焦点环 + 折叠态」取证预期相符（r1 图为 1280×900，2026-09-30 批次，本图确为新截图，非旧图复用）。**图源无疑**。像素取证中途生成的临时裁剪图已删除，对照以原图为准。

---

## r1 未对齐点逐项标注（收敛 / 残留 / 新证据）

| r1# | 严重度(r1) | 摘要 | 本轮裁定 | 证据（r2 图像素实测） |
|---|---|---|---|---|
| 1 | Important | active 项标题用 accent 蓝，应为 `--fg` #333333 | **收敛** | active 行「三级小节 Beta」标题暗像素主色 (51,51,51)=`#333333`=`--fg`，accent 蓝仅剩次像素抗锯齿杂色；与设计 `.active-follow .title { color: var(--fg) }` 一致 |
| 2 | Minor | active 行缺 `--accent-soft` 整行底色 | **收敛** | active 行底色实测 (221,233,247)，与 `--accent-soft` rgba(9,105,218,0.12) 叠 `#fafafa` 计算值 (221,233,246) 精确吻合；整行 28px 满铺（y140–167） |
| 3 | Minor | 左条 2px 且满行无内缩 | **收敛** | 左条实测 3px 宽（x0–2，x2 为抗锯齿边）= 设计 `width:3px`；纵向 y144–164（21–22px），行盒 28px 上下内缩 ≈3px = 设计 `top/bottom:3px`（±1px 取整噪声） |
| 4 | Important | 折叠三角全为「·」无指向差异 | **收敛** | showsFoldTriangle 落地后三角序列成立：H1「主标题 Intro」（有子节）4×3 墨迹 topW=4>botW=2 = ▾ 展开向；H2「第二节 Alpha」（有子节且正文折叠）topW=2<botW=3–4 且质心偏左 = ▸ 折叠向；H3「三级小节 Beta」（有子节）= ▾；叶子 H4「四级小节 Gamma」/ H2「第二节 Delta」= 2×1「·」。方向随折叠态切换（UI-IXD-06）可辨 |
| 5 | Important | 折叠态子树未收起、无 meta | **裁定关闭（勿再报必修）** | 按 FE-08#5 裁定：任务契约优先——折叠=headingFolds 正文同步+三角指向，大纲平铺全量；设计稿「折叠节点隐子行 + meta（含 3 子节 · 折叠已记忆）」口径入登记。r2 图证据与裁定口径一致：正文 Alpha 折叠占位 summary「（11 行内容已折叠 · 与大纲双向同步）」在位（F-v2 口径），大纲侧仍平铺 Beta/Gamma |
| 6 | Minor | 层级徽标 `.lv` 缺失 | **收敛** | 行首 H1/H2/H3/H4 徽标在位（墨迹 11×7px ≈ 10px/700 字号），色 ~(176,176,176) ≈ `--fg-disabled` #b0b0b0；排在 twisty 前，宽约 22px 槽位 |
| 7 | Important | 层级缩进 ~12px/级，应 16px | **收敛** | lv 徽标左缘 5→21→37→53，标题左缘 49→65→81→97，步距均 **精确 16px** = `--tree-indent: 16px` |
| 8 | Minor | 行高 ~26px，应 28px | **收敛** | active 底色带 y140–167 = **28px 整**；行文本带距 28/28/29/27 ≈ 28px = `--tree-row-h: 28px` |

**汇总**：r1 共 8 项 → 收敛 7 项（#1/2/3/4/6/7/8）、裁定关闭 1 项（#5）、残留 0 项。

---

## 本轮未对齐点清单（按区域分组，不打分）

### 大纲面板 · 键盘焦点环（FE-08 核心元素 · 取证缺口）

| # | 元素 | 设计稿值 | 实现值 | 偏差 | 严重度 | 修复建议 |
|---|---|---|---|---|---|---|
| 1 | 键盘焦点环（UI-ELEM-01） | `.tree-row.kbd-focus { outline: 2px solid var(--accent); outline-offset: -2px; background: var(--bg-inset) }`（亮 `#0969da` 环 + `#f2f2f2` 底）；dim-chip「焦点环 2px accent」 | 本实现图中**无任何焦点环**：全侧栏 accent 色扫描仅命中 active 左条（x0–2, y144–164，61px），环形描边 0 命中；`--bg-inset` #f2f2f2 底 0 命中。图中仅有 active-follow 高亮（accent-soft 底 + 左条），无 kbd-focus 态行 | FE-08 阶段 1 验收要求实现图「大纲焦点环 + 折叠态」同框；本图仅满足折叠态，焦点环缺席致 **UI-ELEM-01 本轮无法核验**。注：r1 图曾在「本周进展」行完全对齐焦点环（环色/环宽/offset/bg-inset 四项实测通过），实现自述焦点环 CSS（token `--focus-ring-width/--focus-ring-offset`）在位，故此为**取证缺口，非实现回归的确证**——疑 r2 截图时机未进入键盘导航态（焦点环元素表默认「不显示，仅键盘导航时可见」） | Important（取证面） |
|  | 修复建议 |  |  |  |  | 重截实现图：Tab/↑↓ 使大纲行进入 kbd-focus 后截图，保证焦点环与折叠态同框（阶段 1 取证要求）；或核对截图脚本是否在键盘导航动作后取帧。实现侧仅在确认 CSS 确实丢失时才改码 |

### 大纲面板 · 其余核对面

无其他未对齐点（见下方无偏差确认项）。

---

## 无偏差确认项（要点，供主 agent 参考）

1. **结构（①）**：大纲 5 行 H1→H2→H3→H4→H2 层级缩进逐级递进，与设计样例结构同构（样例文案为原型 fixture，本文案为 fixture-fe08.md 派生，不计文案偏差）；侧栏宽 240px；UI 字号 13px 相符。
2. **元素清单（②）**：节点行/折叠三角/层级徽标/active 高亮均在位且类型正确；焦点环见未对齐 #1（取证缺口）。
3. **关键样式（③）**：缩进 16px、行高 28px、active 底 `--accent-soft`、active 标题 `--fg` 700、左条 3px 内缩 3px、lv 徽标 `--fg-disabled` 10px——本轮全部实测对齐 token 值（修复批 H 侧栏 token 成果确认）。
4. **折叠演示在场**：正文「第二节 Alpha」折叠占位「（11 行内容已折叠 · 与大纲双向同步）」（F-v2 summary 口径），正文 gutter 折叠向（Alpha ▸、Intro/Delta ▾）与大纲三角序列（Alpha ▸ / Intro、Beta ▾ / 叶子「·」）互证，AC-FN-30 折叠链路视觉证据完整。
5. **文案（④）**：tab「文件」「大纲」逐字一致；固定 UI 范围内无错字。设计稿 bottom 注记/差异注记/标注卡/dim-chip 为原型解释层，实现不包含属预期。
6. **三态可区分**：active 态（accent-soft 底 + 左条）在场；焦点态本轮图未呈现（见 #1）；hover 态静态图不可核验——留补图后复核。

## 取稿与读图备注

- 设计稿类型：html（`ui_05_sidebar.html`，1336 行，含完整 token/CSS）。取稿方式：Read 源直读；取稿前校验路径存在（43,222 字节，mtime 2026-10-01 11:32）。按调用方约束禁浏览器、禁写非报告文件，故无 `design.png`；设计侧比对基准 = html 源 CSS 声明值与 dim-chip 标注值。
- 读图方式：Read PNG（浅色 1200×800）+ PIL 像素采样/几何测量/字形 ASCII dump（只读分析；临时裁剪放大图已删除）。未接触实现源码、浏览器、dev server；未修改任何文件（本报告除外）。
- 主题对照（亮）：`--accent` #0969da / `--fg` #333333 / `--fg-dim` #6b6b6b / `--fg-disabled` #b0b0b0 / `--accent-soft` rgba(9,105,218,0.12) / `--bg-inset` #f2f2f2 / `--bg-sidebar` #fafafa / `--tree-row-h` 28px / `--tree-indent` 16px / `--sidebar-width` 240px。
- 动态行为不可核验：↑/↓ 移焦不跳正文、Enter 与点击同路径跳转、←/→ 双向同步、headingFolds 跨重启、.md 零字节、折叠不回 toast、roving tabindex、hover 态——静态截图无法核验，留自测/QA（实现自述浏览器自测通过）。UI-ELEM-01「token 化无裸值」属代码层，按铁律不读源无法核验。
- 交叉印证：#4 折叠三角与 IT-02-FE-07 同源问题在两任务侧栏簇一并收敛；#1/#2/#3/#6/#7/#8 为 r1 同任务项收敛复测；FE-08#5 折叠态子树口径按裁定入登记，本轮未报。

---

## 评审者声明

本报告由独立 subagent（frontend-replica-review）基于实现图视觉/像素取证与设计稿 html 源对比产出。评审者未读取实现源码、未启动浏览器、未连接 dev server、未修改任何文件（本评审报告除外）。不打总分、无 PASS/FAIL；必修性由主 agent 逐条裁定。
