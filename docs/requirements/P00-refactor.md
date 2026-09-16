# P00 需求前置重构

优先级：P00 | 类别：工程 | 预估规模：M（约 1 天）

## 背景

对 V1（约 3.6k 行）代码盘点后发现：架构骨架正确（StateField 提供块装饰、
Markdown 文本唯一数据源、preload contextBridge 分层），但有 5 处结构问题
会在 P01–P15 开发中反复被踩：

1. `App.tsx` 727 行 God Component——文件操作、树 CRUD、主题、菜单定义、
   全局快捷键、侧栏渲染全在一个组件。P02/P03/P07/P12/P13 每个都要往里加
   状态与调用点，不拆则 P12 做完约 1400 行，每个 PR 都在同一文件冲突。
2. 菜单/快捷键/命令三处重复定义——macOS 原生菜单（`main.ts`
   `buildDarwinMenu`）、自绘 MenuBar（`App.tsx` menus）、全局 keydown
   （`App.tsx` 手写 if-else 链）。P03/P04/P08/P13 每加一个命令改 3 处，
   且两套菜单的标签/快捷键会漂移。
3. `livePreviewConfig`（`livePreview.ts` L26）是模块级可变全局，App 直接
   赋值 theme/baseDir。P03 要引入字号/开关进装饰逻辑、P09 要改 touched
   粒度、P15 要做装饰快照测试——全局可变状态是三者的共同阻碍。
4. "点击回源码"的 mousedown→dispatch(sourceFrom) 模式在 widgets.ts 里
   复制了 5 遍（Code/Mermaid/Math/Table + TaskWidget 外的全部块 Widget）。
   P06 要统一悬停工具条并改掉 mousedown 无条件劫持，没有基类要改 5 处。
5. IPC 类型双份手抄（`preload.ts` 与 `env.d.ts` 各写一遍 DirNode/Api），
   `main.ts` 499 行单文件内联所有 ipcMain handler。P04/P05/P12/P13 每个
   都要新增 IPC，现在拆 30 分钟，P13 之后再拆要数小时。

## 目标

行为零变化的结构性重构，为 P01–P15 清障：App.tsx 只剩组合与 JSX；命令
单一来源；装饰构建纯函数化可测；Widget 有公共基座；IPC 类型单一来源、
main 按域分模块。

## 功能需求

### R1 拆分 App.tsx hooks

- [ ] `useFileOps`：new/open/save/saveAs、dirty 判定、`confirmDiscard`、
      `loadContent`、`savedContentRef` 管理
- [ ] `useWorkspaceTree`：folderPath/folderTree、watch 订阅、树 CRUD
      （treeNewFile/treeRename/treeDelete/joinPath）、treeMenu 状态
- [ ] `useAppTheme`：theme 读写、localStorage 持久化、mermaid 缓存清理、
      reconfigureTheme 联动
- [ ] `useMenus`：menus 定义、全局 keydown 快捷键（过渡期保留，R2 落地
      后改为从命令注册表生成）
- [ ] App.tsx 目标 ≤ 250 行：编辑器挂载 effect、hooks 组合、titlebar/侧栏
      JSX

### R2 命令注册表

- [ ] 新建 `src/renderer/src/commands.ts`：`{ id, label, shortcut, run }`
      单一来源，覆盖现有全部命令（File/Edit/View/Help 菜单 + 快捷键）
- [ ] 自绘 MenuBar 的 menus、全局 keydown 改为由注册表生成
- [ ] macOS 原生菜单保持 id→accelerator 薄映射，click 统一发
      `menu:<id>`；renderer 侧 `onMenu` 按 id 分发到 `run`
- [ ] `fmtShortcut` 的 ⌘/⇧ 平台转换移入注册表的展示层

### R3 装饰构建纯函数化

- [ ] `livePreviewConfig` 全局对象废弃，配置改为 CM6 Facet
      （`livePreviewConfig` Facet + Compartment 注入），App 更新配置走
      Compartment reconfigure，装饰随 transaction 重建，不再手动
      `livePreviewConfig.theme = …` + forceRefresh
- [ ] `buildDecorations(state, config)` 签名纯函数化：所有配置经参数
      传入，不读模块状态
- [ ] 300 行 buildDecorations 按语法类型拆 handler：heading / inline
      （em/strong/del/code/link）/ image / list / quote / table /
      fencedCode / hr / task / math（正则 pass 独立函数），tree.iterate
      的 enter 只做分发
- [ ] `TaskWidget` 从 livePreview.ts 迁入 widgets.ts（与其余 Widget 同处）
- [ ] 行为对照：拆分前后同一文档 + 光标位置的装饰区间/类型完全一致
      （可用临时脚本对比，P15 再建正式快照测试）

### R4 BlockWidget 基类

- [ ] 抽 `BlockWidget extends WidgetType`：持有 `sourceFrom/sourceTo`，
      统一 click-to-source（mousedown 定位源码）、`ignoreEvent` 默认值
- [ ] CodeBlockWidget / MermaidWidget / MathBlockWidget / TableWidget
      改继承基类，删除 4 处重复 mousedown 代码
- [ ] 基类预留工具条挂载点（空实现即可，P06 填充）：子类可注册
      toolbar items
- [ ] 行为不变：点击任何渲染块仍然跳回源码（改变此行为是 P06 的事）

### R5 IPC 类型单一源 + main.ts 分域

- [ ] 新建 `electron/shared/api.ts`：DirNode、OpenFileResult、RendererApi
      等类型唯一定义；`preload.ts` 与 `env.d.ts` 引用之，删除两处手抄
- [ ] `main.ts` 按域拆分（保持现有 channel 名不变）：
      - `electron/ipc/window.ts`：窗口控制、zoom、clipboard、app:setState
      - `electron/ipc/files.ts`：dialog:openFile/saveFile/openFolder、
        file:read/write/create/delete/rename、file:resolveImageSrc
      - `electron/ipc/folder.ts`：folder:list/watch/unwatch、DirNode
        扫描逻辑
      - `main.ts` 保留：窗口创建、生命周期、协议注册、macOS 菜单、
        open-file 队列
- [ ] `npm run typecheck` 通过；preload 暴露的 api 对象形状不变
      （env.d.ts 消费 shared 类型后 Window.api 类型等价）

## 实现要点

- **顺序**：R1 → R2（R2 依赖 R1 的 useMenus）→ R3/R4（同属 editor，一起
  做）→ R5（独立，可并行）。每完成一个 R 项跑一次 typecheck + 手动冒烟
  （欢迎页、打开文件、切换主题、文件夹树）。
- R1 与 P02 的 async 化涟漪正交：本轮 `confirmDiscard` 保持同步布尔原样
  搬入 useFileOps，P02 再改 async——拆分时不要顺手改行为。
- R3 的 Facet 方案注意：math 正则 pass 里对 `tree.resolveInner` 的依赖
  保留；Facet 默认值与现 `livePreviewConfig` 初始值一致。
- R2 中 macOS 原生菜单的 role 项（about/quit/copy 等）不经注册表，维持
  现状；只有 app 自定义命令走 id 分发。
- R5 只搬代码不改逻辑：`listMarkdownTree`/watcher 防抖等原样移动；
  channel 名一个都不改（preload 已依赖字符串）。
- 验证手段沿用：`npx electron . --remote-debugging-port=9223` +
  `scripts/cdp-test.mjs` 截图对照重构前后。

## 验收标准

1. `npm run typecheck` 通过；`npm run dev` 启动后欢迎页渲染、输入、
   保存、主题切换、打开文件夹、树右键 CRUD 全部与重构前行为一致。
2. App.tsx ≤ 250 行；新增一个菜单命令只需在 commands.ts 加一条 +
   （macOS）main 菜单映射加一行。
3. `buildDecorations` 可在无 DOM 的 node 环境中以
   `EditorState.create({doc, extensions})` 直接调用（不触发对
   window/document 的访问），为 P15 vitest 铺路。
4. `grep -rn "livePreviewConfig\\." src` 无结果（全局可变对象已废）。
5. widgets.ts 中不存在重复的 click-to-source mousedown 代码块（基类唯一
   定义点）。
6. `DirNode` 只在 `electron/shared/api.ts` 定义一次。

## 非目标

- 不改任何用户可见行为（对话框 async 化是 P02、工具条是 P06、
  touched 粒度是 P09）。
- 不引入 Redux/zustand 等状态库——React hooks 足够当前规模。
- 不拆 `styles.css`（CSS 变量化随 P03 做）。
- 不加测试框架（vitest 属 P15；本轮只保证"可测"结构就绪）。
- 不改 channel 名、不改 preload api 形状、不升级依赖。
