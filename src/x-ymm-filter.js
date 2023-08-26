import { typeOf, reduce, $q, createLogger, memoize, removeTrailingSlash } from './utils'
import { treeify as _treeify, SYM_KEYS, getAllKeysFromElement } from './filter'
import * as ls from './local-storage'

// Fitment Delimeter
const _FD_ = '_'
const ELEMENT_TAG = 'x-ymm-filter'
const treeify = memoize(_treeify)

export class YMM_Filter extends HTMLElement {
  constructor() {
    super()
    this._updateSelect = this._updateSelect.bind(this)
  }

  connectedCallback() {
    if (!this.isConnected) return

    this._ac?.abort()
    this._ac = new AbortController()
    this._hydrated = false
    this.logger = createLogger(ELEMENT_TAG, this.hasAttribute('debug'))

    this._dispatchEvent('loading')

    this.isFitmentWidget = this.hasAttribute('fits')
    this._autoSubmit = this.hasAttribute('auto-submit')

    this.rootUrl = this.getAttribute('root-url')
    if (!this.rootUrl) {
      const err = `"root-url" attribute is required`
      this.logger.error(err)
      throw new Error(err)
    }
    this.rootUrl = removeTrailingSlash(this.rootUrl)

    this.collectionHandle =
      this.getAttribute('collection-handle') ?? ls.get('collectionHandle') ?? 'all'
    ls.set('collectionHandle', this.collectionHandle)

    this.rootCollectionHandle = `${this.rootUrl}/collections/${this.collectionHandle}`
    this.keys = getAllKeysFromElement(this)
    this.itemToInfo = YMM_Filter.parsefitmentInfoByKeys.bind(null, this.keys)

    if (this.keys.length < 2) {
      const err = `There should be at least 2 keys`
      this.logger.error(err)
      throw new Error(err)
    }

    this.setAttribute('state', YMM_Filter.state.NONE)

    this.filterJson = JSON.parse(
      this.querySelector('script[type="application/json"][data-filter-json]')?.textContent ??
        'null',
    )

    const filterJsonValues = this.filterJson?.values.map(x => x.value) ?? []
    this.tree = this.filterJson
      ? treeify({
          itemToInfo: this.itemToInfo,
          keys: this.keys,
          list: filterJsonValues,
        })
      : null

    // if `fits` is defined (array), then we assume it is fitment widget
    this.fitsParsed = this.fits
      ? treeify({
          keys: this.keys,
          list: this.fits,
          itemToInfo: this.itemToInfo,
        })
      : null

    this.els = {
      selects: Array.from(this.querySelectorAll('select')),
      form: $q.first(this, 'form'),
      submitButton: $q(this, 'button[type="submit"]'),
      actionUrl: $q(this, '[data-action-url]'),
      clearCache: $q(this, '[data-clear-cache]'),
      filteredTitleText: $q(this, '[data-filtered-title]'),
      updateShowAttr: $q(this, '[data-update-show]'),
    }

    // disable buttons initially
    this.els.submitButton(button => {
      button.setAttribute('disabled', 'true')
    })
    this.els.updateShowAttr(button => {
      button.setAttribute('disabled', 'true')
    })

    this.els.selects.forEach((select, i) => {
      const disabled = i > 0
      if (disabled) {
        select.setAttribute('disabled', 'true')
      } else {
        select.removeAttribute('disabled')
      }
    })

    // initialize selected options state
    this._updateSelectedOptionAtIndex(null)
    this._updateShowAttr('facet')

    // ----------------------------------------------------------------------

    this._setupCascadingSelects()
    this._setupClearCacheListeners()
    this._setupUpdateShowAttr()

    // ----------------------------------------------------------------------

    this._hydrated = true
    this.removeAttribute('dehydrated')
    this._dispatchEvent('loaded')
  }

  disconnectedCallback() {
    this._hydrated = false
    this._ac?.abort()
    this._ac = null
  }

  _setupCascadingSelects() {
    const selects = this.els.selects

    selects.forEach((select, selectIndex) => {
      let firstOption = select.options[0]

      // Make sure first option is 'reset'
      if (select.options.length !== 1 || firstOption?.value !== '') {
        select.options.length = 0
        select.options[0] = new Option(this.keys[selectIndex].key, '')
      }

      // If it's first select, then add the values
      // First select always has values
      if (selectIndex === 0) {
        const firstSelectOptionValues = this.tree[SYM_KEYS]
        updateSelectOptions(select, firstSelectOptionValues)
      }

      select.value = ''

      select._on_ymm_change = this._updateSelect

      // Add event listener
      select.addEventListener(
        'change',
        e => {
          const value = e.currentTarget.value
          this._updateSelect(selectIndex, value)
        },
        { signal: this._ac.signal },
      )
    })

    // Hydrate with initial (saved) state
    const initalSelectedOptions = reduce(
      this.keys,
      (acc, { key }) => {
        const cachedValue = ls.get(key)
        if (!cachedValue) return reduce.BREAK
        acc.push(cachedValue)
        return acc
      },
      [],
    )

    selects.forEach((select, selectIndex) => {
      const initialValue = initalSelectedOptions[selectIndex] ?? ''
      if (isValidOptionValue(initialValue)) {
        select.value = initialValue
        select._on_ymm_change(selectIndex, initialValue)
      }
    })

    this._updateShowAttr('result')
  }

  _updateSelect(selectIndex, newValue) {
    let validValue = isValidOptionValue(newValue)
    newValue = newValue ?? ''

    const selects = this.els.selects
    const select = selects[selectIndex]
    select.value = newValue

    // If the value does not exist in the dropdown, it appears as blank
    // manually set the value to empty...
    if (select.value === '') {
      validValue = false
      select.value = ''

      // if the current value is invalid. the rest will be too...
      for (let i = selectIndex; i < selects.length; i++) {
        ls.remove(this.keys[i].key)
      }
    }

    // First select is never disabled
    if (validValue || selectIndex === 0) {
      select.removeAttribute('disabled')
    }

    ls.set(this.keys[selectIndex].key, newValue)

    // Reset state
    for (let i = selectIndex + 1; i < selects.length; i++) {
      this.selectedOptionsNullable[i] = null
      this.els.selects[i].setAttribute('disabled', 'true')
      ls.remove(this.keys[i].key)
    }

    // Update the state
    this._updateSelectedOptionAtIndex(selectIndex, newValue)

    // Reset all the 'next' selects
    for (let i = selectIndex + 1; i < selects.length; i++) {
      selects[i].value = ''
      if (this.selectedOptions.length === 0 || this.selectedOptions[i] == null) {
        selects[i].options.length = 1
      }
    }

    // Update the options in the very next select
    const nextSelectIndex = selectIndex + 1
    const nextSelect = selects[nextSelectIndex]
    if (nextSelect && validValue) {
      const tree = this.selectedOptions.reduce((tree, value) => {
        return tree[value]
      }, this.tree)

      if (!tree) {
        // Should never get here...
        const err = `Unable to find the inner tree while updating select value. Value might be incorrect.`
        this.logger.error(err, {
          selectIndex,
          tree,
          nextSelectIndex,
          selectedOptions: this.selectedOptions,
          selectedOptionsNullable: this.selectedOptionsNullable,
        })
        throw new Error(err)
      }

      const options = tree[SYM_KEYS]
      updateSelectOptions(nextSelect, options)
      nextSelect.removeAttribute('disabled')
    }

    // Update root, selects and buttons state
    this._updateState()

    this._updateActionUrl()

    if (this._autoSubmit && this._hydrated) {
      this._updateShowAttr('result')
    }

    this._updateFilteredTitleElements()

    this._dispatchEvent('change', {
      select: select,
      selectIndex,
      finalValue: this.finalValue,
      selectedOptions: this.selectedOptions,
      selectedOptionsNullable: this.selectedOptionsNullable,
    })
  }

  _updateSelectedOptionAtIndex(selectIndex, newValue) {
    // `this.selectedOptionsNullable` = ['2015', 'Ford', null]
    // `this.selectedOptions` = ['2015', 'Ford']

    // `this.finalValue` is the tree value (deepest/actual stored value i.e array in our case)
    // for example: ['2015_Ford_Mustang']
    // or ['2015_Ford_Mustang', '2020+_Honda_Accord']

    if (selectIndex == null) {
      this.selectedOptionsNullable = this.keys.map(k => null)
      this.selectedOptions = []
      this.finalValue = null
      this._allSelected = false

      return
    }

    this.selectedOptionsNullable[selectIndex] = newValue

    // get selected values
    // stop getting values if empty value is found
    // for example: ['2015', 'Ford', null] => ['2015', 'Ford']
    // ['2015', null, null ] => ['2015']
    // or even that: ['2015', null, 'Mustang' ] => ['2015']
    this.selectedOptions = reduce(
      this.selectedOptionsNullable,
      (acc, selectedValue) => {
        if (!isValidOptionValue(selectedValue)) return reduce.BREAK
        acc.push(selectedValue)
        return acc
      },
      [],
    )

    this._allSelected = this.selectedOptions.length === this.els.selects.length
    this.finalValue = this._allSelected
      ? this.selectedOptions.reduce((tree, value, index) => {
          const isLast = index === this.selectedOptions.length - 1

          if (!isLast) {
            // this should never be undefined or null
            // but just in case...
            return tree?.[value] ?? null
          }

          // root is Array<T = string> | null
          const root = tree?.[value]
          if (!root) return null

          if (value != 'ALL' && root) {
            const ALL = tree?.['ALL']
            if (ALL) {
              return Array.from(new Set([...ALL, ...root]))
            }
          }

          return root
        }, this.tree)
      : null
  }

  // updates the root, selects, and buttons state
  _updateState() {
    // Update selects state
    this.els.selects.forEach((select, index) => {
      // update the individul state
      const hasValue = isValidOptionValue(this.selectedOptions[index])
      select.setAttribute('state', hasValue ? 'selected' : 'pending')
    })

    const finalValue = this.finalValue

    // Update root state
    let state = this._allSelected
      ? YMM_Filter.state.SELECTED
      : this.selectedOptions.length > 0
      ? YMM_Filter.state.PARTIAL
      : YMM_Filter.state.NONE

    // If is fitment widget and `allSelected`, then update the state accordingly
    if (this.isFitmentWidget && this._allSelected) {
      const fitsExactly =
        this.fits?.some(fit => {
          if (Array.isArray(finalValue)) return finalValue.includes(fit)
          return fit === finalValue
        }) ?? false
      let fitsParsed = !fitsExactly
        ? this.selectedOptions.reduce((tree, value) => {
            if (!tree) return false
            return tree[value]
          }, this.fitsParsed)
        : false

      // `finalValue` of the tree is always Array<T = string> | null.
      if (Array.isArray(fitsParsed)) fitsParsed = true

      const doesFit = fitsExactly || fitsParsed

      state = doesFit ? YMM_Filter.state.SELECTED_FITS : YMM_Filter.state.SELECTED_UNFITS
    }
    this.setAttribute('state', state)

    // Update buttons state
    const updateButtonDisabledAttr = button => {
      if (this.finalValue) {
        button.removeAttribute('disabled')
      } else {
        button.setAttribute('disabled', 'true')
      }
    }
    this.els.submitButton(updateButtonDisabledAttr)
    this.els.updateShowAttr(updateButtonDisabledAttr)
  }

  _updateActionUrl() {
    this._removeInputFields()
    this.els.form(form => form.removeAttribute('action'))

    if (this.finalValue) {
      if (!Array.isArray(this.finalValue)) {
        throw new Error('Final value must be an array')
      }

      const actionUrl = this._getActionUrl(this.finalValue)

      this.els.form(form => {
        form.setAttribute('action', actionUrl.toString())
        form.setAttribute('data-values', this.finalValue.join(','))

        // auto-submit form
        if (this._autoSubmit && this._hydrated) {
          const prevented = !form.dispatchEvent(
            new Event('submit', { bubbles: true, cancelable: true }),
          )
          if (!prevented) {
            this.els.submitButton(button => {
              const loadingClass = button.getAttribute('loading-class')
              if (loadingClass) {
                button.classList.add(loadingClass)
              }
            })
            form.submit()
          }
        }
      })

      this.els.actionUrl(el => {
        if (el.nodeName === 'A') {
          el.setAttribute('href', actionUrl.toString())
        } else {
          el.textContent = actionUrl.toString()
        }
      })
    } else {
      this.els.actionUrl(el => {
        if (el.nodeName === 'A') {
          el.setAttribute('href', this.rootCollectionHandle)
        } else {
          el.textContent = this.rootCollectionHandle
        }
      })
    }
  }

  _removeInputFields() {
    this.els.form(form => {
      const filterParamName = this.filterJson.param_name
      const existingInputs = Array.from(form.elements).filter(
        el => el.tagName === 'INPUT' && el.name === filterParamName,
      )
      existingInputs.forEach(input => {
        input.remove()
      })
    })
  }

  _getActionUrl(filterValues) {
    const filterParamName = this.filterJson.param_name
    const url = new URL(this.rootCollectionHandle, window.location.origin)

    url.searchParams.delete(filterParamName)
    const valuesList = Array.isArray(filterValues) ? filterValues : [filterValues]

    // remove all the existing values
    this.els.form(form => {
      const inputFields = form.querySelectorAll(`[name="${CSS.escape(filterParamName)}"]`)
      inputFields.forEach(el => {
        el.remove()
      })
    })

    valuesList.forEach(value => {
      url.searchParams.append(filterParamName, value)

      this.els.form(form => {
        // form.appendChild(inputField)

        const inputField = Object.assign(document.createElement('input'), {
          type: 'hidden',
          name: filterParamName,
          value,
        })
        form.appendChild(inputField)
      })
    })

    return url
  }

  _reset() {
    this.keys.map(x => ls.remove(x.key))
    this.selectedOptionsNullable = this.keys.map(k => null)
    this._updateSelect(0, '')
  }

  _setupUpdateShowAttr() {
    this.els.updateShowAttr(updateShowAttr => {
      const attr = updateShowAttr.getAttribute('data-update-show')
      updateShowAttr.addEventListener(
        'click',
        event => {
          this._updateShowAttr(attr)
        },
        { signal: this._ac.signal },
      )
    })
  }

  _setupClearCacheListeners() {
    this.els.clearCache(clearCacheBtn => {
      if (clearCacheBtn.nodeName === 'BUTTON') {
        clearCacheBtn.setAttribute('type', 'button')
      }

      clearCacheBtn.addEventListener(
        'click',
        () => {
          this._reset()
        },
        { signal: this._ac.signal },
      )
    })
  }

  /**
   *
   * @param {'facet' | 'result'} show
   */
  _updateShowAttr(show) {
    const canShowResult = this._allSelected && this.isFitmentWidget

    const validAttr = show === 'facet' || show === 'result'
    if (!validAttr) {
      show = 'facet'
    }

    if (!canShowResult || show == null) show = 'facet'

    this.setAttribute('showing', show)
  }

  _updateFilteredTitleElements() {
    const title = this._allSelected ? this.selectedOptions.join(' ') : ''
    this.els.filteredTitleText(el => {
      el.textContent = title
    })
  }

  get fits() {
    if (!this._fits) {
      this._fits = JSON.parse(this.getAttribute('fits') ?? 'null') ?? []
    }
    return this._fits
  }

  /**
   * @param {string[]} fits - Fitment array ["2017-2018_DODGE_CHARGER","2006_FORD_MUSTANG"]
   */
  set fits(fits = []) {
    this.setAttribute('fits', typeof fits === 'string' ? fits : JSON.stringify(fits))

    this._fits = typeof fits === 'string' ? JSON.parse(fits) : fits
    this.fitsParsed =
      this._fits && Array.isArray(this._fits)
        ? treeify({
            keys: this.keys,
            list: this._fits,
            itemToInfo: this.itemToInfo,
          })
        : null

    // update state
    this._updateState()
    this._updateFilteredTitleElements()
  }

  _dispatchEvent(name, detail = { element: this }) {
    // add `element` prop to details
    if (detail && typeOf(detail) === 'Object') {
      Object.defineProperty(detail, 'element', {
        value: this,
        writable: false,
        enumerable: false,
        configurable: false,
      })
    }

    const customEvent = new CustomEvent(ELEMENT_TAG + name, {
      detail,
      bubbles: true,
      cancelable: false,
    })

    this.dispatchEvent(customEvent)
    document.dispatchEvent(customEvent)
  }
}

YMM_Filter.state = {
  NONE: 'none pending',
  PARTIAL: 'partial pending',
  SELECTED: 'selected',
  SELECTED_FITS: 'selected fits',
  SELECTED_UNFITS: 'selected unfits',
}

/**
 * Converts `2012-2014_DODGE_CHARGER` to
 * `{
 *    info: { year: '2012-24', make: 'Dodge', model: 'Charger' },
 *    value: '2012-2014_DODGE_CHARGER'
 * }`
 * @param {*} keys
 * @param {*} fitment
 * @returns
 */
YMM_Filter.parsefitmentInfoByKeys = (keys, fitment) => {
  const parts = fitment.split(_FD_)
  const info = keys.reduce((acc, k, i) => {
    acc[k.key] = parts[i]
    return acc
  }, Object.create(null))
  return { info, value: fitment }
}

YMM_Filter.tag = ELEMENT_TAG
if (!window.customElements.get(ELEMENT_TAG)) {
  window.customElements.define(ELEMENT_TAG, YMM_Filter)
}

// -----------------------------------------------------------------------------

/**
 *
 * @param {HTMLSelectElement} select
 * @param {string[]} options
 */
function updateSelectOptions(select, options) {
  options.forEach((value, index) => {
    // increment index by 1 to preserve the first option (i.e reset option)
    select.options[index + 1] = new Option(value, value)
  })
}

function isValidOptionValue(value) {
  if (typeof value === 'string' && value !== '') return true
  return false
}
