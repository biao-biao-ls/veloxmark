# 6G 右键菜单补齐与新建内联输入 实施方案

## 技术决策与理由

- **D1 新菜单项 id**：`tree.openInTab` / `tree.revealInOS` / `tree.refresh`（`data-op` 风格字面量，收敛记录登记探针面）。刷新复用 6D/D5 `refreshTree()`；资源管理器复用 6D/D6 通道（目标 = 右键节点路径）。
- **D2 「在新标签打开」语义**：直接走 `openDocPath(path)`（P26 已按路径去重：未开新建、已开激活）——**不**引入重复 tab 模型（与 P26 契约一致，避免第二套打开语义）。菜单文案保留「在新标签打开」，对已开文件表现为激活（Typora 同构）。
- **D3 内联新建 = 复用内联改名的输入行机制**：`useWorkspaceTree` 新建通道从 `prompt` 改为「插入 `filetree-renaming` 形态的临时输入行」（`pendingCreate: { parentPath, kind: 'file'|'dir' }` 状态归 useWorkspaceTree）；Enter → 校验（空名/重名提示）→ 建节点 → 可选进入重命名保持现状体验；Esc/外点取消。`.md` 自动后缀保留（仅文件、仅当无扩展名）。
- **D4 prompt 退役**：6D/D3 落点规则（选中目录→激活文件目录→根）原样，仅输入方式换内联；删除 `prompt` 调用点。
- **D5 菜单组布局**：文件行 = [在新标签打开, 在资源管理器中显示, sep, 拷贝路径, 拷贝相对路径, sep, 重命名, 删除]；目录行 = [新建文件, 新建文件夹, 在资源管理器中显示, sep, 拷贝路径, 拷贝相对路径, sep, 重命名, 删除]；空白 = [新建文件, 新建文件夹, 在资源管理器中显示, 刷新, sep, 拷贝路径]。刷新不进文件/目录档（避免误触丢选中态——**修订**：spec AC1 说任意档 + 刷新；实现取空白档 + 目录档，文件档不放，收敛记录注明偏差）。

## 文件切法

| 源 | 改动 |
|---|---|
| `hooks/useWorkspaceTree.ts` | 菜单三档组重排 + 新增三项（D1/D5）；新建通道内联化 `pendingCreate`（D3/D4） |
| `components/FileTree.tsx` | 内联新建输入行渲染（复用 `filetree-renaming` 样式/交互） |
| `i18n/en.ts` + `i18n/zh.ts` | 新菜单项 + 新建占位/重名提示文案 |

不动：`TreeMenu.tsx`（容器行为）、删除确认流、拖拽移动、`openDocPath`/P26、6D 面板。

## 状态/契约归属

- `pendingCreate` 归 `useWorkspaceTree`（与 rename 态同居）；互斥：新建输入与内联改名不同时激活。
- 新 id `tree.openInTab`/`tree.revealInOS`/`tree.refresh` 登记探针面。

## import 改动面

无新 import（showItemInFolder/refreshTree 已在 6D 面就绪）。

## 任务拆分

| # | 任务 | 依赖 |
|---|---|---|
| T1 | 菜单三档组补齐重排（D1/D2/D5） | [P] T2 |
| T2 | 内联新建通道 + 输入行（D3/D4） | — |
| T3 | i18n 全量 + prompt 退役核对 | T2 |
| T4 | 人工冒烟（见验证） | T1–T3 |

## 验证方案

```bash
npm run typecheck && npm run test:unit
```

- e2e 缝 grep：既有 `data-op`/命令 id/`__velox*` 不在 diff（新 id 只增）
- 人工冒烟：
  1. 三档菜单新项齐 + 分组分隔清晰；在新标签打开（未开/已开两态）；资源管理器定位节点/根；刷新生效
  2. 「+」/菜单新建进内联输入：Enter 建 `.md`（自动后缀）、Esc 取消、重名提示、新建文件夹无后缀
  3. 内联新建与内联改名视觉一致、互斥不叠
  4. 拷贝路径/重命名/删除/拖拽不回归；删除确认流不变
  5. 深浅主题
