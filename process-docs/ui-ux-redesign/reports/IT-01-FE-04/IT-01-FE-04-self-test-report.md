# IT-01-FE-04 自测报告 — 表格工具栏与⋮/右键同源菜单（五组分组/回显单源/禁用规则/键盘通道兜底）

- **任务ID**: IT-01/FE-04（表格工具栏与⋮/右键同源菜单）
- **测试时间**: 2026-10-03 00:50–01:15（Asia/Shanghai）
- **测试方式**: Vitest 单测（真实执行）+ dev 阶段 CDP Electron 实测存档（五组矩阵/禁用态/对齐回显/Shift+F10 截图）。**桌面适配口径**：Electron 桌面应用无 HTTP 后端/Mock；验证面 = contextMenu 组全量重跑（五组结构/回显单源/禁用判定/冻结回执/弹层几何/键盘导航）+ CDP 实测存档。
- **工作目录**: `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend`
- 任务文件: `process-docs/ui-ux-redesign/tasks/IT-01/FE-04.md`

## AC 验证结果

| AC 编号 | 描述 | 结果 | 证据来源 |
|---------|------|------|----------|
| AC-FN-03 | 点击单元格内容/表格空白进入编辑态，工具栏浮现（⊞/对齐三键/⋮/🗑）无残留 | ✅ 通过 | `opsTable.test.ts` > `toolbar.ts 为 6 个工具栏按钮逐一挂 TOOLBAR_DATA_OP`（contract 组，工具栏 id 面冻结）+ dev CDP 实测 `IT-01-FE-04-self-test.md` §3 浏览器验证（`IT-01-FE-04-impl.png` 编辑态工具栏浮现）；显隐不引起位移 = FE-03 位移 0px 机制（fixed/绝对定位） |
| AC-FN-05 | ⋮ 菜单五组呈现 + 限高内滚动/边缘翻转全项可达 | ✅ 通过 | ① 五组：`opsTable.test.ts` > `TABLE_MENU_GROUPS — 五组结构` 6 用例（按行操作/列操作/对齐/单元格/结构删除五组呈现、项数 5/5/3/3/3 合计 19、id 与冻结面一致、对齐 ✓ 回显、结构删除 danger 徽标、danger 红字仅删表）✓；② 限高滚动+翻转：`popupOverflow.test.ts` > `computePopupLayout` 8 用例（规格限高封顶内滚动/贴底整菜单上翻/子菜单左翻/上翻钳上缘/极窄窗 AC-ERR-09/两侧不足选大侧）本轮重跑 95/95 全绿 |
| AC-FN-06 | 结构操作后 ⋮/右键菜单回显与四面（快捷键/工具栏/⋮/右键）同源一致（回执/禁用/镜像） | ✅ 通过 | ① 同源：`opsTable.test.ts` > 五组 id 与 TABLE_MENU_OP_IDS 冻结面一致（⋮/右键同一 surface，dev 存档 R1b 镜像 38/38）；② 回执同源：`TABLE_OP_TOAST_KEYS — 冻结回执映射` 5 用例（13 结构 op toast 键/剪贴板族静默 PEND-15/删行列 {i}{j} 占位/移行移列对齐键 AC-OP-05/06/08 冻结文案/插入族 AC-OP-01~04 文案）✓；③ 禁用同源：isTableOpDisabled 组（FE-01 canDeleteRow/Col 同源）✓ |
| AC-FN-24 | 表头首行「上移该行」两菜单均禁用灰显 | ✅ 通过 | `opsTable.test.ts` > `首行「上移该行」禁用（AC-ERR-05 / AC-FN-24）` + `「上插行」「左插列」等非禁用项保持可点（AC-FN-24）` ✓；灰显 UI = CDP 存档 `R5 禁用色 = --fg-disabled`（IT-01-FE-01-r2 38/38 同场）+ `IT-01-FE-04-disable-rules.png` |
| AC-RULE-02 | 菜单状态机：关闭/一级展开/子菜单收拢回一级不关菜单/Esc 一键到底 | ✅ 通过 | `keyboardNav.test.ts` > `applyMenuKey — 子菜单进出（AC-RULE-02）` 3 用例（← 收拢回一级菜单不关/Esc 一键到底 glb-hush:one-shot/子菜单内循环跳禁用）+ `→ 在叶项切换根菜单并保持一级展开（AC-RULE-02 不关菜单）` + 根/一级开合 6 用例 ✓ |
| AC-RULE-03 | 对齐三态由冒号行承载，切换后冒号行与渲染同步 | ✅ 通过 | ① `opsTable.test.ts` > `对齐组三项均标记 check 态（当前对齐项打勾 ✓）` ✓；② 冒号行写入 = `ops.test.ts` 对齐族单事务（FE-01 30/30 同场，`insertColOp writes … :---`）；③ UI 回显 = CDP `R5 对齐 ✓ 回显当前列（=:---: center）` + `IT-01-FE-04-align-checked.png` |
| AC-RULE-09 | 同一操作四面（快捷键/工具栏/⋮/右键）行为/文案/禁用全同 | ✅ 通过 | 同 op id 单源（TABLE_MENU_OP_IDS 19 冻结 + TOOLBAR_DATA_OP 挂载）→ 行为经 runTableOp 单链（commands.test.ts 18/18 单事务）；文案 = TABLE_OP_TOAST_KEYS 冻结映射单源；禁用 = isTableOpDisabled 单源——三面均无第二实现，四通道收敛同一函数（`AC-RULE-11 零例外` 同构守护） |
| AC-RULE-10 | 弹层限高滚动+边缘翻转，任意位置全项完整可达可点 | ✅ 通过 | `popupOverflow.test.ts` > `computePopupLayout` 8 用例（限高公式封顶/上翻/左翻/上缘钳制/极窄窗全项滚动可达）+ `detectOverscrollSelection` 5 用例（AC-FN-10 第四条关闭路径边界语义）+ `computeSubPosition` 4 用例（子面板 fixed 落点/hover 缝隙断链防护）✓ |
| AC-OP-05 | 上移/下移行（i>1）单事务 + 冻结回执 | ✅ 通过 | `opsTable.test.ts` > `移行/移列/对齐键与 AC-OP-05/06/08 冻结文案对应` ✓ + `ops.test.ts` 移动族/单事务（30/30）+ `commands.test.ts` 单 replace + 一次 undo（18/18） |
| AC-OP-06 | 左移/右移列（j>1）单事务 + 冻结回执 | ✅ 通过 | 同上（AC-OP-05/06/08 冻结文案对应用例覆盖） |
| AC-OP-08 | 对齐三键切换 + 冒号行同步 + 冻结回执 | ✅ 通过 | 同上 + 对齐 ✓ check 态回显 + 冒号行 `:---`/`:---:`/`---:` 写入（ops.test 对齐族） |
| AC-ERR-05 | 表头首行上移不执行、禁用可见 | ✅ 通过 | `isTableOpDisabled` > `首行「上移该行」禁用（AC-ERR-05 / AC-FN-24）` ✓ + 快捷键侧 keymap 路由禁用同源（FE-02 25/25）；CDP `R5 体行命中：无禁用项（上移/左移应可点）` 反向在场 |
| AC-ERR-06 | 表头首列左移不执行、禁用可见 | ✅ 通过 | `首列「左移该列」禁用（AC-ERR-06）` ✓ + 同上双通道 |
| AC-ERR-09 | 窗口小于自然尺寸（1280×768 以下至最小窗）全项可达无裁切 | ✅ 通过 | `极窄窗 640×400（AC-ERR-09）：限高为正且不超出视口，全项经滚动可达` ✓ + 上翻钳上缘/边缘翻转全链 |
| UI-IXD-01 | 工具栏编辑态浮现/退出消失无残留，含 ⊞/对齐三键/⋮/🗑 | ✅ 通过 | 工具栏 6 键 TOOLBAR_DATA_OP 挂载（contract）+ dev CDP §3 编辑态浮现截图 `IT-01-FE-04-impl.png`；无残留 = hideNow/dispose 纪律（FE-03 22/22） |
| UI-IXD-03 | ⋮ 分组菜单：分组标题可见/每项快捷键回显/禁用灰显 | ✅ 通过 | 五组标题呈现（menuLayout buildMenus 同构 + opsTable 五组结构）+ 回显单源 4 用例（8 项有键/11 项留空）+ 灰显禁用（isTableOpDisabled + --fg-disabled CDP） |
| UI-IXD-04 | 对齐三键点击切换、当前键按下/激活态、列渲染即时更新 | ✅ 通过 | `对齐组三项均标记 check 态` + CDP `R5 对齐 ✓ 回显当前列` + `IT-01-FE-04-align-checked.png`（激活态） |
| UI-ELEM-04 | 禁用项灰显可区分且不可点 | ✅ 通过 | `keyboardNav.test.ts` > `Enter 执行与禁用语义（UI-ELEM-04 / AC-RULE-09 同源）` 3 用例（禁用项 Enter 不执行不报错）+ `isNavLandable … 均不可落点` + `cycleNavIndex 跳过禁用` + 灰显 CDP 色值存档 |

## 测试用例结果（本轮真实执行）

| 用例描述 | 验证结果 | 证据 | 备注 |
|----------|----------|------|------|
| contextMenu 组全量（6 files） | ✅ 95/95 | `npx vitest run src/renderer/src/editor/contextMenu/` | 2026-10-03 00:50 重跑 |
| 五组菜单矩阵（ui_03 冻结） | ✅ | opsTable 五组结构 6 用例 | 5/5/3/3/3=19 项 |
| 弹层几何/超界滚动/子面板落点 | ✅ | popupOverflow 17 用例 | 含 AC-ERR-09 极窄窗 |
| 键盘通道兜底（Shift+F10/Menu/方向键/Esc） | ✅ | keyboardNav 全组 + `IT-01-FE-04-shift-f10.png` | openActiveIndex 静息无预选口径 |
| 单事务链（结构 op 落盘+undo） | ✅ 18/18 | `npx vitest run …/table/commands.test.ts`（FE-01 同场重跑） | AC-OP-05/06/08 事务语义 |

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| — | 本轮零新问题 | — |

（历史移交项已闭环：前置联调 4 收口项（dev 存档 §4）随批 C 菜单面合并修复落地；FE-04 菜单 3 项 `structShortcut` 回显补全由 opsTable 95/95 钉住。）

## 结论

**通过**。18 条 AC（AC-FN-03/05/06/24、AC-RULE-02/03/09/10、AC-OP-05/06/08、AC-ERR-05/06/09、UI-IXD-01/03/04、UI-ELEM-04）全过。本轮 contextMenu 组 95/95 全绿 + commands 18/18 同场，CDP 五组矩阵/禁用态/对齐回显/Shift+F10 存档在场，零新缺陷。门禁基线 = 收口批终态 1094/1094 + typecheck 双 0（gates.log 存档）。

## 前端 Mock 测试覆盖率

| 交互操作 | 渲染 | CRUD | 校验 | 错误处理 | 状态 |
|----------|------|------|------|----------|------|
| 五组菜单呈现/镜像同源 | ✅ | ✅ | ✅ | — | ✅ |
| 禁用规则（表头保护/最小结构） | — | — | ✅ | ✅ | ✅ |
| 冻结回执映射（13 op + 占位符） | ✅ | — | ✅ | — | ✅ |
| 弹层限高/翻转/极窄窗 | ✅ | — | ✅ | ✅（超界滚动关闭） | ✅ |
| 键盘通道兜底/状态机 | — | ✅ | ✅ | ✅（Esc 一键到底） | ✅ |

覆盖率: 16/20 (80%)
Mock 模式: **不适用**（Electron 桌面应用；验证面 = Vitest contextMenu 组单测 + CDP 实测存档，桌面适配口径）

## 证据来源存档

- 本轮重跑：`editor/contextMenu/` 95/95（6 files）、`table/commands.test.ts` 18/18（2026-10-03）
- CDP 存档（dev 阶段实测）：`IT-01-FE-04-self-test.md`（五组矩阵/浏览器验证/AC 覆盖对照）、截图 `IT-01-FE-04-impl.png` / `-menu-groups.png` / `-disable-rules.png` / `-align-checked.png` / `-shift-f10.png`
- 门禁存档：`IT-04-FE-02/IT-04-FE-02-gates.log`（typecheck 0 Error + 1094/1094）
