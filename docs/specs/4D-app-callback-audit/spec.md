# 4.4 复核剩余业务回调（= 1.3）

## What / Why

App.tsx（1702 行）经 1A/3A 后仍是业务装配中枢。本任务交付一份**残留业务回调/ effect 域审计表**（keep/sink 逐域决议），并把两个「明显独立域」顺势下沉 hooks：P18 折叠同步、P03 会话持久化写侧 effect 群。装配/glue/ e2e 缝接线留在 App 是设计，不强拆。

## 背景与现状

- **折叠同步域（P18，App L167–220）**：`foldedKeys` state + `foldSigRef` + `syncFoldedKeys`（+Ref 镜像）+ `restoreFoldsFor`（+Ref 镜像）+ filePath 变更 effect。输入只有 `viewRef`/`filePathRef`/`suppressDirtyRef`/`filePath`，输出 `foldedKeys` + 两 ref——边界干净。消费面：create-editor 更新监听（4 处 `syncFoldedKeysRef.current()`）、Outline prop、`useP18Seam`（`restoreFoldsForRef` 是 e2e 缝类型契约 `RestoreFoldsForRef`，**形状不变**，App 透传）。
- **会话持久化写侧（P03，App L257–307）**：`sessionSynced` 门闩 ×3（sidebarVisible/mode/width → `patchSession`）+ tabs 持久化（`fileOps.persistTabsSession`）+ recentItems 校验（`session.recentFiles` → pathExists → `setRecentItems`）+ `window.api.setRecentFiles` 推送。全部是「状态 → store/IPC」单向写，无编辑器耦合。
- **同段落的原生菜单订阅 effect（L308–337）是 4.5 双派发缺陷的现场**——本次**不动**，留给 4.5 收敛（避免同域双改）。
- 启动 restore effect（L349–417）是 boot 编排（workspace+fileOps+showToast+setSidebarMode 纠缠），**属 App 装配职责不下沉**；P12 drafts（`checkDrafts`+`installP12Handle`）、create-editor、链接导航、插入对话框群同理（缝/装配/glue）。

## 验收标准（AC）

- **AC1（审计交付）**：App.tsx 全部业务回调/effect 域列入审计表（spec 内），每域 keep/sink 决议 + 理由；下沉项仅限下列两域。
- **AC2**：新 `hooks/useFoldSync.ts` 收纳折叠同步域全五件（state/两回调/两 Ref 镜像/filePath effect），**body 原样平移**；返回 `{ foldedKeys, syncFoldedKeysRef, restoreFoldsForRef }`；`RestoreFoldsForRef` 契约形状不变（App 透传给 `useP18Seam`）；`syncFoldedKeysRef` 身份稳定（create-editor 闭包 dep 不破）。
- **AC3**：新 `hooks/useSessionPersist.ts` 收纳会话写侧六 effect + `recentItems` state，**body 原样平移**；入参显式注入（`sessionSynced/showOutline/sidebarMode/sidebarWidth/persistTabsSession/tabInfos/recentFiles`），返回 `recentItems`；`sessionSynced` 门闩语义与 effect 依赖数组逐一不变（含 eslint-disable 处）。
- **AC4**：原生菜单订阅 effect、restore effect、P12 drafts **留 App 不动**（审计表注明）；App.tsx 两域原位代码删除、接线改为 hook 调用。
- **AC5**：收敛门禁 typecheck + test:unit 全绿 + madge 0 cycles；行为不变（纯搬移）。

## 约束

- 回调稳定身份纪律：hook 内 `useCallback` deps 只持稳定标识（禁止把 store/hook 返回对象字面量放进 dep 数组——3A 教训）。
- ref 镜像（`xxxRef.current = xxx` during render）是既定模式，随域迁移保持。
- e2e 缝硬契约：`__veloxP18` 依赖的 `restoreFoldsForRef` 形状/写时序不变；`__veloxP12` 不涉。
- 4.5 将重构菜单订阅 effect——本任务不触其一行。

## 不做

- 不动 updateOutline/updateActiveHeading/showToast/startSidebarResize/stats 桥/链接导航/插入对话框/P25 mermaid pin 等（审计表注明 keep 理由）；不拆 restore effect；不改 commands/useMenus。
