import { useState } from 'react'

const states = {}

// Expose globally for debugging purposes.
window.__sonarState = states

class State {
  constructor () {
    this._state = {}
  }

  get (key) {
    return this._state[key]
  }

  set (key, state) {
    this._state[key] = state
  }

  empty (key) {
    return typeof this._state[key] === 'undefined'
  }
}

export default function makeGlobalStateHook (name) {
  if (!states[name]) states[name] = new State()
  const state = states[name]

  return useGlobalState

  function useGlobalState (key, initialState) {
    if (state.empty(key)) state.set(key, initialState)
    const [_, _setState] = useState(state.get(key))

    return [state.get(key), setState]

    function setState (nextState) {
      state.set(key, nextState)
      _setState(nextState)
    }
  }
}
