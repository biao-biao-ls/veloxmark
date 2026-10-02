## 代码审查报告 — IT-02/FE-05 菜单与子菜单键盘遍历

**得分：** 93/100（阈值：90）
**状态：** ✅ 通过（唯一 Important 为 fix-biz-PATH06 扩展-6 在修项，收敛后单测口径即闭合）
**基线规范：** code-review/SKILL.md + eval-loop/prompts/reviewer.md + rubric-code-review.md（前端通用 90 分档）
**评审对象：** `src/renderer` 下 FE-05 实现（MenuBar.tsx / contextMenu/keyboardNav.ts(+test) / styles/chrome.css 菜单分区），非任务文件自述
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）
- 已有同类代码（MenuBar.tsx、EditorContextMenu.tsx、contextMenu/*.ts、useHushLayer.ts、menuLayout.ts、chrome.css/context-menu.css、keyboardNav.test.ts 等 9+ 份实读）：纯逻辑模块+同目录单测（outline/table 先例）、CSS token 分区、bus 单例、`t()` 文案、注释双语体例——新代码全部对齐，风格零扣分。
- CLAUDE.md（根+renderer）：token 唯一声明、禁裸 ipcRenderer、纯函数单测、e2e 缝不动——均遵守。
- 客观项（正确性/测试/性能/安全）不受归因保护，照常扣分。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 功能完整性 | 10 | 10 | 五键遍历/子菜单进出/禁用跳过/作用域隔离/FE-04 滚入/三态/同源 runItem 均落地 | — |
| 遗漏需求点 | 8 | 8 | 涉及文件 4 项全交付（keyboardNav.test.ts 即「或纯逻辑单测」），截图证据齐 | — |
| 多做需求 | 8 | 8 | 无超范围；openActiveIndex 与 EditorContextMenu 同口径系 FE-04 r2 协同 | — |
| 需求理解正确性 | 5.5 | 7 | keyboardNav 两级 Esc 合同误读源 AC（在修批，见 I-1）；空子菜单 Enter 偏差（M-3） | 客观（合同正确性） |
| 边界与异常场景 | 5.5 | 7 | 空子菜单/禁用/循环/越界/模态堆叠覆盖好；Tab 落面板层级错位（M-2） | 客观 |
| 职责分离 | 10 | 10 | keyboardNav 零 DOM 纯模型 / MenuBar 接线 / SubMenuHost 几何，收口清晰 | — |
| 错误处理 | 8 | 10 | disabled/空表/越界 parentIndex 均兜底；nav 状态错位缺口（M-2） | 客观 |
| 编码风格与模式 | 8 | 8 | navRef/单测/注释/token 全对齐既有模式 | 已有代码一致 |
| 测试覆盖 | 6.5 | 8 | 纯模型 22+ 断言扎实（含编译期形状对齐）；但钉死过时 Esc 合同（I-1）；DOM 接线按项目惯例免测 | 客观（测试钉错合同） |
| 安全 | 8 | 8 | 全 React 文本渲染，无 innerHTML/注入/用户可控串外传 | — |
| 性能 | 8 | 8 | rootItems useMemo、滚入仅 getBoundingClientRect 级开销、cycle O(n) | — |
| DRY | 3 | 4 | 子菜单 child 点击双写 runItem 执行序列（M-4） | 客观 |
| YAGNI | 4 | 4 | 两级菜单上限硬约束，无投机功能 | — |
| **合计** | **93** | **100** | | |

### 问题清单

| severity | item | detail | location | suggestion |
|----------|------|--------|----------|------------|
| Important（在修批·勿重结论） | Esc 合同双口径 | keyboardNav 两级 Esc（子菜单 Esc 收拢不关）+ 其测试钉死该口径，与源 AC `ac.md:68` AC-RULE-02「子项选择/Esc/外点后整个菜单关闭」及 `MENU-menubar.md:32` menu:state-machine「Esc 终态必关闭」冲突；稳定消费面 MenuBar.tsx:160-166、EditorContextMenu.tsx:301-309 均走 hush 一键关闭（**符合源 AC**）。并发批已列「Esc 两级死合同改一键到底」 | keyboardNav.ts:174-181、keyboardNav.test.ts:163-171、任务文件 FE-05.md 阶段2 自测行/implementation-notes 7 | 并发批收敛后：keyboardNav Escape 分支一律 `close`，测试改钉一键关闭；同步修订任务文件「子菜单 ←/Esc 收拢回一级」→「← 收拢、Esc 全关」（AC-RULE-02 本义） |
| Minor | Tab 落面板时 nav 层级错位 | submenu 展开时 Tab 进一级面板行，`onFocus`/`onFocusRow` 只 set activeIndex 不收拢 level，state 停留 `level:'submenu'` → childActive 误高亮子项（:370-372），方向键在子层移动 | MenuBar.tsx:390、:361/:529 | onFocus/onFocusRow 与 onMouseEnter 同款收拢（`setNav({level:'menu',...})`） |
| Minor | 空子菜单 Enter 走 run 关闭菜单 | `hasNavSubmenu` 为 false 时 Enter/Space 落到叶项语义 `effect:'run'` → runItem 关闭；任务异常表要求「不展开，保持一级」。生产菜单树（menuLayout recent/export/format）无空子菜单，理论态 | keyboardNav.ts:217-218、keyboardNav.test.ts:143-148（仅断言 level 未断言 effect） | 空 submenu 项 Enter/Space 改 no-op（或明确改口径并更新任务异常表）；测试补 effect/rootIndex 断言 |
| Minor | 子菜单 child 点击双写执行序列 | child onClick 手写 disabled-guard+action+onPick，与 runItem（action→close，UX-P04 F4b 注释双份）重复 | MenuBar.tsx:577-582 vs MenuBar.tsx:96-106 | child onClick 收口到 runItem（onPick≈closeAll 已同参） |
| Info | 任务文件叙述漂移 | implementation-notes 5 称「--accent 底+--on-accent 环」，实际 chrome.css 为 `--bg-inset` 填充+`--accent` 内环（注释 adjudicated design-wins）；replica-review-r2 #2 另记项环渲染透明度取证疑点 | FE-05.md:46-49、chrome.css:239-246 | 对齐注记文案；补一张根钮环+项环同框复验图（r2 建议） |
| Info | hover 部分可见项触发滚入理论微抖 | 滚入 effect 对 hover 驱动的 activeIndex 同样生效，边缘部分可见项滚入后 hover 目标可能易主 | MenuBar.tsx:224-233 | 如实测抖动，仅对键盘导航迁移触发滚入 |

### 兼核面结论（范围提示项）
- **i18n**：FE-05 零新增文案 key；标签全走 `t()`（menuLayout.ts:106/125/169）；「▸」与 EditorContextMenu.tsx:92 同字形同槽位（submenu 指示符，非快捷键占位符，AC-FN-07「无键右侧为空」合规）；「✓」同为字面量既定口径。
- **AC-FN-07/AC-RULE-11 快捷键回显**：`menuLayout.ts:170` 自命令注册表 `fmtShortcut` 单源派生，无键不渲染占位（MenuBar.tsx:401 条件渲染），shortcutSync.test 守护派生——合规；已知 searchInFolder tooltip 键面双源按指示不展开。
- **FE-04 滚动联动合同**：MenuBar.tsx:224-233 手工 scrollTop 只调含激活项面板（`closest('.menu-dropdown')`，子面板 fixed 亦命中），level 守卫（:318-328）+ scroll 不冒泡，不触发根面板「滚动收拢子级」路径；「滚到底不越界」为精确 delta 钳制——与 FE-04 合同一致。
- **Q8 兜底（EditorContextMenu）**：flatten+enabled 循环、openActiveIndex/cycleNavIndex 同语义、Esc 走 hush 一键、data-op 缝未动——与 keyboardNav 模型对齐，未违规改动。

### 结论

93 ≥ 90，**通过**。核心键盘通道（AC-RULE-02/09、AC-FN-10、UI-IXD-11、UI-ELEM-04）实现与源 AC 一致、纯模型测试扎实、五面同源收口单一 runItem；唯一 Important 为 keyboardNav 遗留两级 Esc 死合同（稳定面已合规，且 fix-biz-PATH06 并发批正按「一键到底」收敛）——主 agent 已扩围：该批一并更新 keyboardNav.test.ts 与任务文件 FE-05.md 阶段2 自测行/注记 7。三条 Minor（Tab 层级错位、空子菜单 Enter、child 点击双写）入收口批候选，不阻塞。
