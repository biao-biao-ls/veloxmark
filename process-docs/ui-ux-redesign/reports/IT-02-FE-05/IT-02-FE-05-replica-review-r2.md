# UI 复刻评审报告 · r2（第 1 次重评）

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修项。本报告为 IT-02-FE-05 重评 r2，对 r1 清单逐项标注「收敛 / 残留 / 新证据」。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-02-FE-05 |
| 任务文件 | `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-02/FE-05.md` |
| 评审时间 | 2026-10-01 20:45 |
| 评审者 | frontend-replica-review subagent（r2 重评） |
| 实现图 | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-02-FE-05/IT-02-FE-05-impl.png`（1200×800，亮，mtime 10-01 20:10，r2 场景=文件菜单展开、首项键盘高亮） |
| 补充取证 | `shots/batch-r2-fe05-focus-ring-fixed.png`（117×86，亮，根钮焦点环）/ `shots/batch-r2-fe05-focus-ring-dark.png`（117×86，暗，根钮环）/ `shots/batch-r2-fe05-focus-ring-BASELINE.png`（110×79，改前基线，**实际存放于 `reports/IT-01-FE-03/shots/`**）/ `shots/batch-c-three-states-light.png`（1200×800，批 C 三态亮证）/ `shots/batch-f-fe05-submenu-kbd-focus.png`（1200×800，子菜单键盘焦点）/ `IT-02-FE-05-three-states-dark.png`（1280×900，09-29 旧证） |
| 设计图 | 设计稿为 `.html`，按 skill 取稿规则直读源码（无 design.png 产物，同 r1 口径） |
| 设计稿源 | `D:/code/typora/docs/requirements/ui-ux-redesign/ui/ui_04_menubar.html`（主）+ `ui_07_global.html`（交叉印证） |
| 页面路径 | 顶部菜单栏键盘通道（ui_04_menubar.html 菜单开合语境，「文件」下拉展开态） |
| 上一轮报告 | `IT-02-FE-05-replica-review.md`（r1，2026-09-30 22:21，9 项未对齐） |

## 严重度分布（仅供参考，非通过门槛）

| 严重度 | 数量 | 含义 |
|---|---|---|
| Critical | 0 | — |
| Important | 0 | — |
| Minor | 2 | 微小视觉差异 / 装饰元素细节偏差 / doc 可选对齐 |
| **合计** | **2** | r1 的 9 项中 8 项收敛、1 项按调用方口径豁免；余 2 项为 r2 新登记 Minor |

---

## 一、r1 未对齐点逐项标注（收敛 / 残留 / 新证据）

| r1# | r1 严重度 | 元素 | r2 结论 | r2 证据（像素实测） |
|---|---|---|---|---|
| 1 | Critical | 菜单项高亮填充（hover/键盘激活）：accent 实心 vs 设计 `--bg-inset` | **收敛** | impl.png 键盘激活行（新建）fill=(242,242,242)=`#f2f2f2`=`--bg-inset`，与设计 `.mi.is-hover { background: var(--bg-inset) }` 精确一致；batch-c 证 hover 行/键盘行 fill 同为 `#f2f2f2`。accent 实心填充已移除 |
| 2 | Critical | hover 态 vs 键盘激活态可区分（浅色同屏不可辨） | **收敛** | batch-c-three-states-light 同框双高亮：hover 行（y=70–99）纯 fill、四周无环；键盘激活行（y=101–128）fill + 环（横线 y=100/129 为纯 `#0969da`，侧线 x=102/383 同色）——浅色可区分。impl.png 激活行同构（fill+环，环色见新 #2）。暗色侧 r1 已证可区分，post-fix 暗色新证缺（见「取证缺口」，不判偏差） |
| 3 | Important | 禁用项快捷键色未随禁用态弱化 | **收敛** | impl.png 禁用行「重新打开已关标签」键区墨色峰值=176=`#b0b0b0`=`--fg-disabled`，与标签同色；可用行键区=107=`#6b6b6b`=`--fg-dim`（设计值精确一致）。batch-c 证同口径（键 176 / 标签 176） |
| 4 | Important | 根菜单按钮焦点环（页面元素表第 1 行）无从核验 | **收敛（新证据）** | `batch-r2-fe05-focus-ring-fixed.png`：「文件」钮四缘完整圆角环，主色 (9,105,218)=`#0969da`（244 px 命中）；`batch-r2-fe05-focus-ring-dark.png`：环色 (88,166,255)=`#58a6ff`（244 px）——与 `--focus-ring` 双主题值（亮 #0969da / 暗 #58a6ff）实证一致。改前基线（BASELINE）无环、仅 fill，前后对照闭合。impl.png 主帧根钮无环系焦点已移入面板首项（`:focus-visible` 口径正常，非缺失） |
| 5 | Minor | 根按钮 is-active 强调下划线缺失 | **收敛** | impl.png「文件」钮底缘 y=32–33 两行 (8,102,213)≈`#0969da`，横贯钮宽，即设计 `.menu-root.is-active { box-shadow: inset 0 -2px 0 var(--accent) }` 的 2px 底线 |
| 6 | Important | mi-label 左缩进与组标题不对齐（勾选列占位多 ~20px） | **收敛** | impl.png 组标题（新建与打开/保存/标签页/导出/设置）与全部菜单项 label 墨线 x=**114** 完全一致（激活 fill 左缘 103 + 设计 padding-left 11px）；勾选列占位已消失，与设计 File 面板无 `mi-check` 一致 |
| 7 | Important | menu-panel 面板宽度 218px（应 292px） | **收敛** | impl.png 面板外缘 x=97–388 ≈ **292px**（白区 290px + 两侧 1px 边框），与设计 `.menu-panel.is-wide { width: 292px }` 一致 |
| 8 | Important | 「重新打开已关标签」换行破坏行高 | **收敛** | 该项单行完整呈现、行高与其余 30px 节奏一致，无换行（与 #7 加宽同源闭合） |
| 9 | Minor | 「冲突待裁决」徽标缺失 | **裁定豁免（不报偏差）** | 按调用方口径：「冲突待裁决」/「待定」回显=设计过程注记，勿报。设计稿该徽标（`.badge-conflict`）与 `is-pending` 键位属 FE-02 冲突域注记，本任务不列 |

---

## 二、未对齐点清单（按区域分组 · r2 新登记）

### 下拉面板 · 键盘激活态环（doc 对齐 / token 一致性域）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 1 | Minor | 键盘激活态样式样例登记 | 设计稿 `.mi.is-hover` 仅 `background: var(--bg-inset)`，无「键盘激活」独立样例（静态稿只能示一态） | hover = fill `#f2f2f2`；键盘激活 = fill + accent 系 1px 环 | UI-IXD-11「三态可区分」所需的环样式为 AC 驱动增补，设计稿未登记该态——doc 缺样例，**非视觉偏差**（视觉上与 hover 可区分已满足） | 可选：ui_04_menubar.html 补「键盘激活态」样例或批注（fill+环），或在 change-log 登记该口径；主agent 裁量是否需要 |
| 2 | Minor | 焦点/激活环环色 token 一致性 | 环应取统一 token（页面元素表「焦点环 token」；根钮实证 `--focus-ring` 亮 `#0969da`/暗 `#58a6ff`） | 根钮环（fixed/dark 特写，19:58）= 纯 `#0969da`/`#58a6ff`；菜单项键盘激活环（impl.png，20:10）= (110,164,229)≈accent 以 ~59% 透明度叠白 | 同一现证集内两种环色渲染（纯色 vs 半透明），菜单项环疑未走 `--focus-ring` 同一 token/透明度；另批 C 证（13:22）项环为纯 `#0969da`，与 r2 主图浅环亦不一致 | 菜单项激活环与根钮焦点环收口同一 token（含透明度口径）；修后补一张同框复验图（根钮环 + 项环） |

> 4 类检查其余项本轮无偏差：① 结构——文件面板 5 组 12 项、组序（新建与打开/保存/标签页/导出/设置）、4 条分隔线、行高 ~30px、面板圆角/内边距与 token 相符，品牌位「VeloxMark」在位；② 元素清单——页面元素表 5 行中「根钮焦点态」（close-up 实证）、「键盘激活态」（首项高亮+环）、「禁用项灰显」（#b0b0b0）、「子菜单焦点态」（batch-f-fe05-submenu-kbd-focus：子面板 x≈388–578，激活项 fill `#f2f2f2`+蓝环 y≈287–313）均有证，「关闭态/焦点回正文」属行为态（静态图不覆盖，应由 cdp 探针覆盖，见取证缺口）；③ 关键样式——组标题/标签 `--fg` 系、键区 `--fg-dim #6b6b6b`、禁用 `--fg-disabled #b0b0b0`、高亮 fill `--bg-inset #f2f2f2`、根钮底线 `--accent` 实测均与设计 token 一致；④ 文案逐字——12 个 label（新建/打开…/打开文件夹…/快速打开…/打开最近/保存/另存为…/关闭标签/重新打开已关标签/下一个标签/导出/偏好设置…）、5 个组标题、全部快捷键（Ctrl+N/Ctrl+O/Ctrl+Shift+O/Ctrl+P/Ctrl+S/Ctrl+Shift+S/Ctrl+W/Ctrl+Shift+T/Ctrl+Tab/Ctrl+,）、2 处 ▸ 箭头、品牌 VeloxMark，逐字一致无错字。

---

## 三、取证缺口（如实列出，不判偏差）

1. **暗主题菜单三态（hover/激活/禁用）post-batch-C 无新证**：`IT-02-FE-05-three-states-dark.png`（09-29）仍为 r1 修复前的 accent 实心填充风格（行 fill=(88,166,255)、`--on-accent` #0d1117 内环），不能证明暗主题 hover 已切 `--bg-inset`。暗主题现有新证仅根钮环 close-up（`batch-r2-fe05-focus-ring-dark.png`）。按调用方口径用旧证+r1 记录标注：暗色「三态可区分」沿 r1 记录视为可区分（残留风险低），但「暗色 hover=--bg-inset」未复验。
2. **子菜单「←/Esc 收拢回一级、激活态还父行」**：行为态，静态图仅能证「进子菜单落激活项」（batch-f-fe05-submenu-kbd-focus 已证），收拢回还无截图；应由自测/QA cdp 探针覆盖。
3. **关闭态/焦点回正文（页面元素表第 5 行）**：静态截图无法核验（行为语义），同 r1 口径交 cdp 探针。
4. **根钮 hover 态（无环填充）与焦点环同框对比**无新特写；BASELINE（无环）可作间接对照，非硬缺口。
5. **Edit/View/插入/帮助面板**未在新证中出现：本任务核心为键盘通道视觉态，File 面板样张已含 hover/键盘/禁用三态（亮）；若 #2（环色 token）修复涉及全菜单，需补多面板复验。

---

## 四、取稿与读图备注

- 设计稿类型：html（`ui_04_menubar.html` + 交叉 `ui_07_global.html`）。取稿方式：Read 直读 HTML+CSS 源（skill 对 `.html` 的规定取稿方式）。未生成 design.png——html 类型无位图产物，本轮除评审报告外不落盘任何文件。
- 读图方式：Read PNG + PIL 磁盘像素测量（高亮块边界/填色采样、环探测、文字墨色峰值、面板外缘扫描、行距核对），测量输出仅在会话内。
- **取证纪律执行——串图事件**：本轮 Read 工具多次返回与文件名/尺寸不符的图像（如请求 117×86 暗环特写却返回 1200×800 全景图）。处置：对全部 8 张证据图用 PIL 计算尺寸+md5+采样色指纹，逐张与 Read 结果比对，串图配对全部识破；**所有结论以磁盘文件像素测量（ground truth）为准**，视觉 Read 仅用于文案/结构目视确认且经指纹校验后采信。串图未污染任何测量结论。
- **BASELINE 路径偏差**：调用方称 `shots/batch-r2-fe05-focus-ring-BASELINE.png` 在本任务 shots/ 目录，实际位于 `reports/IT-01-FE-03/shots/`（110×79，mtime 10-01 18:50:20）。按文件名+mtime（晚于 batch-f 17:43、早于 fixed/dark 19:58）采信为 r2 修复前基线，图源可信；路径错放属取证归档问题，请主 agent 转告归位或批注豁免。
- **各证据 mtime 时序**（辨识新旧）：batch-c-three-states-light 10-01 13:22（批 C 期）→ batch-f-fe05-root-focus-ring 17:43（无环，token 断链期失败取景）→ batch-f-fe05-submenu-kbd-focus 18:01 → BASELINE 18:50（改前）→ focus-ring-fixed/dark 19:58（改后）→ impl.png 20:10（r2 主帧）。`batch-f1-grid-pop.png`（307×543）非本任务域（网格弹层），未采信。
- **环色漂移**：菜单项键盘激活环在批 C 证为纯 `#0969da`，r2 主图实测 (110,164,229)（≈accent 59% 叠白，整行均匀非 AA 噪声）；根钮环为纯 `#0969da`/`#58a6ff`。已登记为未对齐点 #2。
- **impl.png 根钮无环的语义**：主帧为「菜单展开、面板首项键盘高亮」，DOM 焦点已在面板项上，根钮呈现 is-active（灰底+底线）而无 `:focus-visible` 环，符合焦点语义，不作为残留；根钮环证据取自 fixed/dark 特写（焦点在根钮时）。
- **双高亮同框解读**：batch-c 同框 hover 行+键盘激活行属三态取证构图（鼠标/键盘双通道同时留痕），非应用异常；r2 主帧仅单高亮（首项键盘激活）。
- 省略号字形（U+2026 vs 三点句号）在 13px 下无法从抗锯齿可靠区分，同 r1 口径未列为未对齐点。
- 设计稿窗口内场景横幅、右侧标注栏、样张 caption 为设计说明性内容，非应用 UI，未纳入对比。

---

## 五、评审者声明

本报告由独立 subagent（frontend-replica-review）基于双图视觉对比、补充取证与任务「页面元素」表核对产出。评审者未读取实现源码、未启动浏览器、未连接 dev server、未修改任何文件（本评审报告除外）。严重度仅作主 agent 判断参考；不打总分、不出 PASS/FAIL。
