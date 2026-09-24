# 6F 最近使用的目录与列表/树视图 实施方案

## 技术决策与理由

- **D1 最近目录模型**：`recentFolders: Array<{ path: string; pinned?: boolean }>`（preferences store）。使用即置顶到历史区首（去重移动）；`pinned` 项排最前（保持相对序）；**显示序 = pinned 组 + 历史组**。纯函数 `upsertRecent(list, path)` / `visibleRecents(list, limit)` 抽 `filetree/recents.ts` 配单测。
- **D2 列表视图渲染**：扁平行 = 全部 md 文件（递归收集，复用树数据不加扫描），行 = 文件名主列 + 相对根目录副标题（`subdir/name.md` 的 `subdir/` 部分，根层不显示副标题）。行交互与树视图同路径（点击打开/右键/高亮/reveal 由 `activePath` 直接匹配）。实现在 `FileTree.tsx` 内按 `fileTreeView` 分叉 flatten（共用 `visibleRows` 的排序入口）。
- **D3 上限**：历史区 10 项（超出挤出最旧未置顶）；置顶**占**历史上限外的独立槽位（最多 5，防滥用）——两者合计展示 ≤15。持久化全量落 preferences（数量小）。
- **D4 「当前根蓝点」**：行尾 `.recents-current` 圆点（`--accent`），比较 `path === 当前树根`（大小写/分隔符归一用 `pathUtil` 现有语义）。
- **D5 `lastFolderPath` 收编完成**：session 写侧并入 recents upsert（6B/D5 半程）；读侧恢复逻辑已废止（6.4a）——不再自动挂根，仅一次性迁移（读到 `lastFolderPath` 时 upsert 进 recents）。

## 文件切法

| 源 | 改动 |
|---|---|
| `filetree/recents.ts` + `recents.test.ts` | **新**：模型纯函数（D1） |
| `preferences/store.ts` | `recentFolders` 字段 + sanitize（缺省 []、非法过滤） |
| `components/SidebarOpsPanel.tsx` | 「最近使用的目录」段 UI（D1/D4） |
| `hooks/useTreeRoot.ts` | 目录点击 → 显式根通道；根变化 → upsertRecent（D1/D5） |
| `components/FileTree.tsx` | 列表视图 flatten 分叉（D2） |
| `hooks/useSessionPersist.ts` | `lastFolderPath` 迁移收编（D5） |
| `styles/filetree.css` | 列表行副标题 + `.recents-current` + hover 置顶/移除钮 |
| `i18n/en.ts` + `i18n/zh.ts` | 段标题 / 置顶 / 移除 / aria |

不动：6B 根解析优先级（recents 只是数据源与入口）、6E 排序、`folder:*` IPC。

## 状态/契约归属

- `recentFolders` 真源 = preferences store；置顶/移除经 store action，不旁路 localStorage。
- 视图切换状态 `fileTreeView` 已归 store（6D/D7），本单元只消费。

## import 改动面

- SidebarOpsPanel / useTreeRoot → `filetree/recents` + store。madge 收敛必跑。

## 任务拆分

| # | 任务 | 依赖 |
|---|---|---|
| T1 | `recents.ts` 纯函数 + 单测（D1/D3） | — |
| T2 | store 字段 + `lastFolderPath` 迁移收编（D5） | T1 |
| T3 | 面板「最近使用的目录」段 + 蓝点 + 置顶/移除（D1/D4） | T2 |
| T4 | 列表视图 flatten 分叉 + 副标题（D2） | [P] T1 |
| T5 | 人工冒烟（见验证） | T1–T4 |

## 验证方案

```bash
npm run typecheck && npm run test:unit
```

- 单测覆盖：upsert 去重移动、置顶序、历史挤出（10）、置顶上限（5）、移除、旧 `lastFolderPath` 迁移
- e2e 缝 grep：既有契约不在 diff
- 人工冒烟：目录点击切根（走显式根）；蓝点跟随；置顶/移除持久化；列表/树切换即时 + 重启保持 + 排序共用；列表行打开/高亮/右键与树视图一致；深浅主题

# 6F 实现细化（2026-09-24，implement 时决策落档）

- **D6 置顶钮 toggle 语义**（AC3 只列「置顶/移除」二操作的补全）：`togglePinRecent`——未置顶 → 置顶（进置顶组尾，保持相对序）；已置顶再点 → 取消置顶回落**历史区首**（作为「刚被使用」）；满 5 置顶再点新项 = no-op 返回原引用。hover 钮 title/aria 随态切 `ops.recents.pin`/`unpin`。
- **D7 upsert 落点**：plan 表点名 `useTreeRoot.ts`，实际收编点是 **`useWorkspaceTree.applyTreeRoot`**（根写侧唯一漏斗，6B 记录③同款修正）——`patchSession({ lastFolderPath })` 写侧删除，替换为 `upsertRecent` 进 `preferences.recentFolders`（历史首/已置顶时 upsert 返回原引用则不写 store，防无谓通知）。`useTreeRoot` 仅更新头注释。
- **D8 路径同一性**：`pathKey`（去尾分隔符 + `\`→`/` + 小写）落在 `filetree/recents.ts`（pathUtil 无归一器，不扩面）；蓝点比较、去重、移除全走 `pathKey`；源路径字符串原样保留。
- **D9 列表视图排序语义**：扁平行 = `flattenFiles`（新纯函数，落 `filetreeRows.ts` 配单测，plan 原写「实现在 FileTree.tsx」——纯逻辑按宪法抽测）递归收集全部文件 → **按 6E 当前键全局排序**（`sortTreeNodes` 复用；纯文件列表下 groupFolders 为 no-op）。「共用 6E 排序」= 共用键/升降/比较器；树视图保持层级内序。副标题 = `relDir`（`subdir/`，根层空）**右对齐暗色**（VSCode 扁平列表惯例），分隔符随平台。
- **D10 迁移收口**：`useSessionPersist` 启动一次性迁移（空依赖 effect：读 `lastFolderPath` → `upsertRecent` → 清槽；strict-mode 双跑幂等）；迁移后 `lastFolderPath` 字段保留类型面但**不再有写侧**（D5 收编完成）。
- **D11 面板溢出**：`.sidebar-ops` 增 `max-height: min(70vh, 520px)` + `overflow-y: auto`（15 recents + 五项 + 排序行在小窗不溢出）。
- **i18n 新 key**：`ops.recents` / `ops.recents.pin|unpin|remove|current`（en+zh 同加）。图标 `PinIcon`/`TrashIcon` 补入 Icons.tsx（禁 emoji）。
- **D8 探针面登记（只增不改）**：`data-op` `sidebar.ops.recent.item`（行容器，带 `data-path`）|`sidebar.ops.recent.open`|`sidebar.ops.recent.pin`|`sidebar.ops.recent.remove`；class `.sidebar-ops-recents*`/`.sidebar-ops-recent*`/`.recents-current`/`.filetree-list-name`/`.filetree-list-sub`。
