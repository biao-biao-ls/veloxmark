# 3D i18n 字典分裂治理

## What / Why

治理三处字典/读源分裂：

- **3.17** 主进程 `NATIVE_MENU_STRINGS` 游离在统一 key 空间与对齐守护之外（第三份字典无人看守）；
- **3.18** `DEFAULT_CALLOUT_TITLES` 与 i18n `callout.*` 语义完全重叠的第二份字典（值逐字一致）；
- **3.19** `i18n/index.ts` 自读 `veloxmark.preferences`，与 `preferences/store.ts` 构成启动时双读源。

目标：字典单一真源 + 对齐测试全覆盖 + 启动语言解析单一读取。

## 背景与现状

- `electron/menu/darwin.ts` L54–110：`NATIVE_MENU_STRINGS`（zh/en × 约 70 key）内联于菜单模块，无守护测试。2.12 已立先例：纯数据落 `electron/shared/`（`commandAccelerators.ts`）+ renderer 测试守护（`shortcutSync.test.ts`）。
- `editor/livePreview/callout.ts` L88–110：`DEFAULT_CALLOUT_TITLES`（zh/en × 8 型）与 `i18n/en.ts`/`zh.ts` 的 `callout.note`…`callout.danger` 值逐字一致（已核对）。唯一消费方 `calloutDefaultTitle` → `calloutDisplayTitle`（handlers-tree / renderDoc 间接消费）。
- `i18n/index.ts` L25–38：`langFromStorage()` 直读 `localStorage['veloxmark.preferences']`；`preferences/store.ts` 同键读取并 sanitize（L280 language 字段，缺省 `'system'`）。
- `LanguagePref = 'system' | 'zh' | 'en'` 在 `i18n/index.ts` 与 `preferences/store.ts` 各声明一份。

## 验收标准（AC）

- **AC1（3.17）**：`NATIVE_MENU_STRINGS` 迁 `electron/shared/menuStrings.ts`（纯数据叶模块）；0.2 对齐测试扩展覆盖第三份字典：zh/en key 集相等、无重复 key 字面量、`{placeholder}` 集一致。darwin 菜单行为与标签值一字节不变。
- **AC2（3.18）**：删除 `DEFAULT_CALLOUT_TITLES`；`calloutDefaultTitle(type)` 改走 `t('callout.'+type)`；`callout.*` 8 键为唯一真源；动态 key 以「CALLOUT_TYPES × `callout.*` 键存在性」直接断言登记。callout 默认标题显示行为不变（值已一致）。
- **AC3（3.19）**：`i18n/index.ts` 不再直读 localStorage，启动语言从 `preferences/store` 的 `getPreferences().language` 解析（`'system'` → `navigator.language` 语义不变）；`LanguagePref` 单源声明于 store、i18n re-export（消费方 import 零改动）。
- **AC4**：`npm run typecheck && npm run test:unit` 全绿；行为不变（人工冒烟：语言切换后原生菜单/callout 标题/欢迎文档同步正确）。

## 约束

- e2e 缝：`__veloxP14.setLanguage`（→ `setPreferences` → App `setLang` 推送链）行为不变；menu id / 命令 id 字面量不变。
- Constitution：跨进程共享数据只落 `electron/shared/`；main 进程不得 import renderer 代码（双 bundle 隔离）；i18n key 变更须 en+zh 同步（0.2 守护）。
- `NATIVE_MENU_STRINGS`「并入统一 key 空间」取任务文本第二选项：**对齐测试覆盖第三份字典**（运行时共享字典受 bundle 隔离所限，无收益）。

## 不做

- 不把约 70 个 native 菜单串并进 en/zh 的 `nativeMenu.*` 键（仅测试锁定第三份字典的内部一致性）。
- 不合并 `commands/menuLayout.ts`（MenuBar）与 native 菜单串的语义重复（可能改动标签文案，另立）。
- 不改 i18n 的 `setLang` 推送模型为 store 订阅模型（行为变更）。
- 不动 en/zh 现有 `callout.*` 键值。
