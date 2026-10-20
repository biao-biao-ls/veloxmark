import type { Command, InsertCmdOps } from './types'

export function buildInsertCmds(ops: InsertCmdOps): Command[] {
  return [
    {
      id: 'insertMermaidDiagram',
      label: 'cmd.insertMermaidDiagram',
      run: () => ops.openMermaidInsert()
    },
    {
      id: 'insertCallout',
      label: 'cmd.insertCallout',
      run: () => ops.openCalloutInsert()
    },
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
