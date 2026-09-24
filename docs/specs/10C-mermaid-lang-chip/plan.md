# 10C 实施方案

## 技术决策与理由

- **近零生产代码**：机制全部就位（9A 通用 chip/picker/switch + 10A 双区 + `enterFencedCode` 分派）。唯一实现动作 = `build.test.ts` 补 4 例钉 AC1–4（切走/切回 dispatch）。
- **测试走装饰层反射**（build.test.ts 既有惯用：`spec.widget.constructor.name`，不调 `toDOM`）：聚焦 mermaid → 断言 `MermaidPreviewWidget` 出现且 `MermaidWidget` 不出现；聚焦非 mermaid → 无预览 widget；静息 mermaid → `MermaidWidget`；静息非 mermaid（同款图语法正文）→ `CodeBlockWidget` 且无 `MermaidWidget`——「分派只看 info 串、不嗅探内容」由此钉死。
- **新 describe `10C mermaid lang dispatch`** 独立成组（AC 可溯源），不动既有 P28/P29 用例（最小 diff）。
- **`switchFenceLang` 不进单测**（9A 惯例：依赖 `syntaxTree.resolveInner`，行为面归冒烟）；切换动作 = info 串改写 + 下次重建按新 lang 分派——后者即本测试钉的面。
- **chip 位置零代码**：9A 公约（闭栏右下）接受为达标，偏差已记录（spec 位置决策节）；不为 mermaid 发明预览区第二挂点。
- **测试环境安全**：`MermaidWidget`/`MermaidPreviewWidget` 构造器仅存参（渲染在 `toDOM`/`mountMermaidRender`，不触达）；mermaid 库经 `test-stubs/` alias 接管，构造无浏览器依赖（handlers 链既有 import 面，build.test.ts 早已加载）。

## 文件切法

| 源 | 改动 |
|---|---|
| `editor/livePreview/build.test.ts` | 新 describe + 4 例（AC1–4）；反射 helper 零改（`widgetName` 已足） |
| 生产代码 | **零改动**（若测试暴露缺口 → 最小修复并回填本节） |

## 状态/契约归属

无新状态、无新 widget、无 i18n key、无 CSS。e2e 契约零改动。`MermaidPreviewWidget` 反射字段仅 `constructor.name`（无 `lang` 面，不扩 helper——避免为测试改产品接口）。

## import 改动面

零（纯测试文件追加）。madge 复核 0 cycles 为例行守护。

## 任务拆分

1. `build.test.ts` 补 4 例（AC1–4）[唯一任务]
2. 收敛（门禁 + 缝核对 + 勾销）

## 验证方案

- `npm run typecheck && npm run test:unit`（新 4 例全绿；总数 328 → 332）
- `npx madge --circular --extensions ts,tsx src/renderer/src` 0 cycles
- e2e 缝：diff 零既有字面量改动（生产代码零文件触碰）
- 人工冒烟（**待运行时冒烟补签**）：
  1. 聚焦 mermaid：chip 显示 `mermaid`（右下角，9A 公约位）
  2. 点 chip → 语言列表（mermaid 在常用区）→ 选普通语言：预览撤除、面板按新语言着色
  3. 光标移出：按普通代码块渲染（非图表）
  4. 再切回 mermaid：图表渲染恢复（聚焦态双区预览回归）
  5. 切换全程 `$$`/fence 块高与 P25 底栏无异常

## 实现细化（2026-09-25 implement 时决策）

- 按 plan 唯一动作落地：`build.test.ts` 末尾新 describe `10C mermaid lang dispatch` + 4 例（AC1 聚焦双区含 `MermaidPreviewWidget` block widget 且无 `MermaidWidget`；AC2 聚焦非 mermaid 无预览 widget；AC4 静息 mermaid → `MermaidWidget`；AC3 静息非 mermaid 同款图语法正文 → `CodeBlockWidget` 且无 `MermaidWidget`——「分派只看 info 串」钉死）。
- 测试暴露缺口：**无**——4 例一次全绿，生产代码零改动（文件切法表所料）。
- 反射面只用既有 `widgetName`（`MermaidPreviewWidget` 无 `lang` 字段，不扩 helper、不改产品接口）。
- chip 位置零代码（9A 公约闭栏右下，偏差记录见 spec 位置决策节）。

## 收敛记录（2026-09-25）

- `npm run typecheck` 双 tsconfig 全过 ✓
- `npm run test:unit`：34 文件 / 332 例全绿（328 → 332，+4 为本 describe）✓
- `npx madge --circular --extensions ts,tsx src/renderer/src`：✔ No circular dependency found ✓
- e2e 缝：diff 仅 `build.test.ts` +36 行，生产代码零文件触碰（零字面量改动）✓
- AC1–5 逻辑路径核对全通（AC5 位置 = 9A 公约，既有测试钉闭栏）；待运行时冒烟补签（5 点）：
  1. 聚焦 mermaid：chip 显示 `mermaid`（右下角，9A 公约位）
  2. 点 chip → 语言列表（mermaid 在常用区）→ 选普通语言：预览撤除、面板按新语言着色
  3. 光标移出：按普通代码块渲染（非图表）
  4. 再切回 mermaid：图表渲染恢复（聚焦态双区预览回归）
  5. 切换全程块高与 P25 底栏无异常
