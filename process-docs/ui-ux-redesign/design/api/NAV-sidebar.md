# NAV 左导航契约（nav-keyboard / nav-folds）

## 1. 概述

| 项 | 内容 |
|---|---|
| 接口域职责 | 左侧导航栏（文件树 / 大纲）键盘导航、折叠态会话记忆、大纲激活态与平滑跳转；功能缺口三候选的取舍登记 |
| 通道类型 | keymap（roving tabindex + 方向键 + Enter）/ 点击（大纲项、折叠三角）/ localStorage（`veloxmark.session.headingFolds`）/ 滚动事件（active 跟随） |
| 类型 | **新增**（文件树/大纲键盘导航）+ **修改**（折叠态跨重启记忆口径收口、大纲跳转平滑）+ **复用**（`headingFolds`、`useFoldSync`、`outline/extract.ts`、fold 双向同步）+ **登记不实现**（大纲排序、节点多选） |
| 裁决来源 | Q9（三候选取舍：仅键盘导航=实现，排序/多选=不实现）、Q10（折叠态继续用 `headingFolds`，localStorage 天然跨重启）、AC-RULE-14（显示态持久化）、AC-FN-13（取舍清单入库） |
| 代码真源（现状） | `src/renderer/src/components/Outline.tsx`、`components/FileTree.tsx`、`hooks/useFoldSync.ts`、`editor/livePreview/fold.ts`、`outline/extract.ts`、`preferences/store.ts`（SessionState.headingFolds） |

---

## 2. 契约清单

| 契约标识 | 通道类型 | 类型 | 说明 | PRD 来源章节 | AC 条目 | 裁决来源 |
|---|---|---|---|---|---|---|
| `nav-keyboard:file-tree` | keymap | 新增 | 文件树 roving tabindex + ↑/↓ 移动焦点 + ←/→ 折叠/展开 + Enter 打开节点；焦点可见 | PRD 6.3 | AC-FN-13（实现项落地） | Q9 |
| `nav-keyboard:outline` | keymap | 新增 | 大纲 roving tabindex + ↑/↓ 移动焦点 + Enter 跳转对应章节 + ←/→ 折叠/展开章节；焦点可见 | PRD 6.3 | AC-FN-13, AC-FN-11 | Q9 |
| `nav-keyboard:focus-visible` | 显示态 | 新增 | 键盘焦点环可见（token 化样式），与 hover/激活态可区分；键鼠双通道可达 | PRD 6.3 | AC-FN-13, UI-ELEM-01 | Q9 |
| `nav-fold:session-memory` | localStorage | 修改 | 折叠态写入 `veloxmark.session.headingFolds`，跨重启持久；不写 .md 正文 | PRD 6.3、PRD M10 | AC-RULE-14, AC-FN-25, AC-FN-30 | Q10 |
| `nav-fold:bidirectional` | 状态同步 | 复用 | 大纲侧折叠 ↔ 正文侧折叠双向同步（任一入口变更即更新另一处视图） | PRD 6.3、PRD 6.4 | AC-FN-30, AC-FN-15 | PRD 冻结 |
| `nav-fold:granularity` | op 语义 | 复用 | 折叠含全部子章节；标题行保留；折叠三角不移动光标 | PRD 6.4 | AC-FN-15 | PRD 冻结 |
| `nav-outline:active-follow` | 滚动联动 | 修改 | 滚动正文时当前可视章节对应大纲项 active 高亮并随滚动切换 | PRD 6.3 | AC-FN-11 | PRD 冻结 |
| `nav-outline:jump` | 点击 | 修改 | 点击大纲项正文定位到该标题（平滑跳转），该大纲项保持 active；目标在折叠区内先自动展开 | PRD 6.3 | AC-FN-11 | PRD 冻结 + 本域细化 |
| `nav-gaps:outline-sort` | — | 登记不实现 | 大纲拖拽排序**不实现**（文档结构重写风险大；剪切/粘贴替代） | PRD 6.3、PRD 12 #2 | AC-FN-13（不实现项登记） | Q9 |
| `nav-gaps:multi-select` | — | 登记不实现 | 文件树节点多选**不实现**（批量文件安全语义成本过高） | PRD 6.3、PRD 12 #2 | AC-FN-13（不实现项登记） | Q9 |

---

## 3. 行为语义明细

### 3.1 文件树键盘导航（`nav-keyboard:file-tree`，新增）

**触发路径**：文件树面板聚焦（Tab/点击进入侧栏）后键盘操作；与鼠标操作并行可用（键鼠双通道）。

| 键位 | 行为 |
|---|---|
| ↑ / ↓ | 焦点在可见行间移动（roving tabindex：仅当前焦点行 `tabIndex=0`，其余 -1；虚拟滚动下仅渲染窗口内行参与） |
| ← | 折叠当前目录节点；已折叠时焦点移至父节点 |
| → | 展开当前目录节点；已展开时移至首个子节点 |
| Enter | 打开文件节点（载入文档标签）/ 切换目录节点展开态 |
| Home / End | 移至首/末可见行（可达性补全） |

**行为规则**：

1. 焦点可见：键盘焦点环使用设计规范 token（焦点态与 hover/激活态三态可区分，UI-ELEM-01）；
2. 焦点移动不触发文件打开（Enter 才执行）；拖拽排序（既有 UX-P07 能力）不受键盘导航影响，Esc 取消拖拽的既有行为保持；
3. 键盘导航与既有「活动文件行自动滚入视口」行为共存：焦点移动同样滚入视口；
4. 只读文件打开仍走既有流程；本契约不改文件 IO 语义。

**禁用规则**：无子节点的文件行 ←/→ 不动作；空树时无焦点行，键盘事件不劫持正文输入（焦点在侧栏才生效）。

**e2e 缝影响**：`data-op="sidebar.ops.*"` 系列 id 不变；键盘导航不新增 data-op 契约（可加 `data-nav-focus` 呈现属性，非契约承诺）。

### 3.2 大纲键盘导航（`nav-keyboard:outline`，新增）

**触发路径**：大纲面板聚焦后键盘操作。

| 键位 | 行为 |
|---|---|
| ↑ / ↓ | 焦点在大纲节点间移动（roving tabindex 同上） |
| Enter | 激活该节点 = 等效点击跳转（§3.5 平滑跳转，active 态随焦点项） |
| ← / → | 折叠 / 展开该章节（等效点击折叠三角；与正文双向同步，§3.4） |

**行为规则**：焦点移动不跳转正文（Enter 才跳）；折叠操作写 `headingFolds`（轻量态切换不回 toast，PEND-15 口径见 GLB §3.6）。

### 3.3 折叠态会话记忆（`nav-fold:session-memory`）

| 项 | 规则 |
|---|---|
| 存储键 | `veloxmark.session` → `headingFolds: Record<filePath, string[]>`（**复用**，Q10：不新增平行键） |
| 键格式 | 每文档的标题折叠 id 集，元素为 `foldKey(level, text)` = `level:text`（`editor/livePreview/fold.ts` 既有格式） |
| 持久口径 | localStorage 落盘即跨重启；标签页切换后与重启后折叠状态均保持（AC-FN-25） |
| 正文隔离 | 折叠为显示态，.md 正文逐字节不变（AC-FN-25/30） |
| 失效清洗 | 标题删除/改名后失效 key 被 `useFoldSync` 清洗（既有签名门控写回，防抖） |
| 读写模式 | 经 `preferences/store.ts` pub/sub + `useSyncExternalStore`（`preferences/useStore.ts` 模式）接入组件 |

### 3.4 折叠双向同步（`nav-fold:bidirectional`，复用）

1. 大纲侧点击折叠/展开入口 → 正文对应章节同步折叠/展开；
2. 正文侧点击标题折叠三角 → 大纲对应节点折叠态同步更新；
3. 折叠粒度：章节含全部子章节；标题行保留；三角指向随折叠/展开切换（UI-IXD-06）；
4. 折叠三角点击只切换折叠、不移动光标（现状行为保持）；
5. 面包屑：点击大纲跳转到折叠区内标题时，目标链路自动展开（现状 `goToHeading` 的 `expandFolds` 行为保持）。

### 3.5 大纲激活态与平滑跳转（`nav-outline:*`）

| 项 | 规则 |
|---|---|
| active 跟随 | 滚动正文过程中，当前可视章节对应大纲项进入 active 高亮并随滚动位置切换（AC-FN-11-1） |
| 点击/Enter 跳转 | 正文滚动定位到该标题（垂直居中视口），该大纲项保持 active 态（AC-FN-11-2） |
| 平滑跳转 | 跳转滚动为平滑动画（`behavior: smooth` 口径），不瞬移、不迷路（PRD 6.3「点击平滑跳转不迷路」）；动画期间 active 态不闪烁 |
| 光标归属 | 跳转后光标落该标题处（现状 `goToHeading` 行为保持），随后键盘输入可直接编辑 |

### 3.6 功能缺口取舍记录（Q9，「不实现」登记）

| 候选 | 裁决 | 理由（Need Gate 口径） | 替代路径 |
|---|---|---|---|
| 大纲排序（拖拽大纲节点调整章节顺序） | **不实现** | 文档结构重写风险大（标题块整段搬运易错位、与折叠态/锚点联动复杂）；去掉后核心用户仍能完成核心任务 | 剪切/粘贴正文段落调整章节顺序 |
| 文件树节点多选 + 批量操作 | **不实现** | 批量文件安全语义成本过高（误删/误移多文件的确认与恢复语义不成比例） | 单节点操作循环执行 |
| 文件树/大纲键盘导航 | **实现** | 键鼠双通道可达是可发现性与可达性基线（AC-FN-13 实现项） | —（本域 §3.1/§3.2） |

**登记效力**：取舍清单随《UI/UX 设计规范》定稿入库；AC-FN-13 的 Given pending 注（AC-PEND-08）解除——三项均有明确裁决、无悬空项；标注不实现的两项在本清单留档即满足 AC-FN-13-3。

---

## 4. 与现有实现差异（现状 → 目标）

| # | 现状 | 目标 | 涉及文件 |
|---|---|---|---|
| 1 | `Outline.tsx` 仅点击交互（onSelect / 折叠三角 onClick），无 tabindex/方向键/Enter 键盘导航 | 新增 roving tabindex + ↑/↓/←/→/Enter + 焦点可见 | `src/renderer/src/components/Outline.tsx` |
| 2 | `FileTree.tsx` 仅有 Esc 取消拖拽的 document keydown；无行级键盘导航 | 新增文件树键盘导航（§3.1） | `src/renderer/src/components/FileTree.tsx`（或抽出 `filetreeKeys` 纯逻辑模块 + 单测） |
| 3 | 折叠记忆已落 `headingFolds`（useFoldSync 写回 + p18 seam），但「跨重启持久」口径在文档间曾有分歧（会话内 vs 跨重启） | 口径统一为跨重启持久（PRD v1.2 / AC-FN-25 / Q10），行为保持不变 | `hooks/useFoldSync.ts`、`preferences/store.ts`（复用，零 schema 变更） |
| 4 | 大纲跳转 `goToHeading` 用 `EditorView.scrollIntoView`（CM6 默认滚动，非显式平滑） | 显式平滑跳转（smooth）且 active 不闪烁。**落点收口**：跳转/active 跟随逻辑抽独立 `hooks/useOutlineNav.ts`，App.tsx 的 `goToHeading` 缩为一行转发（CLAUDE.md：新逻辑不入 App.tsx） | `src/renderer/src/hooks/useOutlineNav.ts`（新）；App.tsx 仅转发 |
| 5 | 大纲排序/多选在功能树（NAV-GAPS-SORT/MSLT）为待取舍实现项 | 转「不实现」取舍登记（Q9），功能树/清单同步标注 | `docs/requirements/ui-ux-redesign/prd/function-tree.md`（登记联动）、规范取舍清单 |
| 6 | 文件树既有活动行滚入视口、虚拟滚动、拖拽排序 | 全部保持；键盘导航与之共存不回归 | `src/renderer/src/components/FileTree.tsx`、`filetreeRows.ts` |
| 7 | 侧栏视觉 token 化改造（PRD 6.3 审计） | 焦点环/三态样式取 token，无裸值（UI-ELEM-01） | `src/renderer/src/styles/`（侧栏分区样式） |

---

## 5. 验收映射（AC 条目 → 本域判据）

| AC 条目 | 本域判据 |
|---|---|
| AC-RULE-14 | §3.3 折叠态写本地偏好键、跨重启持久、既有键位不变 |
| AC-FN-11 | §3.5 active 跟随滚动 + 点击跳转定位 + active 保持 |
| AC-FN-12 | §4-7 侧栏 token 化改造，深浅主题各一遍对照走查 |
| AC-FN-13 | §3.6 三候选逐项裁决（键盘导航=实现且落地并 converge；排序/多选=不实现留档），无悬空项 |
| AC-FN-25 | §3.3 标签切换/重启后折叠保持；.md 逐字节一致 |
| AC-FN-30 | §3.4 大纲折叠 ↔ 正文双向同步；写偏好键跨重启；.md 无字节变化 |
| AC-FN-15 | §3.4 折叠含子章节、标题行保留、大纲一致、跨重启、.md 不变（标题折叠与 REN 域共验） |
| AC-NF-05 | §3.5 跳转/折叠不引起正文布局位移 |
| AC-NF-14 | §3.3 既有键位语义不变、新增键向后兼容（本域零新增键） |
| UI-IXD-13 | §3.5 大纲项点击跳转 + active 高亮随滚动切换 |
| UI-ELEM-01 | §3.1/§3.2 焦点环与三态样式取 token |
| AC-PEND-08 → 转正 | §3.6 取舍清单定稿入库即验收前提达成 |
