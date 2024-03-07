export type Logger = {
  log: (...args) => any
  warn: (...args) => any
  error: (...args) => any
  debug: (...args) => any
}

export type KeyParsed = {
  key: string
  index: number
  sort: 'asc' | 'desc'
  ranged: boolean
  maxRange: number | null
  step: number
  numeric: boolean
}

export type PossibleSelection = {
  index: number
  selected: string | null
  options: string[]
  defaultValue: string | null
  canDisable: boolean
}

export type ItemWithInfo = {
  info: { [key: string]: string | number }
  value: any
}

export type ItemWithInfoHash = ItemWithInfo & {
  hash: string
}

export type ItemWithAllValues = {
  info: { [key: string]: string | number }
  value: any
  hash: string
  allValues: any[]
}
