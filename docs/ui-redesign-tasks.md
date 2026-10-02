# ui-ux-redesign 总看板（ui-redesign-tasks.md）

> **定位**：VeloxMark「UI/UX 全面交互重设计」的统一任务清单（PRD 术语表「总看板」本体）。对应 PRD 5.3 交付主流程 **E 步骤**（总看板 ui-redesign-tasks.md 分期 SDD 改造）→ F（逐项 spec→plan→implement→converge）→ G（对照走查）→ H（验收：四项成功指标）→ I（终点：交付完成，迭代池另立）。
> **期分组真源**：PRD 11 版本规划（M15）+ tech-design §7.1 迭代总览。任务明细与状态：`process-docs/ui-ux-redesign/tasks/IT-01..IT-04/task-list.json`（task-cli 统一维护）。
> **收敛声明（AC-FN-34）**：既有看板 [refactor-tasks.md](refactor-tasks.md)、[markdown-ux-optimization.md](markdown-ux-optimization.md) 的条目去向已逐项核对（见文末「既有看板收敛对账」）——范围内条目全部收敛入本看板无遗漏，迭代池条目显式标注「另立需求」。
> **验收真源**：`docs/requirements/ui-ux-redesign/ac.md`（v1.4，AC-PEND-01..16 已裁决转正）。
> **登记**：本看板由 ui-ux-redesign/IT-04/FE-01 建立（2026-09-30）。

---

## 期 1 规范与原型（前置门禁，T+1 周）——已闭

PRD 5.3 步骤 A→D（立项 / 设计规范草案五部分 / UI 高保真原型 / 用户评审）。**评审通过前不启动实现阶段代码改造**（AC-FN-27 前置门禁，已满足）。

| 交付物 | 状态 | 证据 |
|---|---|---|
| 《UI/UX 设计规范》五部分定稿评审（视觉原则 / 交互模式库 / chrome 规范扩展 / 快捷键总表 / 信息架构；快捷键总表为菜单提示唯一派生源） | 已闭（分布式载体定稿） | AC-FN-26 留档 `process-docs/ui-ux-redesign/reports/IT-04-FE-01/IT-04-FE-01-period1-gate.md` |
| UI 高保真原型用户评审 | 已闭（58/60 通过，2026-09-28） | ui/ui-ux-redesign-ui-test-report.md v2.0-final |

---

## 期 2 表格与全局 P0（IT-01，T+2 周）

tech-design §7.1 期 2：TBL、GLB、STORE ｜ PRD M15：表格五缺陷清零、Shift 升档键位、同源三入口、toast+undo、仅删表确认、一键回安静。

| 任务 | 标题 | 关键裁决 / AC |
|---|---|---|
| IT-01/FE-01 | 表格结构操作语义改造（表头身份迁移/删首行下移/参差补齐矩形/最小结构禁用/单事务） | AC-PEND-07 / AC-PEND-11 / AC-PEND-12、AC-RULE-07/08 |
| IT-01/FE-02 | 表格结构操作键位改造（Shift 升档 3 键/Ctrl+Shift 分流/Ctrl+Enter 专职插行/非回归） | AC-PEND-03 / AC-PEND-13、AC-RULE-06 |
| IT-01/FE-03 | 去增删把手与 data-op 契约迁移（删4留1/左侧留白清零/工具栏⋮挂 data-op） | AC-RULE-17、AC-FN-01/02 |
| IT-01/FE-04 | 表格工具栏与 ⋮/右键同源菜单（五组分组/回显单源/禁用规则/键盘通道兜底） | AC-FN-05、AC-PEND-06、AC-RULE-09 |
| IT-01/FE-05 | ⊞ 网格选择器可选范围改造（max(20,R0)×max(12,C0) 动态上界/拖选缩放/超限表可选） | AC-RULE-12、AC-ERR-13、AC-OP-07 |
| IT-01/FE-06 | 列宽拖拽右邻吸收改造（总宽不变/最右列例外/列宽钳制/防误触） | AC-PEND-10、AC-OP-11、AC-ERR-03 |
| IT-01/FE-07 | toast 动作按钮能力（useToast+ToastHost/5s 驻留/撤销按钮/多 toast 队列） | AC-PEND-05、AC-FN-06、UI-ELEM-03 |
| IT-01/FE-08 | 仅删表确认流（删行/列无确认+确认框冻结文案/Esc 仅关最上层） | AC-PEND-16、AC-RULE-15、AC-OP-10 |
| IT-01/FE-09 | useHushLayer 一键回安静与模态叠加（Esc/空白分层收拢/确认框最上层优先） | AC-PEND-04、AC-FN-21 |
| IT-01/FE-10 | 静息零 chrome 与防抖零抖动（显隐收口/≥150ms 防抖/0px 位移） | AC-FN-23/33、AC-NF-04/05、UI-ELEM-05 |
| IT-01/FE-11 | 冻结文案 i18n 双字典与样式 token 基座（toast/确认文案 key 双写对齐/新浮层 token） | AC-FN-28、UI-ELEM-01/03 |
| IT-01/INFRA-01 | e2e 契约 delta 探针同步（data-table-handle 删4留1 登记与断言迁移） | AC-RULE-17、AC-FN-09 |

---

## 期 3 菜单栏与左导航（IT-02，T+4 周）

tech-design §7.1 期 3：MENU、NAV ｜ PRD M15：菜单信息架构重排、快捷键回显单源、键位归属清理、键盘通道补齐、折叠记忆。

| 任务 | 标题 | 关键裁决 / AC |
|---|---|---|
| IT-02/FE-01 | 菜单信息架构重排（menuLayout 五根菜单分组/插入域去重/命名统一，命令 id 不变） | AC-FN-09/35 |
| IT-02/FE-02 | 快捷键回显单源派生与双源守护（fmtShortcut 派生固化 + shortcutSync.test） | AC-RULE-11、AC-NF-06 |
| IT-02/FE-03 | 键位归属清理与补注册（Q6 Ctrl+Shift+T 独占 + Q7 zoom×3/DevTools 注册表侧） | AC-PEND-01 / AC-PEND-02 |
| IT-02/FE-04 | 菜单弹层限高滚动与边缘翻转（下拉/子菜单全项可达 + 四条关闭路径） | AC-RULE-10、AC-FN-08/10、AC-NF-08 |
| IT-02/FE-05 | 菜单与子菜单键盘遍历（方向键遍历/Enter 执行/Esc 关闭，Q8 菜单键盘化兜底） | AC-PEND-06、UI-IXD-11 |
| IT-02/FE-06 | 文件树键盘导航（filetreeKeys 纯逻辑模块 + roving tabindex + 单测） | AC-PEND-08、AC-FN-13 |
| IT-02/FE-07 | 大纲平滑跳转与 active 跟随（useOutlineNav 抽离，App.tsx 一行转发） | AC-FN-11、UI-IXD-13 |
| IT-02/FE-08 | 大纲键盘导航（roving tabindex + ↑/↓/←/→/Enter，折叠写 headingFolds） | AC-PEND-08、AC-FN-30 |
| IT-02/FE-09 | 折叠记忆口径统一（headingFolds 跨重启持久 + 失效清洗 + 不写正文收口） | AC-RULE-14、AC-FN-25/30 |
| IT-02/FE-10 | 侧栏视觉 token 化审计（焦点环/三态取 token，深浅主题对照走查） | AC-FN-12、UI-ELEM-01 |
| IT-02/FE-11 | 功能缺口取舍清单登记（Q9：大纲排序/节点多选登记不实现，功能树联动标注） | AC-PEND-08、AC-FN-13 |
| IT-02/BE-01 | 加速键单源收敛（Q6 toggleTheme 撤键 + Q7 zoom×3/DevTools 四键迁入 DARWIN_COMMAND_ACCELERATORS） | AC-PEND-01/02、CHANGE-7 |
| IT-02/BE-02 | macOS 原生菜单分组与文案对齐（menu-tree 附录 A + NATIVE_MENU_STRINGS 新分组名 en/zh） | AC-FN-09（CHANGE-4）、AC-FN-28 |

---

## 期 4 渲染区（IT-03，T+6 周）

tech-design §7.1 期 4：REN、STORE ｜ PRD M15：渲染区高收益交互（图片/链接/列表任务项/标题折叠）+ 公式/代码/mermaid 审计微调。

| 任务 | 标题 | 关键裁决 / AC |
|---|---|---|
| IT-03/FE-01 | 渲染区文案与样式 token 基建（i18n 双字典回执键 + 浮层/折叠样式分区） | AC-FN-28、UI-ELEM-01 |
| IT-03/FE-02 | SessionState.quoteFolds 字段与 sanitizer 白名单扩展（含 store.test 用例） | AC-PEND-09、Q10 双键平铺、AC-NF-14 |
| IT-03/FE-03 | hover 浮层/微操作防抖基座与退出纪律（≥150ms、不遮挡、位移 0px、无残留） | AC-NF-04、AC-FN-14 |
| IT-03/FE-04 | 图片编辑浮层（尺寸拖拽/对齐按钮写 .md 图片语法 + undo + 回执） | AC-OP-13、UI-IXD-10；**收敛自 markdown-ux 11.1** |
| IT-03/FE-05 | 链接 hover 浮层（编辑 URL 写回 .md / 外开 / 复制完整 URL） | AC-FN-19、AC-OP-14、UI-IXD-07；**收敛自 markdown-ux 11.2** |
| IT-03/FE-06 | 列表行首拖拽排序与任务项勾选（把手按需浮现、层级不变、轻量口径） | AC-OP-15/16、UI-IXD-08/09；**收敛自 markdown-ux 11.4** |
| IT-03/FE-07 | 标题折叠/展开（含全部子章节 + 大纲双向同步 + 复用 headingFolds） | AC-FN-15/30、UI-IXD-06；**收敛自 markdown-ux 11.5** |
| IT-03/FE-08 | 长引用折叠（useQuoteFold + 摘要行 + quoteFolds 读写，阈值 >5 行） | AC-PEND-09、AC-FN-16、UI-IXD-14；**收敛自 markdown-ux 11.3** |
| IT-03/FE-09 | 点击语义固化与纯选中保护（点击进编辑 / 拖选复制不弹 chrome） | AC-RULE-13、AC-FN-17/18 |
| IT-03/FE-10 | 公式/代码/mermaid 块观感审计微调与非回归（双区/错误态/last-good 保持 + 导出联动核验） | AC-FN-20、AC-OP-17/18/20 |

---

## 期 5 收口（IT-04，T+7 周）

PRD M15 期 5：文档收敛、全域对照走查与验收收口（PRD 5.3 步骤 G→I）。

| 任务 | 标题 | 关键裁决 / AC |
|---|---|---|
| IT-04/DOCB-01 | 文档对齐（后端变更） | doc-reconcile |
| IT-04/DOCF-01 | 文档对齐（前端变更） | doc-reconcile |
| IT-04/FE-01 | 验收基线修订与文档收敛（ac.md PEND 转正/附录别名对账/总看板收敛） | AC-PEND-01..16、AC-FN-26/27/34（本看板建立者） |
| IT-04/FE-02 | 全域对照走查与收尾核验（NF/OP/ERR/ELEM/RULE 专项） | AC-NF-15、AC-FN-12、PRD 四项成功指标 |

---

## 既有看板收敛对账（AC-FN-34）

### docs/markdown-ux-optimization.md

| 条目 | 状态 | 去向 |
|---|---|---|
| ① 7.1 行/列移动操作 | [x] | 已完成基线（改造起点）；结构语义演进收敛入期 2 IT-01/FE-01 |
| ② 7.2 表格结构操作快捷键 | [x] | 已完成基线；键位改造收敛入期 2 IT-01/FE-02 |
| ③ 8.2 公式编辑态源码/预览并排 | [x] | 已完成基线（11A 双区契约保持；期 4 IT-03/FE-10 仅审计微调） |
| ④ 10.1 mermaid 编辑态源码/预览并排 | [x] | 已完成基线（同上） |
| ⑤ 7.5 ⊞ 网格选择器 | [x] | 已完成基线；可选范围改造收敛入期 2 IT-01/FE-05 |
| ⑥ 7.3 编辑态表格工具栏 | [x] | 已完成基线；去把手/同源改造收敛入期 2 IT-01/FE-03、FE-04 |
| ⑦ 9.1 语言 chip 右下角化 | [x] | 已完成基线 |
| ⑧ 8.1 公式 hover 提示带 | [x] | 已完成基线（并入 8B 收敛） |
| ⑨ 7.6 菜单快捷键提示 | [x] | 已完成基线；回显单源/双源守护收敛入期 3 IT-02/FE-02 |
| ⑩ 8.4 KaTeX 错误态跳源码入口 | [x] | 已完成基线 |
| ⑪ 10.3 mermaid 聚焦提示 chip | [x] | 已完成基线 |
| ⑫ 7.7 列宽跨会话持久化 | [x] | 已完成基线；右邻吸收改造收敛入期 2 IT-01/FE-06 |
| ⑬ 9.2 静息态去语言顶栏 | [x] | 已完成基线 |
| ⑭ 10.2 mermaid 静息态去边框盒 | [x] | 已完成基线 |
| ⑮ 7.8 表格静息态零 chrome / 正文列对齐 | [x] | 已完成基线；零 chrome 收口收敛入期 2 IT-01/FE-10 |
| ⑯ 7.10 表格静息态视觉微调 | [x] | 已完成基线 |
| ⑰ 8.3 行内公式 hover 高亮 | [x] | 已完成基线 |
| ⑱ 11.9 块级 chrome 规范定稿 | [x] | 已完成基线（11A 附录 N1-N4 即《UI/UX 设计规范》chrome 规范扩展部分） |
| 11.1 图片编辑体验 | [ ] | **收敛入期 4** IT-03/FE-04（图片编辑浮层） |
| 11.2 链接 hover 编辑浮层 | [ ] | **收敛入期 4** IT-03/FE-05 |
| 11.3 引用块折叠/展开 | [ ] | **收敛入期 4** IT-03/FE-08（长引用折叠，阈值 >5 行） |
| 11.4 列表/任务项 hover 快捷操作 | [ ] | **收敛入期 4** IT-03/FE-06 |
| 11.5 标题锚点/折叠 | [ ] | **收敛入期 4** IT-03/FE-07（标题折叠） |
| 11.6 脚注 hover 预览 | [ ] | **另立需求**（迭代池；PRD M05 Out of Scope） |
| 11.7 行内代码/强调 hover 提示 | [ ] | **另立需求**（迭代池；PRD M05 Out of Scope） |
| 11.8 分隔线/front-matter 观感核对 | [ ] | **另立需求**（迭代池；PRD M05 Out of Scope） |

### docs/refactor-tasks.md

| 条目 | 状态 | 去向 |
|---|---|---|
| 阶段 0-4（0.1~4.5）架构重构全部项 | [x] | 已完成基线（非本期改造面）；其中 4.2/4.3/4.4 落地原可选项 1.7/2.17/1.3 |
| 阶段 5（5.1~5.6）UI 观感 | [x] | 已完成基线（前置）；列表/版心/标题/公式/大纲观感演进见期 2/3 对应项（表格观感演进归 markdown-ux ⑮/⑯，非本阶段条目——收口批指针勘误）、大纲质感进期 3 IT-02/FE-10 |
| 阶段 6（6.1~6.14）左导航 | [x] | 已完成基线（前置）；键盘导航演进入期 3 IT-02/FE-06、FE-08 |
| 1.3 / 1.7 / 2.17 复选框残留 | [ ] | 已由 4.4/4.2/4.3 落地（勾选状态留原样，去向=已完成基线） |
| 6.15 大纲排序切换（文档顺序\|字母序）与条目右键 | [ ] | **另立需求**（迭代池；与 Q9「大纲排序=不实现（拖拽章节顺序）」非同一特性，本期不立项） |
| 6.16 树键盘导航 / 多选 | [ ] | **部分收敛**：键盘导航→期 3 IT-02/FE-06（文件树）+ IT-02/FE-08（大纲）（Q9：键盘导航=实现）；节点多选→**显式不实现**（Q9 留档 prd/gap-tradeoffs.md） |
| 6.17 链接指向目录时侧栏定位 | [ ] | **另立需求**（迭代池） |
| 6.18 SearchPanel `sidebar-mode-seg` 与头部双 tab 冗余消除 | [ ] | **另立需求**（迭代池） |
| 遗留记录三项 | [x] | 已决知情记录（4.1），不进本期 |

---

## 迭代池（另立需求清单）

以下条目在本期显式不立项，待新需求立项后另行排期（PRD 5.3 I 步骤「迭代池另立」）：

| 条目 | 来源看板 | 说明 |
|---|---|---|
| 大纲排序切换（文档顺序\|字母序）与条目右键 | refactor-tasks 6.15 | 与 Q9「大纲排序=不实现（拖拽章节顺序）」非同一特性 |
| 链接指向目录时侧栏定位 | refactor-tasks 6.17 | 6B 落地后可做，低优 |
| SearchPanel 冗余消除 | refactor-tasks 6.18 | 6A 有意零触碰，远期 |
| 脚注 hover 预览 | markdown-ux 11.6 | PRD M05 Out of Scope（新 Markdown 语法支持除外项） |
| 行内代码/强调 hover 提示 | markdown-ux 11.7 | PRD M05 Out of Scope |
| 分隔线/front-matter 观感核对 | markdown-ux 11.8 | PRD M05 Out of Scope |

（另有 Q9 显式不实现项：大纲排序、文件树节点多选——已留档 `docs/requirements/ui-ux-redesign/prd/gap-tradeoffs.md`，不进迭代池。）
