# 6C 树展开定位与行质感 实施方案

## 技术决策与理由

- **D1 默认展开反转**：`expanded` 初始集从「≤100 子节点预展开」改为**空集（全折）**；删除 `COLLAPSE_CHILDREN_OVER` 预展开分支。根层 flatten 规则不变（根层文件 + 一级目录始终可见）。
- **D2 reveal = 祖先链强制可见 + 滚动定位**：新增派生 `revealPath`（激活文档路径）→ flatten 前把祖先链并入 visible 集（**不写入用户 `expanded` state**——用户手动收起不被永久污染；AC3 的「不强制收回」由「reveal 只影响当次可见性，不改用户态」实现）。激活行 `scrollIntoView` 到可视区中部（虚拟滚动下先算 offset 再 `scrollTop`，`ROW_HEIGHT=25` 坐标系）。
- **D3 reveal 触发点**：active tab 变化、树根变化、树数据到达（打开时树可能晚于 tab 到达——世代守卫后补 reveal）。用 `useEffect` 依赖 `activePath + tree`，比较上一 reveal 避免滚动抖动（同路径不重滚）。
- **D4 图标 = 内联 SVG mask + `--fg-muted`**：目录（开/合两态）与 md 文件两 glyph，落 `filetree.css`（`.filetree-icon`）；hover 层次 = 现有 `--code-bg` 保留 + 图标 `--fg` 提亮。**不用 emoji**（字体不一致）。
- **D5 性能边界**：虚拟窗口化阈值不动；reveal 只是可见集修正 + 一次滚动，不引入 O(n²)。

## 文件切法

| 源 | 改动 |
|---|---|
| `components/FileTree.tsx` | D1 删预展开；D2/D3 可见集修正 + reveal 滚动；D4 图标 span |
| `styles/filetree.css` | `.filetree-icon` 图标 + hover 层次 |
| `App.tsx` | 透传 `activePath` 已有；若需 `revealPath` 显式化则 +2 行 |
| `FileTree.reveal.test.ts`（可选） | flatten 可见集修正纯函数抽出则配测（计划抽 `visibleRows()` 纯函数） |

不动：`useWorkspaceTree` 数据/CRUD、`TreeMenu`、虚拟滚动常量、全部 `filetree-*` class 名。

## 状态/契约归属

- `expanded` 用户态归 FileTree 本地 state（原状）；reveal 可见集是**当次渲染派生态**，不持久化、不回写用户态。
- `visibleRows()`（展开集 + reveal 链 → 可见行列表）抽纯函数：可测 + 单一算法源。

## import 改动面

无新 import（SVG 内联在组件）；若抽纯函数文件则 FileTree import 一处。

## 任务拆分

| # | 任务 | 依赖 |
|---|---|---|
| T1 | `visibleRows` 纯函数化 + 默认全折 + reveal 链（D1/D2） | — |
| T2 | reveal 触发点 + 虚拟滚动定位（D3/D5） | T1 |
| T3 | 行图标 + hover 层次（D4） | [P] T1 |
| T4 | 人工冒烟（见验证） | T1–T3 |

## 验证方案

```bash
npm run typecheck && npm run test:unit
```

- 人工冒烟（**行为变更单元，必做**）：
  1. 换根后树全折（只有根层文件 + 一级目录），对比 `veloxmark-2.png` 场景不再瀑布
  2. 打开深路径文件：祖先链自动展开且文件行滚动进视口中部；切 tab 各自 reveal
  3. 手动展开某目录 → 切 tab 再切回：手动展开不被收回（AC3）
  4. 目录/文件图标 + hover 层次，深浅主题
  5. 拖拽移动 / 右键 / 内联重命名 / active 高亮无回归
  6. 大树（>500 行）reveal 滚动位置正确（虚拟滚动兼容）
