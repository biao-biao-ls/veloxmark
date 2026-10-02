/**
 * AC-ERR-08 / AC-RULE-16 — 全局只读前置拦截闸门。
 *
 * 编辑/结构操作在**写前**调用 assertWritable()：只读时返回 false 并回冻结文案
 * 「文件为只读，无法修改，可另存后编辑」（t('err.readonly')），调用方必须因此
 * 放弃 dispatch——保证「不执行任何写入 / 文档逐字节不变 / 不产生半提交」。
 *
 * 真源是主进程 `file:isWritable`（fs.access W_OK）；渲染层 sandbox 无 fs 权，
 * 不得自造判定。未落盘的 Untitled 文档视为可写（另存为即生成可写副本）。
 * FE-05（链接 URL）/FE-06（列表拖拽、任务勾选）复用本闸门，勿各建一份。
 */
import { t } from '../i18n'
import { getCtxRuntime } from './contextMenu/registry'

/**
 * True when the active document may be edited. On refusal it already fires the
 * frozen read-only toast so callers only need to bail out.
 */
export async function assertWritable(): Promise<boolean> {
  const path = getCtxRuntime()?.getActiveFilePath?.() ?? null
  if (!path) return true
  let writable: boolean
  try {
    writable = await window.api.isWritable(path)
  } catch {
    // Probe unavailable (IPC breakage, not a read-only file) — fail open so an
    // infrastructure glitch cannot block every image edit. A genuinely
    // read-only file still answers `false` and is intercepted below.
    return true
  }
  if (writable) return true
  getCtxRuntime()?.toast(t('err.readonly'))
  return false
}
