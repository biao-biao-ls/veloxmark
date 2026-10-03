# 代码审查报告 — IT-02/FE-01 菜单信息架构重排

**得分：91/100（阈值：90）**　**状态：✅ 通过**
**基线规范：** rubric-code-review.md + code-review/SKILL.md；风格归因已前置（项目已有代码 + CLAUDE.md 双层）
**评审者：** zcode:zcode-reviewer（只读，eval-loop 编排）· 2026-10-02

## 风格归因（前置）
- **已有代码风格**（commands/*、components/*、styles/*、*.test.ts 共置）：小模块 + 文件头设计注释（FE-xx#n 引 ui_04）、类型集中导出、`t('ns.key')` 扁平字典、Vitest describe/it 钉契约、CSS token + 设计值注释。新代码（menuLayout.ts/menuLayout.test.ts/MenuBar 增量/chrome.css）全一致。
- **CLAUDE.md 约定**：命令 id 硬契约不改 ✓（48-id 一字未动）；i18n 新 key 双字典同加 ✓；纯逻辑配单测 ✓；CSS 用 `--space-*`/token 不写裸新值 ✓。
- 客观项（安全/性能/测试/正确性）不受归因保护，单独扣分。

## 评分明细
| 维度 | 得分 | 满分 | 扣分项 | 归因 |
|------|------|------|--------|------|
| 功能全实现 | 10 | 10 | — | MENU_LAYOUT 与 menu-tree §3 逐项核对一致（文件5/编辑5/视图6/插入2/帮助1） |
| 遗漏需求点 | 8 | 8 | — | cdp 运行时扫描缺口记 Info（任务阶段3/4 本未勾） |
| 多做需求外 | 6 | 8 | -2 批 C 跨任务合并 | 客观（范围） |
| 需求理解正确 | 7 | 7 | — | en casing 差异记 Info（既有字典风格归因） |
| 边界/异常覆盖 | 7 | 7 | — | 空 recent 态/禁用态/未知 id fail-fast/裸 key/漂移均有守护 |
| 职责分离 | 10 | 10 | — | layout→flatten→resolve→commandItem 单链清晰 |
| 错误处理 | 9 | 10 | -1 throw 位于渲染路径 | 客观（正确性） |
| 编码风格 | 8 | 8 | — | 已有代码一致 |
| 测试覆盖 | 7 | 8 | -1 stub-only 基线 | 客观（测试） |
| 安全 | 8 | 8 | — | 无注入面，React 文本节点 |
| 性能 | 8 | 8 | — | flatten 线性；useMenus 重建为「checked 取最新」既有契约 |
| DRY | 4 | 4 | — | TARGET_GROUPS 双写为钉基线必要双源 |
| YAGNI | 4 | 4 | — | 帮助单项无分组标题有反过度设计断言 |
| **合计** | **91** | **100** | | |

## 问题清单

| severity | item | detail | location | suggestion |
|---|---|---|---|---|
| Important | 批 C 跨任务合并（-2） | 本任务交付混入 FE-04#1~#8/FE-05#1~#3/IT-04-FE-02#1 样式项（面板宽 260/292、hover/键盘环、brand、滚动条、子菜单几何、--shadow-menu 复declare），超出「涉及文件」表 | 任务 frontmatter implementation-notes/doc-drift + styles/chrome.css:22-331、MenuBar.tsx:276-335 | 内容已核对与 ui_04 值一致且 doc-drift 已登记，酌减 2；后续批次按任务拆交付或在各任务文件同步勾销，保持 doc-drift 机制 |
| Minor | commandItem throw 在渲染路径（-1） | `throw new Error('menu layout references unknown command')` 在 buildMenus（useMenus 每渲染执行）内，布局↔注册表不变量破坏时整窗白屏而非降级 | menuLayout.ts:166 | 模块加载期一次性校验 MENU_LAYOUT，或 useMenus 边界 catch 降级空菜单 + console.error |
| Minor | 基线断言 stub-only（-1） | 48-id 基线用 stubCommands 自造注册表比对，未直接与 `buildCommands(stubCommandOps())` 真实注册表 id 集交叉断言（shortcutMatch.test.ts:167 集成面部分覆盖） | menuLayout.test.ts:17-33,116-124 | 增加一条真实注册表 id 集 === BASELINE_COMMAND_IDS 的断言，防基线数组被就地改写 |
| Minor | tooltip 硬编码键位文案（0，相邻面） | `app.searchInFolder` 含字面量 `(Ctrl+Shift+F)`——AC-RULE-11「禁止手工双源维护提示」的同类债（tb.theme 已按 MENU-menubar §4-3 去硬编码，此条未列入） | en.ts:435 / zh.ts 同 key | 渲染侧拼 fmtShortcut 或按 tb.theme 先例登记去硬编码清单；归 FE-02 键位域，勿在 FE-01 内顺手改 |
| Info | en casing 口径（0） | 实现 'Search in Folder…' vs 任务文面 'Search in folder…' | en.ts:26、menuLayout.test.ts:147 | 归因：既有字典 Title Case（en.ts:11 'Open Folder…' 同族），implementation-notes 已声明；tooltip/placeholder 的 sentence case 属不同语域，维持现状 |
| Info | AC-FN-09 cdp 扫描未跑（0） | 红线现由单测钉住（测试断言数组深比较，menuLayout.test.ts:115-125），cdp 探针运行时扫描缺失（脚本不在本 worktree） | 任务阶段3/4 未勾 | 联调阶段补 cdp 扫描（命令 id + data-op 集合）并回填勾选 |
| Info | React key 用 label（0） | `key={menu.label}` 在 i18n 极端同名时冲突；FE-01 已提供 MenuDef.id | MenuBar.tsx:284 | 改 `key={menu.id}` |
| Info | '▸' 复用 shortcut 槽（0） | 子菜单箭头渲染在 `.menu-item-shortcut` 槽（MenuBar.tsx:534），设计为独立 `.mi-arrow`（ui_04:389）；现视觉等价（--fg-dim/11px），父项 echo: — 无槽位冲突 | MenuBar.tsx:534 | 若将来父项带快捷键需拆独立 mi-arrow 槽；可留 |

## 兼核项结论（scopeHint）
- **i18n key 对齐**：18 个 `menu.grp.*` key en/zh 双字典齐全、值与 menu-tree §3 组名逐字一致；i18n.test.ts:52-59 守 key 集合相等；menuLayout.test.ts:190-204 守裸 key。✓
- **文案质量**：zh「插入表格…」「选区转表格…」「文件夹内搜索…」与 AC 一致；en 标题式大小写合族。✓（仅 Info 两条）
- **字形「▸」**：MenuBar.tsx:534 与 EditorContextMenu.tsx:92、ui_04 样张同形；勾选 '✓'、折叠 ▾/▸ 同族。✓
- **AC-FN-07/AC-RULE-11 回显单源**：menuLayout.ts:170 经 `fmtShortcut(cmd.shortcut)` 派生、无快捷键 `undefined` 不占位；shortcutMatch.test.ts:167-193 以真实注册表断言「回显=派生值、无键留空」；shortcutSync.test.ts 守双源加速键。✓（仅 app.searchInFolder tooltip 一条相邻面债）

## 结论

91/100 ≥ 90，**通过**。核心红线（命令 id 48 集合不变、插入域去重、命名统一、双字典对齐）全部由真实代码 + 单测证实，非采信自述。Important 条为批工作流范围问题（doc-drift 已登记）记流程遗留；2 条 Minor（throw 降级、真实注册表交叉断言）入收口批候选；cdp 扫描留联调收尾。
