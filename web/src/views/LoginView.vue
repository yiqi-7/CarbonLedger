<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Lock, User } from '@element-plus/icons-vue'
import { apiMessage } from '@/api'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const form = reactive({ username: '', password: '' })
const error = ref('')
async function submit() {
  if (auth.loading) return
  error.value = ''
  if (!form.username.trim() || !form.password) {
    error.value = '请输入账号和密码'
    return
  }
  try {
    await auth.login(form.username.trim(), form.password)
    ElMessage.success('登录成功')
    router.push('/projects')
  } catch (e: unknown) {
    error.value = apiMessage(e, '登录失败，请检查账号或密码')
  }
}
</script>

<template>
  <section class="login-page">
    <div class="login-content">
      <header class="login-brand">
        <h1>碳建智算平台</h1>
      </header>
      <div class="login-card">
        <h2>账号登录</h2>
        <p class="login-description">账号审批通过后即可登录</p>
        <el-form label-position="top" class="login-form" @submit.prevent="submit">
          <el-form-item label="账号" for="login-username">
            <el-input id="login-username" v-model="form.username" :prefix-icon="User" autocomplete="username" placeholder="请输入账号" :disabled="auth.loading" required />
          </el-form-item>
          <el-form-item label="密码" for="login-password">
            <el-input id="login-password" v-model="form.password" :prefix-icon="Lock" type="password" show-password autocomplete="current-password" placeholder="请输入密码" :disabled="auth.loading" required />
          </el-form-item>
          <el-alert v-if="error" class="login-error" :title="error" type="error" :closable="false" show-icon />
          <el-button class="login-submit" type="primary" native-type="submit" :loading="auth.loading">{{ auth.loading ? '正在登录' : '登录' }}</el-button>
        </el-form>
        <div class="login-register">还没有账号？<RouterLink to="/register">提交注册申请</RouterLink></div>
      </div>
    </div>
    <footer class="login-footer">建筑工程建造阶段碳排放核算</footer>
  </section>
</template>

<style scoped>
:global(body:has(.login-page)) { min-width: 0; }
.login-page { position: relative; min-height: 100vh; min-height: 100svh; color: var(--platform-ink); background: var(--platform-canvas); font-family: var(--el-font-family); }
.login-content { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 36px; min-height: 100vh; min-height: 100svh; padding: 56px 24px 88px; }
.login-brand h1 { margin: 0; color: #1e4875; font-size: 48px; line-height: 1.25; font-weight: 700; letter-spacing: .02em; text-align: center; }
.login-card { width: 460px; max-width: 100%; padding: 36px 40px 30px; border: 1px solid var(--platform-line); border-radius: 16px; background: #fff; }
.login-card h2 { margin: 0; color: var(--platform-ink); text-align: center; font-size: 24px; font-weight: 600; line-height: 1.5; }
.login-description { margin: 8px 0 30px; color: var(--platform-muted); text-align: center; font-size: 15px; line-height: 1.6; }
.login-form :deep(.el-form-item) { margin-bottom: 24px; }
.login-form :deep(.el-form-item__label) { margin-bottom: 9px; padding: 0; color: #344b65; font-size: 15px; font-weight: 500; line-height: 1.5; }
.login-form :deep(.el-input__wrapper) { min-height: 48px; padding: 1px 14px; border-radius: 8px; }
.login-form :deep(.el-input__inner) { font-size: 15px; }
.login-form :deep(.el-input__prefix-inner) { margin-right: 4px; color: var(--platform-muted); font-size: 18px; }
.login-error { margin: 0 0 20px; }
.login-submit { width: 100%; height: 48px; margin-top: 4px; border-radius: 8px; font-size: 16px; font-weight: 600; }
.login-submit:focus-visible, .login-register a:focus-visible { outline: 2px solid var(--el-color-primary); outline-offset: 4px; }
.login-register { margin-top: 24px; color: var(--platform-muted); text-align: center; font-size: 14px; line-height: 1.8; }
.login-register a { display: inline-flex; align-items: center; min-height: 32px; margin-left: 6px; color: var(--el-color-primary); font-weight: 500; text-decoration: none; }
.login-register a:hover { text-decoration: underline; text-underline-offset: 4px; }
.login-footer { position: absolute; inset: auto 0 0; padding: 0 20px 24px; color: var(--platform-muted); text-align: center; font-size: 13px; line-height: 1.6; }
@media (min-width: 601px) and (max-height: 760px) {
  .login-content { gap: 28px; padding: 32px 24px 68px; }
}
@media (max-width: 600px) {
  .login-brand h1 { font-size: 34px; }
  .login-content { gap: 24px; padding: 40px 20px 76px; }
  .login-card { padding: 30px 24px 26px; }
  .login-card h2 { font-size: 22px; }
}
@media (max-width: 360px) {
  .login-brand h1 { font-size: 30px; }
  .login-content { padding-inline: 14px; }
  .login-card { padding-inline: 20px; }
}
</style>
