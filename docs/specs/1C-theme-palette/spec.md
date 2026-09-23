# 1C 主题色单源化（palette.ts 为唯一色值源 + 一致性测试守护）

## What / Why

主题色值目前手工同步于 `styles/themes.css`、`export/exportCss.ts`、`export/inlineStyles.ts`、`export/palette.ts` 四处（callout 色更散落 markdown.css），改色靠人肉同改。确立 `palette.ts` 为唯一定义源，TS 侧全部引用生成；运行时 CSS（themes.css / markdown.css）无法在运行时消费 TS 值——按任务约定二选一取「**手工对照 + 测试守护**」（不做构建期注入），`palette.test.ts` 读文件断言一致，杜绝漂移。

## 验收标准（AC）

1. `palette.ts` 增补 callout 色（8 型 × bar/bg × light/dark）为唯一定义；`exportCss.ts` callout 段与 `inlineStyles.ts` `co` 全部改为引用生成，字面 hex 在这两文件中消失
2. `palette.ts` 文档化 `.export-theme-light/.export-theme-dark` ↔ `.theme-light/.theme-dark` 对应关系 + key↔CSS 变量名对照表（含 `bgAlt` → export `--bg-alt` vs runtime `--bg-sidebar` 错位）；导出 `RUNTIME_CSS_VAR` 映射供测试用
3. `hljsTokens.ts` 文件头标注 hljs 色引用关系（上游 `highlight.js/styles/github*.css`，由 widgets.ts（编辑器）/ buildDocument.ts（导出）按主题类 scope 注入，不走 palette）
4. 新增 `export/palette.test.ts`：断言 themes.css 两主题块的 10 个变量值 == palette、markdown.css callout 16 行值 == palette callout（读文件正则解析）
5. 行为不变：EXPORT_DOC_CSS / classStyles 生成值逐字节等价（测试覆盖）；`npm run typecheck && npm run test:unit` 全绿

## 不做

- 构建期 CSS 注入（Vite 插件/codegen）——过重，测试守护已达标
- `exportCss.ts` 游离 hex（mermaid-error `#d1242f`、katex `#d4d4d4`）——不在 palette 10 token 域内，且 light/dark 不对称，另立清理项
- themes.css 新增 token 化（--bg-inset 等只在运行时存在的 token 不进 palette——palette 是「导出面」子集 + callout 共用色）

## 方案（Plan）

### palette.ts 增补

```ts
export type CalloutType = 'note' | 'tip' | 'important' | 'warning' | 'caution' | 'info' | 'success' | 'danger'
/** [bar, bg] — bar 同时是 head 图标色（markdown.css `color: var(--co-bar)`）。 */
export type CalloutColors = Record<CalloutType, readonly [bar: string, bg: string]>
export const LIGHT_CALLOUTS / DARK_CALLOUTS: CalloutColors
export const RUNTIME_CSS_VAR: Record<PaletteToken, string>  // key → themes.css 变量名
```

文件头补：class 对照（`.export-theme-*` ↔ `.theme-*`）、hljs 引用关系一句话、改色流程（改 palette → 跑 palette.test 指出 themes.css/markdown.css 待同步行）。

### 消费方改造（字面 hex → 引用）

- `exportCss.ts`：16 行 callout → `calloutCss('.export-doc', LIGHT_CALLOUTS)` / `calloutCss('.export-theme-dark', DARK_CALLOUTS)` 生成（选择器前缀保持原样：light 带 `.export-doc`、dark 不带）
- `inlineStyles.ts`：局部 `co` 字面对象 → `p === DARK_PALETTE ? DARK_CALLOUTS : LIGHT_CALLOUTS`（tuple 形状不变，`co.note[0]` 调用点零改动）

### palette.test.ts（新，纯 node fs）

- 解析 `styles/themes.css` `.theme-light`/`.theme-dark` 块 → 每个 `RUNTIME_CSS_VAR` 值 == 对应 palette 值
- 解析 `styles/markdown.css` `.theme-(light|dark) .cm-md-callout-(\w+) { --co-bar: …; --co-bg: …; }` → == `LIGHT_CALLOUTS`/`DARK_CALLOUTS`
- 顺带断言 `EXPORT_DOC_CSS` 含全部 callout 少（生成面回归）

### 任务拆分

1. palette.ts 增补 + 文档头
2. exportCss.ts / inlineStyles.ts 改引用
3. hljsTokens.ts 标注
4. palette.test.ts + converge（typecheck + unit）
