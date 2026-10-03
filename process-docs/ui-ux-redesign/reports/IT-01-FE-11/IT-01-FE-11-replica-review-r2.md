# UI 复刻评审报告 r2（第 1 次重评）

> 由 frontend-replica-review subagent 输出。仅列未对齐点清单，不打分、无 PASS/FAIL。commands/frontend.md 主 agent 据此逐条判断必修项。

---

## 元数据

| 字段 | 值 |
|---|---|
| 任务 ID | IT-01-FE-11 |
| 任务文件 | `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-01/FE-11.md` |
| 评审时间 | 2026-10-01（r2） |
| 评审者 | frontend-replica-review subagent（r2 重评） |
| 实现图 | `D:/code/typora/process-docs/ui-ux-redesign/reports/IT-01-FE-11/IT-01-FE-11-impl.png`（1240×1420，196958B，mtime 2026-10-01 17:34——批 G 后新截，晚于 r1 报告 09-30 22:04，图源可信） |
| 校样产物 | `IT-01-FE-11-proof.html`（15429B，mtime 10-01 13:00，批 G 修订版）+ `gen-proof.mjs`（8573B，10-01 12:59，双文件防回退生成器） |
| 设计图 | 无 design.png（设计稿为 .html，按 skill 取稿表直接 Read 源取精确值；禁起浏览器渲染截图，故未产出 PNG） |
| 设计稿源 | `docs/requirements/ui-ux-redesign/ui/ui_07_global.html`（主稿，42078B，09-28 16:28）、`docs/requirements/ui-ux-redesign/ui/ui_02_table_edit.html`（交叉印证，22464B，09-28 16:24） |
| 冻结基准 | `process-docs/ui-ux-redesign/requirement/ac.md`（需求侧，非实现源） |
| 页面路径 | 全局浮层（文案与样式基座） |
| 上一轮 | `IT-01-FE-11-replica-review.md`（r1，5 未对齐点） |

## 评审范围说明（沿用 r1 口径）

本任务为 **i18n 冻结文案与样式 token 基座**，实现图是 proof.html 校样截图（双主题 key/zh/en 文案表 + token 色值清单 + token 消费演示件）。设计稿 ui_07/ui_02 是应用整页原型，与校样的「文案表 + token 样例」布局**不存在整体结构可比面**，① 结构检查不作对照、不计偏差。本报告只列可核对项：④ 冻结文案逐字、③ token 值、② 页面元素表存在性、以及校样演示件与设计稿同名组件的可比样式/文案。

本轮为 r2 重评：按批 G 修订面（确认框标题 / 按钮行 flex-end / 禁用括注 / toast 撤销钮 ghost / --shadow-menu 删除）逐项复核并对 r1 五项标注「收敛/残留/新证据」。

---

## r1 未对齐点逐项标注（5 项）

| r1 # | 区域/元素 | r1 判定 | r2 结论 | 证据 |
|---|---|---|---|---|
| 1 | Token 清单 · `--shadow-menu` | Important：几何/透明度偏离 ui_07 `--shadow-pop`，且引入设计稿不存在的深浅翻值 | **收敛** | token 已删除。proof.html / gen-proof.mjs 全文零 `--shadow-menu` 引用（grep 证实）；双主题 token 清单均为 7 项（toast-bg/fg/border、accent-soft-strong、danger-soft、grid-cell-size/gap），无 shadow 项；toast-sim/menu-sim 改走 `var(--shadow-pop)`、confirm-sim 走 `var(--shadow-modal)`，与 ui_07 消费口径（toast/float-menu→shadow-pop，confirm-modal→shadow-modal）逐值一致。**残余核对面**：`tokens.test.ts` 同步清理状态本轮不可核（禁读实现源），需主 agent 自核 |
| 2 | 确认框 · 标题行缺失 | Important：主功能元素缺失（设计稿 h3「删除表格」未呈现，注册表无标题 key） | **收敛** | 标题行已落：「删除表格」，样式 16px/700/line-height 1.4/margin-bottom `--space-3`，与 ui_07 `.confirm-modal h3` 逐值一致；gen-proof.mjs L89 证实标题取 `zh['ctx.deleteTable']` 冻结 key（复用既有菜单 key，r1「无标题 key」的关切以复用闭合，无需新增 key）；impl.png 双主题均呈现标题行 |
| 3 | 确认框 · 按钮行对齐 | Minor：居中 vs 设计 flex-end | **收敛**（r1 系低缩放误判，批 G 结论成立） | proof `.confirm-actions` = `justify-content: flex-end; gap: var(--space-2)`，与 ui_07 逐值一致；像素取证：浅色卡右缘 x≈456、按钮组（取消+确认删除）止于 x≈432 贴右、左侧留白；深色卡同构（卡右缘 x≈1068、按钮止于 x≈1044）。双主题均右对齐 |
| 4 | Toast · 撤销钮形态 | Important：描边 ghost → 误做实心填充 | **收敛**（形态）+ **残留 1 条微差**（见未对齐清单 #1） | ghost 已落：proof `.undo-btn` = transparent + 1px `--accent` 边框 + accent 字 + 600；像素垂直切片证实**非实心**——浅色钮内里 (31,35,40)=toast 底色透出、上/下边框 (9,105,218)=#0969da、字色 accent；深色钮内里 (31,35,40)、边框 (88,166,255)=#58a6ff。与 ui_07 `.toast .undo-btn` 形态逐值一致。残留：纵向 padding `var(--space-half)`（实测钮高 25px，推断 space-half≈4px）vs 设计 2px |
| 5 | 菜单 · 禁用项括注 | Minor：「（禁用灰显）」≠ 设计「（表头保护）」 | **收敛** | 现值「上移该行（表头保护）」，与 ui_07 `.disabled-item`（L1249）逐字一致；impl.png 双主题均为此串 |

---

## 重点核对面结果

### ① proof.html 三处修订值与设计（ui_07 确认框/toast）逐值一致

| 修订项 | 设计稿值（ui_07） | 校样现值（proof.html + impl.png） | 结果 |
|---|---|---|---|
| 确认框标题 | `.confirm-modal h3`「删除表格」16px/700/1.4/margin-bottom `--space-3` | `.confirm-title`「删除表格」16px/700/1.4/margin `0 0 --space-3`（key 来源 `zh['ctx.deleteTable']`） | 逐值一致 |
| 按钮行 | `.confirm-actions` flex + `justify-content: flex-end` + gap `--space-2` | 同左（proof L33/L141；像素双主题贴右） | 逐值一致 |
| 禁用括注 | 「上移该行（表头保护）」 | 「上移该行（表头保护）」（proof L81/L150） | 逐字一致 |
| （附）确认框正文 | 「删除后可用一步撤销还原，确认删除该表格」 | 同左（key `ctx.deleteTableConfirm`） | 逐字一致 |
| （附）按钮 | 「取消」（`.btn-secondary`：bg `--bg`/border `--border`/color `--fg`）+「确认删除」（`.btn-danger`：bg `--danger`/border `--danger`/color `--on-accent`/600）；btn 30px/`0 --space-4`/`--radius-sm`/13px | proof `.btn`/`.btn-secondary`/`.btn-danger` 声明逐值同；像素红块浅 (209,36,47)=#d1242f、深 (248,81,73)=#f85149，= 双主题 `--danger` | 逐值一致 |

### ② toast demo ghost 描边钮（非实心）

**成立**。像素级双主题确认：透明内里（透出 toast 底色）、1px accent 描边（浅 #0969da / 深 #58a6ff）、accent 字色、600 字重——与 ui_07 `.toast .undo-btn`（`background:transparent` + `border:1px solid var(--accent)` + `color:var(--accent)` + 600）一致，非实心填充。唯一微差为纵向 padding（见未对齐清单 #1）。

### ③ --shadow-menu 已无残留

**proof 侧零残留，收敛**：proof.html / gen-proof.mjs 均无 `--shadow-menu` 字样；token 清单（双主题）仅 7 项；演示件投影改走 `--shadow-pop`（toast/menu）与 `--shadow-modal`（confirm），与 ui_07 全部消费点（L28 `--shadow-pop:0 4px 16px rgba(0,0,0,0.18)`）对齐。**边界声明**：`tokens.test.ts` 的 allowlist/断言同步状态不在本轮证据面（禁读实现源 .ts），无法证实/证伪，需主 agent 或单测口径（tokens.test.ts）自核——此为取证边界，非未对齐点。

### ④ 21 冻结串逐字（r1 已全对，本轮抽查）

抽查 15 条（覆盖全部 AC 来源），对照 ac.md 冻结串 + ui_07 文案，**零偏差**：

| key（proof 样例值） | 冻结基准 | 结果 |
|---|---|---|
| toast.rowInsertedAbove「已在上方插入行（Ctrl+Z 可撤销）」 | AC-OP-02 同串 | 一致 |
| toast.rowInsertedBelow「已在下方插入行（Ctrl+Z 可撤销）」 | AC-OP-01 同串 | 一致 |
| toast.rowDeleted「已删除第 3 行（Ctrl+Z 可撤销）」 | AC-OP-10「已删除第 i 行（…）」 | 一致（i=3 样例） |
| toast.colDeleted「已删除第 2 列（Ctrl+Z 可撤销）」 | AC-OP-10「已删除第 j 列（…）」 | 一致（j=2 样例） |
| toast.rowMovedUp/Down「已上移/下移该行（Ctrl+Z 可撤销）」 | AC-OP-05 同串 | 一致 |
| toast.colAlignCenter「第 2 列对齐：居中（Ctrl+Z 可撤销）」 | AC-OP-08「第 j 列对齐：居中（…）」 | 一致 |
| toast.tableResized「表格缩放为 3×4（Ctrl+Z 可撤销）」 | AC-OP-07「表格缩放为 R×C（…）」 | 一致（3×4 样例） |
| toast.tableDeleted「已删除表格（Ctrl+Z 可撤销）」 | AC-OP-09 同串 | 一致 |
| toast.undone「已撤销」 | AC-OP-12 / AC-ERR-04 同串 | 一致 |
| ctx.deleteTableConfirm「删除后可用一步撤销还原，确认删除该表格」 | AC-RULE-15 冻结串 | 逐字一致 |
| ctx.deleteTableConfirmOk「确认删除」 | AC-ERR-07 / UI-IXD-05 | 一致 |
| err.readonly「文件为只读，无法修改，可另存后编辑」 | AC-RULE-16 冻结串 | 逐字一致 |
| err.autosaveFailed「自动保存失败，文档可另存副本」 | AC-ERR-15 冻结串 | 逐字一致 |
| toast.undoBtn「撤销」 | ui_07 `.undo-btn`「撤销」 | 一致 |
| dialog.cancel「取消」 | ui_07 btn「取消」 | 一致 |

未抽到的 6 条（colInsertedLeft/Right、colMovedLeft/Right、colAlignLeft/Right）r1 已逐字全对，且本轮 proof 表可见值与 r1 记录逐字相同，不计偏差。gen-proof.mjs 从真实 zh.ts/en.ts 读值生成（防回退双文件设计），proof 表值=生成时字典值。

---

## 新证据（非未对齐点，供主 agent 冻结口径）

1. **`--toast-bg` 深色值移动（r1 → r2 变化）**：r1 记录深色 #0d1117（走 ui_07 CSS `.theme-dark --tooltip-bg:#0d1117` 翻值路径）；**本轮 impl.png（批 G 后新截）像素+清单双证：深色 toast 底 = (31,35,40) = #1f2328，与浅色同值（双主题一致）**。现值= ui_07 band-note「toast 规范：深底（#1f2328）…双主题一致」逐字口径；偏离 ui_07 CSS 翻值声明。设计稿两侧本有内部张力（r1 备注 3 已记），两条口径各自有据，**不计未对齐**；但值确已移动（可能是批 G「单稿翻值非契约」口径的延伸落地），主 agent 需知并冻结唯一口径，避免 FE-07 接线时摇摆。
2. **`--fg-disabled` 在位性获渲染证据**（闭合 r1 备注 7 的一半）：菜单禁用行双主题均灰显渲染成功，证明 token 已定义且可消费；具体色值仍未进 7 项 token 清单（清单面限本任务新增项，不计偏差）。
3. **`--danger-soft` 维持 r1 备注 2 口径**：设计稿无直接对应 token（仅 `--danger` #d1242f/#f85149），校样 rgba(209,36,47,0.08)/rgba(248,81,73,0.1) 基色与 `--danger` 双主题一致（像素证实红块基色），透明度为派生值，无对照基准，不计偏差。

---

## 严重度分布（仅供参考，非通过门槛）

| 严重度 | 数量 | 含义 |
|---|---|---|
| Critical | 0 | — |
| Important | 0 | — |
| Minor | 2 | 微小视觉差异 |
| **合计** | **2** | （r1 的 5 项已全部收敛；下列为本轮新发现微差） |

---

## 未对齐点清单（按区域分组）

### Toast 演示件（token swatches · 操作回执）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 1 | Minor | 撤销钮纵向 padding | ui_07 `.toast .undo-btn`：`padding: 2px var(--space-2)` | proof `.undo-btn`：`padding: var(--space-half) var(--space-2)`（像素实测钮高 25px，推断 space-half≈4px） | 上下各约 +2px（形态/边框/字色/字重均已对齐，仅内边距微差；proof 用 token 合宪法「不写裸 px」，设计稿此处为裸 2px） | 二选一：proof/组件纵向 padding 收到 2px 等效；或回设计稿把 2px 收编为 `--space-*` token 后双向统一（推荐后者，消裸值） |

### 确认框演示件（token swatches · 删表确认）

| # | 严重度 | 元素 | 设计稿值 | 实现值 | 偏差 | 修复建议 |
|---|---|---|---|---|---|---|
| 2 | Minor | 演示件容器宽 | ui_07 `.confirm-modal`：`width: 320px` | proof `.confirm-sim`：`width: 300px` | -20px（内部标题/正文/按钮行/内边距/圆角/边框/投影均已逐值对齐，仅外壳宽微差；属校样演示壳几何，非 token 面/非冻结文案面） | 若要求演示件逐值复刻则改 320px；若仅为校样摆位宽度，主 agent 定性为演示壳几何后可不修 |

---

## 取稿与读图备注

- 设计稿类型：html ×2（ui_07_global.html 主稿、ui_02_table_edit.html 交叉印证）；取稿方式：Read html 源读取精确样式值与文案；**未生成 design.png**（禁起浏览器渲染截图）。
- 读图方式：Read PNG（impl.png 1240×1420，双主题并排校样）+ **像素取证**（PIL 只读采样，未写任何文件）：toast 底色/钮边框/钮内里/确认按钮行位置/危险色基色。
- 取证纪律执行：Read 前已核文件名+尺寸+mtime（impl.png 196958B @10-01 17:34 与批 G 时间线吻合；proof 13:00 / gen-proof 12:59 同批；设计稿 09-28 未动）——图源可信，无串图。
- 本轮**未 Read 任何实现源**（.ts/.css 等）；仅 Read 本任务评审对象 proof.html + gen-proof.mjs（调用方明示豁免），二者为校样声明面而非运行时实现。
- ui_02 交叉印证：`--accent-soft-strong` 浅 rgba(9,105,218,0.22) / 深 rgba(88,166,255,0.26)（ui_02 L26/L60 逐值）；网格 22px/2px（ui_02 L437-442）——校样 token 清单值一致（impl.png 双主题列表证实）。
- 已知口径不报（遵调用方）：「冲突待裁决/待定」回显、232px mock 几何、「实机确认框有标题」不升级（只看校样件——校样件本轮有标题，已核）。
- r1 备注 4/5/6 维持：菜单/网格演示件是 token 消费示范非结构复刻；err.* 提示条「另存为…」链接属 FE-07 面不在本任务元素表；toast.copiedTable/tableFormatted/tableUnchanged 属扩展 key。
- 像素取证坐标（供复查）：浅/深 toast 底 (150,1020)/(760,1020)=#1f2328；钮边框 y=1026/1050 切片；浅色确认卡 x≈159-456、按钮组 x≈280-432；深色卡 x≈771-1068、按钮组 x≈933-1044。

---

## 评审者声明

本报告由独立 subagent（frontend-replica-review）基于校样读取、双图视觉对比、像素取证与任务「页面元素」表核对产出。评审者未读取实现源码（proof.html/gen-proof.mjs 为调用方豁免的评审对象）、未启动浏览器、未修改任何文件（本报告除外）。冻结文案核对基准取自需求侧 `process-docs/ui-ux-redesign/requirement/ac.md`（非实现源）。不打总分、无 PASS/FAIL，必修性由主 agent 逐条判断。
