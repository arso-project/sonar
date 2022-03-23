import { useEffect, useState } from 'react'

export default function useAsync (asyncFn, args = [], deps) {
  if (!deps) deps = args

  const [state, setState] = useState({
    data: undefined,
    error: undefined,
    pending: false
  })

  const [counter, setCounter] = useState(0)

  useEffect(() => {
    let mounted = true
    if (!state.pending) updateState({ pending: true })

    const onSuccess = data =>
      mounted && updateState({ data, pending: false, error: null })
    const onError = error =>
      mounted && updateState({ error, pending: false, data: null })

    const promise = asyncFn(...args)
    promise.then(onSuccess)
    promise.catch(onError)

    return () => (mounted = false)
  }, [...deps, counter])

  return { ...state, refresh }

  function refresh () {
    if (state.pending) return
    setCounter(counter => counter + 1)
  }

  function updateState (nextState) {
    setState(state => ({ ...state, ...nextState }))
  }
}
