# 1A 拆 App.tsx（e2e 类型 + seam 装配外移）

## What / Why

`App.tsx` 2642 行 = ~285 行 e2e `declare global` 类型 + ~750 行 `window.__velox*` seam 装配 effect + 业务回调。e2e 探针面是纯测试基础设施，与业务装配混在一处既撑大文件又模糊「产品代码 vs 测试缝」边界。把类型与 seam 装配整体外移到 `src/renderer/src/e2e/`，App 只剩业务 + 一个统一装配入口。

## 验收标准（AC）

1. `src/renderer/src/e2e/handles.d.ts` 承接 App.tsx 现 `declare global` 块（`__veloxEditor` + `__veloxP12`–`__veloxP29`，约 L100–384）**原样平移**——handle 形状零改动（类型即 e2e 契约，编译器守护）。L385–402 的 null 初始化为运行时代码，移入 `e2e/seams/index.ts` 模块级副作用（import 时执行，早于首次 render，与原模块加载时机等价）
2. `src/renderer/src/e2e/seams/` 按 P 编号分组承接全部纯 seam effect 体（`window.__veloxPXX = {…}` 字面量整体平移，行为零改动）：
   ```
   e2e/seams/
     p12.ts          installP12Handle（effect 与业务 onQueryClose 订阅混合 → 只外提 handle 字面量）
     p13.ts          useP13Seam（含 seam-only sidebarModeRef 随迁）
     p14.ts          useP14Seam（含 seam-only statsRef/loadContentRef 随迁）
     p15.ts          useP15Seam（bench 全自含，无 App 依赖）
     p16.ts          useP16Seam
     p17.ts          useP17Seam
     p18.ts          useP18Seam
     p19.ts          useP19Seam
     p20.ts          useP20Seam
     p21.ts          useP21Seam
     p22.ts          useP22Seam
     p23.ts          useP23Seam
     p24-p29.ts      useP24P29Seam（三 handle 共享单 effect 现状保持，不拆成三个 effect）
     p25.ts          useP25Seam
     p26.ts          useP26Seam
     index.ts        useE2eSeams(deps) 统一入口 + null 初始化副作用
   ```
   - 每个 `usePXXSeam(deps)` 内含原 `useEffect`，**dep 数组逐项保持**（含 `react-hooks/exhaustive-deps` 抑制位）——handle 重建时机零变化
   - ref 归属纪律：**seam-only ref 随迁**（sidebarModeRef/statsRef/loadContentRef/lastAutoSaveAtRef/mermaidDialogOpenRef/calloutDialogOpenRef 等以 grep 复核为准）；**业务共用 ref 留在 App 以 deps 传入**（filePathRef/toastRef/restoreFoldsForRef/openExternalImplRef/tableDialogRef/tableFormRef/lastFormatRef/formatWarningsRef/mpProbeRef 等）
   - P12 特例：原 effect = handle 装配 + `window.api.onQueryClose` 业务订阅（关闭拦截）。只外提 handle 字面量为 `installP12Handle(deps)`，订阅 effect 留 App 原位不动（含 cleanup）
   - P28/P29 两份逐字相同的 `themeToken` 可提为 `p24-p29.ts` 模块内私有 helper（同文件内行为等价去重）；其余一律原样平移
3. App.tsx 在全部 deps 定义之后（约 L2307 现 P20 effect 尾）保留**唯一装配入口** `useE2eSeams({…deps})`；`window.__veloxEditor = {…}` 赋值（create-editor effect 内，属编辑器生命周期非 seam）留原位
4. e2e 契约不变：所有 `window.__velox*` 名称/形状不变（AC1 类型平移即编译期守护）；`window.__veloxTable`/`__veloxPrefs`/`__veloxCtxDebug` 等非 App 持有 handle 的所属模块不动
5. 行为不变：`npm run typecheck && npm run test:unit` 全绿；App.tsx 目标 < 2000 行（预计 ~1590）

## 不做

- 业务回调/hooks 下沉（折叠同步、会话持久化 effect 群等）——本单元只动 e2e 面，业务拆分留 1.3 可选项与阶段 3
- `useE2eSeams` 的 deps 袋合并/记忆化优化——deps 逐项透传，语义与现状一致
- cdp 探针脚本同步——`scripts/cdp-*.mjs` 不在本仓库（已核实无 scripts/ 目录），契约由 handles.d.ts 类型钉住

## 方案（Plan）

### handles.d.ts（类型平移）

`declare global` 块原样剪切；顶部补类型 import（全 `import type` / `typeof` 查询，无运行时引入）：

```ts
import type { EditorView } from '@codemirror/view'
import type { updateLivePreviewConfig } from '../editor/setup'
import type { setMermaidExportIo } from '../editor/widgets'
import type { DocStats } from '../components/StatusBar'
import type { FormatWarning } from '../editor/format'
import type { TableInsertForm } from '../components/TableInsertDialog'
import type { LinkResolveResult, SearchOptions, SearchReplaceRequest, SearchReplaceResult } from '../../../../electron/shared/api'
declare global { interface Window { …原块… } }
```

（相对路径以实测为准；`window.api` 形状继续走 `env.d.ts`，不在此重声明。）

### seam 模块形态

```ts
// pXX.ts
export interface PXXDeps { viewRef: RefObject<EditorView | null>; /* 按需 */ }
export function usePXXSeam(deps: PXXDeps): void {
  const { viewRef, … } = deps
  // seam-only ref（随迁者）在此 useRef + 每 render 同步
  useEffect(() => {
    window.__veloxPXX = { …原字面量… }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ …原 dep 数组… ])
}
```

`index.ts` 的 `useE2eSeams` 顺序调用各 `usePXXSeam`（无条件调用，hook 纪律），P12 只调 `installP12Handle` 的 effect 包装。App 调用点：

```ts
useE2eSeams({ viewRef, fileOps, filePathRef, toast, toastRef, checkDrafts, queryClose, … })
```

### 任务拆分

1. handles.d.ts 平移 + null 初始化迁 seams/index.ts（先做，编译过即契约稳）
2. p12/p14/p15/p13/p16 小组先行（含 ref 随迁判定）
3. p21/p22/p23 + p24-p29（大共享 effect）
4. p25/p26 + p17/p18/p19/p20
5. useE2eSeams 收口 + App 原 effect 段删除 + converge（typecheck + unit + 行数记录）
