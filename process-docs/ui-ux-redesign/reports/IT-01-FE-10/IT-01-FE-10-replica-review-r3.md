# UI 复刻评审报告 · r3（第 2 次重评 = 确认轮，达重评上限）

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修性。
> 本报告为重评 r3：范围收窄为「#6 caret accent 蓝」「#5 U1 整表外框」两项核心确认 + 旧项回归确认（标「维持」不重开）。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-01-FE-10 |
| 任务文件 | `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-01/FE-10.md` |
| 评审时间 | 2026-10-01 |
| 评审轮次 | r3（第 2 次重评=确认轮）；前序 `IT-01-FE-10-replica-review.md`（r1，09-30 21:57）、`IT-01-FE-10-replica-review-r2.md`（r2，10-01 20:50） |
| 评审者 | frontend-replica-review subagent |
| 实现图（主，新） | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-10/IT-01-FE-10-impl.png`（编辑态，浅色，1200×800，mtime 2026-10-01 22:00:50，md5 `9b10c02e25ca63600aa30d76458beb9c`，修复批后新截，与调用方声明一致） |
| 核心确认辅证图 | `IT-01-FE-10-caret-on.png`（caret 亮相特写 3x，930×180，mtime 22:00:50，md5 `b6bf9de4dc307dc2d690826e24c2c485`） |
| 对照旧图 | `IT-01-FE-10-impl-r1-era.png`（1200×800，mtime 10-01 21:14，md5 `a3b28956da845b6f90cdc1add54375f3`——即 r2 报告所评 impl 帧，「纯灰全环」状态；本轮仅作消除对照） |
| 补充取证 | `IT-01-FE-10-recapture-results.json`（DOM/计算级断言，22:50 批）、`IT-01-FE-10-recapture.mjs` |
| 旧证（沿用） | `idle-quiet.png`/`final-quiet.png`/`select-safe.png`（09-30 17:33）、`cdp-results.json`（47/47）、`debounce-timeline.svg`、`zero-shift-compare.svg`、`self-test.md` |
| 设计图 | 未产出 `design.png`（设计稿类型为 html，取稿方式为 Read 直读源码+CSS 值，沿用 r1/r2 口径） |
| 设计稿源 | `docs/requirements/ui-ux-redesign/ui/ui_02_table_edit.html`（主稿）、`ui_07_global.html`（交叉印证） |
| 页面路径 | 表格编辑视图（chrome 显隐四态）+ 全局浮层 |

---

## 一、核心确认项（本轮收窄范围）

### #6 激活格内 caret accent 蓝 — **收敛**

| 取证面 | 读数 | 判定 |
|---|---|---|
| caret-on 特写（3x）像素 | 光标条 x=153–158（3x）≈ **2px 宽**，条芯 `(43,126,223)`、边缘 `(32,123,223)`（chroma 187–191，accent 色相族）；3x 插值平滑致略淡于纯色，非色相偏离 | accent 蓝 ✓ |
| impl 主帧像素 | 激活格（陈屿）内光标条 x=381–382、y≈296–327，条尾像素纯 `(9,105,218)`（= `--accent` #0969da 精确值） | accent 蓝 ✓ |
| 计算级（recapture-results） | `caret-color` = `rgb(9,105,218)`（亮）/ `rgb(88,166,255)`（暗 = #58a6ff） | 双主题精确命中 ✓ |
| 设计稿值 | `.caret`（ui_02 L357–363）`background: var(--accent)`；亮 `--accent:#0969da`（L15）、暗 `#58a6ff`（L50） | — |

r1 #6「深色（近黑）光标」问题**不复存在**；亮/暗两主题 caret 色值均与设计 token 精确一致。r2「待证（无 caret 帧）」状态以 caret-on 特写 + impl 主帧 + 计算级三方闭合。

### #5 U1 整表编辑态外框（wrap outline）— **收敛**；退出态无框—**维持**

| 取证面 | 读数 | 判定 |
|---|---|---|
| 新 impl 表缘四边像素 | 顶 y=244 蓝系 768/769、底 y=368 蓝系 768/769、左 x=337 蓝系 121/121、右 x=1104–1105 蓝系 121/121——**四边全环 accent 色相**，取样 `(34,120,221)`/`(140,182,230)`/`(141,183,231)` 等（1px 插值混色，色相=accent 族） | 整表 1px accent 外框在位 ✓ |
| 计算级（recapture-results） | wrap outline：`solid`、`rgb(9,105,218)`、offset `-1px`、宽度读数 `0.571429px`（= 设计 1px ÷ 1.75，**175% DPI 伪影，按取证纪律不报偏差**） | 机制与 CHANGE-15 口径一致 ✓ |
| 旧图对照（impl-r1-era） | 同口径表缘全环采样 **chroma 全 0**（纯灰阶 228–255）——「纯灰全环」签名 | 灰环已**消除** ✓ |
| 退出态无框（旧证复核） | `idle-quiet.png`/`final-quiet.png` 表缘环带蓝系像素 **0/3076**，全灰 `(229,229,229)` | 退出态无框口径维持 ✓ |

设计稿值：`table.gfm { border: 1px solid var(--accent); /* edit-state container outline */ }`（ui_02 L322–325）；实现为 wrap outline 等效形态（1px accent、offset -1px，覆盖整表四边）。r2 #5「外框不可见（accent 计数 0）」在修复批后新帧已闭合。

> 注：`recapture-results.json` 中「U1 整表外框」「激活单元格 2px 外框」两条 `ok:false` 系断言对宽度字符串的严格相等比较失败（读数 `0.571429px`/`1.71429px` 为 175% DPI 换算伪影 = 设计值÷1.75），**非样式缺失**——同条 detail 的 style/color/offset 均正确，且像素级四边蓝环独立佐证。按取证纪律（视觉/像素优先、DPI 伪影不报偏差）不计未对齐点。激活单元格 2px 外框另经特写独立复核：3x 下 x=21–26 = 6px/3 = **2px**，符合 `.active-cell` `outline:2px solid var(--accent); outline-offset:-2px`（L351–354）。

---

## 二、回归确认（旧项勿重开，标「维持」）

| 旧项 | 本轮确认 | 依据 |
|---|---|---|
| #1 工具栏单 pill 右对齐（两簇→单条） | **维持** | 新帧连续载体 x≈880–1105、y=204–236；控件序 `⊞ ◧ ▣ ◨` + 分隔隙 + `⋮` `🗑`（图标簇 x=904/936/968/1000 + 1050 + 1078）；顶缘 y=204 = 表顶 244−40（`top:-40px`）✓，右缘≈1105 与表右缘对齐（`right:0`）✓；recapture `tbText=["⊞","◧","▣","◨","⋮","🗑"]` tbCount=6 与设计控件集逐字一致 |
| #2 `🗑` danger 色 | **维持** | 红系像素 38 个集中 x=1078–1084/y=215–224（AA 混色如 `(220,129,173)`，色相红族），钮底透明——与 `.tbtn.danger { color:var(--danger) }`（#d1242f）一致 |
| #3 工具栏/按钮尺寸 32/28px | **维持** | 条体 y=204–236 ≈ **32–33px**（含 1px 双边框）；图标节距 32px（28+gap 4）——与 `.table-toolbar height:32px`/`.tbtn 28×28` 吻合 |
| #4 右端仅 `⋮` `🗑`（无复制钮） | **维持** | 右端簇 (1050,1051)=`⋮`、(1078,1085)=`🗑`，无第三钮 |
| #7 深色主题显隐面证据缺口 | **照旧列账，不判偏差** | 仍无深色整帧截图；新增计算级暗色辅证：caret-color `rgb(88,166,255)`（=暗 `--accent`）仅为 caret 单点，深色显隐过渡面仍不可核 |
| #8 hover 微控件浮现态证据缺口 | **照旧列账，不判偏差** | 仍无浮现定格图；CDP 时序旧证（reveal 156–166ms/hide 163ms/gripOpacity 0.5）沿用 |
| 静息零 chrome / Esc 收拢 / 0px 位移 / 拖选安全 / 防抖 | **维持（旧证沿用）** | `idle-quiet`/`final-quiet`/`select-safe` 终态面无变化；`cdp-results` 47/47、零位移六组+toast 组全 0、防抖落窗——修复批为呈现层色值/外框改动，不在状态机与槽位改动面 |

---

## 三、未对齐点清单（按区域分组；不打分、无 PASS/FAIL）

### 表格编辑态（激活单元格）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 1 | Minor | caret 条高度 | `.caret` 2px×**18px**（`height:18px; vertical-align:-3px`，ui_02 L357–363） | 光标条 3x 特写实高 66px/3 ≈ **21–22px**（条芯 60px/3=20px），与正文行高（15px×1.5≈22.5px）等高，宽度 2px 无偏 | 高约 **+3~4px**（原生 caret 取行高形态 vs 设计装饰 span 18px 定高） | 若认可原生 caret 形态（CM6 真光标，高度随行高属合理解释），登记口径差异至 change-log 并在设计侧标注；否则定制 caret 高度至 18px。**色值已收敛不在此项内** |

### 证据缺口（无法从所给截图核验，按调用方口径不判偏差，照旧列账）

| # | 元素 | 设计稿值 | 实现值 | 说明 | 处置 |
|---|---|---|---|---|---|
| 2 | 深色主题显隐面（旧 #7） | 深浅显隐过渡一致、token 翻值 | 全部图证均浅色主题 | 深色面缺口依旧；计算级暗色 caret 值已闭合（`rgb(88,166,255)`）但不覆盖显隐过渡面 | 如实列缺口；如需闭环补深色 idle/edit/quiet 三态图 |
| 3 | hover 微控件浮现态（旧 #8） | hover ≥150ms 后 col-grip 浮现（token 提示线、不遮挡正文） | 无浮现态定格图 | 浮现形态/提示线/遮挡无截图可核 | 如实列缺口；如需闭环补慢速 hover 浮现截图 |

---

## 四、时序类备注（静态图不可判，旧证沿用，不计入未对齐点）

- **防抖 ≥150ms / 快速掠过 0 闪烁（AC-NF-04）**：`cdp-results.json` 47/47——rapidPass `flashes:0`、slowHover reveal 156–166ms、leaveHide 163ms 均落判定窗；修复批未触碰状态机，旧证沿用成立。
- **位移 0px（AC-NF-05）**：zeroShift 六组 + toast 组 dTop/dLeft 全 0（CHROME_SLOT_PX=0）；新帧目视复核工具栏浮于表上空隙（top:-40px 槽位），未推开正文。
- **静息零 chrome / 拖选安全**：`idle-quiet`/`final-quiet`/`select-safe` 终态面复核无变化。

## 五、核对通过面（无偏差，供参考）

- **U1 整表外框（核心 #5）**：编辑态四边 1px accent 全环在位；旧「纯灰全环」消除；退出态无框维持（详见核心确认表）。
- **caret accent 蓝（核心 #6）**：亮 #0969da / 暗 #58a6ff 双命中；caret-on 特写条形 2px 宽、落点在陈屿之后（margin-left:1px 语义）；r1 深色光标问题消除。
- **激活单元格**：2px accent outline + 白底，特写左缘 3x 实测 6px/3=2px 精确命中。
- **工具栏载体**：单 pill、右对齐、`⊞ ◧ ▣ ◨ | ⋮ 🗑` 控件集、32/28px 尺规、danger 色——r1 #1–#4 全部维持收敛。
- **激活/按下态**：第 2 钮（对齐键，fixture 为左对齐列）accent-soft 底 + accent 图标，runtime 映射合理（fixture 口径差异不计入）。
- **文案**：工具栏 6 图标与设计字形逐字一致（recapture tbText 逐项命中）；fixture 正文差异按 r1 范围口径不计入。

---

## 六、取稿与读图备注

- **设计稿类型/取稿**：html ×2，Read 直读源码+CSS 精确值（skill 对 html 稿的规定路径；无法渲染 PNG 为 r1 已登记口径，不构成 fail-closed）。本轮核对锚点：`.caret` L357–363、`.table-toolbar` L376–389、`.tbtn`/`.tsep` L391–419、`table.gfm` 编辑态外框注释 L322–325、`.active-cell` L351–354、token L15/L50。
- **图源核验**（Read PNG 前逐项核对）：impl.png 文件名/1200×800/mtime 22:00:50/md5 `9b10c02e…` ✓；caret-on.png 930×180/mtime 22:00:50 ✓；对照旧图 md5 `a3b28956…` = r2 报告所评 impl 同帧（文件名标 r1-era，实为 r2 评审帧归档；对「纯灰全环」对照用途无影响——r1/r2 两代帧均无 accent 环）。
- **像素取证摘要**（stdout 分析，未写中间文件）：
  - 新 impl 表缘四边：顶/底 y=244/368 蓝系 768/769、左 x=337 蓝系 121/121、右 x=1104–1105 蓝系 121/121（chroma>25）——U1 全环铁证；对照旧图同位 chroma 全 0。
  - caret：impl 条芯含纯 `(9,105,218)`；特写条芯 `(43,126,223)`/`(32,123,223)`（3x 平滑插值略淡，色相同族）。
  - 工具栏：条体 32–33px、图标节距 32px、🗑 红系 38px 簇。
  - quiet 双图环带蓝系 0/3076。
- **冲突采信纪律**：视觉与像素冲突一律采信像素（本轮无冲突）；`recapture-results` 两条 `ok:false` 为 DPI 宽度字符串断言伪影（0.571/1.714px = 设计值÷1.75），按纪律不报偏差、以 detail 样式值 + 像素环为准。
- **范围口径**（沿用 r1/r2）：设计稿为场景原型（含横幅/标注面板脚手架），实现为真实应用外壳；fixture 文案差异（本帧为 2 列 `fe10-r2 recapture fixture`）不计入。本轮聚焦收窄确认面 + 回归维持面。
- **取证纪律执行**：未启动浏览器、未连 dev server、未 Read 实现源码；唯一写入文件为本报告。

---

## 评审者声明

本报告由独立 subagent（frontend-replica-review）基于双图视觉对比、像素级取证与任务「页面元素」表核对产出。评审者未读取实现源码、未启动浏览器、未修改任何文件（本报告除外）。不打总分、无 PASS/FAIL。核心确认项 #5/#6 均以三方证据（像素/特写/计算级）闭合判定收敛；旧项标「维持」不重开；未对齐点以 6 元组输出，必修性由主 agent 逐条判断。本任务已达 2 次重评上限（r3=确认轮）。
