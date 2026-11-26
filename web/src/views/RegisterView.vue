<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api, apiMessage } from '@/api'
const form = reactive({ username: '', password: '', remark: '' })
const submitted = ref(false); const error = ref(''); const saving = ref(false)
async function submit() {
  if (saving.value || submitted.value) return
  error.value = ''
  if (form.username.trim().length < 3 || form.username.trim().length > 50 || form.password.length < 6 || form.password.length > 100) {
    error.value = '用户名须为 3–50 个字符，密码须为 6–100 个字符'
    return
  }
  saving.value = true
  try { await api.post('/auth/register', { ...form, username: form.username.trim() }); submitted.value = true; ElMessage.success('申请已提交') }
  catch (e: unknown) { error.value = apiMessage(e, '提交失败，请稍后重试') }
  finally { saving.value = false }
}
</script>
<template>
  <section class="register-page">
    <div class="register-content">
      <header class="register-brand"><h1>碳建智算平台</h1></header>
      <div class="register-form">
        <div v-if="submitted" class="success-state" role="status">
          <h2>注册申请已提交</h2>
          <p>管理员审批通过后，即可使用申请的账号登录。</p>
          <RouterLink to="/login" class="primary-button button-link">返回登录</RouterLink>
        </div>
        <template v-else>
          <h2>申请账号</h2>
          <p class="register-description">填写以下信息，提交给管理员审批。</p>
          <el-form label-position="top" :disabled="saving" @submit.prevent="submit">
            <el-form-item label="用户名" for="register-username" required>
              <el-input id="register-username" v-model="form.username" autocomplete="username" maxlength="50" placeholder="3–50 个字符" required />
            </el-form-item>
            <el-form-item label="密码" for="register-password" required>
              <el-input id="register-password" v-model="form.password" type="password" show-password autocomplete="new-password" maxlength="100" placeholder="6–100 个字符" required />
            </el-form-item>
            <el-form-item label="申请说明（选填）" for="register-remark">
              <el-input id="register-remark" v-model="form.remark" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="可填写所在单位或使用用途" />
            </el-form-item>
            <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
            <el-button class="primary-button full-width" type="primary" native-type="submit" :loading="saving">{{ saving ? '正在提交' : '提交申请' }}</el-button>
          </el-form>
          <div class="auth-foot">已有账号？<RouterLink to="/login">返回登录</RouterLink></div>
        </template>
      </div>
    </div>
  </section>
</template>

<style scoped>
:global(body:has(.register-page)) { min-width: 0; }
.register-page {
  min-width: 0;
  min-height: 100vh;
  min-height: 100svh;
  background-color: #25414A;
  background-image:
    radial-gradient(ellipse 80% 56% at 50% 10%, rgba(228, 239, 235, 0.22), transparent 64%),
    radial-gradient(ellipse 60% 48% at 14% 86%, rgba(85, 123, 121, 0.34), transparent 62%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='480' height='320' viewBox='0 0 480 320'%3E%3Cg fill='none' stroke='%23E4EFEB' stroke-opacity='0.14' stroke-width='1'%3E%3Cpath d='M0 64 Q120 26 240 64 T480 64'/%3E%3Cpath d='M0 128 Q120 90 240 128 T480 128'/%3E%3Cpath d='M0 192 Q120 154 240 192 T480 192'/%3E%3Cpath d='M0 256 Q120 218 240 256 T480 256'/%3E%3Cpath d='M96 0 V320 M240 0 V320 M384 0 V320' stroke-opacity='0.07'/%3E%3C/g%3E%3C/svg%3E"),
    linear-gradient(160deg, #2D4E59 0%, #25414A 52%, #1A3138 100%);
  background-size: 100% 100%, 100% 100%, 480px 320px, 100% 100%;
  color: #FFFFFF;
}
.register-content {
  display: flex;
  min-height: 100vh;
  min-height: 100svh;
  padding: 48px 24px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
}
.register-brand h1 {
  margin: 0;
  color: #FFFFFF;
  font-size: 38px;
  line-height: 1.12;
  font-weight: 500;
  letter-spacing: -0.035em;
  text-align: center;
}
.register-form {
  width: min(460px, 100%);
  min-width: 0;
  padding: 34px 36px;
  background:
    radial-gradient(240px circle at var(--lg-glint-x, 50%) var(--lg-glint-y, 0%), rgba(255, 255, 255, 0.34), transparent 65%),
    rgba(248, 250, 248, 0.88);
  backdrop-filter: blur(22px) saturate(1.28);
  -webkit-backdrop-filter: blur(22px) saturate(1.28);
  border: 1px solid rgba(255, 255, 255, 0.56);
  border-radius: 28px;
  box-shadow: 0 20px 52px rgba(10, 24, 28, 0.34), inset 0 1px 0 rgba(255, 255, 255, 0.84);
  color: var(--platform-ink);
}
:global(html[data-liquid-glass="optical"]) .register-form {
  backdrop-filter: url(#lg-panel-refract) blur(14px) saturate(1.3);
}
.register-form h2 { margin: 0; color: var(--platform-ink); font-size: 22px; font-weight: 600; text-align: center; }
.register-description { margin: 8px 0 28px; color: var(--platform-muted); font-size: 14px; line-height: 1.6; text-align: center; }
.register-form :deep(.el-form-item) { margin-bottom: 22px; }
.register-form :deep(.el-form-item__label) { margin-bottom: 8px; color: var(--platform-ink); font-size: 14px; font-weight: 500; line-height: 1.5; }
.register-form :deep(.el-input__wrapper) { min-height: 48px; padding: 2px 18px; border-radius: 999px; background: rgba(252, 252, 250, 0.94); }
.register-form :deep(.el-textarea__inner) { padding: 12px 16px; border-radius: 18px; line-height: 1.6; background: rgba(252, 252, 250, 0.94); }
.register-form :deep(.el-alert) { margin-bottom: 18px; }
.register-form :deep(.el-button.full-width) { min-height: 48px; border-radius: 999px; font-size: 16px; font-weight: 600; }
.auth-foot { font-size: 14px; }
.auth-foot a { margin-left: 6px; font-weight: 600; text-underline-offset: 4px; }
.success-state p { color: var(--platform-muted); font-size: 15px; line-height: 1.7; margin-top: 16px; }
.success-state .button-link { color: #FFFFFF; }
@media (prefers-reduced-transparency: reduce) {
  .register-form { background: #FCFCFA; backdrop-filter: none; -webkit-backdrop-filter: none; }
}
@media (max-width: 600px) {
  .register-content { padding: 32px 16px; gap: 24px; }
  .register-brand h1 { font-size: 30px; }
  .register-form { padding: 28px 24px; border-radius: 24px; }
}
/* Apple light authentication surface */
.register-page { background: #F5F5F7; background-image: none; color: #1D1D1F; }
.register-content { gap: 48px; padding: 64px 24px 96px; }
.register-brand h1 { color: #1D1D1F; font-size: 40px; font-weight: 600; letter-spacing: -0.025em; }
.register-form { padding: 40px; border: 0; border-radius: 24px; background: #FFFFFF; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.04); backdrop-filter: none; -webkit-backdrop-filter: none; }
.register-form h2 { color: #1D1D1F; font-size: 24px; font-weight: 600; letter-spacing: -0.015em; }
.register-description { color: #86868B; font-size: 17px; line-height: 1.55; }
.register-form :deep(.el-form-item__label) { color: #1D1D1F; font-size: 14px; font-weight: 400; }
.register-form :deep(.el-input__wrapper) { min-height: 48px; border-radius: 12px; background: #F5F5F7; box-shadow: none; }
.register-form :deep(.el-textarea__inner) { border-radius: 12px; background: #F5F5F7; box-shadow: none; }
.register-form :deep(.el-input__wrapper.is-focus), .register-form :deep(.el-textarea__inner:focus) { box-shadow: 0 0 0 2px #0071E3; }
.register-form :deep(.el-button.full-width) { min-height: 48px; border-radius: 999px; font-size: 17px; font-weight: 500; }
.auth-foot { color: #86868B; }
.auth-foot a, .success-state .button-link { color: #0071E3; }
.success-state p { color: #86868B; font-size: 17px; }
@media (max-width: 600px) {
  .register-content { gap: 32px; padding: 48px 20px 80px; }
  .register-brand h1 { font-size: 32px; }
  .register-form { padding: 32px 24px; border-radius: 24px; }
}
</style>
