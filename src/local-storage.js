const createKey = key => `ymm_filter:${key}`
const expiryKey = key => `${key}__ymm:expiresIn`

export function remove(key) {
  const _key = createKey(key)

  window.localStorage.removeItem(_key)
  window.localStorage.removeItem(expiryKey(_key))

  return true
}

export function get(key) {
  const _key = createKey(key)

  let now = Date.now()
  let expiresIn = Number(window.localStorage.getItem(expiryKey(_key)) || now + 1)

  if (expiresIn < now) {
    remove(_key)
    return null
  } else {
    return window.localStorage.getItem(_key)
  }
}

const FIVE_MINS_IN_SEC = 60 * 5
export function set(key, value, expirySeconds = Infinity) {
  if (value == null || value === '') {
    remove(key)
    return
  }

  const _key = createKey(key)

  const expiryMaxMs = Math.abs(expirySeconds) * 1000 //make sure it's positive
  const now = Date.now() //millisecs since epoch time, lets deal only with integer

  const expiry = now + expiryMaxMs
  window.localStorage.setItem(_key, value)
  window.localStorage.setItem(expiryKey(_key), expiry)
  return true
}
