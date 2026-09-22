# electron/ — 主进程子模块

Electron 主进程 + preload 桥 + IPC。类型契约与实现分离是本模块的核心纪律。

## 入口与启动

- `main.ts`（~579 行）：应用生命周期、无边框窗口、macOS 原生菜单、`mdres://` 特权协议、open-file 队列。由 `npm run dev`（electron-vite）加载，产物 `out/main/index.js`。
- `preload.ts`：`const api: RendererApi = {…}` 显式实现后 `contextBridge.exposeInMainWorld('api', api)`。订阅型方法返回卸载闭包，回调包一层丢弃 `IpcRendererEvent`。

## 核心契约：shared/api.ts（275 行，纯类型）

**preload 桥与全部 IPC payload 的单一真源**——被 `preload.ts`、`ipc/*`、渲染端 `env.d.ts` 三方消费。新增 API 的固定顺序：

1. 在 `shared/api.ts` 加 payload 接口 + `RendererApi` 方法签名（缺签名 preload 编译期即失败）
2. `preload.ts` 实现该方法（invoke/send/on）
3. `ipc/<domain>.ts` 里 `ipcMain.handle/on` 注册实现
4. `ipc/index.ts` 的 `registerAllIpc` 覆盖到

已知缺口：channel 名本身不在类型系统内（preload 与 ipc 各写一遍裸字符串），改 channel 名必须两处同改。

## IPC 组织

按域分模块（`ipc/index.ts` 的 `registerAllIpc(getWindow)` 聚合），命名 `domain:action`（如 `file:read`、`folder:watch`、`search:results`）：

| 模块 | channel 前缀 | 职责 |
|---|---|---|
| `ipc/files.ts` | `dialog:*` `file:*` `path:move` `link:resolve` | 对话框/读写/建删改移 |
| `ipc/folder.ts` | `folder:*` | 目录扫描/监听（`stopFolderWatcher` 退出清理） |
| `ipc/export.ts` | `export:*` | HTML/PDF、图片转 dataURL |
| `ipc/image.ts` | `image:*` | 剪贴板图/导入/远程下载 |
| `ipc/drafts.ts` | `draft:*` | P12 崩溃恢复草稿（500ms 节流写盘） |
| `ipc/search.ts` | `search:*` | 全文搜索/替换（流式批投） |
| `ipc/window.ts` | `window:*` + `clipboard:*` + `shell:*` + `app:setState` | 窗口控制（clipboard/shell 错位在此，见债务） |
| `ipc/window-state.ts` | — | 窗口几何持久化（无 IPC，纯 helper） |

另有 5 个 handler 内联在 `main.ts` `whenReady`（`app:rendererReady`/`setRecentFiles`/`setMenuCheckedIds`/`setLanguage`/`closeResponse`），服务于原生菜单/close 拦截——新 handler 不要效仿内联，进 `ipc/*`。

## macOS 原生菜单（main.ts 内 ~280 行）

`NATIVE_MENU_STRINGS`（en/zh 双语独立字典）+ `buildDarwinMenu`/`rebuildDarwinMenu` + `DARWIN_COMMAND_ACCELERATORS`。**label/handler 在渲染端 `commands.ts`**，main 只按 command id 发 `menu:<id>` 给 renderer——id 是跨进程契约。改快捷键必须同步 `commands.ts` 的 `shortcut` 字段（双源，无测试守护）。

## 安全规则（Electron 最新实践，禁止放松）

- `contextIsolation`/`sandbox` 保持默认开启、`nodeIntegration` 关闭；不加载远程内容则也不得为省事关闭 `webSecurity`
- 桥只暴露最小 API 面（现有 `RendererApi` 即上限），不暴露裸 `ipcRenderer`/`require`
- 导航拦截 `will-navigate` + `setWindowOpenHandler` 默认 deny，放行外链只走 `shell.openExternal` 且**不传用户可控字符串**
- 处理 `render-process-gone` 崩溃日志（已有）；新增 IPC 对 `event.senderFrame` 有疑义时校验来源
- 自定义协议 `mdres://` 服务图片资源，优于 `file://`（不给整盘访问权）

## 已知债务（勿加重，重构走 SDD）

- `main.ts` 双主题混居（窗口生命周期 + 原生菜单），`menu/darwin.ts` 拆分在 backlog
- `window.ts` 错位收纳 `clipboard:*`/`shell:*`/`app:setState`
- channel 字面量双写无编译守护；`onMenu` 的 `menu:<id>` 动态 channel 在类型系统外
- `NATIVE_MENU_STRINGS` 是 i18n 第 3 份字典（渲染端另有 en/zh 两份 + callout 本地字典）
