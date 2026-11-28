import { createApp } from 'vue'
import { api } from '@/api'
import { startAuthenticatedCustomerApp } from '@/customer/authenticatedEntry.js'
import DesignLab from './DesignLab.vue'
import './base.css'

startAuthenticatedCustomerApp({
  apiClient: api,
  mount: () => createApp(DesignLab).mount('#app'),
  storage: window.localStorage,
  location: window.location,
}).catch(() => {
  const root = document.querySelector('#app')
  if (root) root.textContent = '无法验证登录状态，请检查网络后刷新页面。'
})
