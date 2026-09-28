# 原型自测报告（最终版）— VeloxMark UI/UX 全面交互重设计（HTML 高保真原型）

## 基本信息

- 需求名称：VeloxMark「UI/UX 全面交互重设计」
- 自测时间：2026-09-28（第 2 轮复测 · 修复循环后终评）
- 原型目录：`D:/code/typora/docs/requirements/ui-ux-redesign/ui/`（7 页 HTML）
- 验证模式：HTML 原型（Pencil MCP 不可用）；维度 3「表格精度」按 HTML 渲染精度口径（GFM 对齐 / 零布局抖动声明 / 键位回显排版）
- 目标视口：1280×768
- 真源文件：`prd/PRD.md`（v1.2，M06/M09/M11/M13，AC-01..AC-22）、`prd/menu-tree.md`（52 顶部项 / ⋮ 19 项 / 键位回显矩阵 / 附录 B 计数口径）、`prd/function-tree.md`、`src/renderer/src/styles/tokens.css` + `themes.css`（token 真源）
- 验证方式：独立读取原型源码 + headless Chrome DOM 布局度量（1280×768 注入脚本：溢出/截断/边界/对齐/计数）+ Python 像素探测 + WCAG 对比度计算 + grep 硬契约扫描，不依赖设计方自述
- 验证环境备注：本轮 Read 图像通道持续返回会话级旧缓存（水印自证为第 1 轮图片），截图目测不可用；改以 DOM 度量 + 像素探测 + 源码级核验完成全部判定（可测项覆盖率 100%）

---

## 一、轮次得分对照

| 维度 | 第 1 轮 | 本轮终评 | 变化 | 说明 |
|------|--------|---------|------|------|
| 覆盖度 | 8 | **10** | +2 | 52/52 顶部菜单、19/19 ⋮、data-op 挂载、引用折叠样张补齐 |
| 操作闭环 | 9 | **10** | +1 | 删行/删列确认范围改回真源（toast+一步 undo）后全链路无冲突 |
| 表格精度 | 8 | **10** | +2 | 0px 对齐维持；截断清零；键位回显 8+11 与 Windows 形态全对 |
| 设计规范 | 7 | **9** | +2 | dark --on-accent 统一 #0d1117（7.49:1）过 NFR；残留 ui_04 两处 color-mix 双源 |
| 交互完整性 | 6 | **10** | +4 | 顶部菜单 44→52 定额补齐（P0 关闭）；data-op/待定键/冲突双挂全闭 |
| 视觉一致性 | 5 | **9** | +4 | 菜单根 5 根统一、侧栏 240px、斑马纹 2n、Windows 控件；残留 3 处微截断/双源 P2 |
| **总分** | **43/60（71.7%）** | **58/60（96.7%）** | **+15** | — |

**通过线**：≥54/60 且单项 ≥6 → 本轮 58/60、最低单项 9 → **✅ 通过，放行进入下一阶段**

---

## 二、16 项缺陷回归判定

| # | 级别 | 缺断摘要（第 1 轮） | 判定 | 复测证据 |
|---|------|------------------|------|---------|
| 1 | P0 | ui_04 顶部菜单 44/52 | **fixed** | mi-label 去重 52 项：文件 12 + 清空列表 + PDF…/HTML… + 编辑 12 + 格式 5 + 视图 15 + 插入 4（插入表格…/选区转表格…/Mermaid 图表…/插入 Callout…）+ 帮助 1（Markdown 语法参考），与附录 B 口径逐项吻合 |
| 2 | P1 | ui_05/06/07 菜单根 IA 错误（段落/格式/表格） | **fixed** | 三页源码与截图均改「文件/编辑/视图/插入/帮助」5 根，注释注明「菜单根 5 根」 |
| 3 | P1 | dark --on-accent #ffffff 落 #58a6ff 仅 2.53:1 | **fixed** | 7 页全部声明 light `#ffffff` / dark `#0d1117`；#0d1117@#58a6ff = **7.49:1** ≥4.5:1；遮罩/chip 改用 `--tooltip-bg/fg`（#1f2328/#e6edf3，13.37:1） |
| 4 | P1 | ui_07 mac 键位字形 +「删除该行」标签 | **fixed** | 浮层改为分段 kbd：`<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Enter</kbd>` / `Ctrl+Enter` / `Alt+↑`；标签「删除行」与 menu-tree 一致；全目录 ⌘/⌥/⇧ **0 命中** |
| 5 | P1 | 删行/删列确认框宣称与真源冲突 | **fixed** | 文案改为「行/列删除 toast 告知（Ctrl+Z 一步撤销）；仅删除表格弹确认框」，与 menu-tree §0.5/§4 一致 |
| 6 | P1 | ui_03 ⋮ 菜单未限高 + 删表弹窗出屏 | **fixed** | DOM 实测菜单 `max-height:480px`、`overflow-y:auto`（scrollHeight 755 / clientHeight 478，19 项滚动可达）；弹窗 400×200 @x324–724 / y370–570，完整在 1280×768 内 |
| 7 | P1 | ui_04 格式▸子菜单底裁未上翻 | **fixed** | `.submenu--flip` t=531/b=**689**（5 项全可见），标注「下边缘自动上翻 · hover 延展」 |
| 8 | P1 | data-op 未挂模拟元素 | **fixed** | ui_03 共 25 处 `data-op`：菜单 19 项合同 id 全挂（insertRowAbove/insertRowBelow/moveRowUp/moveRowDown/deleteRow/insertColLeft/insertColRight/moveColLeft/moveColRight/deleteCol/alignLeft/alignCenter/alignRight/cutCell/copyCell/pasteCell/copyTable/formatTableSource/deleteTable）+ 工具栏 6（⊞/⋮/对齐×3/🗑）；`data-table-handle` 全目录 0 命中 |
| 9 | P1 | 外壳不一致（侧栏 220/240/320、斑马纹反转、banner 三套） | **fixed** | 侧栏统一 `--sidebar-width: 240px`（含 ui_05 dim-chip 240px）；斑马纹 6 页统一 `tbody tr:nth-child(2n)`；菜单根/窗口控件/横幅样式以 ui_01 为基准收口（可测项全过） |
| 10 | P2 | ui_02 单元格截断 2 处 | **fixed** | 截断扫描 truncatedCount=**0** |
| 11 | P2 | ui_06 文案/--font-ui/on-accent/color-mix | **partial** | 「跨重启持久（本地偏好存储）」已改；`--font-ui` 全部作字体族使用（语义统一）；`color: var(--bg)` 0 命中；ui_05/06 color-mix 已清 → **ui_04 仍有 2 处 color-mix 软强调色**（残留，见遗留 P2-1） |
| 12 | P2 | ui_07 mac 红绿灯窗口控件 | **fixed** | 改 Windows `─ □ ✕`（ui_05/06 同）；像素探测新截图 mac 红/黄/绿像素 **0** |
| 13 | P2 | 开发者工具键位空显 | **fixed** | 放大/缩小/重置缩放/开发者工具 4 键统一 `is-pending`「待定」，注释「不空显」 |
| 14 | P2 | Ctrl+Shift+T 冲突徽标单挂 | **fixed** | 「冲突待裁决」双挂（reopenClosedTab 与 toggleTheme 两侧 + 放大样张共 3 处） |
| 15 | P2 | ui_01 纵向溢出 24px | **fixed** | overflowY −95（scrollHeight ≤ 视口），溢出 0 |
| 16 | P2 | 引用块折叠无样张 | **fixed** | ui_06 新增「区块 E · 长引用折叠（REN-QUOT-FOLD）」：`.quote-folded` / `.quote-summary` / `.quote-restore` 样张在案 |

**统计：fixed 15 · partial 1（#11）· wontfix 0**

---

## 三、重点回归 5 点（第 1 轮指定）

| 回归点 | 方法 | 结果 |
|--------|------|------|
| 52 项计数 | DOM mi-label 去重 + 附录 B 逐项对照 | ✅ 52/52，含子菜单 打开最近 1 / 导出 2 / 格式 5 |
| 菜单根命名 | 源码抽取 + 截图像素佐证 | ✅ 7/7 页均为 文件/编辑/视图/插入/帮助 |
| dark 对比度 | WCAG 计算 | ✅ #0d1117@#58a6ff = 7.49:1；toast #e6edf3@#1f2328 = 13.37:1；正文/弱文/danger 全过 |
| ui_03 限高与弹窗可视 | getBoundingClientRect + computedStyle | ✅ 菜单 480px 内滚动（19 项可达）；弹窗 400×200 @324,370–724,570 |
| data-op 挂载 | grep 属性扫描 + DOM 列举 | ✅ 25 处，19 合同 id 全覆盖；data-table-handle 0 命中 |

---

## 四、硬契约终检（grep / DOM 全量）

| 契约 | 状态 |
|------|------|
| ⋮ 菜单 5 组 19 项 = 8 有键 + 11 无键（无键右侧留空） | ✅ DOM 实测 itemCount 19 / keyed 8 / keyless 11；分组：行操作/列操作/对齐/单元格/结构删除 |
| 表头保护仅禁 首行上移 / 首列左移 | ✅ disabled 恰为「上移该行」「左移该列」 |
| Shift 升档键族（Ctrl+Shift+Enter / Ctrl+Enter / Ctrl+Shift+←→ / Alt+↑↓ / Alt+←→） | ✅ ui_02 键位卡 + ui_03 菜单 + ui_07 浮层三处一致，Windows 形态 |
| 5 条逐字文案 | ✅ 全字命中：「已插入列（Ctrl+Z 可撤销）」「已撤销」「删除后可用一步撤销还原，确认删除该表格」「文件为只读，无法修改，可另存后编辑」「自动保存失败，文档可另存副本」 |
| NFR：0px 抖动 / hover≥150ms / ≥4.5:1 / ⊞ 20×12 钳制 / 列宽仅显示态 | ✅ 全部声明在案；对比度实测通过 |
| e2e：data-op 随元素、无 data-table-handle | ✅ 25 处 data-op / 0 处 data-table-handle |
| 禁渐变/玻璃拟态 | ✅ gradient/backdrop-filter/blur( 全目录 0 命中 |
| mac 字形/红绿灯残留 | ✅ ⌘⌥⇧ 0 命中；像素探测 mac 三色 0 像素 |
| 表格左缘偏移 | ✅ ui_01 proseLeft=tableLeft=403，**偏差 0px** |
| 画布适配 1280 | ✅ 7 页 overflowX ≤ 0（ui_03 −31、ui_04 −31，第 1 轮 +280/+160 已收口） |

---

## 五、六维终评

| 维度 | 得分(0-10) | 10 分标准 | 扣分原因 |
|------|-----------|---------|---------|
| 覆盖度 | 10 | PRD 所有页面、字段、操作 100% 在原型中体现 | 无扣分：7/7 页、52/52 顶部项、19/19 ⋮、功能树 TBL/MENU/NAV/REN/GLB 均有样张 |
| 操作闭环 | 10 | 所有流程可完整走通 | 无扣分：增/删/移/对齐/单元格/编辑/异常/undo 三入口/Esc 收拢/多选批处理均有 前置→触发→成功→失败 表达 |
| 表格精度 | 10 | 对齐 0px、零抖动、键位回显 100% 合同 | 无扣分：0px 实测、截断 0、8+11 键位、⊞ 20×12 钳制与列宽显示态声明在案 |
| 设计规范 | 9 | token 100% 对齐真源、对比度全过、无违禁样式 | ui_04 残留 2 处 color-mix 软强调色（与 --accent-soft 词汇双源）−1 |
| 交互完整性 | 10 | ⋮ 19 项、顶部 52 项、toast 两态、确认框 complete | 无扣分：44→52 补齐；待定键/冲突双挂/data-op 挂载全闭 |
| 视觉一致性 | 9 | 所有页面风格统一、无模板残留 | ui_05 大纲行 2 处微截断、ui_06 摘要行省略号（摘要行设计可接受）合计 −1；图像通道失效导致纯观感复核降级为像素/度量核验 |

**综合评分：58 / 60（96.7%）**（第 1 轮 43/60 → +15）

---

## 六、通过判定

| 规则 | 判定 |
|------|------|
| 综合评分 ≥ 54/60（90%） | 58/60 → **满足** |
| 无单项 ≤ 4 分 | 最低 9 分 → **满足** |
| 结论 | **✅ 通过 — 放行进入下一阶段** |

---

## 七、遗留缺陷（均为 P2，不阻塞交付）

| # | 位置 | 问题 | 建议 |
|---|------|------|------|
| P2-1 | ui_04_menubar.html 行 86–87 | 2 处 `color-mix(in srgb, var(--accent) 10%/35%, transparent)` 软强调色，与 token 词汇（--accent-soft 系）双源 | 提为 token 单源（如 `--accent-soft` / `--accent-border`）或接受为局部装饰并注明 |
| P2-2 | ui_05_sidebar.html 大纲行 | 「本周进展」sw52/cw43、「（含 3 子节 · 折叠已记忆）」sw144/cw120 两处 ellipsis 微截断 | 加宽 meta 区或将记忆徽标换行/省略优先级调低 |
| P2-3 | ui_06_render_zone.html `.quote-summary` | 长引用摘要行 sw435/cw173 省略号（按「摘要行+展开」契约属正常形态） | 若评审要求摘要更完整可读，加宽至 ~240px 或允许两行摘要 |

---

## 八、验证方法与关键原始值（第 2 轮）

- DOM 布局度量：注入脚本 @1280×768，7 页 `QA_DIAG_JSON` + 定点探针（ui_03 菜单/弹窗、ui_04 子菜单、ui_06 滚动容器）
- 像素探测（Python PIL，不经图像通道）：mac 三色 0 像素（ui_04/05 新截图）
- 计数：ui_04 mi-label 52 unique；ui_03 itemCount 19 / keyed 8 / keyless 11 / disabled 2；data-op 25
- 对比度：#0d1117@#58a6ff 7.49:1；#e6edf3@#1f2328 13.37:1；#ffffff@#0969da 5.19:1；#333333@#ffffff 12.63:1；#d4d4d4@#1e1e1e 11.25:1
- 边界：ui_03 菜单 t208/b688（480 内滚）、弹窗 324,370–724,570；ui_04 子菜单 t531/b689；ui_01 edge delta 0px
- 滚动可达：ui_06 `main.content-wrap` overflow:auto（doc 高 2600 / 视口 539，全部 5 区 + 规则卡可达）
- 第 1 轮问题清单见 git 历史 / 本报告第二节对照表（16 项全部收口 15+1 partial）

*验证人：原型质量验证Agent（独立验证）*
*报告版本：v2.0-final · 2026-09-28*
