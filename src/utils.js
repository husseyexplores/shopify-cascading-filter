import hash from 'stable-hash'

export const CURRENT_URL = new URL(window.location.href)
const DEV = import.meta.env.MODE !== 'production' || CURRENT_URL.searchParams.has('_debug_')
const PROD = !DEV
export const env = {
  DEV,
  PROD,
}

export const typeOf = x => Object.prototype.toString.call(x).slice(8, -1)
export const isObject = x => typeOf(x) === 'Object'
export const concatObjects = (x, y) => ({ ...x, ...y })

/**
 *
 * @param {string} id
 * @param {boolean} [debug=env.PROD]
 */
export function createLogger(id, debug = env.DEV) {
  const LOG_PREFIX = `[${id}] :: `
  return {
    debug: (...x) => (debug ? console.log(...x) : undefined),
    log: (...x) => console.log(LOG_PREFIX, ...x),
    warn: (...x) => console.warn(LOG_PREFIX, ...x),
    info: (...x) => console.info(LOG_PREFIX, ...x),
    error: (...x) => console.error(LOG_PREFIX, ...x),
    throw(msg = 'unknown error', meta) {
      const prefixedMsg = `${LOG_PREFIX}${msg}`
      if (meta) {
        this.error(prefixedMsg, meta)
      }
      return new Error(prefixedMsg)
    },
  }
}

/**
 * Returns year range from a string like '<from>_<to>' or '<from>+'
 * @example
 * const [from, to] = getYearRange('2015_2020')
 * // from == 2015, to == 2020
 *
 * const [from, to] = getYearRange('2015')
 * // from == 2015, to == -1
 *
 *
 * const [from, to] = getYearRange('2018+', 2025)
 * // from == 2015, to == -2025
 *
 * // returns 2
 *
 * @param {string | number} input a string like '<from>_<to>' or '<from>+'
 * @param {number} maxRange defaults current year
 *
 * @returns {[number, number]} Returns the tuple of [from, to]. `to` could be Infinity if there is no range.
 */
export function getNumberRange(input, maxRange = Infinity) {
  if (typeof input === 'number') return [input, Infinity]

  // handle cases like `2018+`
  if (input.endsWith('+')) {
    const start = toNumber(input.slice(0, -1))
    return minMax(start, maxRange ?? Infinity)
  }

  const parts = input.split('-')
  const nums = parts.reduce((acc, x) => {
    if (acc.length < 2) {
      acc.push(toNumber(x))
    }
    return acc
  }, [])

  if (nums.length === 1) {
    nums.push(Infinity)
  }

  return minMax(...nums)
}

/**
 *
 * @param {string | number | null | undefined} input
 * @param {{to?: 'integer' | 'float' | 'number', fallback?: number, canThrow?: boolean }} options
 * @returns {number}
 */
export function toNumber(input, { to = 'number', fallback, canThrow = true } = {}) {
  if (to == null) return fallback

  const parsed = numberParser(input, to)

  if (Number.isNaN(parsed)) {
    if (canThrow && fallback === undefined) {
      throw new Error(`Unable to parse "${input}" into "${to}". `)
    }
    return fallback
  }
  return parsed
}

/**
 *
 * @param {*} x
 * @param { 'integer' | 'float' | 'number' } to
 * @returns
 */
function numberParser(x, to) {
  if (to === 'number') return Number(x)
  if (to === 'integer') return parseInt(x, 10)
  if (to === 'float') return parseFloat(x)
  throw new Error(`to: "${to}" is not supported.`)
}

/**
 *
 * @param {number} x
 * @param {number} y
 * @returns {[number, number]}
 */
function minMax(x, y) {
  return x < y ? [x, y] : [y, x]
}

/**
 * Generates a range from "start" to "end"
 * @function
 * @example
 * range(0, 8, 1) // [0, 1, 2, 3, 4, 5, 6, 7, 8]
 * range(0, 25, 5) // [0, 5, 10, 15, 20, 25]
 * range('A', 'E', 1) // ['A', 'B', 'C', 'D', 'E']
 * range(20, 5, 5) // [20, 15, 10, 5]
 *
 * @template T
 * @param {T} start
 * @param {T} end
 * @param {number} step
 * @returns {T[]}
 */
export function range(start, end, step = 1) {
  var typeofStart = typeof start
  var typeofEnd = typeof end

  if (step <= 0) {
    throw TypeError('Step cannot be less than one.')
  }

  if (typeofStart === 'undefined' || typeofEnd === 'undefined') {
    throw TypeError('Must pass start and end arguments.')
  } else if (typeofStart != typeofEnd) {
    throw TypeError('Start and end arguments must be of same type.')
  }

  if (end < start) {
    step = -step
  }

  if (typeofStart === 'number') {
    const range = Array.from({ length: (end - start) / step + 1 }, (_, i) => start + i * step)
    return range
  }

  if (typeofStart === 'string') {
    if (start.length !== 1 || end.length !== 1) {
      throw TypeError('Only strings with one character are supported.')
    }

    start = start.charCodeAt(0)
    end = end.charCodeAt(0)

    const range = Array.from({ length: (end - start) / step + 1 }, (_, i) =>
      String.fromCharCode(start + i * step),
    )
    return range
  }

  throw TypeError('Only string and number types are supported')
}

/**
 * @template T, U
 * @param {T[]} list
 * @param {(acc: U, item: T, index: number) => U} reducer
 * @param {U} initial
 * @returns {U}
 */
export function reduce(list, reducer, init) {
  const listLen = list.length
  if (listLen === 0) {
    return init
  }

  for (let i = 0; i < listLen; i++) {
    const result = reducer(init, list[i], i, list)
    if (result === reduce.BREAK) {
      return init
    }

    if (result === reduce.CONTINUE) {
      continue
    }

    init = result
  }

  return init
}
reduce.BREAK = Symbol('BREAK')
reduce.CONTINUE = Symbol('CONTINUE')

/**
 * @template T
 * @param {T[]} list
 * @param {(item: T, index: number) => any} predicate
 * @returns {T[]}
 */
export function filterUntil(list, predicate) {
  const listLen = list.length
  if (listLen === 0) {
    return []
  }
  return reduce(
    list,
    (acc, x, index) => {
      if (predicate(x, index)) {
        acc.push(x)
        return acc
      }
      return reduce.BREAK
    },
    [],
  )
}

export function $q(ctx, selector, callback) {
  const elements = Array.from(ctx.querySelectorAll(selector))

  if (typeof callback === 'function') {
    elements.forEach((element, index, ctx) => callback(element, index, ctx))
    return
  }

  return callback => {
    elements.forEach((element, index, ctx) => callback(element, index, ctx))
  }
}

$q.first = function first(ctx, selector, callback) {
  const el = ctx.querySelector(selector)
  if (typeof callback === 'function') {
    if (el) callback(el)
    return
  }
  return callback => {
    if (el) callback(el)
  }
}

export function last(list) {
  return list[list.length - 1]
}

/**
 * Determine if we can reset the `select` element
 * @param {HTMLSelectElement} select
 * @returns {boolean}
 */
function canUnselect(select) {
  const firstOption = select.options[0]
  if (firstOption) {
    const noValueAttr = !firstOption.hasAttribute('value')
    const value = firstOption.value ?? ''
    // if there is no `value` is defined on the option element
    // or `value` is set to empty string, we assume it is unselectable
    return noValueAttr || value === ''
  }
  return false
}

/**
 *
 * @param {HTMLSelectElement} select
 * @param {string[]} options
 * @returns {string | null | undefined}
 */
export function updateSelectOptions(select, options) {
  // if select is `unselectable/resetable`, then we keep the first option element as-is
  const offsetIndex = canUnselect(select) ? 1 : 0

  // Remove all selects
  select.options.length = offsetIndex

  // Insert new options
  options.forEach((value, index) => {
    // increment index by 1 to preserve the first option (i.e reset option)
    select.options[index + offsetIndex] = new Option(value, value)
  })
}

/**
 * Parses the specified attributes of an HTML element.
 * @template {{ [key: string]: { fallback?: any, parse: (value: string) => any, attr?: string, allowEmpty?: true } }} T
 * @param {HTMLElement} element - The element to parse the attributes from.
 * @param {T} attributes
 *  - The attributes to parse in the format of an object, where each key represents the attribute name and the
 *  value represents an object with a fallback value and a parse function.
 *
 * @returns {{[K in keyof T]: T[K]['fallback'] extends undefined ? ReturnType<T[K]['parse']> : T[K]['fallback'] |  ReturnType<T[K]['parse']>}} - An object containing the parsed attribute values.
 */
export function getParsedAttributes(element, attributes) {
  /** @type {Error[]} */
  const errors = []

  const result = /** @type {Record<T, U>} */ ({})

  for (let key in attributes) {
    if (Object.prototype.hasOwnProperty.call(attributes, key)) {
      const { parse, fallback, attr, allowEmpty } = attributes[key]
      let attrKey = attr ?? key

      // could be `null` or ''
      let rawValue = element.getAttribute(attrKey)
      if (rawValue === null || rawValue === '') {
        if (allowEmpty) {
          result[key] = rawValue
          continue
        }

        if (fallback !== undefined) {
          result[key] = fallback
          continue
        }
        errors.push(new Error(`Missing ${attrKey} attribute`))
        continue
      }

      const parsed = parse(rawValue)
      if (parsed instanceof Error) {
        errors.push(parsed)
        continue
      }

      if (Number.isNaN(parsed)) {
        errors.push(new Error(`Invalid ${attrKey} attribute (NaN): ${rawValue}`))
        continue
      }

      result[key] = parsed
    }
  }

  if (errors.length > 0) {
    const errorMsgsList = '- ' + errors.map(err => err.message).join('\n- ')
    throw new Error(errorMsgsList)
  }

  return result
}

// -----------------------------------------------------------------------------

export function fetchJson(url, fetchConfig) {
  return fetch(url, {
    headers: {
      accept: 'application/json',
    },
    ...fetchConfig,
  }).then(r => r.json())
}

const htmlParser = new DOMParser()
export function fetchHtml(url, fetchConfig) {
  return fetch(url, fetchConfig)
    .then(r => r.text())
    .then(htmlText => htmlParser.parseFromString(htmlText, 'text/html'))
}

/**
 * @template T, U
 * @param {(...args: T[]) => U} fn - The function to be memoized.
 * @param {number} [memoizedArgsIndices] - The function to be memoized.
 * @returns {(...args: T[]) => U} - Memoized version of the input function.
 */
export function memoize(fn, memoizedArgsIndices) {
  const CACHE = new Map()
  return (...args) => {
    // const key = JSON.stringify(args)

    const key = hash(
      typeof memoizedArgsIndices === 'number' ? args.slice(0, memoizedArgsIndices + 1) : args,
    )

    if (CACHE.has(key)) {
      return CACHE.get(key)
    }
    const result = fn(...args)
    if (result instanceof Promise) {
      result.catch(e => {
        CACHE.delete(key)
        throw e
      })
    }
    CACHE.set(key, result)
    return result
  }
}

export const M = {
  fetchHtml: memoize(fetchHtml, 0),
  fetchJson: memoize(fetchJson),
}

export function removeTrailingSlash(url) {
  return url.endsWith('/') ? url.slice(0, -1) : url
}

function maybeIndex(x) {
  return typeof x === 'number' && !Number.isNaN(x) && Number.isInteger(x) && x >= 0
}

/**
 * @param {string | number[]} rawSortKeyIndexesString
 * @param {(list: string) => string[]} toList
 * @returns {number[] | undefined}
 */
export function parseIndexToList(rawSortKeyIndexesString, toList = list => list.split(',')) {
  const list =
    rawSortKeyIndexesString && typeof rawSortKeyIndexesString === 'string'
      ? toList(rawSortKeyIndexesString)
      : Array.isArray(rawSortKeyIndexesString)
      ? rawSortKeyIndexesString
      : null

  if (!list) return undefined

  for (let i = 0; i < list.length; i++) {
    const int = Number(list[i])
    if (!maybeIndex(int)) return undefined
    list[i] = int
  }

  return list
}

function getSwapEl(el) {
  return el.closest('.YMM_Select-item') || el
}

/**
 *
 * @param {(HTMLElement | Element)[]} keyElements
 * @param {number[] | undefined} sortOrder
 */
function _sortKeyNodes(keyElements, sortOrder) {
  if (sortOrder && sortOrder.length === keyElements.length) {
    for (let i = 0; i < sortOrder.length; i++) {
      const partIndex = sortOrder[i]
      if (i === partIndex) continue

      const el = keyElements.find(el => el.getAttribute('part-index') === partIndex.toString())

      if (!el) throw new Error(`Invalid or missing part index: ${partIndex}`)
      const elAtIndex = keyElements[i]

      if (elAtIndex !== el) {
        // swap els
        swapNodes(getSwapEl(elAtIndex), getSwapEl(el))
        swapListItems(keyElements, i, partIndex)
      }
    }
  }
}

/**
 *
 * @param {HTMLElement} node1
 * @param {HTMLElement} node2
 */
export function swapNodes(node1, node2) {
  const afterNode2 = node2.nextElementSibling
  const parent = node2.parentNode
  //if (false) {
  if (node1 === afterNode2) {
    parent.insertBefore(node1, node2)
  } else {
    node1.replaceWith(node2)
    parent.insertBefore(node1, afterNode2)
  }
}

function swapListItems(list, index1, index2) {
  const item1 = list[index1]
  const item2 = list[index2]
  list[index1] = item2
  list[index2] = item1
}

export function sortKeyNodes(keyElements, comparatorFn, getElementToSwapFn = (x) => x) {
  if (!comparatorFn)
    comparatorFn = (a, b) => {
      const aPartIndex = Number(a.getAttribute('part-index'))
      const bPartIndex = Number(b.getAttribute('part-index'))
      if (Number.isNaN(aPartIndex) || !Number.isInteger(aPartIndex) || aPartIndex < 0) {
        console.error(`Invalid or missing part index: ${aPartIndex}`, a)
        throw new Error(`Invalid part index: ${aPartIndex}`)
      }
      if (Number.isNaN(bPartIndex) || !Number.isInteger(bPartIndex) || bPartIndex < 0) {
        console.error(`Invalid or missing part index: ${bPartIndex}`, a)
        throw new Error(`Invalid part index: ${bPartIndex}`)
      }

      return aPartIndex - bPartIndex
    }

  let sorted = false
  while (!sorted) {
    sorted = true
    for (let i = 0; i < keyElements.length - 1; i++) {
      if (comparatorFn(keyElements[i], keyElements[i + 1]) > 0) {
        // Get the elements to swap
        const elementA = getElementToSwapFn(keyElements[i]);
        const elementB = getElementToSwapFn(keyElements[i + 1]);

        // Swap elements in the array
        [keyElements[i], keyElements[i + 1]] = [keyElements[i + 1], keyElements[i]];

        // Swap elements in the DOM
        elementA.parentNode.insertBefore(elementB, elementA);
        // elementA.parentNode.insertBefore(elementA, elementB);

        sorted = false;
      }
    }
  }
}
