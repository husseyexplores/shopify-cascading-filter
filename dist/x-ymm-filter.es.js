const i = /* @__PURE__ */ new WeakMap();
let l = 0;
function o(t) {
  const c = typeof t, s = t && t.constructor, f = s == Date;
  if (Object(t) === t && !f && s != RegExp) {
    let e = i.get(t);
    if (e)
      return e;
    e = ++l + "~", i.set(t, e);
    let n;
    if (s == Array) {
      for (e = "@", n = 0; n < t.length; n++)
        e += o(t[n]) + ",";
      i.set(t, e);
    } else if (s == Object) {
      e = "#";
      const u = Object.keys(t).sort();
      for (; (n = u.pop()) !== void 0; )
        t[n] !== void 0 && (e += n + ":" + o(t[n]) + ",");
      i.set(t, e);
    }
    return e;
  }
  return f ? t.toJSON() : c == "symbol" ? t.toString() : c == "string" ? JSON.stringify(t) : "" + t;
}
const CURRENT_URL = new URLSearchParams(window.location.search);
const DEV = CURRENT_URL.has("_debug_");
const PROD = !DEV;
const env = {
  DEV,
  PROD
};
const typeOf = (x) => Object.prototype.toString.call(x).slice(8, -1);
const isObject = (x) => typeOf(x) === "Object";
function createLogger(id, debug = env.DEV) {
  const LOG_PREFIX = `[${id}] :: `;
  return {
    debug: (...x) => debug ? console.log(...x) : void 0,
    log: (...x) => console.log(LOG_PREFIX, ...x),
    warn: (...x) => console.warn(LOG_PREFIX, ...x),
    info: (...x) => console.info(LOG_PREFIX, ...x),
    error: (...x) => console.error(LOG_PREFIX, ...x),
    throw(msg = "unknown error", meta) {
      const prefixedMsg = `${LOG_PREFIX}${msg}`;
      if (meta) {
        this.error(prefixedMsg, meta);
      }
      return new Error(prefixedMsg);
    }
  };
}
function getNumberRange(input, maxRange = Infinity) {
  if (typeof input === "number")
    return [input, Infinity];
  if (input.endsWith("+")) {
    const start = toNumber(input.slice(0, -1));
    return minMax(start, maxRange ?? Infinity);
  }
  const parts = input.split("-");
  const nums = parts.reduce((acc, x) => {
    if (acc.length < 2) {
      acc.push(toNumber(x));
    }
    return acc;
  }, []);
  if (nums.length === 1) {
    nums.push(Infinity);
  }
  return minMax(...nums);
}
function toNumber(input, { to = "number", fallback, canThrow = true } = {}) {
  if (to == null)
    return fallback;
  const parsed = numberParser(input, to);
  if (Number.isNaN(parsed)) {
    if (canThrow && fallback === void 0) {
      throw new Error(`Unable to parse "${input}" into "${to}". `);
    }
    return fallback;
  }
  return parsed;
}
function numberParser(x, to) {
  if (to === "number")
    return Number(x);
  if (to === "integer")
    return parseInt(x, 10);
  if (to === "float")
    return parseFloat(x);
  throw new Error(`to: "${to}" is not supported.`);
}
function minMax(x, y) {
  return x < y ? [x, y] : [y, x];
}
function reduce(list, reducer, init) {
  const listLen = list.length;
  if (listLen === 0) {
    return init;
  }
  for (let i2 = 0; i2 < listLen; i2++) {
    const result = reducer(init, list[i2], i2, list);
    if (result === reduce.BREAK) {
      return init;
    }
    if (result === reduce.CONTINUE) {
      continue;
    }
    init = result;
  }
  return init;
}
reduce.BREAK = Symbol("BREAK");
reduce.CONTINUE = Symbol("CONTINUE");
function $q(ctx, selector, callback) {
  const elements = Array.from(ctx.querySelectorAll(selector));
  if (typeof callback === "function") {
    elements.forEach((element, index, ctx2) => callback(element, index, ctx2));
    return;
  }
  return (callback2) => {
    elements.forEach((element, index, ctx2) => callback2(element, index, ctx2));
  };
}
$q.first = function first(ctx, selector, callback) {
  const el = ctx.querySelector(selector);
  if (typeof callback === "function") {
    if (el)
      callback(el);
    return;
  }
  return (callback2) => {
    if (el)
      callback2(el);
  };
};
new DOMParser();
function memoize(fn, memoizedArgsIndices) {
  const CACHE = /* @__PURE__ */ new Map();
  return (...args) => {
    const key = o(
      typeof memoizedArgsIndices === "number" ? args.slice(0, memoizedArgsIndices + 1) : args
    );
    if (CACHE.has(key)) {
      return CACHE.get(key);
    }
    const result = fn(...args);
    if (result instanceof Promise) {
      result.catch((e) => {
        CACHE.delete(key);
        throw e;
      });
    }
    CACHE.set(key, result);
    return result;
  };
}
function removeTrailingSlash(url) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
const SYM_KEYS = Symbol("OBJECT_KEYS");
function iterateOverTree(obj, fn, level = 0) {
  if (isObject(obj)) {
    let allKeys = Object.keys(obj);
    allKeys.forEach((k) => {
      let v = obj[k];
      iterateOverTree(v, fn, level + 1);
    });
    fn(obj, allKeys, level);
  }
  if (Array.isArray(obj)) {
    obj.forEach((o2) => {
      iterateOverTree(o2, fn, level);
    });
  }
  return obj;
}
function createFiltersTree({ data, keys = [], path = [], setValue, getValue }) {
  const useIndex = data.length > 0 && Array.isArray(data[0]);
  let res = {};
  keys.forEach(({ key: k }, keyIndex) => {
    let isLastKeyIndex = keyIndex === keys.length - 1;
    data.forEach((originalItem) => {
      if (!originalItem)
        return;
      const item = getValue ? getValue(originalItem) : originalItem;
      let obj = path.reduce((x, k2) => x[k2], item);
      if (!obj)
        return;
      let value = useIndex ? obj[keyIndex] : obj[k];
      const valueType = typeof value;
      if (valueType === "number" || valueType === "boolean")
        value = value.toString();
      if (typeof value !== "string" || value === "")
        return;
      let resInnerObj = keys.slice(0, keyIndex).reduce((x, { key: k2 }, i2) => {
        const value2 = useIndex ? obj[i2] : obj[k2];
        return x[value2];
      }, res);
      if (!resInnerObj)
        return;
      resInnerObj[value] = isLastKeyIndex ? null : {};
      if (isLastKeyIndex) {
        const values = keys.reduce(
          (acc, { key: k2 }, i2) => {
            const value2 = useIndex ? obj[i2] : obj[k2];
            acc.push(value2);
            return acc;
          },
          /** @type {any[]} */
          []
        );
        resInnerObj[value] = setValue(values, originalItem);
      }
    });
  });
  const tree = Object.keys(res).length > 0 ? iterateOverTree(res, (obj, objKeys, levelIndex) => {
    var _a;
    const desc = ((_a = keys[levelIndex]) == null ? void 0 : _a.sort) === "desc";
    if (!obj[SYM_KEYS]) {
      Object.defineProperty(obj, SYM_KEYS, {
        value: objKeys.sort((a, b) => desc ? b.localeCompare(a) : a.localeCompare(b)),
        configurable: false,
        writable: false,
        enumerable: false
      });
    }
  }) : res;
  return tree;
}
function treeify$1({ keys, list, itemToInfo }) {
  const expandedList = expandList({ keys, list, itemToInfo });
  return createFiltersTree({
    data: expandedList,
    keys,
    getValue: (x) => x.info,
    setValue: (values, item) => {
      return item.allValues;
    }
  });
}
function getAllKeysFromElement(element) {
  const stash = /* @__PURE__ */ new Map();
  element.querySelectorAll("[key]").forEach((el) => {
    var _a, _b, _c, _d;
    const key = (_a = el.getAttribute("key")) == null ? void 0 : _a.trim();
    if (key && !stash.has(key)) {
      let sort = (
        /** @type {KeyParsed["sort"]} */
        (_b = el.getAttribute("sort")) == null ? void 0 : _b.trim()
      );
      if (sort !== "desc")
        sort = "asc";
      let ranged = (
        /** @type {KeyParsed["ranged"]} */
        el.hasAttribute("ranged")
      );
      const maxRange = toNumber((_c = el.getAttribute("max-range")) == null ? void 0 : _c.trim(), {
        to: "float",
        canThrow: false,
        fallback: -1
      }) ?? null;
      const step = toNumber((_d = el.getAttribute("step")) == null ? void 0 : _d.trim(), {
        to: "float",
        canThrow: false,
        fallback: 1
      }) ?? 1;
      const numeric = el.hasAttribute("numeric");
      stash.set(key, { key, sort, ranged, maxRange, step, numeric });
    }
  });
  const list = [...stash.entries()].map(([key, elKey]) => elKey);
  return list;
}
function expandList({ keys, list, itemToInfo }) {
  const queue = [...list];
  const expanded = [];
  const dups = /* @__PURE__ */ new Map();
  while (queue.length > 0) {
    const rawItem = queue.pop();
    if (!rawItem)
      continue;
    const item = itemToInfo(rawItem);
    if (!item)
      continue;
    let foundRanged = false;
    let rangeStart = 0;
    let rangeEnd = Infinity;
    for (const key of keys) {
      let value = item.info[key.key];
      if (key.ranged) {
        const max = key.maxRange ?? Infinity;
        [rangeStart, rangeEnd = Infinity] = getNumberRange(value, max);
        if (foundRanged === false) {
          foundRanged = rangeEnd !== Infinity;
        }
        const isRanged = rangeEnd !== Infinity;
        if (isRanged) {
          for (let start = rangeStart; start <= rangeEnd; start += key.step) {
            const transformedItem = {
              info: { ...item.info, [key.key]: start },
              value: item.value,
              hash: ""
            };
            const itemHash = keys.reduce((acc, { key: key2 }, i2) => {
              return acc + `_${transformedItem.info[key2]}_${i2}`;
            }, "");
            transformedItem.hash = itemHash;
            expanded.push(transformedItem);
            if (!dups.get(itemHash)) {
              dups.set(itemHash, /* @__PURE__ */ new Set());
            }
            dups.get(itemHash).add(item.value);
          }
        }
      }
    }
    if (!foundRanged) {
      const transformedItem = { info: item.info, value: item.value, hash: "" };
      const itemHash = keys.reduce((acc, { key }, i2) => {
        return acc + `_${transformedItem.info[key]}_${i2}`;
      }, "");
      transformedItem.hash = itemHash;
      keys.forEach((k) => {
        if (k.numeric) {
          transformedItem.info[k.key] = toNumber(transformedItem.info[k.key]);
        }
      });
      if (!dups.get(itemHash)) {
        dups.set(itemHash, /* @__PURE__ */ new Set());
      }
      dups.get(itemHash).add(item.value);
      expanded.push(transformedItem);
    }
  }
  return expanded.map((x) => {
    return { ...x, allValues: Array.from(dups.get(x.hash)) };
  });
}
const createKey = (key) => `ymm_filter:${key}`;
const expiryKey = (key) => `${key}__ymm:expiresIn`;
function remove(key) {
  const _key = createKey(key);
  window.localStorage.removeItem(_key);
  window.localStorage.removeItem(expiryKey(_key));
  return true;
}
function get(key) {
  const _key = createKey(key);
  let now = Date.now();
  let expiresIn = Number(window.localStorage.getItem(expiryKey(_key)) || "0");
  if (expiresIn < now) {
    remove(_key);
    return null;
  } else {
    return window.localStorage.getItem(_key);
  }
}
function set(key, value, expirySeconds = Infinity) {
  if (value == null || value === "") {
    remove(key);
    return;
  }
  const _key = createKey(key);
  const expiryMaxMs = Math.abs(expirySeconds) * 1e3;
  const now = Date.now();
  const expiry = now + expiryMaxMs;
  window.localStorage.setItem(_key, value);
  window.localStorage.setItem(expiryKey(_key), expiry);
  return true;
}
const _FD_ = "_";
const ELEMENT_TAG = "x-ymm-filter";
const treeify = memoize(treeify$1);
class YMM_Filter extends HTMLElement {
  constructor() {
    super();
    this._updateSelect = this._updateSelect.bind(this);
  }
  connectedCallback() {
    var _a, _b, _c;
    if (!this.isConnected)
      return;
    (_a = this._ac) == null ? void 0 : _a.abort();
    this._ac = new AbortController();
    this._hydrated = false;
    this.logger = createLogger(ELEMENT_TAG, this.hasAttribute("debug"));
    this._dispatchEvent("loading");
    this.isFitmentWidget = this.hasAttribute("fits");
    this._autoSubmit = this.hasAttribute("auto-submit");
    this.rootUrl = this.getAttribute("root-url");
    if (!this.rootUrl) {
      const err = `"root-url" attribute is required`;
      this.logger.error(err);
      throw new Error(err);
    }
    this.rootUrl = removeTrailingSlash(this.rootUrl);
    this.collectionHandle = this.getAttribute("collection-handle") ?? get("collectionHandle") ?? "all";
    set("collectionHandle", this.collectionHandle);
    this.rootCollectionHandle = `${this.rootUrl}/collections/${this.collectionHandle}`;
    this.keys = getAllKeysFromElement(this);
    this.itemToInfo = YMM_Filter.parsefitmentInfoByKeys.bind(null, this.keys);
    if (this.keys.length < 2) {
      const err = `There should be at least 2 keys`;
      this.logger.error(err);
      throw new Error(err);
    }
    this.setAttribute("state", YMM_Filter.state.NONE);
    this.filterJson = JSON.parse(
      ((_b = this.querySelector('script[type="application/json"][data-filter-json]')) == null ? void 0 : _b.textContent) ?? "null"
    );
    const filterJsonValues = ((_c = this.filterJson) == null ? void 0 : _c.values.map((x) => x.value)) ?? [];
    this.tree = this.filterJson ? treeify({
      itemToInfo: this.itemToInfo,
      keys: this.keys,
      list: filterJsonValues
    }) : null;
    this.fitsParsed = this.fits ? treeify({
      keys: this.keys,
      list: this.fits,
      itemToInfo: this.itemToInfo
    }) : null;
    this.els = {
      selects: Array.from(this.querySelectorAll("select")),
      form: $q.first(this, "form"),
      submitButton: $q(this, 'button[type="submit"]'),
      actionUrl: $q(this, "[data-action-url]"),
      clearCache: $q(this, "[data-clear-cache]"),
      filteredTitleText: $q(this, "[data-filtered-title]"),
      updateShowAttr: $q(this, "[data-update-show]")
    };
    this.els.submitButton((button) => {
      button.setAttribute("disabled", "true");
    });
    this.els.updateShowAttr((button) => {
      button.setAttribute("disabled", "true");
    });
    this.els.selects.forEach((select, i2) => {
      const disabled = i2 > 0;
      if (disabled) {
        select.setAttribute("disabled", "true");
      } else {
        select.removeAttribute("disabled");
      }
    });
    this._updateSelectedOptionAtIndex(null);
    this._updateShowAttr("facet");
    this._setupCascadingSelects();
    this._setupClearCacheListeners();
    this._setupUpdateShowAttr();
    this._hydrated = true;
    this.removeAttribute("dehydrated");
    this._dispatchEvent("loaded");
  }
  disconnectedCallback() {
    var _a;
    this._hydrated = false;
    (_a = this._ac) == null ? void 0 : _a.abort();
    this._ac = null;
  }
  _setupCascadingSelects() {
    const selects = this.els.selects;
    selects.forEach((select, selectIndex) => {
      let firstOption = select.options[0];
      if (select.options.length !== 1 || (firstOption == null ? void 0 : firstOption.value) !== "") {
        select.options.length = 0;
        select.options[0] = new Option(this.keys[selectIndex].key, "");
      }
      if (selectIndex === 0) {
        const firstSelectOptionValues = this.tree[SYM_KEYS];
        updateSelectOptions(select, firstSelectOptionValues);
      }
      select.value = "";
      select._on_ymm_change = this._updateSelect;
      select.addEventListener(
        "change",
        (e) => {
          const value = e.currentTarget.value;
          this._updateSelect(selectIndex, value);
        },
        { signal: this._ac.signal }
      );
    });
    const initalSelectedOptions = reduce(
      this.keys,
      (acc, { key }) => {
        const cachedValue = get(key);
        if (!cachedValue)
          return reduce.BREAK;
        acc.push(cachedValue);
        return acc;
      },
      []
    );
    selects.forEach((select, selectIndex) => {
      const initialValue = initalSelectedOptions[selectIndex] ?? "";
      if (isValidOptionValue(initialValue)) {
        select.value = initialValue;
        select._on_ymm_change(selectIndex, initialValue);
      }
    });
    this._updateShowAttr("result");
  }
  _updateSelect(selectIndex, newValue) {
    let validValue = isValidOptionValue(newValue);
    newValue = newValue ?? "";
    const selects = this.els.selects;
    const select = selects[selectIndex];
    select.value = newValue;
    if (select.value === "") {
      validValue = false;
      select.value = "";
      for (let i2 = selectIndex; i2 < selects.length; i2++) {
        remove(this.keys[i2].key);
      }
    }
    if (validValue || selectIndex === 0) {
      select.removeAttribute("disabled");
    }
    set(this.keys[selectIndex].key, newValue);
    for (let i2 = selectIndex + 1; i2 < selects.length; i2++) {
      this.selectedOptionsNullable[i2] = null;
      this.els.selects[i2].setAttribute("disabled", "true");
      remove(this.keys[i2].key);
    }
    this._updateSelectedOptionAtIndex(selectIndex, newValue);
    for (let i2 = selectIndex + 1; i2 < selects.length; i2++) {
      selects[i2].value = "";
      if (this.selectedOptions.length === 0 || this.selectedOptions[i2] == null) {
        selects[i2].options.length = 1;
      }
    }
    const nextSelectIndex = selectIndex + 1;
    const nextSelect = selects[nextSelectIndex];
    if (nextSelect && validValue) {
      const tree = this.selectedOptions.reduce((tree2, value) => {
        return tree2[value];
      }, this.tree);
      if (!tree) {
        const err = `Unable to find the inner tree while updating select value. Value might be incorrect.`;
        this.logger.error(err, {
          selectIndex,
          tree,
          nextSelectIndex,
          selectedOptions: this.selectedOptions,
          selectedOptionsNullable: this.selectedOptionsNullable
        });
        throw new Error(err);
      }
      const options = tree[SYM_KEYS];
      updateSelectOptions(nextSelect, options);
      nextSelect.removeAttribute("disabled");
    }
    this._updateState();
    this._updateActionUrl();
    if (this._autoSubmit && this._hydrated) {
      this._updateShowAttr("result");
    }
    this._updateFilteredTitleElements();
    this._dispatchEvent("change", {
      select,
      selectIndex,
      finalValue: this.finalValue,
      selectedOptions: this.selectedOptions,
      selectedOptionsNullable: this.selectedOptionsNullable
    });
  }
  _updateSelectedOptionAtIndex(selectIndex, newValue) {
    if (selectIndex == null) {
      this.selectedOptionsNullable = this.keys.map((k) => null);
      this.selectedOptions = [];
      this.finalValue = null;
      this._allSelected = false;
      return;
    }
    this.selectedOptionsNullable[selectIndex] = newValue;
    this.selectedOptions = reduce(
      this.selectedOptionsNullable,
      (acc, selectedValue) => {
        if (!isValidOptionValue(selectedValue))
          return reduce.BREAK;
        acc.push(selectedValue);
        return acc;
      },
      []
    );
    this._allSelected = this.selectedOptions.length === this.els.selects.length;
    this.finalValue = this._allSelected ? this.selectedOptions.reduce((tree, value, index) => {
      const isLast = index === this.selectedOptions.length - 1;
      if (!isLast) {
        return (tree == null ? void 0 : tree[value]) ?? null;
      }
      const root = tree == null ? void 0 : tree[value];
      if (!root)
        return null;
      if (value != "ALL" && root) {
        const ALL = tree == null ? void 0 : tree["ALL"];
        if (ALL) {
          return Array.from(/* @__PURE__ */ new Set([...ALL, ...root]));
        }
      }
      return root;
    }, this.tree) : null;
  }
  // updates the root, selects, and buttons state
  _updateState() {
    var _a;
    this.els.selects.forEach((select, index) => {
      const hasValue = isValidOptionValue(this.selectedOptions[index]);
      select.setAttribute("state", hasValue ? "selected" : "pending");
    });
    const finalValue = this.finalValue;
    let state = this._allSelected ? YMM_Filter.state.SELECTED : this.selectedOptions.length > 0 ? YMM_Filter.state.PARTIAL : YMM_Filter.state.NONE;
    if (this.isFitmentWidget && this._allSelected) {
      const fitsExactly = ((_a = this.fits) == null ? void 0 : _a.some((fit) => {
        if (Array.isArray(finalValue))
          return finalValue.includes(fit);
        return fit === finalValue;
      })) ?? false;
      let fitsParsed = !fitsExactly ? this.selectedOptions.reduce((tree, value) => {
        if (!tree)
          return false;
        return tree[value];
      }, this.fitsParsed) : false;
      if (Array.isArray(fitsParsed))
        fitsParsed = true;
      const doesFit = fitsExactly || fitsParsed;
      state = doesFit ? YMM_Filter.state.SELECTED_FITS : YMM_Filter.state.SELECTED_UNFITS;
    }
    this.setAttribute("state", state);
    const updateButtonDisabledAttr = (button) => {
      if (this.finalValue) {
        button.removeAttribute("disabled");
      } else {
        button.setAttribute("disabled", "true");
      }
    };
    this.els.submitButton(updateButtonDisabledAttr);
    this.els.updateShowAttr(updateButtonDisabledAttr);
  }
  _updateActionUrl() {
    this._removeInputFields();
    this.els.form((form) => form.removeAttribute("action"));
    if (this.finalValue) {
      if (!Array.isArray(this.finalValue)) {
        throw new Error("Final value must be an array");
      }
      const actionUrl = this._getActionUrl(this.finalValue);
      this.els.form((form) => {
        form.setAttribute("action", actionUrl.toString());
        form.setAttribute("data-values", this.finalValue.join(","));
        if (this._autoSubmit && this._hydrated) {
          const prevented = !form.dispatchEvent(
            new Event("submit", { bubbles: true, cancelable: true })
          );
          if (!prevented) {
            this.els.submitButton((button) => {
              const loadingClass = button.getAttribute("loading-class");
              if (loadingClass) {
                button.classList.add(loadingClass);
              }
            });
            form.submit();
          }
        }
      });
      this.els.actionUrl((el) => {
        if (el.nodeName === "A") {
          el.setAttribute("href", actionUrl.toString());
        } else {
          el.textContent = actionUrl.toString();
        }
      });
    } else {
      this.els.actionUrl((el) => {
        if (el.nodeName === "A") {
          el.setAttribute("href", this.rootCollectionHandle);
        } else {
          el.textContent = this.rootCollectionHandle;
        }
      });
    }
  }
  _removeInputFields() {
    this.els.form((form) => {
      const filterParamName = this.filterJson.param_name;
      const existingInputs = Array.from(form.elements).filter(
        (el) => el.tagName === "INPUT" && el.name === filterParamName
      );
      existingInputs.forEach((input) => {
        input.remove();
      });
    });
  }
  _getActionUrl(filterValues) {
    const filterParamName = this.filterJson.param_name;
    const url = new URL(this.rootCollectionHandle, window.location.origin);
    url.searchParams.delete(filterParamName);
    const valuesList = Array.isArray(filterValues) ? filterValues : [filterValues];
    this.els.form((form) => {
      const inputFields = form.querySelectorAll(`[name="${CSS.escape(filterParamName)}"]`);
      inputFields.forEach((el) => {
        el.remove();
      });
    });
    valuesList.forEach((value) => {
      url.searchParams.append(filterParamName, value);
      this.els.form((form) => {
        const inputField = Object.assign(document.createElement("input"), {
          type: "hidden",
          name: filterParamName,
          value
        });
        form.appendChild(inputField);
      });
    });
    return url;
  }
  _reset() {
    this.keys.map((x) => remove(x.key));
    this.selectedOptionsNullable = this.keys.map((k) => null);
    this._updateSelect(0, "");
  }
  _setupUpdateShowAttr() {
    this.els.updateShowAttr((updateShowAttr) => {
      const attr = updateShowAttr.getAttribute("data-update-show");
      updateShowAttr.addEventListener(
        "click",
        (event) => {
          this._updateShowAttr(attr);
        },
        { signal: this._ac.signal }
      );
    });
  }
  _setupClearCacheListeners() {
    this.els.clearCache((clearCacheBtn) => {
      if (clearCacheBtn.nodeName === "BUTTON") {
        clearCacheBtn.setAttribute("type", "button");
      }
      clearCacheBtn.addEventListener(
        "click",
        () => {
          this._reset();
        },
        { signal: this._ac.signal }
      );
    });
  }
  /**
   *
   * @param {'facet' | 'result'} show
   */
  _updateShowAttr(show) {
    const canShowResult = this._allSelected && this.isFitmentWidget;
    const validAttr = show === "facet" || show === "result";
    if (!validAttr) {
      show = "facet";
    }
    if (!canShowResult || show == null)
      show = "facet";
    this.setAttribute("showing", show);
  }
  _updateFilteredTitleElements() {
    const title = this._allSelected ? this.selectedOptions.join(" ") : "";
    this.els.filteredTitleText((el) => {
      el.textContent = title;
    });
  }
  get fits() {
    if (!this._fits) {
      this._fits = JSON.parse(this.getAttribute("fits") ?? "null") ?? [];
    }
    return this._fits;
  }
  /**
   * @param {string[]} fits - Fitment array ["2017-2018_DODGE_CHARGER","2006_FORD_MUSTANG"]
   */
  set fits(fits = []) {
    this.setAttribute("fits", typeof fits === "string" ? fits : JSON.stringify(fits));
    this._fits = typeof fits === "string" ? JSON.parse(fits) : fits;
    this.fitsParsed = this._fits && Array.isArray(this._fits) ? treeify({
      keys: this.keys,
      list: this._fits,
      itemToInfo: this.itemToInfo
    }) : null;
    this._updateState();
    this._updateFilteredTitleElements();
  }
  _dispatchEvent(name, detail = { element: this }) {
    if (detail && typeOf(detail) === "Object") {
      Object.defineProperty(detail, "element", {
        value: this,
        writable: false,
        enumerable: false,
        configurable: false
      });
    }
    const customEvent = new CustomEvent(ELEMENT_TAG + name, {
      detail,
      bubbles: true,
      cancelable: false
    });
    this.dispatchEvent(customEvent);
    document.dispatchEvent(customEvent);
  }
}
YMM_Filter.state = {
  NONE: "none pending",
  PARTIAL: "partial pending",
  SELECTED: "selected",
  SELECTED_FITS: "selected fits",
  SELECTED_UNFITS: "selected unfits"
};
YMM_Filter.parsefitmentInfoByKeys = (keys, fitment) => {
  const parts = fitment.split(_FD_);
  const info = keys.reduce((acc, k, i2) => {
    acc[k.key] = parts[i2];
    return acc;
  }, /* @__PURE__ */ Object.create(null));
  return { info, value: fitment };
};
YMM_Filter.tag = ELEMENT_TAG;
if (!window.customElements.get(ELEMENT_TAG)) {
  window.customElements.define(ELEMENT_TAG, YMM_Filter);
}
function updateSelectOptions(select, options) {
  options.forEach((value, index) => {
    select.options[index + 1] = new Option(value, value);
  });
}
function isValidOptionValue(value) {
  if (typeof value === "string" && value !== "")
    return true;
  return false;
}
export {
  YMM_Filter
};
//# sourceMappingURL=x-ymm-filter.es.js.map
