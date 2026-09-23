# 6E 文件树排序体系 实施方案

## 技术决策与理由

- **D1 状态机模型（已决 2026-09-23，见 spec）**：`fileTreeSort = { groupFolders: boolean, key: 'natural'|'name'|'mtime'|'birthtime', dir: 'asc'|'desc' }`——四键互斥单选 + 点按选中/再按翻转 `dir`；`groupFolders` 独立 toggle **默认 `true`**（用户拍板「默认按文件夹分组」）。UI 落 6D「操作」面板排序行（5 控件：1 toggle + 4 键钮）。
- **D2 排序纯函数 `sortTreeNodes(nodes, opts)` + `compareNatural(a, b)`**：新 `filetree/sort.ts`（叶模块）。自然序 = 分段数字感知比较（`Intl.Collator(undefined, {numeric:true, sensitivity:'base'})`——标准库即自然序，不手写）；文件名序 = 同 collator 关 `numeric`（纯字典序）；mtime/birthtime = `mtimeMs` 升降，缺省值排后。`groupFolders: true` 时目录组在前，组内同序。
- **D3 时间数据源**：主进程 `listMarkdownTree` stat 时写入 `mtimeMs`/`birthtimeMs`（`DirNode` 可选字段；watcher 重扫天然是新数据）。渲染端排序不发起额外 IO。
- **D4 排序作用面 = 渲染端 flatten 前**：树视图（层级内排序）与列表视图（全局排序）共用 `sortTreeNodes`；FileTree 的 `visibleRows` 前置调用（6C 已抽纯函数——接缝在此）。
- **D5 持久化**：`fileTreeSort` 落 preferences store（sanitize 宽容：缺字段回默认，非法枚举回 `'natural'`/`'asc'`）。

## 文件切法

| 源 | 改动 |
|---|---|
| `src/renderer/src/filetree/sort.ts` | **新**：`compareNatural` / `sortTreeNodes`（D2） |
| `filetree/sort.test.ts` | **新**：自然序 vs 字典序、时间升降、groupFolders、缺省排后 |
| `electron/shared/api.ts` | `DirNode` + `mtimeMs?`/`birthtimeMs?`（D3） |
| `electron/ipc/folder.ts` | `listMarkdownTree` stat 写入两字段（D3） |
| `components/FileTree.tsx` | flatten 前接 `sortTreeNodes`（D4） |
| `preferences/store.ts` | `fileTreeSort` 字段 + sanitize（D5） |
| `components/SidebarOpsPanel.tsx`（6D 产物） | 排序行 5 控件（D1 UI） |
| `i18n/en.ts` + `i18n/zh.ts` | 排序行文案 |

不动：IPC channel 面、watcher、QuickOpen/搜索排序（保持相关度序）。

## 状态/契约归属

- `fileTreeSort` 真源 = preferences store；比较器无状态。
- `DirNode` 类型单一真源 `electron/shared/api.ts`（宪法），两端不重声明。

## import 改动面

- FileTree → `filetree/sort`；SidebarOpsPanel → store。electron 侧 `folder.ts` 引 `DirNode` 类型不变。madge 收敛必跑。

## 任务拆分

| # | 任务 | 依赖 |
|---|---|---|
| T1 | `sort.ts` 比较器 + 单测（D2） | — |
| T2 | `DirNode` 时间字段 + 主进程 stat（D3） | [P] T1 |
| T3 | store 字段 + sanitize + FileTree 接线（D4/D5） | T1 |
| T4 | 排序行 UI（6D 面板内，D1） | T3 |
| T5 | 人工冒烟（见验证） | T1–T4 |

## 验证方案

```bash
npm run typecheck && npm run test:unit
```

- 单测覆盖：`2.md`<`10.md`（自然）、`10.md`<`2.md`（字典）、mtime 升降、birthtime、groupFolders on/off、缺省时间排后、空目录
- e2e 缝 grep：既有契约不在 diff（`DirNode` 增字段属 API 面只增，记录注明）
- 人工冒烟：五控件状态可视且即时重排；重启保持；大目录排序无卡顿（纯内存）；深浅主题
