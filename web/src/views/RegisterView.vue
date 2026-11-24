<script setup lang="ts">
import { reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api } from '@/api'
const router = useRouter()
const form = reactive({ username: '', password: '', remark: '' })
const submitted = ref(false); const error = ref('')
async function submit() {
  error.value = ''
  try { await api.post('/auth/register', form); submitted.value = true; ElMessage.success('申请已提交') }
  catch (e: any) { error.value = e.response?.data?.message || '提交失败，请稍后重试' }
}
</script>
<template>
  <section class="auth-layout"><div class="auth-aside"><div class="auth-brand"><span class="brand-mark large">CL</span><strong>CarbonLedger</strong></div><h1>加入项目核算工作流</h1><p>提交申请后，由管理员审批账号访问权限。</p><div class="auth-aside-meta">账号状态 · 待审批</div></div>
    <div class="auth-panel"><div class="auth-form"><div v-if="submitted" class="success-state"><div class="success-icon">✓</div><h2>申请已提交</h2><p class="muted">管理员审批通过后即可登录。请保留你的用户名和密码。</p><RouterLink to="/login" class="primary-button button-link">返回登录</RouterLink></div>
      <template v-else><div class="eyebrow">创建账号</div><h2>注册申请</h2><p class="muted">填写信息后等待管理员审批</p><el-form label-position="top" @submit.prevent="submit"><el-form-item label="用户名"><el-input v-model="form.username" placeholder="3-50 个字符" /></el-form-item><el-form-item label="密码"><el-input v-model="form.password" type="password" show-password placeholder="至少 6 个字符" /></el-form-item><el-form-item label="申请说明"><el-input v-model="form.remark" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="说明你的使用场景（可选）" /></el-form-item><el-alert v-if="error" :title="error" type="error" :closable="false" show-icon /><el-button class="primary-button full-width" type="primary" @click="submit">提交申请</el-button></el-form><div class="auth-foot">已有账号？ <RouterLink to="/login">返回登录</RouterLink></div></template>
    </div></div>
  </section>
</template>
