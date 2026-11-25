import { createApp } from 'vue'
import App from './App.vue'
import './styles/base.css'
import './styles/typography.css'

// Render the customer's app in its own document, without platform CSS.
window.addEventListener('carbon-ledger-unauthorized', () => {
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'carbon-ledger-unauthorized' }, window.location.origin)
  } else {
    window.location.replace('/login')
  }
})

createApp(App).mount('#app')
