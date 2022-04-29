import { useEffect, useState } from 'react'

export type AsyncFn<A extends any[], T> = (...args: A) => Promise<T>

export type AsyncStateInner<T> = {
  data: T | null,
  error?: any,
  pending: boolean
}

export type AsyncState<T> = {
  data: T | null,
  error?: any,
  pending: boolean
  refresh: () => void
}

export default function useAsync<T, A extends any[] = []> (asyncFn: AsyncFn<A, T>, args: A, deps?: any[]): AsyncState<T> {
  if (!deps) deps = args

  const [state, setState] = useState<AsyncStateInner<T>>({
    data: null,
    error: undefined,
    pending: false
  })

  const [counter, setCounter] = useState(0)

  useEffect(() => {
    let mounted = true
    if (!state.pending) updateState({ pending: true })

    const onSuccess = (data: T) =>
      mounted && updateState({ data, pending: false, error: null })
    const onError = (error: any) =>
      mounted && updateState({ error, pending: false, data: null })

    const promise = asyncFn(...args)
    promise.then(onSuccess)
    promise.catch(onError)

    return () => { mounted = false; }
  }, [...deps, counter])

  return { ...state, refresh }

  function refresh () {
    if (state.pending) return
    setCounter(counter => counter + 1)
  }

  function updateState (nextState: Partial<AsyncState<T>>) {
    setState(state => ({ ...state, ...nextState }))
  }
}
