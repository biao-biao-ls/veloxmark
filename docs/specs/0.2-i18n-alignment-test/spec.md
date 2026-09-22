# 0.2 i18n key 对齐测试

## What / Why

`i18n/en.ts` 与 `zh.ts` 约定「Keys must mirror en.ts exactly」但无任何守护（当前 412 key 恰好齐平，纯靠人肉）。加 Vitest 用例固化对齐契约，防止 key 漂移只有用户能发现。

## 背景与现状

- `EN`/`ZH`：扁平 `Record<string, string>`，`t(key, params)` 支持 `{name}` 占位符
- 动态 key 用模板拼接（`t(\`cmd.heading${n}\`)` 等），静态检索天然不可见
- 静态 `t('…')` 引用约 311 处，当前全部命中 EN（评估时点）
- 字典分裂（NATIVE_MENU_STRINGS / DEFAULT_CALLOUT_TITLES）**不在本任务范围**（3.17/3.18）

## 验收标准（AC）

1. 新建 `src/renderer/src/i18n/i18n.test.ts`（Vitest node 环境，随仓库 `*.test.ts` 共置约定）
2. 断言 EN/ZH key 集合相等（双向差集为空，缺失时报出具体 key）
3. 断言两侧源文件内无重复 key 字面量（对象字面量重复 key 运行时静默 last-wins，须源文本级检测）
4. 断言每个 key 的 `{placeholder}` 集合两侧一致
5. 断言源码中静态 `t('…')`/`t("…")` 引用的 key ⊆ EN（模板拼接动态 key 不在扫描面，避免误报）
6. 测试一次通过即基线锁定（若测试揭示现存漂移，顺手修复字典后通过——修复属于收敛范围）

## 约束

- 只测字典与引用，不渲染组件、不引 React（node 环境纪律）
- 扫描源码时排除 `*.test.*` 自身，避免自匹配误报

## 方案（轻）

- 直接 `import { EN } / { ZH }` 做集合/占位符断言
- 重复 key 检测：`readFileSync(new URL('./en.ts', import.meta.url))` 源文本正则取 key 字面量
- 静态引用扫描：`fs.readdirSync` 递归 `src/`（排除 `.test.`），正则 `\bt\(\s*['"]([^'"]+)['"]\s*[,)]`
