<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api, apiMessage } from '@/api'

const pending = ref<any[]>([])
const users = ref<any[]>([])
const logs = ref<any[]>([])
const loading = ref(false)
const busyId = ref<number | null>(null)
const active = ref<'pending' | 'users' | 'audit'>('pending')

async function load() {
  loading.value = true
  try {
    const [pendingResponse, usersResponse, logsResponse] = await Promise.all([
      api.get('/admin/users/pending'),
      api.get('/admin/users'),
      api.get('/admin/audit-logs?limit=200'),
    ])
    pending.value = pendingResponse.data
    users.value = usersResponse.data
    logs.value = logsResponse.data
  } catch (error) {
    ElMessage.error(apiMessage(error, '管理员数据加载失败'))
  } finally {
    loading.value = false
  }
}

async function decide(user: any, decision: 'approve' | 'reject') {
  const verb = decision === 'approve' ? '批准' : '拒绝'
  try {
    await ElMessageBox.confirm(`确认${verb}账号“${user.username}”的注册申请？`, `${verb}注册申请`, { type: 'warning' })
  } catch {
    return
  }
  busyId.value = user.id
  try {
    await api.post(`/admin/users/${user.id}/${decision}`)
    ElMessage.success(`已${verb}账号`)
    await load()
  } catch (error) {
    ElMessage.error(apiMessage(error, `${verb}失败`))
  } finally {
    busyId.value = null
  }
}

function date(value: string) {
  return value ? new Date(value).toLocaleString() : '—'
}

onMounted(load)
</script>

<template>
  <section class="admin-wrap" v-loading="loading">
    <header class="admin-heading">
      <div><h1>管理员控制台</h1><p class="muted">注册审批、账号状态与关键操作记录</p></div>
      <el-button @click="load">刷新</el-button>
    </header>
    <nav class="admin-tabs" aria-label="管理员视图">
      <button :class="{ active: active === 'pending' }" @click="active = 'pending'">待审批 <span>{{ pending.length }}</span></button>
      <button :class="{ active: active === 'users' }" @click="active = 'users'">账号列表</button>
      <button :class="{ active: active === 'audit' }" @click="active = 'audit'">操作审计</button>
    </nav>
    <el-table v-if="active === 'pending'" :data="pending" stripe empty-text="当前没有待审批申请">
      <el-table-column prop="username" label="用户名" min-width="150" />
      <el-table-column prop="remark" label="备注" min-width="220" />
      <el-table-column prop="createdAt" label="申请时间" min-width="180"><template #default="s">{{ date(s.row.createdAt) }}</template></el-table-column>
      <el-table-column label="操作" width="190"><template #default="s"><el-button type="primary" link :loading="busyId === s.row.id" @click="decide(s.row, 'approve')">批准</el-button><el-button type="danger" link :loading="busyId === s.row.id" @click="decide(s.row, 'reject')">拒绝</el-button></template></el-table-column>
    </el-table>
    <el-table v-else-if="active === 'users'" :data="users" stripe empty-text="没有账号">
      <el-table-column prop="username" label="用户名" min-width="180" />
      <el-table-column prop="role" label="角色" width="120"><template #default="s">{{ s.row.role === 'ADMIN' ? '管理员' : '普通用户' }}</template></el-table-column>
      <el-table-column prop="status" label="状态" width="140" />
      <el-table-column prop="createdAt" label="注册时间" min-width="180"><template #default="s">{{ date(s.row.createdAt) }}</template></el-table-column>
    </el-table>
    <el-table v-else :data="logs" stripe empty-text="没有操作记录">
      <el-table-column prop="createdAt" label="时间" min-width="180"><template #default="s">{{ date(s.row.createdAt) }}</template></el-table-column>
      <el-table-column prop="userId" label="操作者 ID" width="110" />
      <el-table-column prop="action" label="动作" min-width="170" />
      <el-table-column prop="targetType" label="对象类型" width="120" />
      <el-table-column prop="targetId" label="对象 ID" width="110" />
      <el-table-column prop="detail" label="详情" min-width="200" />
      <el-table-column prop="result" label="结果" width="100" />
    </el-table>
  </section>
</template>
