/**
 * Insert-domain commands（2B 自 commands.ts 平移，P16/P21/P22）。
 */
import type { Command, InsertCmdOps } from './types'

export function buildInsertCmds(ops: InsertCmdOps): Command[] {
  return [
    // ---- Insert (P16) -------------------------------------------------------
    {
      id: 'insertMermaidDiagram',
      label: 'cmd.insertMermaidDiagram',
      run: () => ops.openMermaidInsert()
    },
    // ---- Insert (P21) -------------------------------------------------------
    {
      id: 'insertCallout',
      label: 'cmd.insertCallout',
      run: () => ops.openCalloutInsert()
    },
    // ---- Insert/Edit (P22) --------------------------------------------------
    {
      id: 'insertTable',
      label: 'cmd.insertTable',
      run: () => ops.openTableInsert('insert')
    },
    {
      id: 'convertToTable',
      label: 'cmd.convertToTable',
      isDisabled: () => !ops.hasSelection(),
      run: () => ops.openTableInsert('convert')
    }
  ]
}
