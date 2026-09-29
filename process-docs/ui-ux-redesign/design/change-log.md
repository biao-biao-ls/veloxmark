# change-log（ui-ux-redesign）

开发中发现实现偏离基线的登记处。格式见 zcode:frontend-dev「变更纪律」。

## CHANGE-1: 渲染区主题翻值落位 themes.css（非 tokens.css）
- 状态: pending
- 类型: Updated
- 风险等级: 低
- 模块: styles/token 体系（渲染区观感契约）
- 来源: 任务 IT-03/FE-01
- 关联任务: IT-03/FE-01
- 涉及基线:
  - tech-design: tech-design.md#83-组件结构（styles/ 新分区 css + token 补充，零 .theme-dark 补丁）
- 变更前: 任务表指定 `.theme-light`/`.theme-dark` 翻值写在 `styles/tokens.css`
- 变更后: 翻值写在 `styles/themes.css`（1B 拆分后 `.theme-light`/`.theme-dark` 的唯一分区）；`tokens.css` 只承载 `:root` 非主题 token
- 变更原因: 遵循本仓既有分区惯例（themes.css 文件头「Theme-split declarations of the :root vocabulary」），避免主题翻值双文件分散；AC「render-zone.css 零 .theme-dark 选择器」不受影响
- 更新时间: 2026-09-29

## CHANGE-2: 渲染区 token 补充支持项（超出任务冻结清单 6 项）
- 状态: pending
- 类型: Added
- 风险等级: 低
- 模块: styles/token 体系（渲染区观感契约）
- 来源: 任务 IT-03/FE-01
- 关联任务: IT-03/FE-01、FE-03~FE-10（消费方）
- 涉及基线:
  - tech-design: tech-design.md#112-参数化设计（chrome 四态 token 化）
- 变更前: 任务冻结清单为浮层表面色/浮层边框/把手 accent/指示线/摘要行灰字/折叠三角过渡时长 6 项
- 变更后: 另补 `--border-width`、`--text-ui`、`--text-body`、`--z-float`、`--on-accent`、`--accent-soft` 6 项支持 token（命名取自 ui_06 设计稿 token 词表）
- 变更原因: FE-01 AC 对 render-zone.css 机械 grep 禁止裸色值/裸 px，边框宽度、字号、浮层槽位 z-index、accent 上文字/软填充必须有 token 才能写出合规样式分区；与 tech-design「槽位由 token 统一辖治」一致
- 更新时间: 2026-09-29

## CHANGE-3: 表格工具栏 ⊞ 的 data-op 取 resizeTable（ui_03 原型为 TBL-TOOL-GRID）
- 状态: merged
- 类型: Updated
- 风险等级: 中（DOM 契约面字面量，e2e 探针消费）
- 模块: 表格编辑视图（editor/table 工具栏契约面）
- 来源: 任务 IT-01/FE-03
- 关联任务: IT-01/FE-03、IT-01/FE-05、IT-01/INFRA-01
- 涉及基线:
  - tech-design: tech-design.md#5-领域模型（ContractSet 演进须登记：data-table-handle 删4留1，其余挂 data-op）
  - AC: ac.md#AC-RULE-17
- 变更前: ui_03_table_menu.html 原型工具栏 ⊞ 挂 `data-op="TBL-TOOL-GRID"`（menu-tree 节点码）；task-list.json PATH-05/FE-05 要求 ⊞ 挂 `data-op resizeTable`（op id）
- 变更后: 实现取 `data-op="resizeTable"`（op id 命名空间，与 FE-05「resizeTable op id 复用」、task-list PATH-05 机器验收路径一致）；⋮ 保留 `TBL-MOR-OPN`（原型/菜单树锚点字面量）；对齐三键/🗑 挂 opsTable 19 项同源 id（alignLeft/alignCenter/alignRight/deleteTable）
- 变更原因: 基线自相冲突——「统一 data-op id 与 opsTable 同源」裁决取 op id 命名空间（resizeTableOp 语义键），TBL-TOOL-GRID 属 menu-tree 节点码另一命名空间；且 PATH-05 为本期机器验收路径字面量。探针侧以 resizeTable 为准（INFRA-01 同步）
- 更新时间: 2026-09-29

## CHANGE-4: 原生菜单空组省略登记（历史组/折叠组不渲染分组头）
- 状态: merged
- 类型: Updated
- 风险等级: 低（呈现层分组，命令 id 契约不变）
- 模块: macOS 原生菜单（darwin 菜单分组呈现层）
- 来源: 任务 IT-02/BE-02
- 关联任务: IT-02/BE-02
- 涉及基线:
  - tech-design: tech-design.md#3-api-接口设计命令契约面（原生菜单分组与 menu-tree 对齐）
  - AC: ac.md#AC-FN-09
- 变更前: menu-tree §3.2 历史组（undo/redo）与 §3.3 折叠组（foldAll/unfoldAll）在目标分组中成组列出；实现侧「空组整组省略」决策仅自登记（electron/menu/darwin.ts 注释、darwinMenu.test.ts「View 5 (折叠 omitted)」、BE-02 implementation-notes 称「已按 menu-tree 附录 A 登记为原生差异」），但 menu-tree 附录 A 为只读现状对照、无该差异登记行，change-log 亦无条目
- 变更后: 登记为原生菜单差异：**原生菜单空组不渲染分组头**——历史组（undo/redo 归 CM6 keymap，无原生项）与折叠组（foldAll/unfoldAll 不在 AC-FN-09 冻结 id 集合 35 项内）整组省略、不渲染空分组头；该取舍受 id 冻结约束属合理决策。登记载体为本条目（CHANGE-4），BE-02 implementation-notes 同步改指本条目（不重复登记入 menu-tree 附录 A）
- 变更原因: 业务流评审 PATH-01（P2）——「已按附录 A 登记」声明与登记载体不符（附录 A 并无历史/折叠组省略的差异登记行），且偏离未入 change-log；补登记使登记声明与载体一致
- 更新时间: 2026-09-29

## CHANGE-5: 右键/⋮ 弹层内滚动不再是关闭信号（原「任何滚动即关」口径变更）
- 状态: pending
- 类型: Updated
- 风险等级: 中（弹层行为口径，AC-FN-05/AC-RULE-10 判据面）
- 模块: 菜单弹层基座（editor/contextMenu + components/EditorContextMenu）
- 来源: 任务 IT-02/FE-04
- 关联任务: IT-02/FE-04、IT-02/FE-02、TBL 域 ⋮ 回归任务（期 2）
- 涉及基线:
  - AC: ac.md#AC-RULE-10、ac.md#AC-FN-05
  - tech-design: tech-design.md#83-组件结构（contextMenu/* 限高滚动+边缘翻转）
- 变更前: EditorContextMenu 监听 window scroll（capture）——任意滚动（含面板自身限高内滚动）在开合 300ms 宽限期后一律收拢菜单（代码注释称 professional convention）
- 变更后: 面板自身滚动（限高内滚动）**不**收拢菜单（AC-FN-05「限高内滚动正常」能力面）；仅菜单外（页面/编辑器）滚动维持收拢既有约定。面板内滚动到边界继续外滚走「超界滚动选择」关闭路径（见 CHANGE-6）
- 变更原因: 原口径与 AC-RULE-10/AC-FN-05 直接冲突——19 项⋮菜单/视图 15 项菜单限高内滚动时，滚动本身即触发关闭则「内滚动可达」不可达；基线冻结的可达性要求优先于实现注释的惯例声明
- 更新时间: 2026-09-29

## CHANGE-6: 「超界滚动选择」关闭路径的操作定义落地（AC-FN-10 第四条）
- 状态: pending
- 类型: Updated
- 风险等级: 低（AC 触发机制落地口径，判据行为「终态必关闭 + 焦点回正文」不变）
- 模块: 菜单弹层基座（popup.ts detectOverscrollSelection）
- 来源: 任务 IT-02/FE-04
- 关联任务: IT-02/FE-04、QA 验收
- 涉及基线:
  - AC: ac.md#AC-FN-10
  - api: MENU-menubar.md#35-弹层限高滚动--边缘翻转可达ac-rule-10（关闭路径）
- 变更前: 基线只声明关闭触发名为「超界滚动选择（滚动到边界继续选择）」，未给出可操作的输入手势定义
- 变更后: 落地定义：**限高滚动面板滚到上/下边界后继续向外滚动（wheel overscroll，deltaY 穿界）即视为该触发**——收拢至关闭态（含子菜单）并焦点回正文；内容未超限的面板不产生该触发。MenuBar 下拉与 contextMenu（⋮/右键）同源生效（popup.detectOverscrollSelection 纯函数）
- 变更原因: PRD 5.5/AC 均未定义手势细节，需可实现可验收口径；选取「边界继续滚动」字面语义（滚动到边界 + 继续），并以纯函数断言钉住（popupOverflow.test.ts）
- 更新时间: 2026-09-29

## CHANGE-7: toggleDevTools 需登记永久派生例外（文档仅点名 zoomIn）
- 状态: merged
- 类型: Updated
- 风险等级: 低（双源守护登记口径，键位行为不变）
- 模块: 加速键单源（DARWIN_COMMAND_ACCELERATORS ↔ commands shortcut 双源守护）
- 来源: 任务 IT-02/BE-01（doc-drift 兜底补登记）
- 关联任务: IT-02/BE-01
- 涉及基线:
  - api: MENU-menubar.md#34-快捷键回显单源派生（DERIVATION_EXCEPTIONS 例外清单）
- 变更前: MENU-menubar §3.4 仅点名 zoomIn（Ctrl+=↔Cmd+Plus）需登记 DERIVATION_EXCEPTIONS，未提 toggleDevTools
- 变更后: toggleDevTools（registry F12 ↔ darwin Cmd+Alt+I）同为**永久**派生例外，须在 §3.4 例外清单补一句登记（平台原生键差异：F12 派生为 F12 ≠ Cmd+Alt+I）；已在 shortcutSync.test 注明原因并钉住
- 变更原因: BE-01 实现/测试实测确认 F12 派生与 darwin Cmd+Alt+I 不可能一致，例外不可省；文档漏列会造成后人误以为「仅 zoomIn 例外」而误删测试登记（doc-drift 兜底）
- 更新时间: 2026-09-29
