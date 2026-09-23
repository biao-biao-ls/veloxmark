# 3A 实施方案

## 技术决策与理由

- **3.1 收口取「truth + 投影镜像 + 单点 mutator」**：`DocTab.dirty`/`DocTab.savedContent` 为真源；`dirtyRef`/`dirty` state/`savedContentRef` 是 active tab 的投影（对外仍是可变 ref 形状——p12/p26 `getDirty` 与 useAutoSave 读 `dirtyRef.current` 不改）。三个 mutator 是唯一写点：
  - `setActiveDirty(d)`：`tab.dirty = d` + `dirtyRef.current = d` + `setDirtyState(d)`（**不**调 `syncAppState`——main 通知时机留在调用点，与现状一致）；
  - `setSavedBaseline(content)`：`tab.savedContent = content` + `savedContentRef.current = content`（draft 恢复「基线≠当前」场景专用）；
  - `markActiveSaved(content, path?)`：既有函数重写为 mutator 组合（基线写入 + 清脏 + path/name/baseDir + `syncAppState` + `refreshTabs`，调用点语义不变）。
  - facade `setDirty` = `setActiveDirty` + `refreshTabs`（即现 `setDirtyAndSyncTabs` 行为 + 补写 `dirtyRef`，App 原本就是「裸写 dirtyRef + setDirty」两连招，并入后等价）。
  - `refreshTabs` 的 `isActive ? dirtyRef.current : tab.dirty` + `if (isActive) tab.dirty = dirtyNow` 兜底拷贝删除（mutator 保证恒同步，`isTabDirty(tab) = tab.dirty`）。
- **跨模块裸写改道的逐点等价性**：
  | 现状 | 改道 | 等价性 |
  |---|---|---|
  | App L458-461：`savedContentRef=''; dirtyRef=true; setDirty(true)` | `setSavedBaseline(''); setDirty(true)` | ✓（`syncAppState` 两边都不调——现状即如此，AC 约束保留） |
  | App L483-488：`savedContentRef=disk; dirtyRef=isDirty; setDirty(isDirty); syncAppState(path,isDirty)` | `setSavedBaseline(disk); setDirty(isDirty); syncAppState(path,isDirty)` | ✓ 逐行对应 |
  | App L604-608：`if(!suppress && !dirtyRef.current){ dirtyRef.current=true; setDirty(true); syncAppState(...) }` | guard 不动，体内 `setDirty(true)` 单行（并入 dirtyRef 写） | ✓ |
  | useAutoSave L117-120：`savedContentRef=content; dirtyRef=false; setDirty(false); syncAppState(null,false)` | `markActiveSaved(content, null)` | ✓ 逐行对照：`setDirty(false)` 即 `setDirtyAndSyncTabs` = `setDirtyState`+`refreshTabs`，四写点全含；差异仅 `tab.savedContent`/`tab.dirty` 直写（此前 `tab.dirty` 由 refreshTabs 兜底推导为同值、`tab.savedContent` 保持旧值——写-only 镜像无读者，收敛到 truth 属修正竞态，无可见变化）。`markActiveSaved` 补进返回表面 + `useAutoSave.Args`（3.6 允许的绑定同步）。 |
- **`SidebarMode` 单源 = `preferences/store.ts`**（session 持久化形状引用它，语义归偏好域）；useFileOps 由声明改 `export type { SidebarMode } from '../preferences/store'`——useWorkspaceTree 的 `from './useFileOps'` 零改动。
- **pathUtil 落根级** `src/renderer/src/pathUtil.ts`（纯函数叶，`content.ts` 同级，App/useExport/hooks 三方消费无 hook 归属）+ `pathUtil.test.ts`（win/Unix/根路径边界）。去重逐点表：
  | 位置 | 现状 | 处置 |
  |---|---|---|
  | App L295 `path.replace(/^.*[\\/]/, '')` | 等价 `baseNameOf` | 改 |
  | App L1474 `folderPath.replace(/^.*[\\/]/, '') \|\| folderPath` | 等价 `baseNameOf(p) \|\| p` | 改 |
  | App L1472 `filePath.replace(/^.*[\/]/, '')` | `[\/]`-only 变体（反斜杠路径标题显示全路径） | 改 `baseNameOf`（超集修复，唯一微行为差异，标题栏显示更正确；文档化） |
  | App L1447 `p.replace(/[^/\\]+$/, '')` | **非等价**（保留尾分隔符） | 不并；注释指向 pathUtil 标注差异 |
  | useExport L117 `fp.replace(/^.*[\\/]/, '').replace(/\.[^.]*$/, '')` | 等价 `baseNameOf(fp).replace(...)` | 改 |
- **useTabStore 取 hook 模块而非模块级 store**：tab 声明周期=组件（viewRef/state），且现 API 全是 `useCallback`——同构平移风险最低；`extensionsRef` 留 store 内部（`initTabs` 注入），3.3 条目「makeState 注入 extensionsRef」落在 store 内聚。
- **依赖 DAG（无环）**：`useFileOps` → {`useTabStore`, `useDocIo`, `tabClosePolicy`}；`useDocIo` → `useTabStore`（激活/刷新/mutator）；`useTabStore` → `tabClosePolicy`（closeTab 的 dirty 分支调 policy）；`tabClosePolicy` → 叶子（dialog/t/window.api/e2eSaveDialog）。`notifySaveFailed` 在 facade 构造（onSaveFailedRef 就近）注入 useDocIo 与 tabClosePolicy，避免 policy→io 反向边。
- **tabClosePolicy 取显式 deps 纯函数**（`confirmDiscard`/`queryClose`/`resolveTabCloseDirty`），P12 三选一语义整段平移；closeTab 序（对话框 → closedStack push → Map delete → 邻格激活/关窗）留 useTabStore，仅 dirty 分支调 `resolveTabCloseDirty`。
- **facade 返回对象 key 名逐字保留**（含 `setDirty` 指向包装后的 mutator）；顺序不变（e2e `FileOps` 以 `ReturnType` 钉形状，key 集不减即可）。

## 状态/契约归属

- 真源：`DocTab.dirty`/`DocTab.savedContent`（useTabStore）。镜像：`dirtyRef`/`dirty` state/`savedContentRef`（facuseTabStore mutator 唯一写点）。`suppressDirtyRef`/`filePathRef` 归 useTabStore（激活/载入路径写）。
- `savedContentRef` 现存「useAutoSave 写后被 refreshTabs 旧值覆盖」竞态随 3.1 自然消除（truth 直写），0 读者故无可见变化。
- e2e 缝：返回表面 key 集 ⊇ 现集；`__veloxP12`（confirmDiscard/queryClose/getDirty）、`__veloxP26`（tab 面 + resetWelcome + getDirty）形状不变。

## import 改动面

- 新建：`src/renderer/src/pathUtil.ts`(+test)、`src/renderer/src/hooks/docTabs.ts`、`hooks/useTabStore.ts`、`hooks/useDocIo.ts`、`hooks/tabClosePolicy.ts`。
- 修改：`hooks/useFileOps.ts`（收为组合壳 ~150 行）、`App.tsx`（3 处裸写改道 + 4 处路径内联去重 + 传 `markActiveSaved` 给 useAutoSave）、`hooks/useAutoSave.ts`（Args +`markActiveSaved`，untitled 路径一行收编）、`hooks/useExport.ts`（1 处去重）。
- 零改动：useWorkspaceTree、TabsBar、e2e/seams/*、commands/*。

## 任务拆分

1. **3.1**（useFileOps.ts 内原地收口）：mutators + `isTabDirty` + 5 处判断收敛 + App/useAutoSave 裸写改道——先立契约再动结构，本步可独立收敛。
2. **3.2**：`docTabs.ts` + `pathUtil.ts`( + test) + SidebarMode re-export + App/useExport 去重。
3. **3.3**：切 `useTabStore.ts`（Map CRUD + mutators + 装配工具）。
4. **3.4**：切 `useDocIo.ts`（open/load/save 系 + notifySaveFailed）。
5. **3.5**：切 `tabClosePolicy.ts`（confirmDiscard/queryClose/resolveTabCloseDirty）。
6. **3.6**：facade 组合 + 返回表面 key 集核验（与本 plan 状态节清单 diff）。

（每步后 typecheck 可独立绿；3.3–3.5 为函数级平移 + deps 注入改造，改造点集中在回调签名。）

## 验证方案

- `npm run typecheck && npm run test:unit`（+ `pathUtil.test.ts` 新用例）；`npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles。
- 返回表面 key 集 diff = ∅（允许 +`markActiveSaved`）；`e2e/seams/types.ts` 的 `FileOps` 类型编译即契约。
- 三轨收敛验证：grep 断言 `dirtyRef.current =` 与 `savedContentRef.current =` 写点只存在于 useTabStore mutator（+镜像初始化）；`isActive ? dirtyRef` 处处为 0。
- 行为不变类——人工冒烟：多标签开/关/切/拖拽排序/重开关闭、脏关三选一（单/多文档）、关末标签关窗、autosave（debounce/interval）与 untitled 草稿存盘、draft 崩溃恢复两条（untitled/path）、Save/Save As（取消/写失败 toast）、外部文件变更 reload（dirty inactive 不动）、session 恢复（后台开 tab）。
