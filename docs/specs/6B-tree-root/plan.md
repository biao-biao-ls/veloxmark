# 6B 树根跟随当前文档 实施方案

## 技术决策与理由

- **D1 树根解析纯函数 `resolveTreeRoot`**（落 `hooks/useTreeRoot.ts` 或 `pathUtil.ts`，配单测）。优先级：
  1. **显式根**（`openFolder` / 操作面板「打开文件夹…」/ 最近目录点击设定）——钉住直到激活文档跑到根**外**，届时失效转跟随；
  2. **激活文档 dirname**（有路径的活动 tab）；
  3. **最近根**（session `lastFolderPath` 收编为最近根首项，6F 扩成列表）。
  理由：保住 `__veloxP13.openFolder(path)` 的可观测语义（调用后树立即显示 path），同时不违反「随当前文件走」的主规则。
- **D2 新 hook `useTreeRoot.ts`**：订阅 active tab path 变化 → `resolveTreeRoot` → 根变则 `folder:unwatch` + `folder:watch` 换靶；渲染侧**根标识竞态守卫**（带 rootPath 世代号，过期 `folder:tree` 丢弃）。主进程 200ms 防抖保持；App.tsx 只接线不写逻辑。
- **D3 搜索范围收窄随树根**：QuickOpen/全局搜索吃 `folderTree` 天然跟随（零代码），但属**行为变更**——收敛记录注明「搜索范围 = 当前树根」。
- **D4 扫描深度 8 → 20**（`folder.ts:10` `MAX_SCAN_DEPTH`）：一步到位放宽，不做配置项（避免偏好面膨胀）；20 仍截断但覆盖真实目录形态。备选：可配置（不做）。
- **D5 `lastFolderPath` 兼容收编**：写侧改为写「最近根」（6F 的 `recentFolders[0]` 前身），读侧语义不变，6F 落地时扩成完整列表。

## 文件切法

| 源 | 改动 |
|---|---|
| `hooks/useTreeRoot.ts` | **新**：树根解析 + 换靶 + 竞态守卫（D1/D2） |
| `pathUtil.ts` 或同 hook 内 | `resolveTreeRoot` 纯函数（导出可测） |
| `hooks/useWorkspaceTree.ts` | `loadFolder` 改由 useTreeRoot 驱动；`openFileFromTree` 不再管根（6A 已删切模式） |
| `App.tsx` | 接线 useTreeRoot（~10 行）；`App.tsx:1130` 目录定位低优注释随 6B 语境更新 |
| `electron/ipc/folder.ts` | L10 `MAX_SCAN_DEPTH` 8 → 20（D4） |
| `hooks/useSessionPersist.ts` | `lastFolderPath` 写侧改写最近根（D5） |
| `useTreeRoot.test.ts` | **新**：`resolveTreeRoot` 优先级/回落/显式根失效 用例 |

不动：`folder:*` channel 面、`DirNode` 形状（6E 才增字段）、`baseDir` 链、QuickOpen/SearchPanel（零代码跟随）。

## 状态/契约归属

- 显式根状态单一归属 `useTreeRoot`（模块内 ref/state，App 透传给「打开文件夹」入口与 6D/6F 的目录点击通道）。
- watcher 生命周期仍归主进程 `ipc/folder.ts` 单 watcher；渲染侧只换靶。

## import 改动面

- App → `useTreeRoot`（新）；`useWorkspaceTree` 可能解 import `loadFolder` 自驱部分；electron 侧零 import 变化。
- madge 收敛必跑（hooks 域 import 面变化）。

## 任务拆分

| # | 任务 | 依赖 |
|---|---|---|
| T1 | `resolveTreeRoot` 纯函数 + 单测（D1） | — |
| T2 | `useTreeRoot` 换靶 + 竞态守卫 + App 接线（D2/D5） | T1 |
| T3 | 深度 8→20（D4） | [P] T1 |
| T4 | 人工冒烟（见验证） | T1–T3 |

## 验证方案

```bash
npm run typecheck && npm run test:unit
```

- `npx madge --circular --extensions ts,tsx` 0 cycles（import 面变化）
- e2e 缝 grep：`__velox*` / `data-op` / 命令 id 不在 diff
- 人工冒烟（**行为变更密集，必做**）：
  1. 打开 A 目录文件 → 树根 = A；切到 B 目录文件的 tab → 树根 = B；切回 A 恢复
  2. 未命名草稿 / 无 tab：树回落最近根不消失
  3. 「打开文件夹…」钉住根；打开根外文件后转跟随（D1 失效规则）
  4. 快速连切 3+ tab：树不错闪旧内容
  5. 外部改文件（watcher）仍自动刷新；QuickOpen/搜索范围 = 当前树根
  6. 深层目录（>8 级）可见（D4）

---

# 6.4a 修订实施方案（2026-09-24，AC4 废止）

对应 spec 修订记录（未落盘文档 → 树根 = 空，不回落最近根）。

## 技术决策与理由

- **R1 `resolveTreeRoot` 删 lastRoot 档**：优先级收为 显式根 → 激活文档 dirname → `null`。未落盘文档无目录上下文，宁可显式空态也不装工作区（spec 修订 What/Why）。
- **R2 启动恢复不再挂 `lastFolderPath`**：`App.tsx` 恢复链删除 `loadFolder(saved.lastFolderPath)` 分支（原经显式根通道钉住，是启动误显树的主因）。恢复落盘 tab 后激活事件自然走跟随制重建根；纯 untitled 会话落空态。`lastFolderPath` **写侧保留**（D5 最近根槽，6F recents 数据源），读侧仅剩 6F 的一次性迁移。
- **R3 空态卡复用 6A**：`sidebar-empty` 卡已有「打开文件夹…」按钮；文案区分「当前文档未落盘」（新 i18n key `sidebar.filesEmptyUntitled`，en+zh）——根为 null 只发生在未落盘/无文档场景，无需再分叉。

## 文件切法

| 源 | 改动 |
|---|---|
| `hooks/useTreeRoot.ts` | `ResolveTreeRootInput` 删 `lastRoot`；`resolveTreeRoot` 第 3 档恒 `null`；effect 不再读 session |
| `hooks/useTreeRoot.test.ts` | 回落用例改为「未落盘/无文档 → null」；输入面同步 |
| `hooks/useWorkspaceTree.ts` | `applyTreeRoot` 注释更新（`lastFolderPath` 仅写侧） |
| `App.tsx` | 恢复链删 `loadFolder(saved.lastFolderPath)` 分支；空态卡文案按未落盘场景选 key |
| `i18n/en.ts` + `i18n/zh.ts` | 新 key `sidebar.filesEmptyUntitled` |

## 状态/契约归属

- 显式根 ref 仍单一归属 `useTreeRoot`；`lastFolderPath` 写侧仍归 `applyTreeRoot`（D5）。
- e2e 缝零触碰（`openFolder`/`getSidebarMode`/`data-op`/命令 id）。

## 验证方案

```bash
npm run typecheck && npm run test:unit
```

- `npx madge --circular --extensions ts,tsx` 0 cycles（hooks import 面变化）
- 人工冒烟（**行为变更，必做**）：① 冷启动（默认 untitled-2.md）：files tab 空态卡「当前文档未落盘」+ 引导按钮，不显任何目录树；② 打开落盘文件 → 树跟随其目录；切回 untitled tab → 回空态；③ 「打开文件夹…」钉住根后切 untitled tab → 树保持（D1 不变）；④ 重启：落盘 tab 会话恢复后树根 = 激活文档目录；纯 untitled 会话重启仍空态；⑤ 6A/6B/6C 不回归（双 tab、跟随换根、reveal）。
