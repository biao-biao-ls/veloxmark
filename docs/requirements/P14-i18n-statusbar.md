# P14 界面 i18n 与状态栏

优先级：P14 | 类别：功能 | 预估规模：S–M

## 背景

界面中英混杂：菜单/对话框/欢迎页为英文（P00 后菜单标签在 `commands.ts`
注册表、欢迎页/帮助文案在 `content.ts`），用户是中文使用者。编辑器没有状态栏——Typora 底部显示字数/字符/行数、
光标行列，是写作时的高频参考信息。

## 目标

① 完整的界面中英双语支持（默认跟随系统，可手动切换）；② 底部状态栏：
字数统计 + 光标位置 + 模式指示。

## 功能需求

### i18n
- [x] 抽取全部用户可见字符串到语言资源文件（`src/renderer/src/i18n/zh.ts`
      / `en.ts`），建立 `t('key')` 查询与 `useTranslation` hook
- [x] 覆盖范围：标题栏菜单（P00 后由 `commands.ts` 注册表生成——label
      改为 i18n key 或由 `t()` 查表；macOS 原生菜单字符串独立维护一份）、
      对话框（P02）、文件树右键菜单、侧栏标题、欢迎页、
      帮助文档（中文版 HELP_MD）、设置面板（P03）
- [x] 语言切换：设置项"跟随系统 / 中文 / English"，切换即时生效；macOS
      原生菜单切换后重建（IPC 通知主进程 `Menu.setApplicationMenu`）
- [x] 报错/提示信息 i18n（`treeNewFile` 等 alert 文案）

### 状态栏
- [x] 底部常驻状态栏（可设置隐藏）：
      - 左：光标 `行:列`、选区时显示 `选中 N 字符`
      - 中/右：字数（中文按字、西文按词，混合策略参照 wcwidth/Typora
        口径：CJK 计 1 字）、字符数、行数
      - 右：模式指示灯（Focus / Typewriter / Source，对接 P08）、
        自动保存状态（对接 P12，显示 "已保存 12:03"）
- [x] 点击字数弹出详细统计（段落/词/字符/字符含空格）——可选低优

## 实现要点

- i18n 不引重库：字典 + 简单插值函数即可（<100 行）；React 侧用 context
  触发重渲。
- macOS 原生菜单字符串：`electron/main.ts` 的 buildDarwinMenu 需按语言
  构建，语言值启动时从渲染进程同步或读共享 userData 配置文件（后者更稳，
  主进程先于渲染就绪）。
- 字数统计性能：每次 doc change 全文统计在大文件下浪费——debounce 300ms
  或用 CM6 `changeByRange` 增量维护计数；首版 debounce 全文即可（5k 行
  文档 <5ms）。
- 状态栏组件 `StatusBar.tsx` 放 `.main` 之下、editor-host 旁，高度 24px，
  样式进 `styles.css` 两套主题。

## 验收标准

1. 系统语言为中文时首次启动界面即为中文；设置里切 English 无需重启全部
   文案切换。
2. macOS 原生菜单与应用内菜单语言一致。
3. 中英混排文档（100 汉字 + 50 英文词）字数显示与 Typora 同文档计数一致
   （±0，口径写入验收记录）。
4. 状态栏行:列随光标实时更新；选中文本显示选区字符数。

## 非目标

- 日韩等第三语言（架构预留即可）、界面 RTL。

## 实施状态（已完成）

提交：`feat(P14): i18n (zh/en) + status bar`（分支 `feat/P11-P26-scenarios`）。

### i18n

- `src/renderer/src/i18n/en.ts` / `zh.ts`：扁平 key→字符串字典（英文为源，
  中文逐 key 镜像），覆盖 `cmd.*`（命令注册表 label 改为 i18n key，构建
  菜单时 `t()` 查表）、`menu.*`、`dialog.*`、`tree.*`、`search.*`、`quick.*`、
  `export.*`、`prefs.*`、`outline.*`、`app.*`、`tb.*`、`status.*`。
- `i18n/index.ts`：`t(key, params)`（`{n}` 插值，缺 key 回落英文再回落 key
  本身）+ `useTranslation()`（`useSyncExternalStore` 订阅模块级
  `currentLang`，切换语言时 App 子树整体重渲）。`resolveLang('system')` 按
  `navigator.language` 前缀判 `zh`。
- 覆盖组件：Titlebar/菜单（含右键 TreeMenu、Open Recent/Export 子菜单）、
  Dialog（默认按钮）、FileTree、Outline、SearchPanel、QuickOpen、
  ExportDialog、Preferences、标题栏按钮 tooltip、欢迎页（`content.ts`
  双语 `getWelcomeMd(lang)`）、帮助文档（`getHelpMd(lang)`，双语 HELP_MD）、
  各 hook 内 alert/confirm/prompt 文案（useFileOps / useWorkspaceTree）。
- 语言偏好 `language: 'system' | 'zh' | 'en'`（默认 system），Preferences
  行为区首项；切换即时生效（store → effect `setLang(resolveLang(pref))` +
  `window.api.setUiLanguage(resolved)`）。
- macOS 原生菜单：`electron/main.ts` 独立维护 `NATIVE_MENU_STRINGS` zh/en
  映射；语言持久化在 `userData/ui-language.json`（启动时读文件，缺省回退
  `app.getLocale()` 判 zh）；IPC `app:setLanguage` 写文件并
  `rebuildDarwinMenu`，与应用内语言保持一致。

### 状态栏

- `components/StatusBar.tsx`，`.app` 纵向 flex 中 `.main` 之下的 24px 常驻
  条（两套主题样式在 `styles.css`）。偏好 `showStatusBar`（默认 true）可隐藏。
- 左：`行:列`（`status.lineCol` = `{line}:{col}`，光标移动即时更新——
  editor `onSelectionChanged` 直写 stats）；选区时追加 `选中 N 字符`。
- 右：字数（可点击弹详细统计：段落/词/字符/字符（不含空格））、字符数、
  行数；模式指示灯 Focus/Typewriter/Source（对接 P08 prefs，关时不渲染）；
  自动保存槽位对接 P12 `lastAutoSaveAt`（状态栏 `已保存 HH:MM`，标题栏
  `已自动保存 HH:MM`，两处各自 i18n key）。
- 统计 debounce 300ms 全文计算（`computeDocStats`），光标行列/选区不走
  debounce。

### 字数口径（验收记录）

Typora 对齐口径：**CJK 字符（U+3400–4DBF / U+4E00–9FFF / U+F900–FAFF）每个
计 1 词；西文按空白分词，仅计入含字母或数字（`\p{L}`/`\p{N}`）的 token；
纯标点 token 跳过。** 混排样例 100 汉字 + 50 英文词（`w1..w50`）→
**words = 150**，与 Typora 同文档计数一致（±0）；字符数 = 全文长度。

### e2e（scripts/cdp-p14.mjs，端口 9231，29 项全部 PASS）

- 英文 pin 启动：菜单 File/Edit/View/Help、欢迎页 Welcome to VeloxMark。
- `__veloxP14.setLanguage('zh')`：菜单 文件/编辑/视图/帮助、欢迎页
  「欢迎使用 VeloxMark」即时切换；`t('cmd.newFile')='新建'`、
  `t('menu.file')='文件'`；`userData/ui-language.json` 持久化 `{lang:'zh'}`
  （原生菜单字符串随之切换）。切回 en 同理对称验证。
- 字数：载入 100×`汉` + 50 西文 token → `getStats().words===150`、
  `chars===len`、状态栏含 "150 words"。
- 光标：定位 `w1` 内 → `1:103` 实时；选区 0..25 → `25 chars selected`。
- 模式灯：三模式开 → Focus/Typewriter/Source；全关 → 灯不渲染。
- `showStatusBar:false/true` → 状态栏消失/恢复。
- 对话框跟语言：zh 下偏好面板标题「偏好设置」、Language 标签「语言」、
  「关闭」按钮可关面板。
- 自动保存：debounce 1s 触发一次 → 状态栏 `已保存 …`、标题栏
  `已自动保存 …`（中文文案断言）。

### 附带变更

- 既有 cdp 脚本（p03–p13）启动时统一 pin `language: 'en'`——系统 locale
  为 zh 时默认 UI 是中文，旧脚本的英文文案断言需要确定性英文环境；
  cdp-p03 的偏好分区断言同步更新为当前六个分区
  （Appearance/Editing/Images/Workspace/Autosave & Recovery/Behavior）。
