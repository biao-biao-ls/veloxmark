## 代码审查报告 — IT-02/FE-04 菜单弹层限高滚动与边缘翻转

**得分：** 96/100（阈值：90）
**状态：** ✅ 通过（无 Important；3 Minor 入收口批候选，不阻塞）
**基线规范：** code-review/SKILL.md + rubric-code-review.md + eval-loop/prompts/reviewer.md（前端，通用 90 阈值）
**评审范围：** `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/frontend/src/renderer`（popup.ts / popupOverflow.test.ts / MenuBar.tsx / EditorContextMenu.tsx / chrome.css / context-menu.css / menuLayout.ts / useHushLayer.ts / i18n）；任务文件 `D:/code/typora/process-docs/ui-ux-redesign/tasks/IT-02/FE-04.md`
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）

- **已有代码风格**：editor/contextMenu/ 小文件纯逻辑模块 + 同目录 `*.test.ts`（keyboardNav/menuSkeleton 先例）；组件只做量测与应用；CSS token 色值 + 几何裸 px（chrome.css/context-menu.css 既有全篇如此）；中英混注；e2e 契约类名保留（menu-sub--flip / itemTestId）。
- **CLAUDE.md**：纯函数单测、token 唯一声明、i18n `t()` 双字典、禁 `.theme-dark` 补丁、禁 App.tsx 堆逻辑——新代码均符合。
- 判定：新代码与已有代码/CLAUDE.md 一致；风格类不扣分，客观项照扣。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 功能实现 | 9 | 10 | 外点焦点回退有 focusable 例外（见 P2） | 客观（AC 字面偏差，已注释裁决） |
| 遗漏需求 | 8 | 8 | 无——限高/双轴翻转/hover 桥/四关闭路径/640×400/基座同源/交付图均在 | — |
| 多做需求 | 8 | 8 | 键盘滚入可视区为 FE-05 联动且服务于「全项可达」，非多余 | — |
| 理解正确 | 7 | 7 | 契约形状与「期望数据」逐字一致；超界滚动语义补录 CHANGE-6（原文未定义） | — |
| 边界异常 | 6 | 7 | MIN_PANEL_MAX_HEIGHT 钳底可越出视口（P3）；禁用子菜单父行 hover 未挡（P1） | 客观 |
| 职责分离 | 10 | 10 | popup.ts 纯几何收口，MenuBar/EditorContextMenu 只量测应用 | — |
| 错误处理 | 9 | 10 | P1 同上；focusEditorBody 无编辑面静默降级、焦点竞态补一拍均到位 | 客观 |
| 项目风格 | 8 | 8 | 与 keyboardNav/menuSkeleton 模式同型 | — |
| 测试覆盖 | 8 | 8 | popupOverflow.test.ts 17 条真行为断言（双翻转向/公式/超界/落点/640×400），无 mock | — |
| 安全 | 8 | 8 | 无注入面（[data-op] 选择器用内部 id）；React 转义文案 | — |
| 性能 | 8 | 8 | 量测仅 open/resize，监听器清理干净，scroll 处理轻量 | — |
| DRY | 3 | 4 | wheel 超界收口逻辑两组件各写一份（P4） | 客观 |
| YAGNI | 4 | 4 | maxHeightCap/margin/reservedTop 参数均被消费（表格 480 上限等） | — |
| **合计** | **96** | **100** | | |

### 问题清单

| severity | item | detail | location | suggestion |
|---|---|---|---|---|
| Minor | 禁用子菜单父行 hover 守卫 | Chromium 对 disabled 按钮仍派发 mouseenter，onRowEnter 无 disabled 守卫会为禁用父行展开子菜单（当前菜单数据无禁用父行，理论态） | MenuBar.tsx:345 | onRowEnter 首行加 `if (item.disabled) return`（对照 runItem:97 与 EditorContextMenu runItem:250 的守卫） |
| Minor | 外点焦点回退与 AC-FN-10 字面偏差 | closeIfOutside 对 focusable 目标（button/input 等）不回焦正文——工程上正确（目标应持有焦点），但 AC 字面为「外点后焦点回正文」 | MenuBar.tsx:133-138 | 在 change-log 补一条裁决注记（同 CHANGE-6 体例），或 AC 侧补「点击落于可聚焦目标时该目标持有焦点」例外 |
| Minor | DRY：wheel 超界收口重复 | detectOverscrollSelection→close 的 wheel 处理在两组件内联重复约 12 行 | MenuBar.tsx:237-249、EditorContextMenu.tsx:326-337 | 抽 `popup.ts` 共享 helper（如 `overscrollEdge(e)`），两处调用 |
| Info | MIN_PANEL_MAX_HEIGHT 钳底越界 | chosenSpace<96 的病理锚点时面板可越出视口边 ≤(96−chosenSpace)px；注释已声明取舍（保可滚动操作带） | popup.ts:21,87 | 可维持现状；若收紧，钳底改为 `Math.min(96, chosenSpace)` 并测补 |
| Info | CSS 裸 px 几何值 | 新增滚动条 4px/999px、桥 7px 等为裸 px——与同文件既有风格一致（优先级 1 认可），仅提示 CLAUDE.md「不写裸 px 新值」存在张力 | chrome.css:167-186,292-306 | 不扣分；后续 token 化（--space-*）可随样式专项统一 |
| Info | i18n 文案微差 | `menu.grp.dangerBadge` zh「危险组」vs en「DANGER」体例不对称（徽标语 vs 标签语），系 FE-03 既有面 | zh.ts:128、en.ts:129 | 非本任务改动，转存量记录即可 |
| Info | 并发修复批文件只读快照 | useHushLayer.ts 属并发修复批；本快照中 collapseAll→focusBody 与 FE-04 的 Esc 焦点合同自洽，未据此下重结论 | useHushLayer.ts:94-110,179-181 | 修复批收敛后如触及 close/focus 合同，复核 Esc 路径焦点回正文 |

### 专项核验（任务指定）

- **AC-FN-07/AC-RULE-11 快捷键回显单源**：✅ `menuLayout.ts:170` 回显 = `fmtShortcut(Command.shortcut)`，键位与回显同源；`shortcutDisplay.test.ts`/`shortcutMatch.test.ts` 钉死「有键 100% 回显、无键留空、mac 转换」。darwin 双源残留属 BE-01 存量，不重复深挖。
- **i18n key 对齐**：✅ `menu.*` 系列 en/zh 全对齐（含 `menu.grp.dangerBadge`），对齐测试守护。
- **字形「▸」**：✅ 子菜单箭头统一 `▸`（MenuBar.tsx:534 / EditorContextMenu.tsx:92），与 Outline/FileTree 家族一致。
- **hover/禁用落点（FE-01/02/03 遗留关注面）**：禁用行 `:hover:not(:disabled)`/`:disabled` 不高亮不落点（chrome.css:234-258、context-menu.css:63-75）；hover 死区由 menu-sub-bridge 桥接（MenuBar.tsx:593-609）；本任务无 toast 面。
- **交付物**：`reports/IT-02-FE-04/IT-02-FE-04-impl.png` + `flip-up.png` + `flip-left.png` 存在（命名走仓库 IT-XX-FE-YY 惯例，覆盖任务要求的上翻+左翻断言面）。

### 需求合规要点（已读码验证，不采信自述）

- 限高公式落地 `popup.ts:75`（可视高−菜单栏高−边距），并钳所选侧可用空间 + maxHeightCap；测试 `popupOverflow.test.ts:69-79` 钉公式值。
- 贴下缘→placement=top、贴右缘→submenuPlacement=left 断言在 `popupOverflow.test.ts:49-67`；子面板 fixed 逃逸 overflow 裁切的理由与几何收口在 `popup.ts:138-159`，类名契约（menu-sub--flip / velox-ctx-sub--flip/--up）保留可探针。
- 四条关闭路径：选中（MenuBar.tsx:96-106 action 先于 close）、Esc（hush consumeTop→collapseAll→focusEditorBody）、外点（MenuBar.tsx:126-146）、超界滚动（MenuBar.tsx:237-249 / EditorContextMenu.tsx:326-337），后三条焦点回正文。
- resize 重算（MenuBar.tsx:217 / 508）；窗口移动无需重算（视口坐标不变），与元素表意图相容。
- EditorContextMenu openKey 渲染期重置（EditorContextMenu.tsx:121-136）与 focus 竞态补拍（popup.ts:196-206）解决了自述第 5/6 条所列缺陷，且代码可复核。

### 结论

96/100 ≥ 90：**通过**。核心能力（popup 基座横向化、双轴翻转、限高滚动、四关闭路径、焦点归还、17 条纯函数测试）实现完整且与 AC/契约一致；3 个 Minor（禁用父行 hover 守卫、外点焦点例外注记、wheel 收口 DRY）建议顺手收口，不阻塞。
