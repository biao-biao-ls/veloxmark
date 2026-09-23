# 4.5 双派发缺陷修复 — 实施计划

## 技术决策与理由

- **命令侧赢（useMenus 泛化订阅）**：三消费方（MenuBar/全局快捷键/mac 原生菜单）都从 `commands.ts` 生成是既定设计（useMenus 文件头明文）；App 手写监听是 P26 期 pre-registry 补丁，属「hand-listed」异常。保留 commandOps 装配为唯一行为定义点。
- **不动载荷/专用通道**：`openRecent`（带 path）/`clearRecent`/`closeTabOrWindow`（main `before-input-event` 专用路由）非命令 id，useMenus 不订阅，双派发不成立——保持 App 手写。

## 逐 id 等价表（AC2）

| id | App 手写 body（删） | commandOps body（留，经 useMenus 跑） | 等价 |
|---|---|---|---|
| `nextTab` | `fileOps.nextTab()` | `() => fileOps.nextTab()` | 逐字同 |
| `closeTab` | `void fileOps.closeTab(fileOps.getActiveTabId())` | 同 | 逐字同 |
| `reopenClosedTab` | `void fileOps.reopenClosedTab()` | 同 | 逐字同 |
| `openRecent` | `onMenu('openRecent', path?)` → `fileOps.openRecentFile(path)` | 非命令 | **保留**（载荷） |
| `clearRecent` | `onMenu('clearRecent')` → `clearRecentFiles()` | 非命令 | **保留** |
| `closeTabOrWindow` | tab-aware：tabs>1 → closeTab；否则 queryClose→windowClose | 非命令 | **保留**（main 路由语义） |

## 文件切法

| 源 | 改动 |
|---|---|
| App.tsx 原生菜单订阅 effect | 删 `offCloseTab`/`offReopenTab`/`offNextTab` 三个订阅 + 清理项；effect 注释注明单派发收敛（4.5）；**deps 收窄**：`[fileOps]` → 显式稳定字段（`openRecentFile`/`closeTab`/`queryClose`/`getActiveTabId`/`getTabCount`/`reopenClosedTab`? 不再需要）——实际留下的 handler 用到 `fileOps.openRecentFile`/`fileOps.closeTab`/`fileOps.queryClose`/`fileOps.getActiveTabId`/`fileOps.getTabCount`，deps 取这几个稳定 useCallback 身份，告别对象字面量 churn |
| useMenus / commands / main.ts / darwin.ts | **零改动** |

## 等价性说明

- 单执行后行为 = 原双执行中的一次（body 逐字同，幂等性无涉——`reopenClosedTab`/`closeTab` 本就不幂等，这正是缺陷可见的原因）。
- 注册时序无涉：删的是重复订阅之一，余下 useMenus 订阅在 mount 期注册（与原手写订阅同 tick 语义）。
- `closeTabOrWindow` 内部仍调 `fileOps.closeTab`/`queryClose`——与命令侧 closeTab 并存是**有意的**（Cmd/Ctrl+W 走专用路由，不经 `menu:closeTab`），无双派发。

## 验证方案（converge）

1. `npm run typecheck && npm run test:unit` 全绿。
2. `npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles。
3. grep 断言：App 内 `onMenu('closeTab'|'reopenClosedTab'|'nextTab')` 0 命中；`onMenu('openRecent'|'clearRecent'|'closeTabOrWindow')` 各恰 1；useMenus 泛化订阅不动。
4. 人工冒烟（行为变更类，重点）：macOS 原生菜单 File → Close Tab / Reopen Closed Tab / Next Tab **各单击一次验证只执行一次**（reopen 恰好重开一张）；Cmd/Ctrl+W 三态（多 tab 关 tab / 单 tab 关窗 + 脏文档拦截）；MenuBar 点击与 Ctrl+Tab/Ctrl+Shift+T 无回归。
