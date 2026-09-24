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
