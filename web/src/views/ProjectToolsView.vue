<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api, apiMessage, downloadApiFile } from '@/api'
import { formatNumber as format } from '@/utils/chart'

type ToolTab = 'factors' | 'versions'
type FactorType = 'build' | 'transport'
type ReportType = 'pdf' | 'excel'

const route = useRoute()
const router = useRouter()
const projectId = computed(() => Number(route.params.id))
const tabs: { key: ToolTab; label: string }[] = [
  { key: 'factors', label: '因子配置' },
  { key: 'versions', label: '核算版本' },
]
const active = computed<ToolTab>({
  get: () => route.query.tab === 'versions' ? 'versions' : 'factors',
  set: tab => { void router.replace({ query: { ...route.query, tab } }) },
})
const project = ref<any>(null)
const title = computed(() => project.value?.projectName || '项目管理')
const loading = ref(true)
const error = ref('')
const busyAction = ref('')
const unavailable = computed(() => loading.value || !!busyAction.value || !project.value || !!error.value)
const versions = ref<any[]>([])
const buildFactors = ref<any[]>([])
const transportFactors = ref<any[]>([])
const factorTab = ref<FactorType>('build')
const snapshotDialog = ref(false)
const snapshotData = ref<any>(null)
let loadSequence = 0

function errorText(error: unknown) { return apiMessage(error, '操作失败') }
function factorPath(type: FactorType) { return type === 'build' ? 'build-factors' : 'transport-factors' }

async function refresh() {
  const sequence = ++loadSequence
  const id = projectId.value
  loading.value = true
  error.value = ''
  try {
    const [projectResponse, versionResponse, buildResponse, transportResponse] = await Promise.all([
      api.get(`/projects/${id}`),
      api.get(`/projects/${id}/versions`),
      api.get(`/projects/${id}/build-factors`),
      api.get(`/projects/${id}/transport-factors`),
    ])
    if (sequence !== loadSequence) return
    project.value = projectResponse.data
    versions.value = versionResponse.data
    buildFactors.value = buildResponse.data
    transportFactors.value = transportResponse.data
  } catch (cause) {
    if (sequence === loadSequence) error.value = errorText(cause)
  } finally {
    if (sequence === loadSequence) loading.value = false
  }
}

async function runAction(name: string, action: (id: number) => Promise<void>) {
  if (unavailable.value) return
  busyAction.value = name
  try { await action(projectId.value) }
  catch (cause) { ElMessage.error(errorText(cause)) }
  finally { busyAction.value = '' }
}

async function seedFactors() {
  await runAction('seed', async id => {
    await api.post(`/projects/${id}/factors/seed?overwrite=true`)
    ElMessage.success('已恢复默认因子配置')
    await refresh()
  })
}

async function saveFactor(type: FactorType, row: any) {
  await runAction('factor', async id => {
    const path = `/projects/${id}/${factorPath(type)}`
    const response = row.id ? await api.patch(`${path}/${row.id}`, row) : await api.post(path, row)
    Object.assign(row, response.data)
    ElMessage.success('因子配置已保存')
  })
}

async function deleteFactor(type: FactorType, row: any) {
  await runAction('factor', async id => {
    try { await ElMessageBox.confirm('确定删除该因子配置吗？', '删除确认', { type: 'warning' }) }
    catch { return }
    if (row.id) await api.delete(`/projects/${id}/${factorPath(type)}/${row.id}`)
    const factors = type === 'build' ? buildFactors : transportFactors
    factors.value = factors.value.filter(item => item !== row)
    ElMessage.success('因子配置已删除')
  })
}

function newFactor() {
  if (unavailable.value) return
  if (factorTab.value === 'build') {
    buildFactors.value.push({ category: '其他', name: '新建因子', emissionFactor: 0, materialUnit: 't', recyclingFactor: 0, recyclingCoefficient: 0 })
  } else {
    transportFactors.value.push({ vehicleName: '新建车辆', energyType: '柴油', emissionFactor: 0 })
  }
}

async function saveVersion() {
  await runAction('version', async id => {
    const response = await api.post(`/projects/${id}/versions`)
    ElMessage.success(`已保存版本 v${response.data.versionNumber}`)
    try {
      const list = (await api.get(`/projects/${id}/versions`)).data
      if (id === projectId.value) versions.value = list
    } catch { ElMessage.warning('版本已保存，暂时无法刷新版本列表，请稍后刷新') }
  })
}

async function viewVersion(versionId: number) {
  await runAction('snapshot', async id => {
    const response = await api.get(`/projects/${id}/versions/${versionId}`)
    if (id !== projectId.value) return
    snapshotData.value = response.data
    snapshotDialog.value = true
  })
}

async function report(versionId: number, type: ReportType) {
  await runAction('report', async id => {
    await downloadApiFile(`/projects/${id}/reports/${versionId}/${type}`, `${title.value}-报告.${type === 'pdf' ? 'pdf' : 'xlsx'}`)
  })
}

async function reportCurrent(type: ReportType) {
  await runAction(`current-${type}`, async id => {
    await downloadApiFile(`/projects/${id}/reports/current/${type}`, `${title.value}-当前核算.${type === 'pdf' ? 'pdf' : 'xlsx'}`)
  })
}

watch(projectId, () => {
  project.value = null
  versions.value = []
  buildFactors.value = []
  transportFactors.value = []
  snapshotDialog.value = false
  snapshotData.value = null
  void refresh()
}, { immediate: true })
</script>
<template>
  <div v-loading="loading || !!busyAction" class="workspace-wrap project-tools-page">
    <div class="workspace-heading">
      <div><button class="back-link" @click="router.push('/projects')">返回我的项目</button><h1>{{ title }}</h1><p class="muted">{{ format(project?.buildingArea, 0) }} ㎡ · {{ project?.buildingType || '未填写类型' }} · {{ project?.accountingStandard }}</p></div>
      <div class="heading-actions"><el-button :disabled="loading || !!busyAction" @click="refresh">刷新</el-button><el-button :disabled="unavailable" :loading="busyAction==='current-excel'" @click="reportCurrent('excel')">导出当前 Excel</el-button><el-button :disabled="unavailable" :loading="busyAction==='current-pdf'" @click="reportCurrent('pdf')">导出当前 PDF</el-button><el-button type="primary" :disabled="unavailable" :loading="busyAction==='version'" @click="saveVersion">保存核算版本</el-button></div>
    </div>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
    <nav class="workspace-tabs"><button v-for="tab in tabs" :key="tab.key" :class="{active: active===tab.key}" :aria-current="active===tab.key ? 'page' : undefined" @click="active=tab.key">{{ tab.label }}</button></nav>

    <section v-if="active==='factors' && project && !error" class="workspace-section"><div class="panel"><div class="panel-heading"><div><h2>因子配置</h2><p class="muted">修改后请逐行保存。因子配置仅用于当前项目。</p></div><div class="factor-actions"><el-button :disabled="unavailable" @click="newFactor">新增</el-button><el-button type="primary" :disabled="unavailable" @click="seedFactors">恢复默认因子</el-button></div></div><div class="factor-tabs"><button :class="{active:factorTab==='build'}" @click="factorTab='build'">建材因子（{{ buildFactors.length }}）</button><button :class="{active:factorTab==='transport'}" @click="factorTab='transport'">运输因子（{{ transportFactors.length }}）</button></div><el-table v-if="factorTab==='build'" :data="buildFactors" stripe><el-table-column prop="category" label="类别" min-width="120"><template #default="s"><el-input :disabled="unavailable" v-model="s.row.category"/></template></el-table-column><el-table-column prop="name" label="名称" min-width="180"><template #default="s"><el-input :disabled="unavailable" v-model="s.row.name"/></template></el-table-column><el-table-column label="碳排因子" min-width="160"><template #default="s"><el-input-number :disabled="unavailable" v-model="s.row.emissionFactor" :min="0"/></template></el-table-column><el-table-column label="单位" min-width="100"><template #default="s"><el-input :disabled="unavailable" v-model="s.row.materialUnit"/></template></el-table-column><el-table-column label="回收因子" min-width="160"><template #default="s"><el-input-number :disabled="unavailable" v-model="s.row.recyclingFactor" :min="0"/></template></el-table-column><el-table-column label="回收系数" min-width="160"><template #default="s"><el-input-number :disabled="unavailable" v-model="s.row.recyclingCoefficient" :min="0"/></template></el-table-column><el-table-column label="操作" min-width="120"><template #default="s"><el-button :disabled="unavailable" link type="primary" @click="saveFactor('build',s.row)">保存</el-button><el-button :disabled="unavailable" link type="danger" @click="deleteFactor('build',s.row)">删除</el-button></template></el-table-column></el-table><el-table v-else :data="transportFactors" stripe><el-table-column prop="vehicleName" label="车辆名称" min-width="180"><template #default="s"><el-input :disabled="unavailable" v-model="s.row.vehicleName"/></template></el-table-column><el-table-column prop="energyType" label="能源类型" min-width="120"><template #default="s"><el-select :disabled="unavailable" v-model="s.row.energyType"><el-option label="柴油" value="柴油"/><el-option label="汽油" value="汽油"/></el-select></template></el-table-column><el-table-column label="碳排因子" min-width="160"><template #default="s"><el-input-number :disabled="unavailable" v-model="s.row.emissionFactor" :min="0"/></template></el-table-column><el-table-column label="操作" min-width="120"><template #default="s"><el-button :disabled="unavailable" link type="primary" @click="saveFactor('transport',s.row)">保存</el-button><el-button :disabled="unavailable" link type="danger" @click="deleteFactor('transport',s.row)">删除</el-button></template></el-table-column></el-table></div></section>

    <section v-else-if="active==='versions' && project && !error" class="workspace-section"><div class="panel"><div class="panel-heading"><div><h2>核算版本</h2><p class="muted">保存当前核算数据，便于后续查看和导出。已保存的版本不会随当前数据变化。</p></div><el-button type="primary" :disabled="unavailable" :loading="busyAction==='version'" @click="saveVersion">保存当前版本</el-button></div><el-table :data="versions" empty-text="暂无核算版本，点击“保存当前版本”创建"><el-table-column prop="versionNumber" label="版本" width="90"><template #default="scope">v{{ scope.row.versionNumber }}</template></el-table-column><el-table-column prop="createdAt" label="保存时间" min-width="180"><template #default="scope">{{ new Date(scope.row.createdAt).toLocaleString() }}</template></el-table-column><el-table-column prop="createdBy" label="保存人"/><el-table-column prop="netEmission" label="净排放（t）"><template #default="scope">{{ scope.row.netEmission==null?'—':format(scope.row.netEmission,3) }}</template></el-table-column><el-table-column prop="totalCost" label="总成本（万元）"><template #default="scope">{{ scope.row.totalCost==null?'—':format(scope.row.totalCost,4) }}</template></el-table-column><el-table-column label="报告" width="180"><template #default="scope"><el-button :disabled="unavailable" link type="primary" @click="report(scope.row.id,'excel')">Excel</el-button><el-button :disabled="unavailable" link type="primary" @click="report(scope.row.id,'pdf')">PDF</el-button></template></el-table-column><el-table-column label="快照" width="90"><template #default="scope"><el-button :disabled="unavailable" link @click="viewVersion(scope.row.id)">查看</el-button></template></el-table-column></el-table></div></section>

    <el-dialog v-model="snapshotDialog" :title="`版本快照 v${snapshotData?.versionNumber || ''}`" width="min(760px, calc(100% - 32px))"><div v-if="snapshotData"><dl class="detail-list"><dt>保存时间</dt><dd>{{ new Date(snapshotData.savedAt).toLocaleString() }}</dd><dt>项目名称</dt><dd>{{ snapshotData.project?.projectName }}</dd><dt>建筑面积</dt><dd>{{ format(snapshotData.project?.buildingArea, 0) }} ㎡</dd><dt>建材记录</dt><dd>{{ snapshotData.buildMaterials?.length || 0 }} 条</dd><dt>运输记录</dt><dd>{{ snapshotData.transportRecords?.length || 0 }} 条</dd><dt>施工记录</dt><dd>{{ snapshotData.constructionRecords?.length || 0 }} 条</dd><dt>回收记录</dt><dd>{{ snapshotData.recyclingRecords?.length || 0 }} 条</dd><dt>净碳排放</dt><dd>{{ format(snapshotData.summary?.emission?.netEmission, 6) }} tCO₂e</dd><dt>总成本</dt><dd>{{ format(snapshotData.summary?.cost?.totalCost, 4) }} 万元</dd></dl><h3>阶段排放</h3><div v-for="stage in snapshotData.summary?.emission?.stages || []" :key="stage.name" class="analysis-line"><span>{{ stage.name }}</span><strong>{{ format(stage.emission, 6) }} tCO₂e</strong></div></div><template #footer><el-button @click="snapshotDialog=false">关闭</el-button></template></el-dialog>
  </div>
</template>

<style scoped>
:global(body:has(.project-tools-page)) { min-width: 0; }
.workspace-heading > div, .panel { min-width: 0; }
.workspace-heading h1, .detail-list dd { overflow-wrap: anywhere; }
.heading-actions { flex-wrap: wrap; justify-content: flex-end; }
.heading-actions .el-button + .el-button { margin-left: 0; }
.panel-heading { gap: 16px; flex-wrap: wrap; }
.factor-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.factor-actions .el-button + .el-button { margin-left: 0; }
:deep(.el-input-number) { width: 100%; }
.workspace-tabs button:focus-visible, .factor-tabs button:focus-visible { outline: 2px solid #2563a6; outline-offset: -2px; }
@media (max-width: 600px) {
  .heading-actions { justify-content: flex-start; }
  .panel { padding: 16px; }
}
</style>