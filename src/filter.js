// @ts-check
import { isObject, getNumberRange, toNumber, filterUntil, sortKeyNodes } from './utils'

export const SYM_KEYS = Symbol('OBJECT_KEYS')
export const SYM_DEPTH = Symbol('OBJECT_DEPTH')

export const getTreeOptions = tree => (tree ? tree[SYM_KEYS] : null)
const isValidValue = x => x != null && x !== ''

/**
 * @typedef {import('./types').PossibleSelection} PossibleSelection
 * @typedef {import('./types').Logger} Logger
 * @typedef {import('./types').ItemWithInfo} ItemWithInfo
 * @typedef {import('./types').ItemWithInfoHash} ItemWithInfoHash
 * @typedef {import('./types').ItemWithAllValues} ItemWithAllValues
 * @typedef {import('./types').KeyParsed} KeyParsed
 */
export function validateFilter(filter) {
  if (!isObject(filter)) return null

  let filterKeys = Object.keys(filter)
    .map(k => k.trim())
    .filter(k => k.length > 0)
  if (filterKeys.length < 1) return null

  let hasAtleastOne = false
  let validated = filterKeys.reduce((acc, k) => {
    let label = k
    let value = filter[k]
    if (typeof value === 'string') {
      let trimmed = value.trim()
      if (trimmed.length > 0) {
        acc[label] = value
        hasAtleastOne = true
      }
    }
    return acc
  }, {})

  return hasAtleastOne ? validated : null
}

export function iterateOverTree(obj, fn, level = 0) {
  if (isObject(obj)) {
    let allKeys = Object.keys(obj)
    allKeys.forEach(k => {
      let v = obj[k]
      iterateOverTree(v, fn, level + 1)
    })
    fn(obj, allKeys, level)
  }

  if (Array.isArray(obj)) {
    obj.forEach(o => {
      iterateOverTree(o, fn, level)
    })
  }

  return obj
}

/**
 * Only string/number/booleans are supported.
 * All values are converted to strings
 *
 * @template T, U
 * @param {{ data: T[], keys: KeyParsed[], path?: string[], setValue: (values: any[], value: T) => any, getValue?: (value: T) => U}} param0
 * @returns
 */
export function createFiltersTree({ data, keys = [], path = [], setValue, getValue }) {
  // if first item is array, then we use index to get value
  // otherwise we assume its a list of objects
  const useIndex = data.length > 0 && Array.isArray(data[0])
  let res = {}

  keys.forEach(({ key: k }, keyIndex) => {
    let isLastKeyIndex = keyIndex === keys.length - 1

    data.forEach(originalItem => {
      if (!originalItem) return
      const item = getValue ? getValue(originalItem) : originalItem

      let obj = path.reduce((x, k) => x[k], item)
      if (!obj) return

      let value = useIndex ? obj[keyIndex] : obj[k]
      const valueType = typeof value
      if (valueType === 'number' || valueType === 'boolean') value = value.toString()
      if (typeof value !== 'string' || value === '') return

      let resInnerObj = keys.slice(0, keyIndex).reduce((x, { key: k }, i) => {
        const value = useIndex ? obj[i] : obj[k]
        return x[value]
      }, res)
      if (!resInnerObj) return

      resInnerObj[value] = isLastKeyIndex ? null : {}
      if (isLastKeyIndex) {
        // [year, make, model]
        // const values = []

        const values = keys.reduce((acc, { key: k }, i) => {
          const value = useIndex ? obj[i] : obj[k]
          acc.push(value)
          return acc
        }, /** @type {any[]} */ ([]))
        resInnerObj[value] = setValue(values, originalItem)
      }
    })
  })

  const tree =
    Object.keys(res).length > 0
      ? iterateOverTree(res, (obj, objKeys, levelIndex) => {
          // const isLast = levelIndex === keys.length - 1

          const desc = keys[levelIndex]?.sort === 'desc'

          if (!obj[SYM_KEYS]) {
            Object.defineProperty(obj, SYM_KEYS, {
              value: objKeys.sort((a, b) => (desc ? b.localeCompare(a) : a.localeCompare(b))),
              configurable: false,
              writable: false,
              enumerable: false,
            })
          }
        })
      : res

  return tree
}

/**
 *
 * @template T
 * @param {{
 *   keys: KeyParsed[]
 *   list: T[]
 *   itemToInfo: (value: T) => ItemWithInfo
 * }} params
 * @returns {*}
 */
export function treeify({ keys, list, itemToInfo }) {
  const expandedList = expandList({ keys, list, itemToInfo })

  return createFiltersTree({
    data: expandedList,
    keys,
    getValue: x => x.info,
    setValue: (values, item) => {
      return item.allValues
    },
  })
}

/**
 *
 * @param {HTMLElement} element
 * @param {number[] | undefined} keySortOrder key sort order by part index
 * @returns {KeyParsed[]}
 */
export function getAllKeysFromElement(element, keySortOrder) {
  /** @type {Map<string, KeyParsed>} */
  const stash = new Map()
  let keyEls = Array.from(element.querySelectorAll('[key]'))

  if (keySortOrder && keySortOrder.length === keyEls.length) {
    sortKeyNodes(keyEls, keySortOrder)

    // must reselect the elements after sorting
    keyEls = Array.from(element.querySelectorAll('[key]'))
  }

  keyEls.forEach(el => {
    const key = el.getAttribute('key')?.trim()
    if (key && !stash.has(key)) {
      let sort = /** @type {KeyParsed["sort"]} */ (el.getAttribute('sort')?.trim())
      if (sort !== 'desc') sort = 'asc'

      let ranged = /** @type {KeyParsed["ranged"]} */ el.hasAttribute('ranged')

      /** @type {KeyParsed["index"]} */
      const index = Number(el.getAttribute('part-index') || 'missing')
      if (Number.isNaN(index) || !Number.isInteger(index) || index < 0) {
        console.error(`Invalid index: ${index}`, el)
        throw new Error(`Invalid index: ${index}`)
      }

      /** @type {number| null} */
      const maxRange =
        toNumber(el.getAttribute('max-range')?.trim(), {
          to: 'float',
          canThrow: false,
          fallback: -1,
        }) ?? null
      const step =
        toNumber(el.getAttribute('step')?.trim(), {
          to: 'float',
          canThrow: false,
          fallback: 1,
        }) ?? 1

      const numeric = el.hasAttribute('numeric')
      stash.set(key, { key, index, sort, ranged, maxRange: maxRange, step, numeric })
    }
  })

  const list = [...stash.entries()].map(([key, keyParsed]) => keyParsed)

  return list
}

/**
 *
 * @template T
 * @param {{
 *   keys: KeyParsed[]
 *   list: T[]
 *   itemToInfo: (value: T) => ItemWithInfo
 * }} params
 * @returns {ItemWithAllValues[]}
 */
function expandList({ keys, list, itemToInfo }) {
  const queue = [...list]

  /** @type {ItemWithInfoHash[]} */
  const expanded = []

  const dups = new Map()

  while (queue.length > 0) {
    const rawItem = queue.pop()
    if (!rawItem) continue

    // item is `{ [keys.key]: value }`
    const item = itemToInfo(rawItem)
    if (!item) continue

    let foundRanged = false
    let rangeStart = 0
    let rangeEnd = Infinity

    for (const key of keys) {
      let value = item.info[key.key]

      if (key.ranged) {
        const max = key.maxRange ?? Infinity
        ;[rangeStart, rangeEnd = Infinity] = getNumberRange(value, max)

        // only update if not already ranged
        if (foundRanged === false) {
          foundRanged = rangeEnd !== Infinity
        }

        const isRanged = rangeEnd !== Infinity
        if (isRanged) {
          for (let start = rangeStart; start <= rangeEnd; start += key.step) {
            const transformedItem = {
              info: { ...item.info, [key.key]: start },
              value: item.value,
              hash: '',
            }
            const itemHash = keys.reduce((acc, { key }, i) => {
              return acc + `_${transformedItem.info[key]}_${i}`
            }, '')
            transformedItem.hash = itemHash

            expanded.push(transformedItem)
            if (!dups.get(itemHash)) {
              dups.set(itemHash, new Set())
            }
            dups.get(itemHash).add(item.value)
          }
        }
      }
    }

    if (!foundRanged) {
      const transformedItem = { info: item.info, value: item.value, hash: '' }
      const itemHash = keys.reduce((acc, { key }, i) => {
        return acc + `_${transformedItem.info[key]}_${i}`
      }, '')
      transformedItem.hash = itemHash

      keys.forEach(k => {
        if (k.numeric) {
          transformedItem.info[k.key] = toNumber(transformedItem.info[k.key])
        }
      })

      if (!dups.get(itemHash)) {
        dups.set(itemHash, new Set())
      }
      dups.get(itemHash).add(item.value)

      expanded.push(transformedItem)
    }
  }

  return expanded.map(x => {
    return { ...x, allValues: Array.from(dups.get(x.hash)) }
  })
}

/**
 *
 * @template T
 * @param {{
 *   keys: KeyParsed[]
 *   list: T[]
 *   itemToInfo: (value: T) => ItemWithInfo
 * }} params
 * @returns {*}
 */

/**
 * @template T
 */
export class ReactiveFilterTree {
  /**
   *
   * @param {{
   *   keys: KeyParsed[]
   *   list: T[]
   *   itemToInfo: (value: T) => ItemWithInfo
   *   onOptionsChange: (selection: PossibleSelection) => *
   *   onRoot: (roots: { root: *, defaultRoot: *}) => *
   *   getSelectedValueAtIndex: (index: number) => *
   *   initialValues: (string|null)[]
   *   beforeOptionsUpdate?: (...any) => *
   *   afterOptionsUpdate?: (...any) => *
   *   logger?: Logger
   *   canAutoPreselect?: boolean
   * }} params
   */
  constructor({
    keys,
    list,
    itemToInfo,
    onOptionsChange,
    onRoot,
    getSelectedValueAtIndex,
    initialValues,
    beforeOptionsUpdate,
    afterOptionsUpdate,
    logger = console,
    canAutoPreselect = true,
  }) {
    this.maxIndex = keys.length - 1
    this.onOptionsChange = onOptionsChange
    this.onRoot = onRoot
    this.logger = logger
    this.getSelectedValueAtIndex = getSelectedValueAtIndex
    this.beforeOptionsUpdate = beforeOptionsUpdate
    this.afterOptionsUpdate = afterOptionsUpdate
    this.canAutoPreselect = canAutoPreselect

    this.tree = treeify({ keys, list, itemToInfo })

    /** @type {(string|null)[]} */
    if (initialValues.length !== keys.length) {
      throw new Error('initialValues must be the same length as keys')
    }

    this._selection = keys.map((x, i) => {
      const initial = initialValues[i]
      return isValidValue(initial) ? initial : null
    })
  }

  get possibleSelection() {
    /** @type {PossibleSelection[]} */
    const init = []
    const PS = this._selection.reduce((acc, x, i) => {
      let selected = x

      const tree = acc.reduce((t, x) => {
        // if (!x.selected || !t) return null
        if (!t) return null
        return t[x.selected ?? x.defaultValue ?? '']
        // return t[x.selected ?? '']
      }, this.tree)

      const options = tree != null ? tree[SYM_KEYS] : []

      if (!Array.isArray(options)) {
        throw new Error(`"options" is not an array. Shoud never happen..`)
      }

      const invalidSelection = !options.includes(selected)
      const prevUnselected = i > 0 && acc[i - 1]?.selected === null
      if (invalidSelection || prevUnselected) {
        selected = null
      }

      const defaultValue = options[0] ?? null

      // if previous item is not selected, we can disable this
      const canDisable = !!prevUnselected
      acc.push({ index: i, selected, options, defaultValue, canDisable })
      return acc
    }, init)

    const { defaultRoot, root } = PS.reduce(
      (acc, s) => {
        acc.defaultRoot = acc.defaultRoot?.[s.selected ?? s.defaultValue ?? ''] ?? null
        acc.root = (s.selected ? acc.root[s.selected] : null) ?? null
        return acc
      },
      {
        defaultRoot: this.tree,
        root: this.tree,
      },
    )
    this._possibleSelection = PS

    return { PS, defaultRoot, root }
  }

  get selectedNullish() {
    return this._selection
  }

  get selectedStrict() {
    const nonNull = /** @type {(string)[]} */ (filterUntil(this._selection, x => x !== null))
    return nonNull
  }

  /**
   *
   * @param {number} index
   * @param {*} rawValue
   * @returns {void}
   */
  update(index, rawValue) {
    const value = rawValue === '' || rawValue == null ? null : rawValue

    const validIndex = index >= 0 && index <= this.maxIndex
    if (!validIndex) {
      this.logger?.error('Invalid index selected', {
        index,
        value,
        maxIndex: this.maxIndex,
      })
      return
    }

    let prevValueAtIndex = this._selection[index]
    this._selection[index] = value
    const { PS, defaultRoot, root } = this.possibleSelection

    // we can't select the value if the previous is still not selected
    if (index > 0) {
      const prevSelection = PS[index - 1]
      if (prevSelection.selected === null) {
        if (!this.canAutoPreselect) {
          this.logger.warn('Unable to select. Previous value is not selected yet.', {
            index,
            prevPS: prevSelection,
            PS,
          })

          this._selection[index] = prevValueAtIndex
          return
        }

        if (this.canAutoPreselect) {
          prevSelection.selected = prevSelection.defaultValue
        }
      }
    }

    // `root` is defined if all values are selected
    if (root || defaultRoot) {
      this.onRoot({ defaultRoot, root })
    }

    const pathToNextTree = this.selectedStrict.slice(0, index + 1)
    // Index at next tree
    const nextTree = pathToNextTree.reduce((tree, treeKey) => {
      return tree?.[treeKey]
    }, this.tree)

    // Tree is found if `SYM_KEYS` is defined
    const nextTreeFound = !!nextTree?.[SYM_KEYS]

    if (!nextTreeFound) {
      // may be we got to the root...
      if (root) return

      // No tree, no value, abyss...
      this.logger?.warn('Invalid value selected', { index, value })
      this._selection[index] = prevValueAtIndex
      return
    }

    // Tree is found - check if the value actually exist
    const nextIndex = index + 1

    for (let i = nextIndex; i <= this.maxIndex; i++) {
      const selection = PS[i]

      if (selection.index !== i) {
        throw new Error('Invalid index. Should never happen...')
      }

      this.onOptionsChange(selection)
      // this._selection[i] = usedValue
    }
  }
}

/*

var filtersList = [
  {
    "value": "2019+_HONDA_ATLAS"
  },{
    "value": "2015-2018_DODGE_CHARGER"
  },{
    "value": "2002-2008_FORD_MUSTANG"
  },{
    "value": "2014-2022_FORD_MUSTANG"
  },{
    "value": "2012_DODGE_CHARGER"
  },{
    "value": "2016_FORD_MUSTANG"
  },{ "value": "2006_HONDA_CIVIC" }
]


var keys = [
  { key: 'year', sort: 'desc', numeric: true, ranged: true, maxRange: 2023, step: 1},
  { key: 'make' },
  { key: 'model' },
]

var itemTransformer = x => {
  const parts = x.value.split('_')
  const info = keys.reduce((acc, k, i) => {
    acc[k.key] = parts[i]
    return acc
  }, {})
  return { info, value: x.value }
}

var transformedList = filtersList.map(itemTransformer)

var expandedList result  = expandList(transformedList,keys)
// console.log('expandedList result => ', expandedList result)

var tree = treeify({
  keys,
  list: filtersList,
  itemToInfo: itemTransformer
})

*/
