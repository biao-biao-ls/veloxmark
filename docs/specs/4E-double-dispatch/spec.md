# 4.5 双派发缺陷修复（2D 遗留，行为变更）

## What / Why

macOS 原生菜单单击 `closeTab`/`reopenClosedTab`/`nextTab` 时**双执行**（`reopenClosedTab` 重开两张标签）。根因：同一条 IPC 事件上挂了两个处理器——App 手写监听（P26 期，pre-registry 补丁）与 useMenus 对全部命令 id 的泛化订阅（`menu:<id>`）。收敛为**单派发**。

## 背景与拓扑（已核）

- **命令侧（应赢）**：`commands/tabsCmds.ts` 三 id（`nextTab`/`closeTab`/`reopenClosedTab`）→ `run: () => ops.<fn>()`；App 的 `commandOps` 装配 body 为 `nextTab: () => fileOps.nextTab()` / `closeTab: () => { void fileOps.closeTab(fileOps.getActiveTabId()) }` / `reopenClosedTab: () => { void fileOps.reopenClosedTab() }`。useMenus 泛化订阅 `window.api.onMenu(cmd.id, …)` 覆盖全部命令 id——**MenuBar 点击 / 全局快捷键 / mac 原生菜单三消费方的设计面**（useMenus 文件头明文「nothing is hand-listed here」）。
- **手写侧（应删）**：App 原生菜单订阅 effect 内 `onMenu('closeTab'|'reopenClosedTab'|'nextTab')` 三个手写 handler，body 与 `commandOps` 对应字段**逐字等价**（唯一差异是双执行本身）。
- **不涉（保持 App 手写）**：`openRecent`（带 path 载荷）/`clearRecent`——非命令 id，useMenus 不订阅；`closeTabOrWindow`——main.ts `before-input-event` 的 Cmd/Ctrl+W 专用路由（tab-aware 语义），非命令 id。三者各只有一处订阅，无双派发。
- 影响面：仅 macOS 原生菜单点击路径（darwin.ts `commandItem`）双发；MenuBar 点击与键盘快捷键本就单发。附带异味：该 effect 依赖 `[fileOps]`（hook 返回对象字面量，每 render 新身份）导致每次 render 拆装订阅——删三监听后依赖收窄，churn 一并消失。

## 验收标准（AC）

- **AC1**：App 删除三个手写监听（`onMenu('closeTab'|'reopenClosedTab'|'nextTab')`），useMenus `menu:<id>` 泛化订阅成为唯一派发面——原生菜单单击恰好执行一次（`reopenClosedTab` 恰好重开一张）。
- **AC2**：逐 id 行为等价表落 plan（手写 body ≡ `commandOps` body 已逐字核对）；`openRecent`/`clearRecent`/`closeTabOrWindow` 三监听**原样保留**（非命令 id，单注册）。
- **AC3**：订阅 effect 依赖数组收窄并注明（不再依赖 `fileOps` 对象字面量——每 render 拆装的 churn 消失）；effect 内清理函数相应减少三个 `off`。
- **AC4**：收敛门禁 typecheck + test:unit 全绿；命令 id 字面量、`menu:` 通道名、`data-op` 全集零变化（e2e 缝硬契约）；madge 0 cycles。

## 约束

- 行为变更仅限「双执行 → 单执行」；三命令的业务 body 一字不改。
- 不改 useMenus / commands / main.ts / darwin.ts；不动 `closeTabOrWindow` 的 tab-aware 语义（Cmd/Ctrl+W 规格）。
- 不为该缝补单测（window.api 依赖，node 环境不渲染 wiring）——人工冒烟为验收手段。

## 不做

- 不合并 `closeTabOrWindow` 进命令注册表（它是 main 侧输入路由的专用语义，改造属另一议题）；不做 `onMenu` 通道类型化（已知债 4.1 决议范围外）。
