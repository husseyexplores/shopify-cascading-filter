// @ts-check
import { getAllKeysFromElement, ReactiveFilterTree } from './filter'
import {
  createLogger,
  typeOf,
  updateSelectOptions,
  fetchJson,
  M,
  memoize,
  getParsedAttributes,
  removeTrailingSlash,
} from './utils'

const ELEMENT_TAG = 'x-product-siblings'

const GROUP_TAG_PREFIX = '_GROUP:'

export class ProductSiblings extends HTMLElement {
  async connectedCallback() {
    if (!this.isConnected) return

    this._ac?.abort()
    this._ac = new AbortController()
    this._hydrated = false

    this.logger = createLogger(ELEMENT_TAG, this.hasAttribute('debug'))
    this.attrs = getParsedAttributes(this, {
      group: {
        fallback: undefined,
        parse: x => {
          const group = x.startsWith(GROUP_TAG_PREFIX) ? x.slice(GROUP_TAG_PREFIX.length) : x
          if (!group.length) return new Error('Invalid or missing "group"')
          return group
        },
      },
      pid: {
        fallback: undefined,
        parse: x => Number(x),
      },
      rootUrl: {
        attr: 'root-url',
        fallback: undefined,
        parse: removeTrailingSlash,
      },
      sectionId: {
        attr: 'section-id',
        fallback: undefined,
        parse: x => x,
      },
    })

    this._dispatchEvent('loading')
    await this._setupSiblings()

    // ------------------------------------------------------------------

    this._hydrated = true
    this.removeAttribute('dehydrated')
    this._dispatchEvent('loaded')
  }

  disconnectedCallback() {
    this._hydrated = false
    this._ac?.abort()
    this._ac = null
  }

  async _setupSiblings() {
    if (!this.attrs) throw new Error('"attrs" has been been parsed yet')

    const siblings = await ProductSiblings.fetchSiblings(GROUP_TAG_PREFIX + this.attrs.group)
    this.siblings = siblings
    this.keys = getAllKeysFromElement(this)

    /** @type {HTMLSelectElement[]} */
    const selects = Array.from(this.querySelectorAll('select[key]'))
    this.selects = selects

    if (this.keys.length !== this.selects.length) {
      if (this.logger) {
        throw this.logger.throw(`Expected ${this.keys.length} selects, got ${this.selects.length}`)
      }
    }

    const reactiveTree = new ReactiveFilterTree({
      canAutoPreselect: !this.hasAttribute('no-autoselect'),
      keys: this.keys,
      list: siblings,
      itemToInfo: x => {
        return {
          info: x.options,
          value: x.product.handle,
        }
      },
      initialValues: this.selects.map(select => select.value),
      getSelectedValueAtIndex: index => this.selects?.[index].value ?? null,
      onRoot: ({ root, defaultRoot }) => {
        if (!this.attrs) return

        if (!this._hydrated) {
          this.logger?.debug('onRoot - but not hydrated')
          return
        }

        // reached the root on of three. Root is an array or handles
        const rootItem = root ?? defaultRoot
        const productHandle = rootItem[0]
        const sib = productHandle
          ? siblings.find(sib => sib.product.handle === productHandle) ?? null
          : null

        this._dispatchEvent('root', { root, defaultRoot, sibling: sib })
        this.logger?.debug('onRoot => ', { root, defaultRoot, handle: productHandle, sib })
      },
      onOptionsChange: selection => {
        const prevented = this._dispatchEvent('onOptionsChange', selection)
        if (prevented) {
          this.logger?.debug('onOptionsChange prevented')
          return
        }

        const { index, options, defaultValue, selected, canDisable } = selection

        if (this.logger) {
          this.logger.debug('onOptionsChange => ', {
            index,
            options,
            defaultValue,
            selected,
            canDisable,
          })
        }

        const select = this.selects?.[index]
        if (!select) return

        updateSelectOptions(select, options)
        // const value = selected ?? ''
        const value = selected ?? defaultValue ?? ''

        select.value = value
        // select.disabled = canDisable

        return value
      },
      logger: this.logger,
    })
    this.reactiveTree = reactiveTree

    this.selects.forEach((select, index) => {
      select.addEventListener('change', e => {
        reactiveTree.update(index, select.value)
      })
    })

    // hydrate selects

    reactiveTree.update(0, this.selects[0].value)
  }

  /**
   * @param {string} eventName
   * @param {object} [detail]
   */
  _dispatchEvent(eventName, detail) {
    // add `element` prop to details
    if (detail && typeOf(detail) === 'Object') {
      Object.defineProperty(detail, 'target', {
        value: this,
        writable: false,
        enumerable: false,
        configurable: false,
      })
    }

    const customEvent = new CustomEvent(`${ELEMENT_TAG}:${eventName}`, {
      detail,
      bubbles: false,
      cancelable: true,
    })

    this.dispatchEvent(customEvent)
    const isCancelled = !document.dispatchEvent(customEvent)
    return isCancelled
  }
}

async function fetchSiblings(group) {
  if (!group) {
    return Promise.reject(
      new Error('Missing `group` argument, which is needed when trying to fetch siblings'),
    )
  }

  // return fetchJson(`/search?view=siblings&type=product&q=${group}`)

  let siblings = []
  /** @type {number | null} */
  let pageNumber = 1

  let url = `/search?view=siblings&type=product&q=${group}`

  while (pageNumber) {
    let result = await fetchJson(url)
    siblings.push(...result.data)

    if (result.pageInfo.hasNextPage) {
      pageNumber++
      url = `/search?view=siblings&type=product&q=${group}&page=${pageNumber}`
    } else {
      pageNumber = null
    }
  }

  return siblings
}

ProductSiblings.fetchSiblings = memoize(fetchSiblings)
ProductSiblings.fetchHtml = M.fetchHtml
ProductSiblings.fetchJson = M.fetchJson

ProductSiblings.tag = ELEMENT_TAG
if (!window.customElements.get(ELEMENT_TAG)) {
  window.customElements.define(ELEMENT_TAG, ProductSiblings)
}

// -------------------------

/**

- Fetch siblings
- create filter tree
- hydrate the selects with default value (first value is always there, can't be empty)
- If the final value is different from the default value - change the URL

*/
