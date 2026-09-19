# P25 Mermaid 源码实时预览

优先级：P25（原标注 V2 后置；本批全量实施，已完成） | 类别：UX/功能 |
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

- [x] 光标进入任一 mermaid fence（源码态，`blockTouched` 既有行为）：
      底部/侧向预览面板自动出现，实时渲染**该 fence 当前源码**的图
- [x] 文档内容变更且光标仍在 fence 内：debounce 300ms 重渲染（走
      P15 限流队列）；渲染失败面板内显示错误（P16 覆盖条样式复用）
- [x] 光标离开 fence：面板延迟 2s 收起（期间移回则取消）；手动 pin
      按钮可保持面板常驻（pin 状态存 session，对接 P03）
- [x] 面板操作：Copy 源码 / 导出 SVG / PNG（复用 P16 工具条能力）
- [x] 面板可调高度（拖拽分隔条），偏好记住高度
- [x] 源码模式（P08）与 live 模式行为一致（fence 内光标判定基于语法树
      与模式无关）
- [x] 文档中多个 mermaid fence：面板只跟随光标所在 fence；pin 时锁定
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


## 实施状态（已完成）

- e2e：`scripts/cdp-p25.mjs`（port 9242）**26/26 ALL PASS**；typecheck /
  unit（154）/ smoke（5/5）全绿。
- 按**路线 B（预览面板）**实现，未做 Widget 内嵌编辑（路线 A 为非目标）：
  - `components/MermaidPreviewPanel.tsx`：编辑器下方 flex 分栏面板——
    debounce 300ms 走 `renderMermaid`（内含 P15 并发限流队列 + 缓存）；
    渲染失败显示 P16 风格错误条并**保留上一版 SVG**（加暗）；工具条
    Pin/取消固定、Copy 源码、SVG、PNG、Copy Image、关闭；拖拽分隔条
    调高，高度存偏好 `mermaidPreviewHeight`（默认 240，clamp 120–800）。
  - 光标判定：`editor/mermaidPreview.ts` `mermaidFenceAt`（语法树向上
    resolve FencedCode + CodeInfo=mermaid，模式无关）挂在 createExtensions
    的 onSelectionChanged/onChange 上（App 侧 ref 桥），结果即时；
    离开 fence 延迟 2s 收起、期间移回取消；pin 存 session
    `mermaidPreviewPin`（P03，e2e 已断言重启前持久化写入）。
  - pin 锁定：按内容 hash（FNV-1a）记忆 pinned fence；文档编辑后
    `resolvePinnedFence` 先按 hash 匹配、失效时跟随最近 fence（hash 变化
    跟随更新）；e2e 验证 pin 时切换光标到另一 fence 面板内容不变，编辑
    pinned fence 内容面板跟随，取消固定后面板回到光标所在 fence。
  - 数据流满足通用约束：面板纯投影——每次触发从 `view.state.sliceDoc`
    读源码渲染，面板无可写状态、无 contentEditable（e2e 断言
    editableCount=0）；Ctrl+Z 在编辑器内逐步回退每一步输入（唯一数据
    源断言；注意 CM6 history 500ms 分组——e2e 以间隔输入验证逐步撤销）。
- e2e 实测：进 fence 面板+SVG 出现 ≤0.8s（暖缓存后远低于验收 0.5s 预算
  的量级，冷启动含 mermaid 初始化）；输入后图更新 ≤1.2s（300ms debounce
  + 渲染）；语法错误提示 + 上一版保留 + 改对恢复；离开 2s 收起；源码
  模式（P08）判定一致。
- 未做（验收外/非目标）：多图同时 pin、面板内源码编辑、语法补全、
  P15 基准脚本的显式帧率对照（渲染走既有队列，输入路径无额外同步工作）。

## 非目标

- Widget 内直接编辑（路线 A）、图形化拖拽画图
- 多图同时 pin、预览面板内编辑源码
- mermaid 语法智能补全（如做另立输入辅助需求）
