# P25 Mermaid 源码实时预览

优先级：P25（**后置：V2 候选，当前不排期**） | 类别：UX/功能 |
预估规模：M

状态说明：本需求源自 P16 讨论中的"分屏实时预览"场景。P16 先交付错误
体验/模板/导出/lightbox；本项涉及编辑回路重设计，按排序原则"难题后置"
单独立项，待 P16 落地后评估。

## 背景

当前编辑 mermaid 的回路是：点击图 → 跳回 fence 源码 → 编辑 → 离开后
才重渲染。反馈延迟使画图体验显著落后于 mermaid.live 等专用编辑器。
"渲染态 Widget 内嵌编辑器"（路线 A）与"Markdown 源文本是唯一数据源"
的通用约束冲突风险高（P10 的单元格编辑为此付出了 L 级成本）；本需求
推荐**不进 Widget 编辑**的路线 B。

## 目标

编辑 mermaid 源码时图在旁边实时跟随——反馈延迟从"离开块"降到亚秒级，
且不引入 Widget 内的第二份数据源。

## 功能需求（路线 B：预览面板）

- [ ] 光标进入任一 mermaid fence（源码态，`blockTouched` 既有行为）：
      底部/侧向预览面板自动出现，实时渲染**该 fence 当前源码**的图
- [ ] 文档内容变更且光标仍在 fence 内：debounce 300ms 重渲染（走
      P15 限流队列）；渲染失败面板内显示错误（P16 覆盖条样式复用）
- [ ] 光标离开 fence：面板延迟 2s 收起（期间移回则取消）；手动 pin
      按钮可保持面板常驻（pin 状态存 session，对接 P03）
- [ ] 面板操作：Copy 源码 / 导出 SVG / PNG（复用 P16 工具条能力）
- [ ] 面板可调高度（拖拽分隔条），偏好记住高度
- [ ] 源码模式（P08）与 live 模式行为一致（fence 内光标判定基于语法树
      与模式无关）
- [ ] 文档中多个 mermaid fence：面板只跟随光标所在 fence；pin 时锁定
      当前 fence（以内容 hash 标识，文档编辑后 hash 变化跟随更新）

## 技术方案要点

- **数据流（满足通用约束）**：面板是纯投影——每次触发从
  `view.state.sliceDoc(fenceFrom, fenceTo)` 读源码渲染，面板不持有
  可写状态，一切编辑仍发生在 CM6 文档。无 Widget 内 contentEditable，
  无 write-back 问题。
- 光标判定：`EditorView.updateListener`（selection 变化）+
  `syntaxTree` resolve 到 FencedCode 且 lang=mermaid；结果经 effect 写入
  轻量 StateField/或直接 React state（面板是 React 层组件，模式同
  `Outline.tsx` 挂载）。
- 面板组件 `components/MermaidPreviewPanel.tsx`：调用 `renderMermaid`
  （`widgets.ts` 导出已有）；错误展示复用 P16 的 errorBar 结构。
- 布局：编辑器下方分栏（CSS flex 调高），不遮挡编辑区；自绘标题栏/
  状态栏层级注意 z-index。
- 性能：单 fence 渲染 + debounce + P15 队列，预期输入不卡顿；基准进
  P15 脚本场景集。

### 备选路线 A（不推荐首版）
Widget 内嵌 textarea 分屏 + write-through（每次变更 debounce 后 dispatch
改文档 fence 内容）。问题：undo 历史噪声、与 P09 mark 显隐/光标映射
冲突、Widget 内焦点管理——成本接近 P10，收益不高于路线 B。若 V2 要做
"点图直接改"的手感，再评估此路线。

## 验收标准（路线 B）

1. 光标点入 mermaid fence：≤0.5s 面板出现并显示当前图；输入节点名后
   ≤0.5s 图更新。
2. 语法错误输入：面板显示错误提示，上一版图保留（P16 行为）；改对后
   恢复。
3. 光标移到段落中：面板 2s 后收起；pin 后不收起且切换文档内其他 fence
   不改面板内容。
4. 连续快速输入：编辑器无输入延迟劣化（对照 P15 基准）。
5. 全程只有一份数据源：Ctrl+Z 在编辑器内正常回退每一步输入。

## 非目标

- Widget 内直接编辑（路线 A）、图形化拖拽画图
- 多图同时 pin、预览面板内编辑源码
- mermaid 语法智能补全（如做另立输入辅助需求）
