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
.login-page {
  position: relative;
  min-height: 100vh;
  min-height: 100svh;
  color: #FFFFFF;
  background-color: #25414A;
  background-image:
    radial-gradient(ellipse 80% 56% at 50% 10%, rgba(228, 239, 235, 0.22), transparent 64%),
    radial-gradient(ellipse 60% 48% at 14% 86%, rgba(85, 123, 121, 0.34), transparent 62%),
    radial-gradient(ellipse 52% 44% at 88% 82%, rgba(20, 44, 52, 0.56), transparent 66%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='320' viewBox='0 0 480 320'%3E%3Cg fill='none' stroke='%23E4EFEB' stroke-opacity='0.14' stroke-width='1'%3E%3Cpath d='M0 64 Q120 26 240 64 T480 64'/%3E%3Cpath d='M0 128 Q120 90 240 128 T480 128'/%3E%3Cpath d='M0 192 Q120 154 240 192 T480 192'/%3E%3Cpath d='M0 256 Q120 218 240 256 T480 256'/%3E%3Cpath d='M96 0 V320 M240 0 V320 M384 0 V320' stroke-opacity='0.07'/%3E%3C/g%3E%3C/svg%3E"),
    linear-gradient(160deg, #2D4E59 0%, #25414A 52%, #1A3138 100%);
  background-size: 100% 100%, 100% 100%, 100% 100%, 480px 320px, 100% 100%;
  font-family: var(--el-font-family);
}
.login-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 34px;
  min-height: 100vh;
  min-height: 100svh;
  padding: 56px 24px 88px;
}
.login-brand h1 {
  margin: 0;
  color: #FFFFFF;
  font-size: 52px;
  line-height: 1.08;
  font-weight: 500;
  letter-spacing: -0.04em;
  text-align: center;
}
.login-card {
  width: 460px;
  max-width: 100%;
  padding: 36px 38px 30px;
  border: 1px solid rgba(255, 255, 255, 0.56);
  border-radius: 28px;
  background:
    radial-gradient(240px circle at var(--lg-glint-x, 50%) var(--lg-glint-y, 0%), rgba(255, 255, 255, 0.34), transparent 65%),
    rgba(248, 250, 248, 0.86);
  backdrop-filter: blur(22px) saturate(1.28);
  -webkit-backdrop-filter: blur(22px) saturate(1.28);
  box-shadow: 0 20px 52px rgba(10, 24, 28, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.84);
  color: var(--platform-ink);
}
:global(html[data-liquid-glass="optical"]) .login-card {
  backdrop-filter: url(#lg-panel-refract) blur(14px) saturate(1.3);
}
.login-card h2 {
  margin: 0;
  color: var(--platform-ink);
  text-align: center;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: -0.015em;
}
.login-description {
  margin: 8px 0 28px;
  color: var(--platform-muted);
  text-align: center;
  font-size: 14px;
  line-height: 1.6;
}
.login-form :deep(.el-form-item) { margin-bottom: 22px; }
.login-form :deep(.el-form-item__label) {
  margin-bottom: 8px;
  padding: 0;
  color: var(--platform-ink);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
}
.login-form :deep(.el-input__wrapper) {
  min-height: 48px;
  padding: 2px 18px;
  border-radius: 999px;
  background: rgba(252, 252, 250, 0.94);
}
.login-form :deep(.el-input__inner) { font-size: 15px; }
.login-form :deep(.el-input__prefix-inner) { margin-right: 6px; color: var(--color-focus); font-size: 18px; }
.login-error { margin: 0 0 20px; }
.login-submit { width: 100%; height: 48px; margin-top: 6px; border-radius: 999px; font-size: 16px; font-weight: 600; }
.login-submit:focus-visible, .login-register a:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 4px; }
.login-register {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid rgba(37, 65, 74, 0.12);
  color: var(--platform-muted);
  text-align: center;
  font-size: 14px;
  line-height: 1.8;
}
.login-register a {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  margin-left: 6px;
  color: var(--color-glass-scene);
  font-weight: 600;
  text-decoration: none;
}
.login-register a:hover { text-decoration: underline; text-underline-offset: 4px; }
.login-footer {
  position: absolute;
  inset: auto 0 0;
  padding: 0 20px 24px;
  color: rgba(228, 239, 235, 0.82);
  text-align: center;
  font-size: 13px;
  letter-spacing: 0.025em;
  line-height: 1.6;
}
@media (prefers-reduced-transparency: reduce) {
  .login-card { background: #FCFCFA; backdrop-filter: none; -webkit-backdrop-filter: none; }
}
@media (min-width: 601px) and (max-height: 760px) {
  .login-content { gap: 28px; padding: 32px 24px 68px; }
}
@media (max-width: 600px) {
  .login-brand h1 { font-size: 36px; }
  .login-content { gap: 24px; padding: 40px 20px 76px; }
  .login-card { padding: 30px 24px 26px; border-radius: 24px; }
  .login-card h2 { font-size: 22px; }
}
@media (max-width: 360px) {
  .login-brand h1 { font-size: 30px; }
  .login-content { padding-inline: 14px; }
  .login-card { padding-inline: 20px; }
}
</style>
