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
const CURRENT_URL = new URL(window.location.href);
const DEV = CURRENT_URL.searchParams.has("_debug_");
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
function filterUntil(list, predicate) {
  const listLen = list.length;
  if (listLen === 0) {
    return [];
  }
  return reduce(
    list,
    (acc, x, index) => {
      if (predicate(x, index)) {
        acc.push(x);
        return acc;
      }
      return reduce.BREAK;
    },
    []
  );
}
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
function canUnselect(select) {
  const firstOption = select.options[0];
  if (firstOption) {
    const noValueAttr = !firstOption.hasAttribute("value");
    const value = firstOption.value ?? "";
    return noValueAttr || value === "";
  }
  return false;
}
function updateSelectOptions$1(select, options) {
  const offsetIndex = canUnselect(select) ? 1 : 0;
  select.options.length = offsetIndex;
  options.forEach((value, index) => {
    select.options[index + offsetIndex] = new Option(value, value);
  });
}
function getParsedAttributes(element, attributes) {
  const errors = [];
  const result = (
    /** @type {Record<T, U>} */
    {}
  );
  for (let key in attributes) {
    if (Object.prototype.hasOwnProperty.call(attributes, key)) {
      const { parse, fallback, attr, allowEmpty } = attributes[key];
      let attrKey = attr ?? key;
      let rawValue = element.getAttribute(attrKey);
      if (rawValue === null || rawValue === "") {
        if (allowEmpty) {
          result[key] = rawValue;
          continue;
        }
        if (fallback !== void 0) {
          result[key] = fallback;
          continue;
        }
        errors.push(new Error(`Missing ${attrKey} attribute`));
        continue;
      }
      const parsed = parse(rawValue);
      if (parsed instanceof Error) {
        errors.push(parsed);
        continue;
      }
      if (Number.isNaN(parsed)) {
        errors.push(new Error(`Invalid ${attrKey} attribute (NaN): ${rawValue}`));
        continue;
      }
      result[key] = parsed;
    }
  }
  if (errors.length > 0) {
    const errorMsgsList = "- " + errors.map((err) => err.message).join("\n- ");
    throw new Error(errorMsgsList);
  }
  return result;
}
function fetchJson(url, fetchConfig) {
  return fetch(url, {
    headers: {
      accept: "application/json"
    },
    ...fetchConfig
  }).then((r) => r.json());
}
const htmlParser = new DOMParser();
function fetchHtml(url, fetchConfig) {
  return fetch(url, fetchConfig).then((r) => r.text()).then((htmlText) => htmlParser.parseFromString(htmlText, "text/html"));
}
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
const M = {
  fetchHtml: memoize(fetchHtml, 0),
  fetchJson: memoize(fetchJson)
};
function removeTrailingSlash(url) {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}
function maybeIndex(x) {
  return typeof x === "number" && !Number.isNaN(x) && Number.isInteger(x) && x >= 0;
}
function parseIndexToList(rawSortKeyIndexesString, toList = (list) => list.split(",")) {
  const list = rawSortKeyIndexesString && typeof rawSortKeyIndexesString === "string" ? toList(rawSortKeyIndexesString) : Array.isArray(rawSortKeyIndexesString) ? rawSortKeyIndexesString : null;
  if (!list)
    return void 0;
  for (let i2 = 0; i2 < list.length; i2++) {
    const int = Number(list[i2]);
    if (!maybeIndex(int))
      return void 0;
    list[i2] = int;
  }
  return list;
}
function sortKeyNodes(keyElements, comparatorFn, getElementToSwapFn = (x) => x) {
  if (!comparatorFn)
    comparatorFn = (a, b) => {
      const aPartIndex = Number(a.getAttribute("part-index"));
      const bPartIndex = Number(b.getAttribute("part-index"));
      if (Number.isNaN(aPartIndex) || !Number.isInteger(aPartIndex) || aPartIndex < 0) {
        console.error(`Invalid or missing part index: ${aPartIndex}`, a);
        throw new Error(`Invalid part index: ${aPartIndex}`);
      }
      if (Number.isNaN(bPartIndex) || !Number.isInteger(bPartIndex) || bPartIndex < 0) {
        console.error(`Invalid or missing part index: ${bPartIndex}`, a);
        throw new Error(`Invalid part index: ${bPartIndex}`);
      }
      return aPartIndex - bPartIndex;
    };
  let sorted = false;
  while (!sorted) {
    sorted = true;
    for (let i2 = 0; i2 < keyElements.length - 1; i2++) {
      if (comparatorFn(keyElements[i2], keyElements[i2 + 1]) > 0) {
        const elementA = getElementToSwapFn(keyElements[i2]);
        const elementB = getElementToSwapFn(keyElements[i2 + 1]);
        [keyElements[i2], keyElements[i2 + 1]] = [keyElements[i2 + 1], keyElements[i2]];
        elementA.parentNode.insertBefore(elementB, elementA);
        sorted = false;
      }
    }
  }
}
const SYM_KEYS = Symbol("OBJECT_KEYS");
const isValidValue = (x) => x != null && x !== "";
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
function getAllKeysFromElement(element, keySortOrder) {
  const stash = /* @__PURE__ */ new Map();
  let keyEls = Array.from(element.querySelectorAll("[key]"));
  if (keySortOrder && keySortOrder.length === keyEls.length) {
    sortKeyNodes(
      keyEls,
      (a, b) => {
        const aPartIndex = Number(a.getAttribute("part-index"));
        const bPartIndex = Number(b.getAttribute("part-index"));
        if (Number.isNaN(aPartIndex) || !Number.isInteger(aPartIndex) || aPartIndex < 0) {
          console.error(`Invalid or missing part index: ${aPartIndex}`, a);
          throw new Error(`Invalid part index: ${aPartIndex}`);
        }
        if (Number.isNaN(bPartIndex) || !Number.isInteger(bPartIndex) || bPartIndex < 0) {
          console.error(`Invalid or missing part index: ${bPartIndex}`, a);
          throw new Error(`Invalid part index: ${bPartIndex}`);
        }
        const aIndex = keySortOrder.indexOf(aPartIndex);
        const bIndex = keySortOrder.indexOf(bPartIndex);
        if (aIndex === -1 && bIndex === -1)
          return 0;
        if (aIndex === -1)
          return 1;
        if (bIndex === -1)
          return -1;
        return aIndex - bIndex;
      },
      (el) => el.closest(".YMM_Select-item") || el
    );
    keyEls = Array.from(element.querySelectorAll("[key]"));
  }
  keyEls.forEach((el) => {
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
      const index = Number(el.getAttribute("part-index") || "missing");
      if (Number.isNaN(index) || !Number.isInteger(index) || index < 0) {
        console.error(`Invalid index: ${index}`, el);
        throw new Error(`Invalid index: ${index}`);
      }
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
      stash.set(key, { key, index, sort, ranged, maxRange, step, numeric });
    }
  });
  const list = [...stash.entries()].map(([key, keyParsed]) => keyParsed);
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
class ReactiveFilterTree {
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
    canAutoPreselect = true
  }) {
    this.maxIndex = keys.length - 1;
    this.onOptionsChange = onOptionsChange;
    this.onRoot = onRoot;
    this.logger = logger;
    this.getSelectedValueAtIndex = getSelectedValueAtIndex;
    this.beforeOptionsUpdate = beforeOptionsUpdate;
    this.afterOptionsUpdate = afterOptionsUpdate;
    this.canAutoPreselect = canAutoPreselect;
    this.tree = treeify$1({ keys, list, itemToInfo });
    if (initialValues.length !== keys.length) {
      throw new Error("initialValues must be the same length as keys");
    }
    this._selection = keys.map((x, i2) => {
      const initial = initialValues[i2];
      return isValidValue(initial) ? initial : null;
    });
  }
  get possibleSelection() {
    const init = [];
    const PS = this._selection.reduce((acc, x, i2) => {
      var _a;
      let selected = x;
      const tree = acc.reduce((t, x2) => {
        if (!t)
          return null;
        return t[x2.selected ?? x2.defaultValue ?? ""];
      }, this.tree);
      const options = tree != null ? tree[SYM_KEYS] : [];
      if (!Array.isArray(options)) {
        throw new Error(`"options" is not an array. Shoud never happen..`);
      }
      const invalidSelection = !options.includes(selected);
      const prevUnselected = i2 > 0 && ((_a = acc[i2 - 1]) == null ? void 0 : _a.selected) === null;
      if (invalidSelection || prevUnselected) {
        selected = null;
      }
      const defaultValue = options[0] ?? null;
      const canDisable = !!prevUnselected;
      acc.push({ index: i2, selected, options, defaultValue, canDisable });
      return acc;
    }, init);
    const { defaultRoot, root } = PS.reduce(
      (acc, s) => {
        var _a;
        acc.defaultRoot = ((_a = acc.defaultRoot) == null ? void 0 : _a[s.selected ?? s.defaultValue ?? ""]) ?? null;
        acc.root = (s.selected ? acc.root[s.selected] : null) ?? null;
        return acc;
      },
      {
        defaultRoot: this.tree,
        root: this.tree
      }
    );
    this._possibleSelection = PS;
    return { PS, defaultRoot, root };
  }
  get selectedNullish() {
    return this._selection;
  }
  get selectedStrict() {
    const nonNull = (
      /** @type {(string)[]} */
      filterUntil(this._selection, (x) => x !== null)
    );
    return nonNull;
  }
  /**
   *
   * @param {number} index
   * @param {*} rawValue
   * @returns {void}
   */
  update(index, rawValue) {
    var _a, _b;
    const value = rawValue === "" || rawValue == null ? null : rawValue;
    const validIndex = index >= 0 && index <= this.maxIndex;
    if (!validIndex) {
      (_a = this.logger) == null ? void 0 : _a.error("Invalid index selected", {
        index,
        value,
        maxIndex: this.maxIndex
      });
      return;
    }
    let prevValueAtIndex = this._selection[index];
    this._selection[index] = value;
    const { PS, defaultRoot, root } = this.possibleSelection;
    if (index > 0) {
      const prevSelection = PS[index - 1];
      if (prevSelection.selected === null) {
        if (!this.canAutoPreselect) {
          this.logger.warn("Unable to select. Previous value is not selected yet.", {
            index,
            prevPS: prevSelection,
            PS
          });
          this._selection[index] = prevValueAtIndex;
          return;
        }
        if (this.canAutoPreselect) {
          prevSelection.selected = prevSelection.defaultValue;
        }
      }
    }
    if (root || defaultRoot) {
      this.onRoot({ defaultRoot, root });
    }
    const pathToNextTree = this.selectedStrict.slice(0, index + 1);
    const nextTree = pathToNextTree.reduce((tree, treeKey) => {
      return tree == null ? void 0 : tree[treeKey];
    }, this.tree);
    const nextTreeFound = !!(nextTree == null ? void 0 : nextTree[SYM_KEYS]);
    if (!nextTreeFound) {
      if (root)
        return;
      (_b = this.logger) == null ? void 0 : _b.warn("Invalid value selected", { index, value });
      this._selection[index] = prevValueAtIndex;
      return;
    }
    const nextIndex = index + 1;
    for (let i2 = nextIndex; i2 <= this.maxIndex; i2++) {
      const selection = PS[i2];
      if (selection.index !== i2) {
        throw new Error("Invalid index. Should never happen...");
      }
      this.onOptionsChange(selection);
    }
  }
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
  let expiresIn = Number(window.localStorage.getItem(expiryKey(_key)) || now + 1);
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
const ELEMENT_TAG$1 = "x-ymm-filter";
const treeify = memoize(treeify$1);
class YMM_Filter extends HTMLElement {
  constructor() {
    super();
    this._updateSelect = this._updateSelect.bind(this);
    this._connected = false;
  }
  async connectedCallback() {
    this._connected = true;
    await Promise.resolve();
    if (!this.isConnected)
      return;
    this.hydrate();
  }
  async disconnectedCallback() {
    this._connected = false;
    await Promise.resolve();
    if (this.isConnected)
      return;
    this.dehydrate();
  }
  hydrate({ ymm_sort } = {}) {
    var _a, _b, _c;
    if (!this.isConnected)
      return;
    (_a = this._ac) == null ? void 0 : _a.abort();
    this._ac = new AbortController();
    this._hydrated = false;
    this.logger = createLogger(ELEMENT_TAG$1, this.hasAttribute("debug"));
    this._dispatchEvent("loading");
    this.isFitmentWidget = this.hasAttribute("fits");
    this._autoSubmit = this.getAttribute("auto-submit") === "true";
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
    const keysIndexSortOrder = parseIndexToList(
      ymm_sort ?? this.ymm_sort ?? CURRENT_URL.searchParams.get("ymm-sort") ?? this.getAttribute("ymm-sort")
    );
    this.ymm_sort_resolved = keysIndexSortOrder;
    this.keys = getAllKeysFromElement(this, keysIndexSortOrder);
    if (!this.ymm_sort_resolved) {
      this.ymm_sort_resolved = this.keys.map((x) => x.index);
    }
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
    this._dispatchEvent("loaded", {
      selectedValues: this.selectedOptionsNullable
    });
  }
  dehydrate() {
    var _a;
    this._hydrated = false;
    (_a = this._ac) == null ? void 0 : _a.abort();
    this._ac = null;
  }
  _setupCascadingSelects() {
    var _a;
    const selects = this.els.selects;
    selects.forEach((select, selectIndex) => {
      let firstOption = select.options[0];
      if (select.options.length !== 1 || (firstOption == null ? void 0 : firstOption.value) !== "") {
        select.options.length = 0;
        select.options[0] = new Option(
          !firstOption.value ? firstOption.textContent : this.keys[selectIndex].key,
          ""
        );
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
    (_a = CURRENT_URL.searchParams.get(this.filterJson.param_name)) == null ? void 0 : _a.split(_FD_);
    let cachedFilterValue = get(this.filterJson.param_name);
    if (currentParam && (!cachedFilterValue || currentParam !== cachedFilterValue)) {
      set(this.filterJson.param_name, currentParam);
    }
    const initialSelectedOptions = reduce(
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
      const initialValue = initialSelectedOptions[selectIndex] ?? "";
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
    set(this.filterJson.param_name, this.finalValue || "");
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
              button.disabled = true;
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
    let title = "";
    if (this._allSelected) {
      let selectedOptions = this.selectedOptions;
      const sortOrder = this.ymm_sort_resolved;
      let selectedValuesOrdered = [];
      for (let i2 = 0; i2 < sortOrder.length; i2++) {
        const index = sortOrder[i2];
        selectedValuesOrdered[index] = selectedOptions[i2];
      }
      selectedOptions = selectedValuesOrdered;
      if (selectedOptions.length <= 3) {
        title = selectedOptions.join(" ");
      } else {
        const firstThree = selectedOptions.slice(0, 3).join(" ");
        const rest = selectedOptions.slice(3).join(" - ");
        title = `${firstThree} - ${rest}`;
      }
    }
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
  _dispatchEvent(eventName, detail = { element: this }) {
    if (detail && typeOf(detail) === "Object") {
      Object.defineProperty(detail, "element", {
        value: this,
        writable: false,
        enumerable: false,
        configurable: false
      });
    }
    const customEvent = new CustomEvent(`${ELEMENT_TAG$1}:${eventName}`, {
      detail,
      bubbles: false,
      cancelable: true
    });
    this.dispatchEvent(customEvent);
    const isCancelled = !document.dispatchEvent(customEvent);
    return isCancelled;
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
  const info = keys.reduce((acc, k) => {
    acc[k.key] = parts[k.index];
    return acc;
  }, {});
  return { info, value: fitment };
};
YMM_Filter.tag = ELEMENT_TAG$1;
if (!window.customElements.get(ELEMENT_TAG$1)) {
  window.customElements.define(ELEMENT_TAG$1, YMM_Filter);
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
const ELEMENT_TAG = "x-product-siblings";
const GROUP_TAG_PREFIX = "_GROUP:";
class ProductSiblings extends HTMLElement {
  async connectedCallback() {
    var _a;
    if (!this.isConnected)
      return;
    (_a = this._ac) == null ? void 0 : _a.abort();
    this._ac = new AbortController();
    this._hydrated = false;
    this.logger = createLogger(ELEMENT_TAG, this.hasAttribute("debug"));
    this.attrs = getParsedAttributes(this, {
      group: {
        fallback: void 0,
        parse: (x) => {
          const group = x.startsWith(GROUP_TAG_PREFIX) ? x.slice(GROUP_TAG_PREFIX.length) : x;
          if (!group.length)
            return new Error('Invalid or missing "group"');
          return group;
        }
      },
      pid: {
        fallback: void 0,
        parse: (x) => Number(x)
      },
      rootUrl: {
        attr: "root-url",
        fallback: void 0,
        parse: removeTrailingSlash
      },
      sectionId: {
        attr: "section-id",
        fallback: void 0,
        parse: (x) => x
      }
    });
    this._dispatchEvent("loading");
    await this._setupSiblings();
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
  async _setupSiblings() {
    if (!this.attrs)
      throw new Error('"attrs" has been been parsed yet');
    const siblings = await ProductSiblings.fetchSiblings(this.attrs.group);
    this.siblings = siblings;
    const cont = this.closest(".product");
    const info = cont == null ? void 0 : cont.querySelector("product-info");
    info == null ? void 0 : info.querySelector(".price__container");
    const mediaGallery = cont == null ? void 0 : cont.querySelector("media-gallery");
    mediaGallery == null ? void 0 : mediaGallery.querySelector(".product__media-list");
    info == null ? void 0 : info.querySelector("x-ymm-filter.YMM_Ftmnt");
    this.keys = getAllKeysFromElement(this);
    const selects = Array.from(this.querySelectorAll("select[key]"));
    this.selects = selects;
    if (this.keys.length !== this.selects.length) {
      if (this.logger) {
        throw this.logger.throw(`Expected ${this.keys.length} selects, got ${this.selects.length}`);
      }
    }
    const reactiveTree = new ReactiveFilterTree({
      canAutoPreselect: !this.hasAttribute("no-autoselect"),
      keys: this.keys,
      list: siblings,
      itemToInfo: (x) => {
        return {
          info: x.options,
          value: x.product.handle
        };
      },
      initialValues: this.selects.map((select) => select.value),
      getSelectedValueAtIndex: (index) => {
        var _a;
        return ((_a = this.selects) == null ? void 0 : _a[index].value) ?? null;
      },
      onRoot: ({ root, defaultRoot }) => {
        var _a, _b;
        if (!this.attrs)
          return;
        if (!this._hydrated) {
          (_a = this.logger) == null ? void 0 : _a.debug("onRoot - but not hydrated");
          return;
        }
        const rootItem = root ?? defaultRoot;
        const productHandle = rootItem[0];
        const sib = productHandle ? siblings.find((sib2) => sib2.product.handle === productHandle) ?? null : null;
        this._dispatchEvent("root", { root, defaultRoot, sibling: sib });
        (_b = this.logger) == null ? void 0 : _b.debug("onRoot => ", { root, defaultRoot, handle: productHandle, sib });
      },
      onOptionsChange: (selection) => {
        var _a, _b;
        const prevented = this._dispatchEvent("onOptionsChange", selection);
        if (prevented) {
          (_a = this.logger) == null ? void 0 : _a.debug("onOptionsChange prevented");
          return;
        }
        const { index, options, defaultValue, selected, canDisable } = selection;
        if (this.logger) {
          this.logger.debug("onOptionsChange => ", {
            index,
            options,
            defaultValue,
            selected,
            canDisable
          });
        }
        const select = (_b = this.selects) == null ? void 0 : _b[index];
        if (!select)
          return;
        updateSelectOptions$1(select, options);
        const value = selected ?? defaultValue ?? "";
        select.value = value;
        return value;
      },
      logger: this.logger
    });
    this.reactiveTree = reactiveTree;
    this.selects.forEach((select, index) => {
      select.addEventListener("change", (e) => {
        reactiveTree.update(index, select.value);
      });
    });
    reactiveTree.update(0, this.selects[0].value);
  }
  /**
   * @param {string} eventName
   * @param {object} [detail]
   */
  _dispatchEvent(eventName, detail) {
    if (detail && typeOf(detail) === "Object") {
      Object.defineProperty(detail, "target", {
        value: this,
        writable: false,
        enumerable: false,
        configurable: false
      });
    }
    const customEvent = new CustomEvent(`${ELEMENT_TAG}:${eventName}`, {
      detail,
      bubbles: false,
      cancelable: true
    });
    this.dispatchEvent(customEvent);
    const isCancelled = !document.dispatchEvent(customEvent);
    return isCancelled;
  }
}
function fetchSiblings(group) {
  if (!group) {
    return Promise.reject(
      new Error("Missing `group` argument, which is needed when trying to fetch siblings")
    );
  }
  return fetchJson(`/search?view=siblings&type=product&q=${group}`);
}
ProductSiblings.fetchSiblings = memoize(fetchSiblings);
ProductSiblings.fetchHtml = M.fetchHtml;
ProductSiblings.fetchJson = M.fetchJson;
ProductSiblings.tag = ELEMENT_TAG;
if (!window.customElements.get(ELEMENT_TAG)) {
  window.customElements.define(ELEMENT_TAG, ProductSiblings);
}
//# sourceMappingURL=index.es.js.map
