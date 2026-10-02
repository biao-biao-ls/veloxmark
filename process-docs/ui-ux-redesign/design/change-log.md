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

## CHANGE-8: 只读前置拦截需新增 isWritable 跨进程探针（AC-ERR-08 判据 1/2）
- 状态: pending
- 类型: Added
- 风险等级: 中（新增 IPC 通道；AC-ERR-08 判据行为依赖此真源）
- 模块: 跨进程 API（electron/shared/api.ts + preload + ipc/files.ts）/ 渲染区只读闸门
- 来源: 任务 IT-03/FE-04
- 关联任务: IT-03/FE-04、FE-05、FE-06（三任务共用同一「全局拦截」）、QA 验收
- 涉及基线:
  - AC: ac.md#AC-ERR-08、ac.md#AC-RULE-16
  - tech-design: tech-design.md#10-异常处理
  - api: REN-render-zone.md#31-图片编辑浮层ren-image（禁用规则）
- 变更前: 全仓无任何可写性真源——`OpenFileResult` 只有 filePath/content，`err.readonly` 文案键已冻结但零调用点；`writeFile` 失败只能事后得知（Promise reject），无法满足 AC-ERR-08「不执行任何写入 / 文档逐字节不变 / 不产生半提交」的前置拦截要求
- 变更后: `RendererApi.isWritable(filePath): Promise<boolean>`（channel `file:isWritable`，`fs.access(W_OK)` 判定）+ 渲染区 `editor/readOnlyGuard.ts` 单点闸门 `assertWritable()`（只读时回 false 并 toast 冻结文案 `err.readonly`）；图片写回统一走该闸门，FE-05/FE-06 复用同一入口
- 变更原因: 任务 FE-04「涉及文件」仅列渲染层，但 AC-ERR-08 判据 1/2 是**写前**拦截语义，渲染层在 sandbox 下无 fs 访问权，必须补最小跨进程探针；按 electron/CLAUDE.md「新增 API 固定顺序」三处落位（api.ts 签名 → preload 实现 → ipc/files.ts handle）
- 更新时间: 2026-09-29

## CHANGE-9: ⊞ 网格选择器预设按钮组与自动适应窗口估算（FE-05 实现口径）
- 状态: pending
- 类型: Added
- 风险等级: 低（任务 AC/交互面扩展 UI；缩放语义/toast/undo 均在既有冻结面内）
- 模块: 表格编辑（⊞ 网格选择器浮层 gridPicker）
- 来源: 任务 IT-01/FE-05
- 关联任务: IT-01/FE-05
- 涉及基线:
  - AC: ac.md#AC-OP-07、ac.md#AC-FN-04
  - ui-design: ui_02_table_edit.html（.grid-pop/.gcell/.grid-pop-label）
  - api: TBL-table-ops.md#grid:resize-range（resizeTable op id 复用，无新 DOM 契约）
- 变更前: ui_02 mock 的 .grid-pop 只有格点矩阵 + 读数「R × C」，无预设按钮组；任务交互 #3 文案称「自动适应窗口按既有窗口宽度估算列数逻辑」，但仓内查无任何窗口宽度→列数估算实现
- 变更后: 读数下方落地 4 预设按钮（1×1 / 2×2 / 3×3 / 自动适应窗口，data-testid `grid-preset-1x1|2x2|3x3|autoFit`，i18n key `table.gridPreset*` 双字典）；「自动适应窗口」自创估算 `estimateAutoFitCols(fitWidth, maxCols) = clamp(⌊fitWidth/96⌋, 1, maxCols)`（名义列宽 `GRID_AUTO_FIT_COL_PX=96`，行数保持当前 R0），纯函数单测钉住钳制边界
- 变更原因: 预设组为任务 FE-05 页面元素表 #3/交互 #3 明文要求（可溯源到任务 AC/交互要求，非审美偏离）；自动适应窗口的「既有逻辑」实为空中楼阁，取最小可测估算并在 gridPicker.ts 注释 + 本条登记，后续若有正式窗口宽度规则仅需替换该单一纯函数接缝
- 更新时间: 2026-09-29

## CHANGE-10: ac.md v1.4 验收基线修订登记（PEND 转正 / 4 处措辞对齐 / 附录别名对账）
- 状态: merged
- 类型: Updated
- 风险等级: 中（AC 判据面修订；冻结中文文案面不动，契约演进口径化）
- 模块: 验收标准（requirement/ac.md）与总看板收敛
- 来源: 任务 IT-04/FE-01
- 关联任务: IT-04/FE-01
- 涉及基线:
  - AC: requirement/ac.md（v1.3 → v1.4）
  - 裁决真源: design/adr/grill-rulings.md（2026-09-28 用户全锁，PEND 闭合 16/16）
  - 契约口径: design/adr/e2e-contract-delta.md（AC-RULE-17 修订口径）
- 变更前: ac.md v1.3——AC-PEND-01..16 为 §5.1「[PENDING] 待确认条目」表（不计入覆盖分母），正文 15 处交叉引用带 [PENDING] 注；AC-RULE-15 为删表/删行/删列全量确认框口径（删行/列文案待回填）；AC-RULE-17 为「契约集合全部保持不变」口径；AC-OP-10 带删行/列确认框分支；AC-FN-05/§8 分组缺「单元格」组
- 变更后: ac.md v1.4——§5.1 重写为 16 条正式 Given-When-Then 裁决转正条目（编号保留 AC-PEND-NN 作任务 acRef 稳定锚点，[PENDING] 标记全清零），判据与 grill-rulings 逐条一致；措辞对齐 4 处：AC-RULE-15 确认流收窄为**仅删表**（删行/列 toast+undo，其确认文案退出文案面）、AC-RULE-17 改为「已登记的契约集演进为准入变更，此后变更须走登记流程」（保留 CHANGE-3 尾注）、AC-OP-10 删行/列无确认回执 + 表头身份下移、AC-FN-05/§8 ⋮ 菜单五组含「单元格」组（行操作/列操作/对齐/单元格/结构删除）；附录 A/B/C 别名对账留痕（22/22 无悬空）；三副本同步（docs / worktree CRLF / process-docs）。总看板 `docs/ui-redesign-tasks.md` 新建（AC-FN-34），两既有看板加收敛标注
- 变更原因: AC-PEND 全部闭合后须按唯一裁决真源转正为正式验收判据（任务 IT-04/FE-01 阶段 1-2）；措辞对齐 4 处对应已裁定口径（Q3 仅删表确认、e2e-contract-delta 契约演进登记、PEND-12 表头下移、Q3/生成期差异登记 #1 五组口径）；冻结中文文案以 ac.md 为准逐字未动（删行/列确认文案随确认流退出属 Q3 裁决生效，非文案改写）。本条目为 ac.md 修订记录登记（任务阶段 4 要求），非实现偏离裁决；不触碰 CHANGE-1/2/5/6/8/9 pending 项与 CHANGE-3/4/7 merged 项
- 更新时间: 2026-09-30

## CHANGE-11: 两按钮对话框布局统一为「取消左 + 确认主按钮右」（ui_07 复刻序）
- 状态: pending
- 类型: Updated
- 风险等级: 低（呈现层按钮次序；确认语义/按钮 label/键盘默认钮不变）
- 模块: 全局浮层（components/Dialog.tsx 两按钮布局）
- 来源: 任务 IT-01/FE-08
- 关联任务: IT-01/FE-08、IT-01/FE-09（消费 Esc 分层）、IT-04/FE-01（QA 走查 ui_07）
- 涉及基线:
  - UI 设计稿: docs/requirements/ui-ux-redesign/ui/ui_07_global.html#场景 C（confirm-actions：「取消」btn-secondary + 「确认删除」btn-danger，flex-end）
  - AC: requirement/ac.md#UI-IXD-05（「确认删除」为右侧主按钮）
- 变更前: 两按钮确认/提示框按平台原生序渲染——macOS「取消」左+确认右，Windows/Linux 确认左+「取消」右（Dialog.tsx 原 isMac 分支，注释称平台习惯）
- 变更后: 两按钮布局不分平台恒为「取消」左 + 确认主按钮右（danger 时红底）；Enter 仍默认确认、Esc 仍 cancel；choose 三按钮（P12 不保存/取消）保留原平台分支不动
- 变更原因: ui_07 场景 C 与 UI-IXD-05 明文「右侧主按钮」是本重设计基线的复刻真源；旧 Windows 确认居左属重设计前状态。统一序同时覆盖其余 confirm/prompt 共享宿主（外链确认、替换全部等），属同一设计系统一次对齐，无契约面影响（无 cdp 探针依赖按钮次序）
- 更新时间: 2026-09-30

## CHANGE-12: 导出表格空单元格保留（listTable 按管道结构数槽位，AC-OP-17 缺陷修复）
- 状态: pending
- 类型: Updated
- 风险等级: 低（导出渲染保真修复，恢复 AC 既定行为；无契约面/接口变更）
- 模块: 导出渲染（src/renderer/src/export/renderDoc/listTable.ts）
- 来源: 任务 IT-04/FE-02（全域对照走查发现 P1 真实缺陷，任务授权最小 TDD 修复）
- 关联任务: IT-04/FE-02（缺陷发现与回归）、IT-03/FE-*（导出通道原实现）、IT-04/FE-03（后续导出 QA 若有）
- 涉及基线:
  - AC: requirement/ac.md#AC-OP-17（判据 2「行数/列数/单元格内容/对齐与编辑视图及冒号行逐项一致」）
  - tech-design: design/tech-design.md#导出渲染（renderDoc 三通道共用）
- 变更前: `renderRow` 只遍历 lezer `TableCell` 节点计列——`@lezer/markdown` GFM 对空单元格不产节点（只剩相邻 `TableDelimiter` 管道），空列被丢：含空列的 4 列表导出为 3 列、全空行导出为 `<tr></tr>`、`aligns[i]` 随错位（右对齐落到中列）
- 变更后: `rowCellSlots()` 按行内管道结构数槽位（行首管道不开槽、每后续管道关一槽、无行尾管道收尾补格），非空 `TableCell` 映射到对应位置，空槽输出空 `<td${align}></td>`/`<th>`；行宽 rectify 到全表最大槽位数（与 editor/table/parse.ts padRow 哨兵补空同口径），`aligns[i]` 按列序兑现冒号行
- 变更原因: 导出三通道（HTML/PDF/富文本）共用 renderDoc，空单元格丢失违反 AC-OP-17 判据 2 且与编辑视图不一致；修复以 `listTable.test.ts` 4 用例钉住（空列/全空行/对齐序/短行补齐），全量单测 873/873 + typecheck 0 Error，三通道 CDP 复测逐项一致
- 更新时间: 2026-09-30

## CHANGE-13: 表格编辑工具栏形态复刻对齐——右上浮动紧凑 pill（批 A 裁定落地）
- 状态: pending
- 类型: Updated
- 风险等级: 中（编辑态 chrome 形态/危险色范围/菜单几何，UI-IXD-04 与 AC-FN-03 关联；无契约面 data-op 变更）
- 模块: 表格编辑 chrome（editor/table/toolbar.ts + styles/markdown.css + editor/contextMenu/opsTable.ts + styles/context-menu.css）
- 来源: 人工介入（复刻评审 Step 3.2 主 agent 裁定 · 跨任务合并修复批 A）
- 关联任务: IT-01/FE-01、IT-01/FE-03、IT-01/FE-04、IT-01/FE-10（四方互证）、IT-01/FE-05（⊞ 锚定连带）
- 涉及基线:
  - UI 设计稿: docs/requirements/ui-ux-redesign/ui/ui_02_table_edit.html#floating table edit toolbar、ui_03_table_menu.html#表格工具栏/⋮ 菜单弹层
  - AC: requirement/ac.md#AC-FN-03（工具栏浮现面）、#AC-FN-05（菜单限高滚动）
  - docs/specs/7C-table-toolbar/plan.md（原「左簇+右簇两端分布」布局决策被本裁定取代）
- 变更前: 编辑态工具栏为通栏两端分簇（左簇 ⊞+对齐三键 / 右簇 ⋮+🗑，跨表全宽 ~765px），无容器 chrome（散落 chip 底）；🗑 中性灰；「删除行/删除列」菜单项 danger 红字；⋮ 菜单展开时源钮无激活态；⋮/右键菜单宽 225px + 18px 系统滚动条；编辑态无整表外框
- 变更后: 对照 ui_02/ui_03 改为表格右上浮动紧凑 pill（top:-40px right:0 语义；⊞ ◧ ▣ ◨ + .tsep 1px×18px + ⋮ 🗑 单组连续排列；条高 32px/钮 28×28；容器 --widget-surface+1px --border+--radius-md+--shadow-pop）；🗑 静息 danger 红（--danger）；danger 红范围收敛为「删除表格」一项（deleteRow/deleteCol 去 danger，结构删除组徽标保留）；⋮ 菜单展开期 .is-source accent 实底；菜单宽 min 248px + 5px 定制细滚动条（--bg-inset 轨/--fg-disabled 拇指）；编辑态 table 加 1px --accent 外框（border-collapse 下改色不改尺，UX-P28 F3 零位移保持）
- 变更原因: ui_02/ui_03 双稿一致为紧凑药丸，无 CHANGE 登记取舍；7C plan 的两端分簇属实现侧自选偏离复刻源。FE-01#1-4/FE-03#1-5/FE-04#1-4/#6-9/FE-10#1-3 四方互证为必修；danger 红仅属「删除表格」与 FE-08「仅删表确认」策略同源
- 更新时间: 2026-10-01

## CHANGE-14: 对齐三键按下态映射归一——GFM 默认左对齐计入按下回显（UI-IXD-04）
- 状态: pending
- 类型: Updated
- 风险等级: 低（呈现层回显映射；setAlignOp/冒号行写回语义不变）
- 模块: 表格工具栏/⋮ 菜单对齐回显（editor/table/toolbar.ts + editor/contextMenu/opsTable.ts + editor/table/parse.ts）
- 来源: 人工介入（复刻评审 Step 3.2 主 agent 裁定 · 批 A 必修项 2，功能缺陷升级关注）
- 关联任务: IT-01/FE-04（#5）、IT-01/FE-01/FE-03/FE-10（样式互证）
- 涉及基线:
  - AC: requirement/ac.md#UI-IXD-04（「当前对齐键呈按下/激活态」）、#AC-RULE-03（三键切换冒号行与显示回显一致）
  - docs/specs/7C-table-toolbar/plan.md#对齐按下态（原「model.aligns[col] 精确匹配（'' 全不按）」映射被本裁定取代）
- 变更前: 按下/勾选回显只认冒号行显式标记（`:---`/`:---:`/`---:` → left/center/right）；`---` 解析为 '' 时三键全不按、菜单对齐项全不勾——默认左对齐列（GFM 语义即左对齐）无回显，构成 UI-IXD-04 功能缺陷。按下态样式为 accent 实底+浅图标
- 变更后: 显示层经 effectiveAlign 归一（'' → 'left'，GFM 默认左对齐），工具栏 is-pressed 与菜单对齐 ✓ 同源消费；按下态样式改 accent-soft 半透明底（--accent-soft）+ accent 图标（--accent，亮 #0969da/暗 #58a6ff）。alignmentOf/冒号行写回不动（`---` 不会被改写为 `:---`，零往返失真保持）
- 变更原因: UI-IXD-04 明文「当前对齐键呈按下/激活态」以列的实际渲染对齐为准，GFM `---` 即左对齐；FE-04#5 实测三列分列左/中/右时三键零回显。样式双改对齐 ui_02 `.tbtn.active`（rgba(9,105,218,0.12) 底+蓝图标）
- 更新时间: 2026-10-01

## CHANGE-15: 表格编辑态整表外框改画在 wrap——outline 绕开 border-collapse 压盖（CHANGE-13 机制修正）
- 状态: pending
- 类型: Updated
- 风险等级: 低（呈现层绘制机制修正，视觉意图与 CHANGE-13 一致；UX-P28 F3 零位移契约不变）
- 模块: 表格编辑 chrome（styles/markdown.css 编辑态整表外框）
- 来源: 任务 IT-01/FE-03（r2 必修 U1）
- 关联任务: IT-01/FE-03、IT-01/FE-01/FE-04/FE-10（批 A 互证）、IT-02/FE-05（无连带，仅同期 r2）
- 涉及基线:
  - UI 设计稿: docs/requirements/ui-ux-redesign/ui/ui_02_table_edit.html#edit-state container outline（编辑态整表 1px solid --accent 蓝外框）
  - AC: requirement/ac.md#AC-FN-01（编辑态浮现面）、#AC-RULE-17
- 变更前: `.cm-md-table-wrap.cm-md-table-editing .cm-md-table { border: 1px solid var(--accent) }`——computed 值为 rgb(9,105,218) 正确，但 border-collapse 边框冲突消解让 th/td `--border` 灰边在共享边缘胜出（CSS 2.1：cell border wins over table border），多单元格表外缘像素为 --border 灰，蓝框不可见（实测 4×4 表四边 32 采样 accent 计数 0）
- 变更后: 外框画在 wrap 上 `outline: 1px solid var(--accent); outline-offset: -1px`（作用域 `.cm-md-table-wrap.cm-md-table-editing`，退出编辑态无框）；table 级 border 规则删除。outline 在 collapse 模型之外绘制（盖住灰边像素环）、不参与布局——UX-P28 F3 零位移保持；激活单元格 2px accent outline / cell 边框色 / 批 A 工具栏 pill / 批 K H2 字号不动
- 变更原因: CHANGE-13 落地机制（table border 改色）被 border-collapse 压盖，设计意图未渲染；仿真对比三技法（temp/batch-r2-fix-sim.mjs）：wrap outline -1px 外缘纯 accent 灰迹全无；wrap box-shadow 被否（灰边残留在环内侧成双环）；wrap border 会进布局违零位移
- 更新时间: 2026-10-01

## CHANGE-16: 焦点环 token 断链修复——:root 补声明 --accent 且 --focus-ring 主题块重声明（CSS 替换时点烘焙问题）
- 状态: pending
- 类型: Updated
- 风险等级: 中（token 分层修复；--focus-ring 全消费方渲染行为从「无环」变「按主题 accent 环」，FE-05 UI-IXD-11 恢复既定行为）
- 模块: token 词表（styles/tokens.css + styles/themes.css + styles/tokens.test.ts）
- 来源: 任务 IT-02/FE-05（r2 必修新产品 bug，由 IT-01/FE-03 r2 轮合并修复）
- 关联任务: IT-02/FE-05（根因与证据）、IT-01/FE-03（r2 修复轮）、IT-01/FE-11（token 守护测试族）
- 涉及基线:
  - AC: requirement/ac.md#UI-IXD-11（键盘焦点环）；宪法 token 分层（:root 唯一声明点 / .theme-* 仅翻值）
- 变更前: `tokens.css :root` 声明 `--focus-ring: 0 0 0 1px var(--accent)`，但 `--accent` 只在 `.theme-light/.theme-dark` 定义——var() 在 :root 计算值时点替换失败，computed `--focus-ring` 为空，`chrome.css .menubar-label:focus-visible { box-shadow: var(--focus-ring) }` 匹配 :focus-visible 但 box-shadow: none，menubar 根钮键盘焦点环永不渲染（证据 reports/IT-02-FE-05/shots/batch-f-fe05-root-focus-ring.png）
- 变更后: (1) `--accent: #0969da` 在 `:root` 补声明（主题块翻值不变：亮 #0969da/暗 #58a6ff）；(2) `--focus-ring: 0 0 0 1px var(--accent)` 同时在 `.theme-light`/`.theme-dark` 重声明——CSS 自定义属性 var() 在声明元素的计算值时点即完成替换并按已替换值继承，仅 :root 声明会把亮色 accent 烘焙进暗主题环（仿真 darkRingRootOnly 实测 #0969da），主题块重声明让替换在主题元素上按主题 --accent 重算（darkRingReDeclared → #58a6ff）；(3) tokens.test.ts 增链路守护：:root 级 token 引用的自定义属性必须在 :root 有声明，且引用了主题翻值 token 的 :root token 必须双主题块重声明
- 变更原因: 修复 FE-05 焦点环永不渲染的真 bug；仅把 --accent 补进 :root 不够（暗主题环色错），主题块重声明属「翻值」而非选择器补丁，合宪法；无契约面变更
- 更新时间: 2026-10-01

## CHANGE-17: 菜单项执行与面板关闭顺序取舍 + 叠加态验证口径（UX-P04 F4b / PATH-06 r2 校正）
- 状态: pending
- 类型: Updated
- 风险等级: 低
- 模块: 菜单（MenuBar / EditorContextMenu）
- 来源: 业务流评审 PATH-06 软门修复批（fix-biz-PATH06 P2b 起草）→ PATH-06 r2 登记口径校正（主 agent 落地）
- 变更前: （登记失真）统一记为「close-after-run → action 先于 close」，未区分双菜单；未登记叠加态手势不可构造取舍。
- 变更后: 分菜单口径——**MenuBar 叶项：action 先于 close**（MenuBar.tsx:102-103 runItem action→closeAll，UX-P04 F4b）；**EditorContextMenu（⋮/右键）叶项：close-first**（EditorContextMenu.tsx:255-256 closeContextMenu() 先于 item.run?.()）。删除类危险项弹确认框时，确认框恒最上层（PEND-04），Esc/空白仅关确认框。**叠加态构造性取舍**：因 ctxMenu close-first + 确认框全屏遮罩拦截再唤起，「⋮ 菜单+确认框同开」手势路径不可构造；验证口径定为「确认框+⊞ 工具栏同开（程序式 click 构造）+ z 序契约测试 overlayZOrder.test.ts + 代码读证」，核心断言=同开时确认框恒最上层（z 序 + modal tier + outside-let-go 三件套）。
- 变更原因: 与 glb-hush:one-shot 统一消费权对齐；PATH-06 r2 指出原条目两读同向自相含混且未登记真正取舍，按双菜单实作校正。
- 更新时间: 2026-10-02（r2 校正）

## CHANGE-18: 浮层 z 序分层定标（glb-modal:stacking）
- 状态: pending
- 类型: Updated
- 风险等级: 中
- 模块: 全局浮层
- 来源: 业务流评审 PATH-06 软门修复批（fix-biz-PATH06 P2b 起草，主 agent 落地）
- 涉及基线: menu-tree.md#0.1 层序表（T区999>D区200 字面修订）；design/api/GLB-global-patterns.md#3.3（现文「z-index 对齐 menu-tree §0.1 D 区=200」，GLB-global-patterns.md:84——修订为「以 overlayZOrder 契约分层 dialog-overlay > popover > ctx-menu 为准」，交叉引用不再指已废除字面值）
- 变更前: popover（table-grid-picker/code-lang-picker）z 2400 高于 dialog-overlay 2000；menu-tree §0.1 字面「T区 999 > D区 200」与 GLB「确认框最上层」矛盾。
- 变更后: 层序钉为 dialog-overlay(2000) > popover(1500) > editor-context-menu(1000)（契约测试 overlayZOrder.test.ts 守护）；menu-tree §0.1 修订为「D 区确认框恒最上层，T 区工具/浮层不得超过 D 区」，999/200 字面值废除，以本分层为准。
- 变更原因: AC-RULE「确认框开启时最上层」；原 T>D 字面基线无法与 PEND-04 共存，按 adjudicated design-wins 统一口径。PATH-06 r2 校正：GLB §3.3.1「D 区=200」交叉引用纳入本条修订范围（基线文本合并随 doc-reconcile）。
- 更新时间: 2026-10-02（r2 校正）

## CHANGE-19: 表格菜单边界位灰显回退——「下移该行/右移该列」恢复可点击（AC-RULE-07 仅限两项）
- 状态: pending
- 类型: Updated
- 风险等级: 低（呈现层禁用规则；op 边界 no-op 语义与键盘路径不变）
- 模块: ⋮/右键表格菜单禁用规则（editor/contextMenu/opsTable.ts isTableOpDisabled）
- 来源: 业务流评审 PATH-05 软门修复批（fix-biz-PATH04-05，P2 分叉裁定）
- 关联任务: IT-01/FE-04（禁用规则）、IT-01/FE-01（canDeleteRow/canDeleteCol 同源）
- 涉及基线:
  - AC: requirement/ac.md#AC-RULE-07（禁用范围仅限「首行上移」与「首列左移」两项）
  - UI 设计稿: docs/requirements/ui-ux-redesign/ui/ui_03_table_menu.html（边界位渲染态为可点击/无灰显）
- 变更前: isTableOpDisabled 额外灰显末行「下移该行」与末列「右移该列」（超出 AC-RULE-07「仅限两项」）
- 变更后: 灰显收敛回 AC-RULE-07 冻结面——仅「首行上移」「首列左移」灰显（+ PEND-12 最小结构禁删行/列）；末行「下移该行」/末列「右移该列」恢复可点击，边界点击走 op 边界 no-op（moveRowOp/moveColOp 返回 null）静默无 toast，键盘路径不动
- 变更原因: P2 分叉裁定「先核 mock 再定分支」——ui_03 mock 边界位可点击/无灰显、设计注释「表头保护灰显即语义」仅列两项 → 取 Branch B 回退灰显（若 mock 灰显则改登记扩项，实际不符）；opsTable.test.ts 断言同步改钉
- 更新时间: 2026-10-02

## CHANGE-20: 结构 op destroy 端 handoff 抑制窗（AC-PEND-11 表头污染/undo 双历史修复）
- 状态: pending
- 类型: Updated
- 风险等级: 高（UX-P28 handoff correctness-critical 跨方法状态；AC 判据面）
- 模块: 表格编辑（editor/table/nestedSession.ts 抑制标记 + editor/table/commands.ts runTableOp + editor/contextMenu/opsTable.ts runOp dispatch）
- 来源: 业务流评审 PATH-04 软门修复批（fix-biz-PATH04-05，P0 必修）
- 关联任务: IT-01/FE-02（主责）、IT-01/FE-01/FE-04/FE-08（同族触发面连带）
- 涉及基线:
  - AC: requirement/ac.md#AC-PEND-11、#AC-OP-02、#AC-ERR-01、#AC-RULE-08
- 变更前: nestedSession.destroyHandoff 的 isRetarget 仅比对 getTableEdit(view.state).active（=op nextActive）与旧 widget spec.active 的 row/col；ops.ts insertRowAboveOp/deleteRowOp 的 nextActive 恒 {row: idx, col: 0}、setAlignOp 恒 {row: 0, col}——激活格在第 0 列时坐标相同 → isRetarget=false → 走「同格 pending 文本保全」分支 → pendingHandoff + commitHandoff 微任务**独立事务**把旧格文本写进新格（①新表头被旧表头文本污染 ②undo 栈两条历史，一次 Ctrl+Z 不还原）
- 变更后: guard 层抑制窗（三选一取方案 a）——nestedSession 模块级 handoffSuppressDepth + withHandoffSuppressed(fn)；runTableOp 与 opsTable runOp 的结构 dispatch 在抑制窗内执行（widget destroy 同步发生在 view.dispatch 内，窗覆盖 capture）；shouldHandoff 纯决策分层「suppressed || hop/retarget」；pending 文本仍经 modelWithPendingText 折叠进结构 op 单事务。**ops.ts 的 nextActive 未动**（红线：不动 ops.ts）
- 变更原因: isRetarget 坐标比对无法区分「rebuild 同格」与「结构 op 坐标碰撞」（nextActive 语义受 AC-OP-02 表头身份迁移约束不可改），须在 guard 层携带结构事务语义；headless CM6 state 级回归钉住（激活格 (0,0) 首行上插/删行/对齐三族：新表头首格为空 + 一次 undo 逐字节还原含参差态 + history 仅一条）
- 更新时间: 2026-10-02

## CHANGE-21: 表格结构操作写入口收口只读闸门（AC-ERR-08/AC-RULE-16）
- 状态: pending
- 类型: Updated
- 风险等级: 中（AC 判据面；新增闸门消费点，闸门本体属 IT-03/FE-04）
- 模块: 表格结构操作写点（editor/table/commands.ts runTableOp + editor/contextMenu/opsTable.ts runStructOp/cutCell/pasteCell/formatTableSource/confirmDeleteTable）
- 来源: 业务流评审 PATH-05 软门修复批（fix-biz-PATH04-05，P1 必修）
- 关联任务: IT-01/FE-02（主责）、IT-01/FE-04/FE-08（入口连带）
- 涉及基线:
  - AC: requirement/ac.md#AC-ERR-08、#AC-RULE-16；tech-design.md#10-异常处理
- 变更前: 表格结构操作三入口（runTableOp / opsTable runOp / confirmDeleteTable / formatTableSourceRange，含 cutCell 写路径）全未接 assertWritable()——只读文件照常改写 + 假成功 toast
- 变更后: 写前 dispatch 收口统一接 readOnlyGuard.assertWritable()（whenWritable 薄消费层：无活动路径=Untitled 同步放行保既有同步 boolean 契约；有路径逐入口探针，写与回执同窗共用一次探针 → 恰一条 err.readonly）；只读时拒绝 dispatch、文档逐字节不变、不置 dirty、回冻结 toast err.readonly；confirmDeleteTable 在确认框**之前**拦截；copyCell 纯读不设闸；toolbar.ts→runTableOp 自然被闸住（toolbar.ts 未动）
- 变更原因: AC-ERR-08/AC-RULE-16「写前拦截 + 不执行任何写入 + 不产生半提交」的判据要求写点前置；闸门本体是 IT-03/FE-04 readOnlyGuard（本批只消费不重实现）
- 更新时间: 2026-10-02

## CHANGE-22: 删表 confirm 异步稳态重解析跨度（FE-08 扩展-1）
- 状态: pending
- 类型: Updated
- 风险等级: 中（破坏性写点的区间真源；全仓唯一删表确认入口）
- 模块: 删表确认流（editor/contextMenu/opsTable.ts confirmDeleteTable）
- 来源: 任务 IT-01/FE-08 评审 Minor① 扩围（并入 fix-biz-PATH04-05 随批）
- 关联任务: IT-01/FE-08（缺陷来源）、IT-01/FE-02（修复归属批）
- 涉及基线:
  - AC: requirement/ac.md#AC-RULE-15、#AC-OP-09；stale-instance 纪律（editor/table/resolve.ts 文件头）
- 变更前: confirmDeleteTable 的 confirm 是异步 Promise，resolve 后仍用点击时解析的旧 span.from/to 调 deleteTableRange——whenWritable 探针 + 确认框期间文档可变，旧区间过期即误删（删错区间/截断表尾/删到表外内容）
- 变更后: confirm 成功确认路径在调 deleteTableRange 前以 resolveTableModel(view, span.from) 重解析表格最新跨度（modelSpan 同语义，stale-instance 纪律），用重解析出的最新 from/to；解析失败（表格已不存在/锚点已不在表内）→ 静默 no-op 返回（不删、不报错、不发回执）；删除动作仍在 withHandoffSuppressed 内（与 CHANGE-20 同窗，整表删的 destroy 不留 handoff 残留）
- 变更原因: confirm 异步落点使点击时 span 天然过期，属破坏性写点的区间真源缺陷；判据测试（confirm 期间文档变更/表格消失 → 不删错误区间静默返回；正常路径用最新跨度）已钉
- 更新时间: 2026-10-02

## CHANGE-23: MenuBar 外点关闭的焦点归宿取舍（AC-FN-10 判据 2 例外登记）
- 状态: pending
- 类型: Updated
- 风险等级: 低（行为零变更，既有取舍补登记；Esc/超界滚动选择主路径判据不受影响）
- 模块: 菜单弹层基座（MenuBar.tsx closeIfOutside / popup.ts 焦点纪律）
- 来源: 业务流评审 IT-02/PATH-02 P2 登记缺口补完（FE-04 code-review Minor 早有同项要求）
- 关联任务: IT-02/FE-05（主责）、IT-02/FE-04（弹层焦点基座）
- 涉及基线:
  - AC: requirement/ac.md#AC-FN-10 判据 2（Esc/外点/超界滚动选择路径焦点回正文）
- 变更前: 「外点」触发的焦点归宿无例外表述；实现 closeIfOutside 对落在 button,input,textarea,select,a,[contenteditable],[tabindex] 的外点目标执行 closeAll({refocus:false})——焦点留在该可聚焦目标（popup.ts:192-194 注释自证「点到对话框等真焦点持有者时不抢焦点」），与判据字面「焦点回到编辑器正文」在该分支不一致，且取舍未登记
- 变更后: 登记取舍——**外点落到可聚焦目标（button/input/textarea/select/a/[contenteditable]/[tabindex]）时菜单关闭但不抢焦点，焦点归该目标**（点击意图=聚焦该目标，抢回正文违背指哪打哪）；「焦点回正文」判据适用于外点落到非聚焦面（背景/正文区）与 Esc/超界滚动选择路径。行为零变更
- 变更原因: AC-FN-10 判据 2 未区分外点目标类型；实现取「不抢真焦点持有者」为合理 UX（FE-04 审查 Minor + PATH-02 P2 双次提出），补登记消除未登记偏离；AC 文义例外措辞如需同步归 doc-reconcile
- 更新时间: 2026-10-02

## CHANGE-24: 语言切换即时性边界定标——toast 驻留保持渲染时语言（边界取舍）+ 删表确认框 key-based live-relabel
- 状态: pending
- 类型: Updated
- 风险等级: 低（确认框行为向既有 DialogKeyedCopy 契约收敛、冻结字面零改动；toast 为零行为变更登记）
- 模块: Dialog 契约（components/Dialog.tsx ConfirmOptions + editor/contextMenu/opsTable.ts 删表确认调用点）＋ toast 回执（hooks/useToast 5s 驻留文案面）
- 来源: 任务 IT-01/FE-11 定向修复批（FE-08 域：Dialog 契约）
- 关联任务: IT-01/FE-11、IT-01/FE-08
- 涉及基线:
  - AC: requirement/ac.md#AC-FN-28（语言切换无裸 key / key 集合全对齐）、#AC-RULE-15、#AC-OP-09、#AC-ERR-07（删表确认固定文案）
- 变更前: 两处语言切换即时性口径不一致且边界均未登记——(A) 删表确认框由调用点 t() 预烘焙 title/message/confirmLabel/cancelLabel 串传入 `rt.confirm`，确认框打开后切换语言不换字，与 Dialog.tsx:15-18 DialogKeyedCopy「*Key 字段渲染侧 t() 即时求值」live-relabel 契约不一致（label 面 string 优先时预烘焙串冻结）；(B) toast 回执同样在触发时 t() 预烘焙，5s 驻留窗内语言切换不换字——行为存在但边界取舍无登记
- 变更后: **分列登记**——(A) **删表确认框 key-based live-relabel（行为变更）**：`confirmDeleteTable` 确认框 options 改为只传 key 不传预烘焙串（`titleKey: 'ctx.deleteTable'`、`messageKey: 'ctx.deleteTableConfirm'`、`confirmLabelKey: 'ctx.deleteTableConfirmOk'`、`cancelLabelKey: 'dialog.cancel'`）；`ConfirmOptions` 补 `confirmLabelKey`/`cancelLabelKey` 字段且 `dialog.confirm()` 透传（既有 `dialog.ok`/`dialog.cancel` 默认仅在调用方未给 key 时兜底）；Dialog 渲染侧沿既有契约 t() 即时求值——**打开中的确认框随 en→zh→en 切换即时换字、无裸 key**。冻结字面零改动：「删除后可用一步撤销还原，确认删除该表格」「确认删除」「取消」仍取既有冻结面（frozenCopy.test 注册表口径不变），仅派生方式从预烘焙串改 key 派生。(B) **toast 驻留期语言保持 = 边界取舍（零行为变更登记）**：5s TOAST_DWELL_MS 驻留窗内 toast 文案保持**渲染时语言**，不做 toast store key 化——渲染时语言正确、无裸 key、多 toast 顶替重置语义不变；驻留期内切语言不换字属登记取舍（与确认框 live-relabel 分列），后续如需同口径再立专项
- 变更原因: AC-FN-28「切换界面语言」与 DialogKeyedCopy 契约要求打开中浮层即时换字；预烘焙串使删表确认框违反该契约（P2-2 必修）。toast store key 化需改 ToastInput/store 形状波及全量回执调用点，5s 驻留窗内收益低——取「渲染时语言驻留」为边界取舍并显式登记，避免被误判为未修缺陷。确认框与 toast 同属语言切换即时性面但风险/收益不同，分列登记防止互相绑架
- 更新时间: 2026-10-02

## CHANGE-25: 抑制窗覆盖面扩展至 TSV 粘贴整表结构替换 dispatch（handleTsvPaste）
- 状态: pending
- 类型: Updated
- 风险等级: 高（UX-P28 handoff correctness-critical 同族残余；AC 判据面——粘贴值存活/undo 单历史）
- 模块: 表格编辑（editor/table/commands.ts handleTsvPaste 的 pasteTsvOp 整表结构替换 dispatch）
- 来源: 业务流评审 PATH-04 r2 同机制残余（business-review-IT01PATH04-r2，1×P1 主 agent 判必修）
- 关联任务: IT-01/FE-01（修复归属）、IT-01/FE-02（CHANGE-20 原抑制窗主责，同族连带）
- 涉及基线:
  - AC: requirement/ac.md#AC-PEND-11、#AC-OP-02、#AC-ERR-01、#AC-RULE-08
- 变更前: handleTsvPaste 的整表结构替换 dispatch（pasteTsvOp → 全表 rewrite + setActiveCell）未裹 withHandoffSuppressed——pasteTsvOp 的 nextActive 恒等于激活格（**任意列**坐标均可碰撞，不限第 0 列），1×1 TSV（Excel 单格复制典型形态，parseTsv("hello\n") → [["hello"]]）时 isRetarget=false → captureHandoff stash + commitHandoff 微任务把旧嵌套文本写回覆盖刚粘贴的值 + input.table.cell 独立 history（一次 Ctrl+Z 不还原）
- 变更后: handleTsvPaste 的 main.dispatch 裹入 withHandoffSuppressed（与 commands.ts runTableOp 窗、opsTable.ts runOp 窗同款——CHANGE-20 抑制窗覆盖面扩展至本 dispatch）；1×1 TSV 粘贴于激活格：粘贴值存活、无 pendingHandoff 微任务二次写回、一次 Ctrl+Z 逐字节还原到粘贴前（无 input.table.cell 第二条历史）；多格 TSV 粘贴/激活格落位/参差 rectify 正向面不回归。**最小改动**，不做「抑制窗下沉统一收口点」结构性重构
- 变更原因: 业务流评审 PATH-04 r2 发现 CHANGE-20 抑制窗漏盖 handleTsvPaste 这一整表结构替换 dispatch（触发面向量=pasteTsvOp nextActive 恒等于激活格 + 1×1 TSV 形态，与 runTableOp 族同机制）；定向 headless 回归钉住（1×1 于 (0,0)/(0,1) 两列碰撞面 + 负对照文档向量 + 多格/参差正向面，红绿验证通过）
- 更新时间: 2026-10-02

## CHANGE-26: 导出任务勾选态大小写口径同源 + mermaid last-good 位置键随变更重映射（AC-OP-18 判据 2 / AC-ERR-11 判据 1）
- 状态: pending
- 类型: Updated
- 风险等级: 中（AC 判据面；导出三通道勾选态一致性 + last-good 缓存键位 correctness，无契约/接口变更）
- 模块: (A) 静态导出列表渲染（export/renderDoc/listTable.ts renderListItem TaskMarker 完成态判定）；(B) mermaid 错误态记忆（editor/mermaid/errMemory.ts 位置键缓存 + editor/setup.ts createExtensions 挂接）
- 来源: 业务流评审 IT-03/PATH-08（business-review-IT03PATH08，2×P2；r2 复审 1×P2 跨标签残余，同根因 first-touch 自动派修）
- 关联任务: IT-03/FE-10（修复归属）、IT-03/FE-06（勾选态口径源头，只读参照）
- 涉及基线:
  - AC: requirement/ac.md#AC-OP-18（判据 2 任务项勾选态三通道一致）、#AC-ERR-11（判据 1 渲染区保留上一次成功渲染的图）
- 变更前: (A) 导出侧完成态判定 `textOf(ctx, marker).includes('x')` **大小写敏感**——含 `[X]` 的任务项经 renderDoc 共用管线导出 HTML/PDF/富文本三通道均渲染未勾选（`<input type="checkbox" disabled>` 无 checked），与编辑视图不一致（编辑侧 livePreview/handlers-tree.ts `isTaskDoneText = /\[x\]/i`、contextMenu/detect.ts `[ xX]` → checked 均大小写不敏感）；(B) errMemory `Map<number, MermaidGoodRender>` 按 fence 文档位置作键且**从不随文档变更重映射**——fence 之前任意编辑使 `sourceFrom` 漂移 → renderHost `getMermaidLastGood(sourceFrom)` miss → `showPlaceholder()` 显示 failed 占位，违反 AC-ERR-11 判据 1
- 变更后: (A) 导出侧改与编辑侧同源判定：`TASK_DONE_RE = /\[x\]/i`（listTable.ts 局部同源镜像，双侧注释互指 handlers-tree.ts `isTaskDoneText` / detect.ts；不新建公共层、不把 live-preview widget import 图拉进静态导出管线）——`[X]`/`[x]` 导出 `checked`、`[ ]` 不勾选，三通道一次修复；(B) `remapMermaidLastGood(changes)` 以 `ChangeDesc.mapPos(pos, 1)` 重映射键位（assoc=1，键随 fence 走），挂 `mermaidLastGoodRemap` StateField 于 setup.ts createExtensions（**StateField 而非 updateListener**：updateListener 在 docView.update/widget toDOM 之后触发，同事务 toDOM 查询仍 miss；StateField.update 在 state update 内、重绘前完成）；**防串图**：键落在被删/被替换区间（fromA ≤ pos < toA）的条目一律丢弃（fence 起点已亡不得还魂到别的键）+ mapPos 保序 + `next.has` 碰撞守卫——两个 mermaid 块不得把 A 的旧图当 B 的；主场景（fence 内改语法 → dim 旧图+错误条 → 修复重渲染，S3 已验）键不动、行为不变；**(B-r2) 多标签维度隔离（r2 残余收口）**：last-good 缓存改按文档身份分命名空间——`WeakMap<MermaidDocId, Map<pos, entry>>`，`MermaidDocId` 由 `mermaidLastGoodRemap` StateField 值承担（每 DocTab `EditorState.create` 链 `create()` 铸一枚、`update()` 恒定不变；App.tsx P26 一份 extensions 服务所有 DocTab 状态即由此获得互异身份），`remapMermaidLastGood(doc, changes)` 只重映射本命名空间——B 标签的 `ChangeDesc` 不再跨文档 mapPos A 标签的键（键漂移门关闭）；renderHost `mountMermaidRender` 在**发起渲染/查询时**（`mermaidDocIdOf(view.state)` 捕获）把身份带入异步 `rememberMermaidGood` 回调（共享 EditorView 切标签后回调里现取「当前 state」会写错命名空间——身份绑定钉）；存储 WeakMap 免显式清退（关标签 state 链成垃圾即随 namespace 释放），每文档 64 条上限口径不变。**同位置跨标签串图一并收口**（验收 2）：A、B 各持有 sourceFrom 相同位置的 last-good 时各归各命名空间，`getMermaidLastGood` 互不可见对方 SVG（修复前既有缺陷，身份键方案自然覆盖）。嵌套单元格编辑器隔离不降级：nestedSession 自建扩展表仍不含该 field（零改动），无 field 的 state 走 unkeyed 兜底命名空间（语义与改造前一致）。主场景（S3）行为不变。**验收**：B 任意插/删/替换后 A 键不漂移、A fence failed 态切回仍按原键命中 dim 旧图不落 showPlaceholder（errMemory.test.ts 跨标签 3 用例 + 既有 8 用例全绿）；typecheck 双 tsconfig 零错 + test:unit 1066/1066（76 files，基线 1063 只增不减）
- 变更原因: AC-OP-18 判据 2「导出物中任务项勾选态与编辑视图一致」被大小写敏感判定破坏（P2）；AC-ERR-11 判据 1「保留上一次成功渲染的图」被位置键漂移破坏（P2）。修法取最小正确解：(A) 局部同口径镜像（import 边界考量，见变更后）；(B) 择方案 a「键位随 Changes 重映射」（calloutFold.ts / table/state.ts mapPos 既有模式同款），弃「近邻键兜底」（不能严格防串图）。(B-r2) r2 复审发现 (B) 修复引入面残余：模块级 Map 无文档身份，多 DocTab 共享一份 extensions/一份模块 Map 时，标签 B 的 ChangeDesc 对标签 A 的位置键跨文档 mapPos → 键漂移 → 切回 A 失败态查不到 last-good 落 showPlaceholder（AC-ERR-11 判据 1 经「跨标签键漂移」门再入）；择「文档身份命名空间键」（同时覆盖同位置跨标签串图面），弃「仅持图文档才 remap」（需另建持图文档判定、等价复杂度且不覆盖串图面）；身份必须在发起渲染时绑定（异步 remember 回调时「当前」文档已可能切走）
- 更新时间: 2026-10-02

## CHANGE-27: toast 撤销钮 token 调亮 + 弹层族原生控件 token 皮肤 + `.primary` 死类清账（AC-NF-09 / AC-ERR-14 判据 2）
- 状态: pending
- 类型: Updated
- 风险等级: 低-中（AC 判据面视觉合规修复；纯观感/token 面，无契约/接口/行为语义变更）
- 模块: (A) toast 回执面（styles/themes.css 新 token `--toast-accent` + styles/toast.css `.toast-undo-btn` + styles/tokens.test.ts 守护表）；(B) 弹层族原生控件皮肤（components/TableInsertDialog.tsx number×2/按钮×2 + styles/markdown.css 图片工具栏 range + styles/buttons.css 按钮三态）
- 来源: 业务流评审 IT04PATH02 缺陷修复批（business-review-IT04PATH02-defects，batch9 校准重测暴露 2×P2 真实产品缺陷，first-touch 自动派修）
- 关联任务: IT-04/FE-02（修复实施）、IT-01/FE-02（toast 面归属）、IT-01/FE-05（⊞ TableInsertDialog 归属）、IT-03/FE-04（图片工具栏归属）
- 涉及基线:
  - AC: requirement/ac.md#AC-NF-09（WCAG 1.4.3 对比度 ≥4.5:1）、#AC-ERR-14 判据 2（深色无未适配浅色块）
- 变更前: (A) `.toast-undo-btn` ghost 形态 `color/border: var(--accent)`——toast 面 ui_07 双主题恒深 `--toast-bg:#1f2328`，浅色主题 `--accent:#0969da` 对该面 **3.04:1 < 4.5**（AC-NF-09 违反；深色 `#58a6ff` 同面 6.25 达标，正文 13.37 达标）；(B) TableInsertDialog 裸 `input[type=number]`×2（UA rgb(255,255,255)）+ 裸 `button`×2（UA rgb(240,240,240)，且 `.primary` 为死类——全仓零 CSS 规则）+ 图片工具栏裸 `input[type=range]`（UA 浅色，markdown.css 仅设 width/accent-color）——深色主题下 5 处近白块（AC-ERR-14 判据 2 违反）
- 变更后: (A) 新增 toast 专用 accent token **`--toast-accent: #58a6ff`**（themes.css `.theme-light`/`.theme-dark` 双侧声明同值——toast 面主题不变故 token 语义按「深色接待面上的动作强调」取深色 accent 值；**不 alias 全局 `--accent`**，避免 toast 面与 chrome accent 翻转再耦合、也避免牵动主题色四副本），`.toast-undo-btn` color/border 改挂该 token，ghost 形态（透明底/圆角/字距）零改动；tokens.test.ts `THEME_SPLIT_OVERLAY_TOKENS` 收录（双侧声明 + 零影子声明守护）。复测：撤销钮双主题 **6.25:1**（浅 3.04→6.25 达标）、正文 13.37:1 不降级。(B) 原生控件全部接既有 token 皮肤：number×2 挂 `.prefs-input`（forms.css 既有）、按钮改 `.dialog-btn` / `.dialog-btn dialog-btn-primary`（**`.primary` 死类清账**——删无规则死类、改挂 Dialog.tsx 同款真 primary 族，DOM `.primary` 残留 0），range 走 `appearance:none` + `::-webkit-slider-runnable-track`（`--bg-inset`/`--border`/`--radius-sm`）+ `::-webkit-slider-thumb`（`--accent` 14px 圆点）token 皮肤（先例 `.cm-md-task` checkbox）；buttons.css 补 `.btn`/`.dialog-btn` `:active`（brightness 0.92）与 `:disabled`（opacity 0.5 / cursor default）三态完整性。复测：深色五处 nearWhite offenders=**[]**（rows/cols/cancel bg rgb(30,30,30)=--bg、confirm rgb(88,166,255)=--accent、range 透明），浅色无回归（bg=浅 --bg 协调），hover/active/disabled 三态实测可用，深色弹层族硬编码浅色块重扫 offenders=[]
- 变更原因: batch9 校准重测（含全子孙扫描）暴露两项 P2 真实产品缺陷：AC-NF-09 被 toast 撤销钮 3.04:1 破坏、AC-ERR-14 判据 2 被 5 处 UA 原生控件浅色 chrome 破坏。修法取最小正确解：(A) 按 ui_07「toast 面主题不变」语义新增面内专用 token（toast 家族前缀命名，与 `--toast-bg/--toast-fg/--toast-border` 同族），弃「翻全局 --accent」（四副本爆炸半径 + 错误语义——chrome accent 不该为 toast 面让步）；(B) 复用既有 token 皮肤类（`.prefs-input`/`.dialog-btn` 族）而非新写平行皮肤（CLAUDE.md 按钮皮肤单源纪律），死类 `.primary` 一并清账并入 `.dialog-btn-primary`；range 无既有皮肤类，按 checkbox 先例 appearance:none 走 token
- 验收数字（batch10 收敛补记，2026-10-02）: typecheck 双 tsconfig 0 Error + test:unit 1066/1066（76 files）；batch10 CDP 复测 7/7 PASS。r2 补注：batch10-data 中 native.*.rangeTrack 读数为宿主 input 回退值（getComputedStyle 无法读 UA shadow 伪元素），不作伪元素皮肤证据采信——range 皮肤证据以实拍截图 + markdown.css 静态引用承担
- 更新时间: 2026-10-02

## CHANGE-28: 收口批——code-review 必修-低/Minor 余债清账（快捷键/表格/渲染/悬浮四域）

- 状态: pending
- 类型: Updated（防御闸补齐 + 死面清账 + 视觉余量微修 + 少量交互语义缺陷修正；无契约扩张）
- 风险等级: 低-中（单点语义修正均有红绿钉住；视觉类数值等价或余量增大）
- 模块: (A) 快捷键/菜单域（shortcutSync.test 合流护栏、menuLayout 模块加载期校验与注释、build.ts 注释、Titlebar formatShortcut 死链、MenuBar Tab 收拢/child onClick 收口、keyboardNav 空子菜单 Enter/Space、keymap 恒挂断言）；(B) 表格域（handleTsvPaste 只读闸、parse.ts trimmedCell 倒置规范化、state.ts colWidths supersede、gridPicker 拖选死区）；(C) 渲染内容域（quoteFold 单遍收集/caret 余量/expandQuoteFolds 删除、多行任务删除线、ListDragHandle rAF+快照、deriveWidthPct 单源、错误条间距 token 化、--errbar-* 守护登记）；(D) 悬浮/杂项（useHoverDiscipline hideNow 快照、useHushLayer toast 断言真实面与 dispose 删除）
- 来源: Step 4 左轨 code-review 全部任务的必修-低（IT-02/FE-03 Important-1 BE-01 合流断言标记）与 Minor/Info 收口批候选 + 业务流评审登记残余（PATH-04-r3 观察②、PATH04-05 批内未尽③、PATH-08 附注）；四修复批收-A/B/C/D 并行落地
- 关联任务: IT-02/FE-01·02·03·05、IT-01/FE-01·05·08·09、IT-03/FE-03·04·06·08·10
- 涉及基线:
  - AC: AC-RULE-11（快捷键回显单源）、AC-ERR-08（只读拦截）、AC-FN-16/RULE-14（引用折叠不丢内容/不写正文）、AC-OP-15/16（列表任务）、AC-FN-14（浮层不遮挡锚点——收-D #2 豁免依据）
- 变更前: (A) shortcutSync 以 `zoomIn !== undefined` 单点作 BE-01 合流标记（漏迁两键可全绿放行）；menuLayout commandItem throw 在 useMenus 渲染路径（不变量破坏=整窗白屏）；menuLayout.ts:108/build.ts 注释含陈旧键位/遮蔽陈述；Titlebar formatShortcut 死 prop 链空转；Tab 落面板 nav 停留 submenu 层（childActive 误高亮）；空子菜单项 Enter/Space 走 run 关菜单（契约要求保持一级）；child onClick 与 runItem 双写执行序列；keymap 恒挂无断言。(B) handleTsvPaste 整表结构替换 dispatch 无 whenWritable 写前闸（只读文件可粘贴写入）；trimmedCell 空白格倒置区间 `{from>to}` → CM6 RangeError 被吞 → commitHandoff 文档级写回不可达（退化为 stash-only）；colWidths 旧键 undo 后 mapPos 漂移 debris 残留脏宽度；gridPicker 拖选落预设按钮松开=静默落空。(C) applyQuoteFoldDecos 每次重建双遍树收集；展开态 ▾ caret 越出 gutter 16px 文本列（长首行余量 0~2px）；expandQuoteFolds 零 dispatch 死命令面；多行任务删除线只盖首行；ListDragHandle 每 pointermove 全量重解析；deriveWidthPct/derivePct 双份且 fallback 不一（100 vs spec.width）；错误条间距/字号裸 px；--errbar-* 族未入 THEME_SPLIT_OVERLAY_TOKENS 守护。(D) hideNow 对非 active 条目无条件 setActive(null)（误清活动通道快照）；HushLayerStore.dispose() 零消费死接口；toast 不可动断言为局部变量同义反复（永真）。
- 变更后: (A) shortcutSync 改 all-or-none 合流标记（MERGE_MARKER_IDS 四键任一在表→断言四键全在逐值钉住 + toggleTheme 加速键必须消失；四键全无→过渡分支）+ pending 例外卫生用例（残余容忍型 pending 必须仍命中表条目、合流后 pending 清单必须为 []）；menuLayout 模块加载期 `assertLayoutMatchesRegistry()` 对真实注册表 id 集一次性校验（commandItem throw 留测试兜底），展开 id 收敛 EXPORT/FORMAT_SUBMENU_IDS 单源；menuLayout 注释改引命令 id（AC grep 判据字面成立）、build.ts 注释改 Q6 后口径；formatShortcut 死链全拆（Titlebar/useMenus/App，tooltip 文案零变化）；Tab onFocus/onFocusRow 与 onMouseEnter 同款收拢 `setNav({level:'menu',...})`；空子菜单项 Enter/Space 改 no-op（isSubmenuParent 判定，effect:'none'）；child onClick 收口 runItem 单点；keymap.test 增 extension 级恒挂断言（关断态 Mod-b/i/e、开断态八键）+ run 闭包真实 dispatch 断言；menuLayout.test 增 BASELINE↔真实注册表交叉断言。(B) prepareTsvPaste+handleTsvPaste 裹 whenWritable（只读=零 dispatch+恰一条冻结 err.readonly，与 runTableOp/opsTable.runOp 同口径，CHANGE-21 写点清单边界外收口）；trimmedCell 在 parse 层规范化倒置区间（swap→raw 全跨，commitHandoff/moveCell cellChange 三消费方单点受益，nestedSession/widget/ops 零触碰）——空白格文档级写回可达，commands.test 负对照如实恢复 stash+文档双向量钉住；state.ts colWidths supersede 规则（同事务 setColWidth 覆写键不再 mapPos，effect 写正键，delete/undo/redo 三向仅剩还原表 tableFrom 一键）；gridPicker onRelease 落预设区=执行该预设（applyPreset 与 click 同源），非按钮区回退 hover 确认，无双挑。(C) collectQuoteFoldRanges 增可选预计算 blocks 参数（仿 fold.ts），单次树遍历（折叠 callout 体内引用不再发摘要 replace，与模块注释契约一致）；▾ caret `right:0` 对齐 gutter 边（PIL 实测长首行墨迹间隙 8.57px，无裁切）；expandQuoteFolds StateEffect/field 分支全删（含 setup.ts 侦测接线，全仓 0 残留）；taskDoneTextSpans 块内后续行逐行追加 task-done mark（嵌套列表不外溢）；ListDragHandle 拖拽开始缓存行快照 + place() rAF 合帧（commit 仍 dropListMove live re-plan）；docLines 收敛 listDrag.ts 导出、draggable 复用 canReorderListItem；deriveWidthPct 抽 editor/image-parse.ts 单源（口径：live style.width → spec.width → 100），image-widget/ImageEditFloat 双侧共用；错误条 gap/margin/padding/font-size/border token 化（数值等价）；tokens.test THEME_SPLIT_OVERLAY_TOKENS 补 --errbar-fg/bg/border。(D) hideNow 仅当 `snapshot.active?.id === id` 才 setActive(null)（新钉用例红绿验证）；HushLayerStore.dispose() 核实零消费后删接口+实现；toast 守护改真实面三重断言（layerIds 无 toast 类 id / close() 集合精确 / 注入 deps 触达面枚举无 toast，真实 createToastStore 收拢后存活）。below-align 上翻顶裁不做 0-clamp：几何证明任何生效 clamp 必然侵占锚点 gap（违反 AC-FN-14 不遮挡），按「保不遮挡优先」取舍维持现状，登记豁免
- 变更原因: Step 4 双轨评审收口后必修-低（BE-01 合流断言标记单点）须于合流前落地；Minor 余债按收口批统一清账防债务滚雪球。语义修正类（只读闸/倒置区间/debris/死区/快照/空子菜单）均为既有缺陷或潜伏面，修法取最小正确解并红绿钉住；死面清账（formatShortcut/expandQuoteFolds/dispose）全仓核实零消费后删除；测试加固（all-or-none 标记、pending 卫生、恒挂断言、交叉断言、真实面断言）补护栏缺口不改行为
- 验收数字（收口批收敛，2026-10-02）: 合并终门禁 typecheck 双 tsconfig 0 Error + test:unit **1094/1094 全绿（79 files）**（基线 1066→1094 只增不减：收-B +8、收-A +7、收-C +12、收-D +1）；四批各自红绿记录齐（摘修复必红→恢复必绿）；e2e 缝零变更（formatShortcut/expandQuoteFolds/dispose 均非缝面，grep 核实）。登记面同批补完：FE-02.md AC-NF-09/AC-ERR-14 按 batch10 证据翻转通过、FE-06.md:150 台账勾销、FE-10.md 勘误、ui-redesign-tasks.md:135 指针勘误、IT-04/FE-02 报告回填 ①②④⑤+gates.log
- 更新时间: 2026-10-02
