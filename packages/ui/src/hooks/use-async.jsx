import { useEffect, useState } from 'react'

export default function useAsync (promise, args = [], deps = []) {
  const [state, setState] = useState({
    data: undefined,
    error: undefined,
    pending: true
  })
  const [cnt, setCounter] = useState(0)
  useEffect(() => {
    let mounted = true
    promise(...args)
      .then(data => mounted && setState({ data, pending: false }))
      .catch(error => mounted && setState({ error, pending: false }))
    return () => (mounted = false)
  }, [...deps, cnt])
  return { ...state, reload }

  function reload () {
    setCounter(cnt => cnt + 1)
  }
}
