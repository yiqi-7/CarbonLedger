import { createApp } from 'vue'
import App from './App.vue'
import './styles/base.css'
import './styles/typography.css'
import './styles/workspace.css'
import { initLiquidGlass } from '../lib/liquidGlass'
import { CUSTOMER_EVENT_TYPES, CUSTOMER_MESSAGE_TYPES } from './bridge'

// Render the customer's app in its own document, without platform CSS.
initLiquidGlass()
window.addEventListener(CUSTOMER_EVENT_TYPES.unauthorized, () => {
  if (window.parent !== window) {
    window.parent.postMessage({ type: CUSTOMER_MESSAGE_TYPES.unauthorized }, window.location.origin)
  } else {
    window.location.replace('/login')
  }
})

createApp(App).mount('#app')
