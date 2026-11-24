// Small infrastructure seams so the booking logic can run in the browser
// today (localStorage + Web Locks) and in tests (memory), and be swapped for
// a real database later without touching the business rules.

export interface KV {
  get(key: string): string | null
  set(key: string, value: string): void
}

export const browserKV: KV = {
  get(key) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value)
    } catch {
      /* storage blocked - state just won't persist */
    }
  },
}

export function memoryKV(): KV {
  const m = new Map<string, string>()
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) }
}

/** Runs `fn` with exclusive access to the named resource. */
export type LockFn = <T>(name: string, fn: () => Promise<T>) => Promise<T>

/** In-process mutex: calls with the same name run strictly one after another. */
export function memoryLock(): LockFn {
  const tails = new Map<string, Promise<unknown>>()
  return (name, fn) => {
    const prev = tails.get(name) ?? Promise.resolve()
    const run = prev.then(fn, fn)
    tails.set(
      name,
      run.catch(() => undefined),
    )
    return run
  }
}

/**
 * Cross-tab mutex using the Web Locks API: two browser tabs (two customers)
 * clicking the same seat at the same moment are serialised, so only one wins.
 */
export function browserLock(): LockFn {
  const fallback = memoryLock()
  return (name, fn) => {
    const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined
    if (locks?.request) return locks.request(name, () => fn()) as Promise<Awaited<ReturnType<typeof fn>>>
    return fallback(name, fn)
  }
}

export const readJSON = <T>(kv: KV, key: string, fallback: T): T => {
  const raw = kv.get(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}
