// @ts-expect-error
import pretty from 'pretty-hash'
import type { InspectOptions as NodeInspectOptions, Style } from 'util'
// @ts-expect-error
import inspect from 'inspect-custom-symbol'

export const inspectSymbol: symbol = inspect

export type InspectOptions = NodeInspectOptions & {
  stylize?: (msg: string, style: Style) => string,
  indentationLvl?: number
}
