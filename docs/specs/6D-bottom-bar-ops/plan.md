# 6D 底部栏与「操作」面板 实施方案

## 技术决策与理由

- **D1 底部栏落 `filetree.css` 新区 + App files 分支 JSX**：`.filetree-bottombar`（sticky 底，flex 左中右）；四槽 = 新建按钮 / 目录名按钮 / 操作按钮 / 视图切换按钮。骨架用 4B 的 `.btn` 皮肤别名（新代码可用 primitives）。
- **D2 「操作」面板 = 下拉浮层组件 `components/SidebarOpsPanel.tsx`**：定位于触发钮（目录名 / 操作按钮共用一实例），开合走**菜单单例 bus 模式**（对齐 ctxMenu：同一时刻至多一个开；Esc/外点关闭、焦点归还）。不用 Dialog（非模态、轻量）。
- **D3 新建落点规则**：选中目录行 → 该目录；选中/激活文件 → 其所在目录；否则树根。落点经 `useWorkspaceTree` 现有新建通道（prompt 版保持，6.14 换内联）。
- **D4 「搜索」= QuickOpen**（文件名模糊，与 Typora 文件树搜索语义对位）；全局搜索保留 Ctrl+Shift+F 原入口，不重复放面板（面板只五项，对齐 typora-4.png）。
- **D5 「刷新」= 强制 `folder:list` 重扫**：新增 renderer 侧 `refreshTree()`（复用现有订阅通道推树），watcher 降级场景的兜底；顺手把 `folder.ts:164-167` 静默降级改为可见（收敛记录注明，勿扩面）。
- **D6 「在资源管理器中显示」**：先核 `RendererApi` 已有 `showItemInFolder`（2D 已收 `shell:showItemInFolder`）——有则直用；无则 expose（`electron/shared/api.ts` + preload，路径 = 树根）。
- **D7 视图切换按钮** = 写偏好 `fileTreeView: 'tree' | 'list'`（6F 持久化完善，本单元先落字段 + 按钮态）；渲染分叉留给 6.12。
- **D8 新契约登记**：DOM class `.filetree-bottombar` / `.sidebar-ops` / `.sidebar-ops-item`，`data-op` 风格 id `sidebar.ops.open|newFile|search|reveal|openFolder|refresh|toggleView`（探针可扫，收敛记录登记）。

## 文件切法

| 源 | 改动 |
|---|---|
| `components/SidebarOpsPanel.tsx` | **新**：操作面板浮层（D2） |
| `App.tsx` | files 分支底部栏 JSX + 面板装配（只装配） |
| `hooks/useWorkspaceTree.ts` | 新建落点参数化（D3）；`refreshTree`（D5） |
| `preferences/store.ts` | `fileTreeView: 'tree'\|'list'` 字段 + sanitize（D7） |
| `electron/shared/api.ts` + `preload.ts` + `ipc/shell.ts` | 仅当 D6 核实缺 expose 时补 |
| `styles/filetree.css` | `.filetree-bottombar` / `.sidebar-ops` 区 |
| `i18n/en.ts` + `i18n/zh.ts` | 五操作 + 底栏 aria + 面板标题 key |

不动：`QuickOpen.tsx`、`openFolder` 命令、`TreeMenu`、现有顶部头部（6G 再整容）。

## 状态/契约归属

- 面板开合态归 `SidebarOpsPanel` 自身 + 菜单单例 bus（与其他弹层互斥）。
- `fileTreeView` 真源 = preferences store（6F 补持久化语义）；选中行概念若未有则引入 FileTree 受控 `selectedPath`（6G 菜单也用——归属 FileTree state 上提至 useWorkspaceTree）。

## import 改动面

- App → SidebarOpsPanel；SidebarOpsPanel → 菜单 bus / i18n / window.api（若 D6）。madge 收敛必跑。

## 任务拆分

| # | 任务 | 依赖 |
|---|---|---|
| T1 | 底部栏框架 + 四槽 UI（D1/D7 按钮态） | [P] T3 |
| T2 | SidebarOpsPanel 浮层 + 菜单 bus 接入（D2） | [P] T3 |
| T3 | 五操作接线：新建落点（D3）/ QuickOpen（D4）/ showItemInFolder 核实与接线（D6）/ openFolder / 刷新（D5） | — |
| T4 | store `fileTreeView` + i18n 全量（D7） | [P] T1 |
| T5 | 人工冒烟（见验证） | T1–T4 |

## 验证方案

```bash
npm run typecheck && npm run test:unit
```

- e2e 缝 grep：`window.__velox*` / 既有 `data-op` / 命令 id 不在 diff（新 id 只增不改）
- 人工冒烟：
  1. 底栏四槽布局对齐 Typora 截图（左中右）；树滚动时底栏固定
  2. 「+」三种落点（选中目录 / 激活文件目录 / 根）；`.md` 自动后缀
  3. 中目录名与「操作」按钮开同一面板；Esc / 外点 / × 关闭；与其他弹层互斥
  4. 五操作各触发一次：新建 / 搜索开 QuickOpen / 资源管理器定位根 / 打开文件夹对话框 / 刷新（外部删文件后刷新恢复）
  5. 视图切换按钮状态可切 + 重启保持（渲染差异待 6.12）
  6. 深浅主题
