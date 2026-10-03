# BE-02 自测报告 — macOS 原生菜单分组与文案对齐

- 任务: BE-02 (IT-02, 后端)
- 验证环境: Windows 10（无法截取真实 macOS 菜单栏；实现图为同一 `buildDarwinMenu()` 模板经 `Menu.popup()` 的原生渲染截图，模板即 mac 实际菜单结构）
- 质量门禁: `npm run typecheck` 通过；`npm run test:unit` 38 文件 351 用例全部通过（含新增 `darwinMenu.test.ts` 6 条契约断言）

## 1. 分组对照记录（menu-tree §3 / 附录 A vs darwin 菜单模板）

| 菜单 | menu-tree §3 目标分组 | darwin 模板实际分组 | 对齐结论 |
|------|----------------------|--------------------|----------|
| 文件 File | 新建与打开 / 保存 / 标签页 / 导出 / 设置（5 组） | 同 5 组 + `close` role（mac 关闭窗口，附录 A 登记） | 一致（实现图 BE-02-impl.png） |
| 编辑 Edit | 历史 / 剪贴板 / 查找与整理 / 格式 / 选区导出（5 组） | 剪贴板 / 查找与整理 / 格式 / 选区导出（4 组） | **历史组有意缺省**（附录 A 登记：undo/redo 归 CM6 keymap，原生加速键会抢注）；insertTable/convertToTable 移出 → 插入菜单（menu:insert-dedupe） |
| 视图 View | 侧栏与搜索 / 折叠 / 模式 / 输入辅助 / 缩放 / 开发与主题（6 组） | 侧栏与搜索 / 模式 / 输入辅助 / 缩放 / 开发与主题（5 组） | **折叠组有意缺省**（附录 A 登记：foldAll/unfoldAll 不在冻结的原生 id 集合内）；实现图 BE-02-impl-view.png |
| 插入 Insert | 表格 / 图表与容器（2 组） | 同 2 组 | 一致（BE-02-impl-insert.png）；表格组 = insertTable + convertToTable（原 Edit 内副本删除） |
| 帮助 Help | 单项（不过度设计） | 单项 showHelp，无分组头 | 一致 |
| App 菜单 | 附录 A：mac 系统菜单 | about/services/hide/hideOthers/unhide/quit + openPreferences | 登记差异，mac-only |
| 窗口 Window | 附录 A：mac 系统菜单 | minimize/zoom/fullscreen/front | 登记差异，mac-only |

组内位次与分组线均为呈现层调整；组名渲染为 `enabled: false` 禁用行（Electron 原生菜单无 header role）。

## 2. 双语 key 对账（NATIVE_MENU_STRINGS，第 3 份字典）

新增 18 个 `menu.grp.*` key，与 FE-01 渲染端 i18n `menu.grp.*` **同名语义对齐**（第 3 份字典独立维护）：

| key | en | zh |
|-----|----|----|
| menu.grp.newOpen | New & Open | 新建与打开 |
| menu.grp.save | Save | 保存 |
| menu.grp.tabs | Tabs | 标签页 |
| menu.grp.export | Export | 导出 |
| menu.grp.settings | Settings | 设置 |
| menu.grp.history | History | 历史 |
| menu.grp.clipboard | Clipboard | 剪贴板 |
| menu.grp.findOrganize | Find & Organize | 查找与整理 |
| menu.grp.format | Format | 格式 |
| menu.grp.selectionExport | Selection Export | 选区导出 |
| menu.grp.sidebarSearch | Sidebar & Search | 侧栏与搜索 |
| menu.grp.fold | Fold | 折叠 |
| menu.grp.mode | Mode | 模式 |
| menu.grp.inputAssist | Input Assists | 输入辅助 |
| menu.grp.zoom | Zoom | 缩放 |
| menu.grp.devTheme | Dev & Theme | 开发与主题 |
| menu.grp.table | Table | 表格 |
| menu.grp.chartContainer | Charts & Containers | 图表与容器 |

对账结果：
- en/zh key 集合完全一致（`i18n.test.ts` 第 3 份字典守卫断言通过）
- 模板全部 `S.x` / `S['…']` label 引用在双语均可解析（`darwinMenu.test.ts` 断言，无裸 key）
- 无重复 key 字面量（源扫描已适配带点号的 namespaced key）
- 实图验证：`BE-02-impl.png`（zh 文件菜单分组名）与 `BE-02-impl-en.png`（en 文件菜单 New & Open/Tabs/Settings）双语渲染无裸 key

## 3. 命令 id 契约（AC-FN-09）

- darwin 模板 `commandItem(...)` id 集合与重排前基线 35 项逐一相等（冻结基线断言 `BASELINE_COMMAND_IDS`）
- insertTable/convertToTable 各出现且仅出现 1 次（从 Edit 移到 Insert，集合不变）
- `menu:<id>` 转发链零改动（`commandItem` click → `menuChannel(id)` → renderer `useMenus` 订阅同一命令注册表）
- openPreferences 在 App 菜单与文件「设置」组双入口，id 不新增

## 4. 既有裁决保持

- 格式子菜单（bold/italic/inlineCode/strikethrough/highlight）不挂原生加速键 —— `DARWIN_COMMAND_ACCELERATORS` 断言 undefined（CM6 keymap 拥有 Mod-B/I/E）
- 标签命令（closeTab/reopenClosedTab/nextTab）不挂原生加速键 —— Ctrl+W 走 before-input 标签感知路由
- 实图佐证：`BE-02-impl-edit.png` 格式子菜单项无加速键列

## 5. 已知截图取证限制

- 截图机为 Windows，`Menu.popup()` 弹出的是 Electron 原生菜单渲染（加速键显示为「Win 键」= macOS 的 Cmd）；结构/分组/文案与 mac 应用菜单一致（同一模板），仅系统外观不同。
- 截图时桌面上有无关应用菜单残留（Chrome DevTools 等）与本任务取证用的多次弹出残留，最终交付图为裁剪后的菜单本体。
- 取证用临时 popup 钩子（`VELOX_CAPTURE_MENU`）已从 `darwin.ts` 移除，未合入代码。
