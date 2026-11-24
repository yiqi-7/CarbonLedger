import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/projects' },
    { path: '/login', component: () => import('@/views/LoginView.vue'), meta: { public: true } },
    { path: '/register', component: () => import('@/views/RegisterView.vue'), meta: { public: true } },
    { path: '/projects', component: () => import('@/views/ProjectsView.vue') },
    { path: '/projects/:id', component: () => import('@/views/WorkspaceView.vue') },
  ],
})

router.beforeEach(async to => {
  const auth = useAuthStore()
  if (!auth.user && auth.token) await auth.loadMe()
  if (!to.meta.public && !auth.isAuthenticated) return '/login'
  if (to.meta.public && auth.isAuthenticated && to.path === '/login') return '/projects'
})

export default router
