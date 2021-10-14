import React from 'react'
import ReactDOM from 'react-dom'

import App from './App'

let el

window.__sonarRerender = () => {
  if (el) el.parentNode.removeChild(el)
  el = document.createElement('div')
  document.body.appendChild(el)
  ReactDOM.render(<App />, el)
}
window.__sonarRerender()
