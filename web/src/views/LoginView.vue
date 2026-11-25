<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Lock, OfficeBuilding, User } from '@element-plus/icons-vue'
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
    <header class="login-brand">
      <span class="login-brand-icon" aria-hidden="true"><OfficeBuilding /></span>
      <h1>碳建智算平台</h1>
    </header>
    <div class="login-content">
      <div class="login-card">
        <h2>账号登录</h2>
        <p class="login-description">使用已审批的账号登录</p>
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
  --login-blue: #88ddef;
  --login-ink: #edf9fc;
  --login-muted: #b5d0da;
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100svh;
  overflow: hidden;
  color: var(--login-ink);
  font-family: var(--el-font-family);
  background:
    radial-gradient(ellipse at 77% 28%, rgb(72 141 151 / 29%), transparent 45%),
    radial-gradient(ellipse at 10% 85%, rgb(29 116 132 / 24%), transparent 55%),
    linear-gradient(145deg, #061924, #0c3441 62%, #081e2c);
}
.login-page::before,
.login-page::after {
  content: '';
  position: absolute;
  bottom: 0;
  pointer-events: none;
}
.login-page::before {
  inset-inline: 0;
  height: 22%;
  opacity: .12;
  background: #94c5ce;
  clip-path: polygon(0 47%, 6% 47%, 6% 24%, 12% 24%, 12% 64%, 18% 64%, 18% 38%, 22% 38%, 22% 70%, 68% 70%, 68% 44%, 75% 44%, 75% 18%, 81% 18%, 81% 60%, 88% 60%, 88% 32%, 94% 32%, 94% 52%, 100% 52%, 100% 100%, 0 100%);
}
.login-page::after {
  width: 100%;
  height: 7%;
  background: linear-gradient(180deg, transparent, #081e2c);
}
.login-brand {
  z-index: 1;
  display: grid;
  grid-template-columns: 44px auto 44px;
  justify-content: center;
  align-items: center;
  gap: 13px;
  padding: 30px 42px;
  color: #fff;
}
.login-brand-icon {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border: 1px solid rgb(224 252 255 / 35%);
  border-radius: 14px;
  background: rgb(255 255 255 / 10%);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}
.login-brand-icon svg { width: 28px; height: 28px; }
.login-brand h1 {
  margin: 0;
  font-size: 28px;
  line-height: 1.4;
  font-weight: 500;
  letter-spacing: .02em;
}
.login-content {
  z-index: 1;
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 30px 24px 66px;
}
.login-card {
  width: 440px;
  max-width: 100%;
  padding: 38px 42px 32px;
  border: 1px solid rgb(239 254 255 / 23%);
  border-radius: 24px;
  background: linear-gradient(145deg, rgb(255 255 255 / 17%), rgb(255 255 255 / 8%));
  box-shadow: 0 14px 42px rgb(0 14 24 / 18%), inset 0 1px 0 rgb(255 255 255 / 10%);
  backdrop-filter: blur(24px) saturate(118%);
  -webkit-backdrop-filter: blur(24px) saturate(118%);
}
.login-card h2 {
  margin: 0;
  color: #effbff;
  text-align: center;
  font-size: 26px;
  font-weight: 500;
  line-height: 1.5;
}
.login-description {
  margin: 9px 0 28px;
  color: var(--login-muted);
  text-align: center;
  font-size: 13px;
  line-height: 1.6;
}
.login-form :deep(.el-form-item) { margin-bottom: 22px; }
.login-form :deep(.el-form-item__label) {
  margin-bottom: 8px;
  padding: 0;
  color: #d7eaf1;
  font-size: 14px;
  line-height: 1.5;
}
.login-form :deep(.el-input__wrapper) {
  min-height: 46px;
  padding: 1px 13px;
  background: rgb(4 23 33 / 28%);
  box-shadow: 0 0 0 1px rgb(235 252 255 / 24%) inset;
  border-radius: 12px;
}
.login-form :deep(.el-input__inner) { color: var(--login-ink); font-size: 15px; }
.login-form :deep(.el-input__inner::placeholder) { color: #a5c3ce; }
.login-form :deep(.el-input__prefix-inner) { color: #abd5e2; font-size: 17px; }
.login-form :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px var(--login-blue) inset;
}
.login-error { margin: 0 0 20px; }
.login-submit {
  --el-color-primary: var(--login-blue);
  --el-color-primary-light-3: #b2effb;
  --el-color-primary-dark-2: #59c8e0;
  width: 100%;
  height: 46px;
  margin-top: 5px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 500;
}
.login-submit:focus-visible,
.login-register a:focus-visible {
  outline: 2px solid #b7edfa;
  outline-offset: 4px;
}
.login-register {
  margin-top: 28px;
  color: #b3ced9;
  text-align: center;
  font-size: 13px;
  line-height: 1.8;
}
.login-register a {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  margin-left: 5px;
  color: #a8e7f5;
  text-decoration: none;
}
.login-register a:hover { text-decoration: underline; }
.login-footer {
  z-index: 1;
  padding: 0 20px 24px;
  color: #9cbfcb;
  text-align: center;
  font-size: 12px;
  line-height: 1.6;
}
@media (max-width: 600px) {
  .login-brand { grid-template-columns: 38px auto 38px; gap: 10px; padding: 24px; }
  .login-brand-icon { width: 38px; height: 38px; }
  .login-brand-icon svg { width: 25px; height: 25px; }
  .login-brand h1 { font-size: 23px; }
  .login-content { padding: 24px 20px 42px; }
  .login-card { padding: 32px 26px 26px; }
  .login-card h2 { font-size: 24px; }
  .login-description { margin-bottom: 25px; }
  .login-register { margin-top: 22px; }
}
@media (max-width: 360px) {
  .login-brand { padding-inline: 20px; }
  .login-content { padding-inline: 14px; }
  .login-card { padding-inline: 22px; }
}
@supports not ((backdrop-filter: blur(20px)) or (-webkit-backdrop-filter: blur(20px))) {
  .login-card { background: #234552; }
}
</style>
