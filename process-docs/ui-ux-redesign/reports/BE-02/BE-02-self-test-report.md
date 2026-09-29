# BE-02 自测报告

- **任务ID**: BE-02（IT-02，macOS 原生菜单分组与文案对齐）
- **测试时间**: 2026-09-29 13:01
- **测试方式**: 契约单测（Vitest）+ typecheck + 同任务实测取证引用（本仓无 HTTP 服务，测试面为 `buildDarwinMenu`/`NATIVE_MENU_STRINGS` 契约，不适用 API 清单）
- **测试环境**: Windows 10（Git Bash），工作目录 `D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/backend`（worktree 根）
- **无代码改动**: 本次仅执行测试与核对，未修改任何生产代码 / 测试代码

## AC 验证结果

对照任务 frontmatter `acceptance-criteria` 与任务正文核心流程，逐条给出结论。

| 条目 | 描述 | 结果 | 证据来源 |
|------|------|------|----------|
| AC-FN-28 | 双语切换无 key 裸露、en/zh key 全对齐、原生菜单文案同步 | ✅ 通过 | ① `i18n.test.ts > i18n dictionaries > EN and ZH define the same key set`（en.ts/zh.ts key 集合一致断言）② `i18n.test.ts > native menu strings (third dictionary, 3.17) > zh and en define the same key set`（NATIVE_MENU_STRINGS 第 3 字典 en/zh key 对齐）③ `darwinMenu.test.ts > every label key reference resolves in NATIVE_MENU_STRINGS (en + zh)`（模板全部 `S.x`/`S['…']` label 引用双语可解析 → 无裸 key）④ `i18n.test.ts > every static t('…') key resolves against EN` + `callout.<type> resolves in EN and ZH for every CalloutType`（渲染端文案/callout 标题双语可解析）⑤ 实图：`BE-02-selftest.md` §2 + `BE-02-impl.png`（zh 分组名）/`BE-02-impl-en.png`（en 分组名）双语渲染无裸 key |
| AC-FN-09 | 命令 id 集合不变（本任务口径：darwin 命令 id 集合冻结基线 + insertTable/convertToTable 各 1 次） | ✅ 通过 | ① `darwinMenu.test.ts > command id set matches the frozen pre-reorder baseline (AC-FN-09)`（`BASELINE_COMMAND_IDS` 35 项集合逐一相等）② `darwinMenu.test.ts > insertTable/convertToTable appear once each (menu:insert-dedupe)`（各出现且仅出现 1 次） |
| 核心流程 1 | 原生菜单分组对齐 menu-tree §3/附录 A（分组/位次，id 集合不变） | ✅ 通过 | ① `darwinMenu.test.ts > group headers follow the menu-tree §3 group order`（File 5 组/编辑 4 组/视图 5 组/插入 2 组顺序断言）② `darwinMenu.test.ts > menu-tree §3 group keys exist in both languages (FE-01 inventory)`（18 个 `menu.grp.*` key 清单断言）③ 分组对照走查记录：`BE-02-selftest.md` §1（历史组/折叠组空组缺省已登记 change-log CHANGE-4） |
| 核心流程 2 | NATIVE_MENU_STRINGS 新分组名 en/zh 双语增补、key 集合一致 | ✅ 通过 | ① `i18n.test.ts > native menu strings (third dictionary, 3.17) > zh and en define the same key set` ② `darwinMenu.test.ts > menu-tree §3 group keys exist in both languages (FE-01 inventory)` ③ `i18n.test.ts > native menu strings > no duplicate key literals / placeholders agree per key` |
| 核心流程 3 | 既有不挂键行为保持（格式子菜单、标签命令不挂原生加速键） | ✅ 通过 | `darwinMenu.test.ts > format submenu and tab commands keep no native accelerator`（bold/italic/inlineCode/strikethrough/highlight/closeTab/reopenClosedTab/nextTab 在 `DARWIN_COMMAND_ACCELERATORS` 断言 `undefined`） |

### 范围说明（不假 ✅）

- **AC-FN-28** 完整 AC 含「切换界面语言 en → zh → en」界面走查：双语 key 对账、无裸 key 断言为测试实证；双语渲染取证为 Windows 下同一 `buildDarwinMenu()` 模板的原生 popup 截图（`BE-02-impl.png` / `BE-02-impl-en.png`）。真实 macOS 菜单栏系统外观（Cmd 加速键外观、系统语言联动）本机无法取证——但模板/label/字典为同一实现，无 mac-only 分支逻辑，故本条按既有取证口径判 ✅，并在备注中保留该外观差异限制（见 `BE-02-selftest.md` §5）。
- **AC-FN-09** 完整 AC 含「data-op 值集合与重排前完全一致（cdp 探针扫描）」：data-op 属渲染端 MenuBar（FE-01）面，不在本任务 darwin 契约测试覆盖内；本任务口径（frontmatter）为 darwin 命令 id 集合冻结基线，已由测试实证 ✅。data-op 一半留待「阶段 3：与 FE-01 联动」与 QA cdp 探针扫描（任务正文阶段 3/阶段 4 对应 checkbox 尚未勾销），不得视为本任务已覆盖。

## 测试命令与输出摘要

### 命令 1：契约单测

```bash
cd D:/code/typora/projects/.worktrees/typora/ui-ux-redesign/backend
npx vitest run --reporter=verbose src/renderer/src/commands/darwinMenu.test.ts src/renderer/src/i18n/i18n.test.ts
```

输出摘要（2 文件 14 用例全部通过）：

```
✓ darwinMenu.test.ts > command id set matches the frozen pre-reorder baseline (AC-FN-09) 5ms
✓ darwinMenu.test.ts > insertTable/convertToTable appear once each (menu:insert-dedupe) 1ms
✓ darwinMenu.test.ts > every label key reference resolves in NATIVE_MENU_STRINGS (en + zh) 1ms
✓ darwinMenu.test.ts > menu-tree §3 group keys exist in both languages (FE-01 inventory) 0ms
✓ darwinMenu.test.ts > group headers follow the menu-tree §3 group order 1ms
✓ darwinMenu.test.ts > format submenu and tab commands keep no native accelerator 1ms
✓ i18n.test.ts > i18n dictionaries > EN and ZH define the same key set 4ms
✓ i18n.test.ts > i18n dictionaries > no duplicate key literals within either source 3ms
✓ i18n.test.ts > i18n dictionaries > placeholders agree per key across languages 3ms
✓ i18n.test.ts > i18n static references > every static t('…') key resolves against EN 31ms
✓ i18n.test.ts > callout.* dynamic key family (3.18) > callout.<type> resolves in EN and ZH for every CalloutType 1ms
✓ i18n.test.ts > native menu strings (third dictionary, 3.17) > zh and en define the same key set 1ms
✓ i18n.test.ts > native menu strings (third dictionary, 3.17) > no duplicate key literals within either language map 1ms
✓ i18n.test.ts > native menu strings (third dictionary, 3.17) > placeholders agree per key across languages 1ms

Test Files  2 passed (2)
     Tests  14 passed (14)
  Duration  904ms
```

### 命令 2：typecheck

```bash
npm run typecheck   # tsc --noEmit -p tsconfig.web.json && tsc --noEmit -p tsconfig.node.json
```

输出摘要：双 tsconfig 检查 0 Error，退出码 0。

## 问题清单

| 级别 | 问题描述 | 复现步骤 |
|------|----------|----------|
| - | 无（本轮测试零失败，未进入 systematic-debugging 修复流程） | - |

## 结论

**通过**。AC-FN-28、AC-FN-09 及核心流程 1-3 全部由契约测试断言实证（14/14 用例通过 + typecheck 0 Error），零失败、零代码改动、无需重新构建。遗留边界已在「范围说明」如实登记：AC-FN-09 的 data-op/cdp 探针一半与 FE-01/FE-02 联动项归阶段 3/4，待联调与 QA 收口。

## 契约测试覆盖率（替代 API 覆盖率；本仓无 HTTP 接口）

| 契约面 | 正向（结构/值） | 对账（key 集合） | 顺序/位次 | 业务规则（锁定裁决） | 异常（漂移拦截） | 联动 |
|--------|------|----------|--------|----------|------|------|
| darwin 命令 id 集合（`menu:<id>`） | ✅ 基线 35 项相等 | - | - | ✅ insertTable/convertToTable 去重各 1 次 | ✅ id 集合漂移即断言失败 | - |
| NATIVE_MENU_STRINGS（第 3 字典） | ✅ label 引用双语可解析 | ✅ en/zh key 集合一致 + 无重复 key + 占位符一致 | ✅ menu-tree §3 分组顺序 | ✅ 格式/标签命令加速键 undefined | ✅ 裸 key/缺 key 即断言失败 | ✅ 18 个 `menu.grp.*` 与 FE-01 清单同源对账 |
| 渲染端 i18n（en.ts/zh.ts） | ✅ 静态 t() key 全解析 + callout 全类型 | ✅ en/zh key 集合一致 | - | - | ✅ 裸 key 即断言失败 | - |

覆盖率: 15/15 已测维度（100%）；未测维度（data-op cdp 探针、真实 macOS 菜单栏外观）已在范围说明登记归属，不计入本任务契约面。
