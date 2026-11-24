import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { api, type AuthUser } from '@/api'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('carbon-ledger-token'))
  const user = ref<AuthUser | null>(null)
  const loading = ref(false)
  const isAuthenticated = computed(() => Boolean(token.value && user.value))

  async function login(username: string, password: string): Promise<void> {
    loading.value = true
    try {
      const response = await api.post('/auth/login', { username, password })
      token.value = response.data.accessToken
      user.value = response.data.user
      localStorage.setItem('carbon-ledger-token', response.data.accessToken)
    } finally {
      loading.value = false
    }
  }

  async function loadMe(): Promise<void> {
    if (!token.value) return
    try {
      const response = await api.get('/auth/me')
      user.value = response.data
    } catch {
      logout()
    }
  }

  function logout(): void {
    token.value = null
    user.value = null
    localStorage.removeItem('carbon-ledger-token')
  }

  return { token, user, loading, isAuthenticated, login, loadMe, logout }
})
