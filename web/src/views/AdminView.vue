<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
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
      <div class="admin-heading-actions">
        <RouterLink to="/projects" class="admin-back-button"><ArrowLeft aria-hidden="true" />返回我的项目</RouterLink>
        <el-button @click="load">刷新</el-button>
      </div>
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

<style scoped>
.admin-heading-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}
.admin-back-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  min-height: 44px;
  padding: 0 18px;
  border: 1px solid rgba(37, 65, 74, 0.16);
  border-radius: 999px;
  background: rgba(239, 245, 242, 0.84);
  color: var(--color-glass-scene);
  font-size: 14px;
  font-weight: 500;
  text-decoration: none;
  box-shadow: 0 4px 14px rgba(19, 37, 41, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.82);
  transition: color 0.16s ease, background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, transform 420ms ease-out;
}
.admin-back-button :deep(svg) { width: 16px; height: 16px; }
.admin-back-button:hover {
  border-color: rgba(85, 123, 121, 0.42);
  background: #FCFCFA;
  color: var(--platform-ink);
  box-shadow: 0 8px 20px rgba(19, 37, 41, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.92);
}
.admin-back-button:active { transform: scale(0.96); transition-duration: 110ms; }
.admin-back-button:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 3px; }
@media (max-width: 600px) {
  .admin-heading-actions { width: 100%; justify-content: stretch; }
  .admin-heading-actions > * { flex: 1 1 0; }
}
@media (prefers-reduced-motion: reduce) {
  .admin-back-button { transition: none; }
  .admin-back-button:active { transform: none; }
}
/* Apple style admin actions */
.admin-back-button { border: 0; background: #F5F5F7; color: #0071E3; box-shadow: none; transition: transform 500ms cubic-bezier(0.25, 0.1, 0.25, 1), background-color 500ms cubic-bezier(0.25, 0.1, 0.25, 1); }
.admin-back-button:hover { border: 0; background: #E8F2FC; color: #0066CC; box-shadow: none; transform: translateY(-2px); }
.admin-back-button:active { transform: scale(0.96); transition-duration: 110ms; }
.admin-back-button:focus-visible { outline-color: #0071E3; }
</style>
