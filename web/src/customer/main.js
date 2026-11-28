import { createApp } from 'vue'
import App from './App.vue'
import { api } from '@/api'
import { startAuthenticatedCustomerApp } from './authenticatedEntry.js'
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

startAuthenticatedCustomerApp({
  apiClient: api,
  mount: () => createApp(App).mount('#app'),
  storage: window.localStorage,
  location: window.location,
}).catch(() => {
  const root = document.querySelector('#app')
  if (root) root.textContent = '无法验证登录状态，请检查网络后刷新页面。'
})
