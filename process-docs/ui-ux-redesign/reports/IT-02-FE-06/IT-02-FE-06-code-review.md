## IT-02/FE-06 代码审查报告（文件树键盘导航）

**得分：** 94/100（阈值：90）
**状态：** ✅ 通过（无 Critical/Important；5 Minor 入收口批候选，不阻塞）
**基线规范：** code-review SKILL.md + rubric-code-review.md（均已 Read；风格归因前置完成）
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

### 风格归因（前置）

- **已有代码**（已 Read：filetreeRows.ts、outlineKeys.ts、Outline.tsx、pathUtil.ts、filetree/recents.ts、filetree.css、tokens.css、sidebarTokens.test.ts）：纯逻辑模块+同目录单测先例（outlineKeys/filetreeRows）；kbd 焦点 idiom（kbdNav + pendingFocusRef + tabStop + data-nav-index）在 Outline.tsx 既有同构实现；CSS token 消费 var() 零裸值；分隔符无关路径比较（r2 #11）。
- **CLAUDE.md 约定**：strict TS、纯函数配 *.test.ts、:root token 单点、t('ns.key') 双字典、e2e 缝不破坏——新代码全部符合。
- **结论**：风格一致性通过；下列扣分均为客观项（正确性/测试/DRY）。

### 评分明细

| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 功能实现 | 10 | 10 | — | |
| 遗漏需求 | 8 | 8 | — | |
| 需求外多做 | 8 | 8 | — | |
| 需求理解 | 6 | 7 | 虚拟滚动参与模型与契约括注字面不符（-1） | 客观·已留档 |
| 边界/异常 | 5 | 7 | tree-churn 后 focusIndex 错位（-1）；scrollRowIntoView 索引空间错位（-1） | 客观 |
| 职责分离 | 10 | 10 | — | |
| 错误处理 | 10 | 10 | — | |
| 编码风格 | 8 | 8 | — | |
| 测试覆盖 | 7 | 8 | toVisibleRows 无断言 + 环 token 未入守护清单（-1） | 客观 |
| 安全 | 8 | 8 | — | |
| 性能 | 8 | 8 | — | |
| DRY | 3 | 4 | pathKey 同名异义双源（-1） | 客观 |
| YAGNI | 4 | 4 | — | |
| **合计** | **94** | **100** | | |

### 问题清单

| 级别 | 检查项 | 问题 | 位置 | 建议 |
|------|--------|------|------|------|
| Minor | 需求理解 | 契约「虚拟滚动下仅渲染窗口内行参与」字面要求窗口外行不参与移动；实现为全行参与（toVisibleRows 恒 visible:true）+ deferred .focus() 自愈拉入窗口。行为等价偏优且 notes/文件头留档，但与契约括注不一致 | filetreeKeys.ts:157-167、FileTree.tsx:288 | 二选一：改 NAV-sidebar.md §3.1 括注为「全行参与+滚入视口」口径，或按 visible 标志接虚拟窗口（倾向前者，现状 UX 更好）→ 归 doc-reconcile 登记候选 |
| Minor | 边界 | 树数据外部变更（扫描到达/reveal 增行）时 focusIndex 不随 DOM 焦点行的 keyIndex 重算，焦点环/tabStop 可短暂错挂他行；下次 nav 键自愈 | FileTree.tsx:289,526-529 | rows 变更 effect 中用 document.activeElement 的 data-nav-index 重同步 focusIndex |
| Minor | 边界 | scrollRowIntoView 用 keyRows 索引算行位，pendingCreate splice 后渲染位差 1 行（28px），CreateRow 在场时键盘滚入视口偏差一行 | FileTree.tsx:324-339 vs :389-405 | 换算 viewRows 索引（+splice 偏移）或复用 reveal effect 的 viewRows.findIndex 口径 |
| Minor | 测试 | toVisibleRows（模块导出的唯一适配器）无直接断言；--focus-ring-width/offset 未入 sidebarTokens.test.ts SIDEBAR_ROOT_TOKENS 声明唯一性守护（UI-ELEM-01 机器可查缺口） | filetreeKeys.test.ts（缺）、styles/sidebarTokens.test.ts:83-110 | 补 2-3 条 toVisibleRows 映射断言；两 token 加入守护清单 |
| Minor | DRY | pathKey 双源同名异义：pathUtil.ts（仅分隔符归一）与 filetree/recents.ts:26（大小写折叠+去尾分隔符）导出同名函数，语义不同易误用 | src/renderer/src/pathUtil.ts:27、src/renderer/src/filetree/recents.ts:26 | recents 侧改名 recentPathKey 或注明「勿与 pathUtil.pathKey 混用」 |
| Info | 文档 | 实现面超出「涉及文件」表（pathUtil/filetreeRows/tokens.css/Outline.tsx/chrome.css/sidebarTokens.test.ts 等），frontmatter doc-drift: [] 与之矛盾；批共改本身归属清楚（FE-06#N/FE-07#N/FE-08#N/FE-10#N），非 gold-plating | tasks/IT-02/FE-06.md:169-176 | 涉及文件表补录实际触点 |
| Info | 键位模型 | keyRows[cur] 直接索引依赖「cur 来自当前渲染 DOM」不变量，可改用 result.nextIndex 更稳（现行为正确） | FileTree.tsx:370-378 | 结构动作统一取 result.nextIndex |

### 专项核对（scope 注入项）

- **AC-FN-13**：7 键位全实现（resolveKey move/collapse/expand/open/first/last/none），空树/叶子行/正文焦点不劫持（onTreeKeyDown 仅 nav 内冒泡生效；空树走 outline-empty 无 handler；CreateRow/RenameRow stopPropagation），焦点移动不触发 onOpen（仅 Enter）。✅
- **UI-ELEM-01**：环规则全 var()（filetree.css:219-224）；2px/-2px 已收口 --focus-ring-width/offset（tokens.css:91-92）；三态 hover --bg-inset / kbd-focus 环 / active --accent-soft 可区分；r2 #11 分隔符无关 active-follow 修复有测试（pathUtil.test.ts:35-54）+ setHasPath 兼容旧单测。✅
- **i18n**：FE-06 无新增 key；tree.* 既有 key en/zh 对齐（zh.ts:153-179 ↔ en.ts:155-181）；字形 ▾/▸/· 与 fold.ts/outlineKeys.ts 惯用一致。✅
- **AC-FN-07/AC-RULE-11**：本任务零快捷键字面量/零菜单回显面，无新增双源。✅
- **测试**：23 用例与自述一致，7 个动作分支各有断言（TDD 声明未独立复跑，静态核对用例覆盖完整）。

### 结论

契约键盘面、roving tabindex、焦点环 token 化、拖拽/Esc/活动行滚入共存均落地且与 Outline 同构 idiom 一致；扣分集中于 4 个 Minor（契约括注口径、churn 错位、索引空间、双源命名）与 1 个测试守护缺口，无 Critical/Important。**94/100 ≥ 90，通过。** 修复优先级（收口批参考）：scrollRowIntoView 索引空间 > focusIndex 重同步 > token 守护/断言补录 > pathKey 改名。
