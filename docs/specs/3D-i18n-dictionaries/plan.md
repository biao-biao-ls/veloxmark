# 3D 实施方案

## 技术决策与理由

- **3.17 取「对齐测试覆盖」而非「共享 key 派生」**：main/renderer 双 bundle 运行时无法共用 `t()`；仿 2.12 `commandAccelerators` 先例把纯数据迁 `electron/shared/menuStrings.ts`，使 0.2 测试可 import 守护。key 名保持 `S.xxx` 短名——`buildDarwinMenu` 约 70 处引用不动，行为零变化。新文件一字一行排布，使 0.2 的 key 字面量源码扫描（防对象字面量静默 last-wins）可复用。
- **3.18 删 `DEFAULT_CALLOUT_TITLES` 走 `t('callout.'+type)`**：值已与 `callout.*` 键逐字一致；动态 key 用「CALLOUT_TYPES × 键存在性」直接断言（比前缀白名单更强，且不引入白名单基建）。
- **3.19 启动读 store**：`preferences/store.ts` 零 import（无环）；try/catch 语义由 store sanitize 承担（missing/garbage → `DEFAULT_PREFERENCES.language='system'`，与现实现等价）。
- **`LanguagePref` 收敛到 store 声明 + i18n re-export**：消除同名双声明，消费方（p14 seam 等）import 路径不变。

## 文件切法

| 源 | 目标 | 内容 |
|---|---|---|
| `electron/menu/darwin.ts` L54–110 | `electron/shared/menuStrings.ts` | `NATIVE_MENU_STRINGS` 字典（一字一行） |
| `editor/livePreview/callout.ts` L88–110 | （删） | `DEFAULT_CALLOUT_TITLES`；`calloutDefaultTitle` 改 `t()`；header 注释同步 |
| `i18n/index.ts` `langFromStorage` | （改） | 读 `getPreferences().language`；`LanguagePref` 改 re-export |
| `i18n/i18n.test.ts` | （增） | 第三份字典对齐块 + `callout.*` 动态键断言 |

## 状态/契约归属

- 无模块级可变状态迁移；`uiLang`/`recentFiles`/`nativeCheckedIds` 等菜单状态仍归 `menu/darwin.ts`（2.18 归属不动）。
- `currentLang` 仍归 `i18n/index.ts`（`setLang` 推送模型不变）。

## import 改动面

- `darwin.ts`：+ `import { NATIVE_MENU_STRINGS } from '../shared/menuStrings'`（删本地字典）。
- `callout.ts`：`getLang` → `t`（文件头「parser never touches i18n」注释改为「display names call-time 取语言」说明）。
- `i18n/index.ts`：+ `import { getPreferences, type LanguagePref } from '../preferences/store'`；删本地 `LanguagePref` 与 localStorage 读取。
- `i18n.test.ts`：+ `import { NATIVE_MENU_STRINGS } from '../../../electron/shared/menuStrings'`、`import { CALLOUT_TYPES } from '../editor/livePreview/callout'`。

## 任务拆分

1. 3.17 迁字典 + 测试块
2. 3.18 删副本 + 动态键断言
3. 3.19 读源收敛 + `LanguagePref` 单源

（顺序执行；三步互不依赖但同属一 spec 单元，不拆并行组。）

## 验证方案

- `npm run typecheck && npm run test:unit`——0.2 对齐测试新增用例全绿。
- 人工冒烟：Preferences 切语言 → 原生菜单 / callout 默认标题 / 欢迎文档同步；`> [!note]` 无自定义标题显示 Note/注意；启动语言 = 上次偏好。
