import { useEffect, useState } from 'react'

export default function useAsync (asyncFn, args = [], deps) {
  if (!deps) deps = args
  // console.log('useAsync', { asyncFn, args, deps })
  // deps = deps.map(dep => {
  //   if (typeof dep === 'object') return JSON.stringify(dep)
  //   return dep
  // })

  const [state, setState] = useState({
    data: undefined,
    error: undefined,
    pending: true
  })

  const [counter, setCounter] = useState(0)

  useEffect(() => {
    let mounted = true
    if (!state.pending) updateState({ pending: true })

    const onSuccess = data => mounted && updateState({ data, pending: false })
    const onError = error => mounted && updateState({ error, pending: false })

    const promise = asyncFn(...args)
    promise.then(onSuccess)
    promise.catch(onError)

    // asyncFn(...args)
    //   .then(data => mounted && updateState({ data, pending: false }))
    //   .catch(error => mounted && updateState({ error, pending: false }))
    return () => (mounted = false)
  }, [...deps, counter])

  return { ...state, refresh }

  function refresh () {
    setCounter(counter => counter + 1)
  }

  function updateState (nextState) {
    setState(state => ({ ...state, ...nextState }))
  }
}
