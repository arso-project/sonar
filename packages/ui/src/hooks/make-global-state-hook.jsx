import { useState, useEffect } from 'react'

const states = {}

// Expose globally for debugging purposes.
window.__sonarState = states

class State {
  constructor () {
    this._state = {}
    this._watchers = {}
  }

  get (key) {
    return this._state[key]
  }

  set (key, state) {
    this._state[key] = state
    if (this._watchers[key]) this._watchers[key].forEach(fn => fn(state))
  }

  empty (key) {
    return typeof this._state[key] === 'undefined'
  }

  watch (key, fn) {
    if (!this._watchers[key]) this._watchers[key] = []
    this._watchers[key].push(fn)
    return () =>
      (this._watchers[key] = this._watchers[key].filter(x => x !== fn))
  }
}

export default function makeGlobalStateHook (name) {
  if (!states[name]) states[name] = new State()
  const state = states[name]

  return useGlobalState

  function useGlobalState (key, initialState) {
    if (state.empty(key)) state.set(key, initialState)
    const [_, _setState] = useState(state.get(key))
    const [i, setI] = useState(0)
    useEffect(() => {
      return state.watch(key, () => setI(i => i + 1))
    }, [key])

    return [state.get(key), setState]

    function setState (nextState) {
      if (typeof nextState === 'function') {
        _setState(oldState => {
          const newState = nextState(oldState)
          state.set(key, newState)
          return newState
        })
      } else {
        state.set(key, nextState)
        _setState(nextState)
      }
    }
  }
}
