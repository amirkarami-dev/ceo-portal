// Tiny global "is anything loading" store, used to drive the top progress bar.
// Counts in-flight work (API requests + manual begin/end). No dependencies, SSR-safe.

type Listener = (active: boolean) => void

let count = 0
const listeners = new Set<Listener>()

function emit() {
  const active = count > 0
  for (const l of listeners) l(active)
}

/** Mark a unit of work as started. Pair every call with `endLoading()`. */
export function beginLoading() {
  count += 1
  if (count === 1) emit() // false -> true
}

/** Mark a unit of work as finished. */
export function endLoading() {
  count = Math.max(0, count - 1)
  if (count === 0) emit() // true -> false
}

export function isLoading(): boolean {
  return count > 0
}

/** Subscribe to active/idle changes. Returns an unsubscribe function. */
export function subscribeLoading(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
