<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { ElMessage } from 'element-plus'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()
const form = reactive({ username: '', password: '' })
const error = ref('')
async function submit() {
  error.value = ''
  try {
    await auth.login(form.username.trim(), form.password)
    ElMessage.success('登录成功')
    router.push('/projects')
  } catch (e: any) {
    error.value = e.response?.data?.message || '登录失败，请检查账号或密码'
  }
}
</script>

<template>
  <section class="auth-layout">
    <div class="auth-aside"><div class="auth-brand"><span class="brand-mark large">CL</span><strong>CarbonLedger</strong></div><h1>建筑碳排放核算平台</h1><p>项目数据集中管理，核算结果可追溯。</p><div class="auth-aside-meta">GB/T 51366-2019 · 建造阶段</div></div>
    <div class="auth-panel"><div class="auth-form"><div class="eyebrow">欢迎回来</div><h2>登录账号</h2><p class="muted">使用已审批的账号继续工作</p>
      <el-form label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名"><el-input v-model="form.username" autocomplete="username" placeholder="输入用户名" @keyup.enter="submit" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="form.password" type="password" show-password autocomplete="current-password" placeholder="输入密码" @keyup.enter="submit" /></el-form-item>
        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
        <el-button class="primary-button full-width" type="primary" :loading="auth.loading" @click="submit">登录</el-button>
      </el-form>
      <div class="auth-foot">还没有账号？ <RouterLink to="/register">提交注册申请</RouterLink></div>
    </div></div>
  </section>
</template>
