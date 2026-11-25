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
.register-page { min-width: 0; min-height: 100vh; min-height: 100svh; background: var(--platform-canvas); color: var(--platform-ink); }
.register-content { display: flex; min-height: 100vh; min-height: 100svh; padding: 48px 24px; flex-direction: column; align-items: center; justify-content: center; gap: 28px; }
.register-brand h1 { margin: 0; color: #1e4875; font-size: 32px; line-height: 1.4; font-weight: 700; letter-spacing: .02em; text-align: center; }
.register-form { width: min(460px, 100%); min-width: 0; padding: 32px 36px; background: #fff; border: 1px solid var(--platform-line); border-radius: 16px; }
.register-form h2 { margin: 0; font-size: 24px; font-weight: 600; text-align: center; }
.register-description { margin: 8px 0 30px; color: var(--platform-muted); font-size: 15px; line-height: 1.6; text-align: center; }
.register-form :deep(.el-form-item) { margin-bottom: 24px; }
.register-form :deep(.el-form-item__label) { margin-bottom: 9px; color: #344b65; font-size: 15px; font-weight: 500; line-height: 1.5; }
.register-form :deep(.el-input__wrapper) { min-height: 48px; }
.register-form :deep(.el-textarea__inner) { padding: 12px 14px; line-height: 1.65; }
.register-form :deep(.el-alert) { margin-bottom: 18px; }
.register-form :deep(.el-button.full-width) { min-height: 48px; font-size: 16px; font-weight: 600; }
.auth-foot { font-size: 14px; }
.auth-foot a { margin-left: 6px; }
.success-state p { color: var(--platform-muted); font-size: 15px; line-height: 1.8; margin-top: 16px; }
.success-state .button-link { color: #fff; }
@media (max-width: 600px) {
  .register-content { padding: 32px 16px; gap: 24px; }
  .register-brand h1 { font-size: 28px; }
  .register-form { padding: 28px 24px; }
}
</style>
