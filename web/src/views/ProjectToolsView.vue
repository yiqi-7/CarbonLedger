<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api, apiMessage, downloadApiFile } from '@/api'
import { formatNumber as format } from '@/utils/chart'

type ToolTab = 'factors' | 'versions'
type FactorType = 'build' | 'transport'
type ReportType = 'pdf' | 'excel'

const route = useRoute()
const router = useRouter()
const projectId = Number(route.params.id)
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
const versions = ref<any[]>([])
const buildFactors = ref<any[]>([])
const transportFactors = ref<any[]>([])
const factorTab = ref<FactorType>('build')
const snapshotDialog = ref(false)
const snapshotData = ref<any>(null)

function errorText(error: unknown) { return apiMessage(error, '操作失败') }
function factorPath(type: FactorType) { return type === 'build' ? 'build-factors' : 'transport-factors' }

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    const [projectResponse, versionResponse, buildResponse, transportResponse] = await Promise.all([
      api.get(`/projects/${projectId}`),
      api.get(`/projects/${projectId}/versions`),
      api.get(`/projects/${projectId}/build-factors`),
      api.get(`/projects/${projectId}/transport-factors`),
    ])
    project.value = projectResponse.data
    versions.value = versionResponse.data
    buildFactors.value = buildResponse.data
    transportFactors.value = transportResponse.data
  } catch (cause) {
    error.value = errorText(cause)
  } finally {
    loading.value = false
  }
}

async function seedFactors() {
  try {
    await api.post(`/projects/${projectId}/factors/seed?overwrite=true`)
    ElMessage.success('已重新装载旧版因子配置')
    await refresh()
  } catch (cause) { ElMessage.error(errorText(cause)) }
}

async function saveFactor(type: FactorType, row: any) {
  try {
    const path = `/projects/${projectId}/${factorPath(type)}`
    if (row.id) await api.patch(`${path}/${row.id}`, row)
    else await api.post(path, row)
    ElMessage.success('因子配置已保存')
    await refresh()
  } catch (cause) { ElMessage.error(errorText(cause)) }
}

async function deleteFactor(type: FactorType, row: any) {
  try {
    await ElMessageBox.confirm('确定删除该因子配置吗？', '删除确认', { type: 'warning' })
  } catch { return }
  if (!row.id) {
    const factors = type === 'build' ? buildFactors : transportFactors
    factors.value = factors.value.filter(item => item !== row)
    return
  }
  try {
    await api.delete(`/projects/${projectId}/${factorPath(type)}/${row.id}`)
    ElMessage.success('因子配置已删除')
    await refresh()
  } catch (cause) { ElMessage.error(errorText(cause)) }
}

function newFactor() {
  if (factorTab.value === 'build') {
    buildFactors.value.push({ category: '其他', name: '新建因子', emissionFactor: 0, materialUnit: 't', recyclingFactor: 0, recyclingCoefficient: 0 })
  } else {
    transportFactors.value.push({ vehicleName: '新建车辆', energyType: '柴油', emissionFactor: 0 })
  }
}

async function saveVersion() {
  try {
    const response = await api.post(`/projects/${projectId}/versions`)
    ElMessage.success(`已保存版本 v${response.data.versionNumber}`)
    await refresh()
  } catch (cause) { ElMessage.error(errorText(cause)) }
}

async function viewVersion(versionId: number) {
  try {
    snapshotData.value = (await api.get(`/projects/${projectId}/versions/${versionId}`)).data
    snapshotDialog.value = true
  } catch (cause) { ElMessage.error(errorText(cause)) }
}

async function report(versionId: number, type: ReportType) {
  try {
    await downloadApiFile(`/projects/${projectId}/reports/${versionId}/${type}`, `${title.value}-报告.${type === 'pdf' ? 'pdf' : 'xlsx'}`)
  } catch (cause) { ElMessage.error(errorText(cause)) }
}

async function reportCurrent(type: ReportType) {
  try {
    await downloadApiFile(`/projects/${projectId}/reports/current/${type}`, `${title.value}-当前核算.${type === 'pdf' ? 'pdf' : 'xlsx'}`)
  } catch (cause) { ElMessage.error(errorText(cause)) }
}

onMounted(refresh)
</script>

<template>
  <div v-loading="loading" class="workspace-wrap">
    <div class="workspace-heading">
      <div><button class="back-link" @click="router.push('/projects')">← 返回项目台账</button><h1>{{ title }} · 项目管理</h1><p class="muted">{{ format(project?.buildingArea, 0) }} ㎡ · {{ project?.buildingType || '未填写类型' }} · {{ project?.accountingStandard }}</p></div>
      <div class="heading-actions"><el-button @click="refresh">刷新</el-button><el-button @click="reportCurrent('excel')">导出当前 Excel</el-button><el-button @click="reportCurrent('pdf')">导出当前 PDF</el-button><el-button type="primary" @click="saveVersion">保存核算版本</el-button></div>
    </div>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
    <nav class="workspace-tabs"><button v-for="tab in tabs" :key="tab.key" :class="{active: active===tab.key}" @click="active=tab.key">{{ tab.label }}</button></nav>

    <section v-if="active==='factors'" class="workspace-section"><div class="panel"><div class="panel-heading"><div><h2>因子配置</h2><p class="muted">项目使用的因子由旧版配置文件初始化，可按项目调整</p></div><div><el-button @click="newFactor">新增</el-button><el-button type="primary" @click="seedFactors">重新装载旧版因子</el-button></div></div><div class="factor-tabs"><button :class="{active:factorTab==='build'}" @click="factorTab='build'">建材因子（{{ buildFactors.length }}）</button><button :class="{active:factorTab==='transport'}" @click="factorTab='transport'">运输因子（{{ transportFactors.length }}）</button></div><el-table v-if="factorTab==='build'" :data="buildFactors" stripe><el-table-column prop="category" label="类别"><template #default="s"><el-input v-model="s.row.category"/></template></el-table-column><el-table-column prop="name" label="名称"><template #default="s"><el-input v-model="s.row.name"/></template></el-table-column><el-table-column label="碳排因子"><template #default="s"><el-input-number v-model="s.row.emissionFactor" :min="0"/></template></el-table-column><el-table-column label="单位"><template #default="s"><el-input v-model="s.row.materialUnit"/></template></el-table-column><el-table-column label="回收因子"><template #default="s"><el-input-number v-model="s.row.recyclingFactor" :min="0"/></template></el-table-column><el-table-column label="回收系数"><template #default="s"><el-input-number v-model="s.row.recyclingCoefficient" :min="0"/></template></el-table-column><el-table-column label="操作"><template #default="s"><el-button link type="primary" @click="saveFactor('build',s.row)">保存</el-button><el-button link type="danger" @click="deleteFactor('build',s.row)">删除</el-button></template></el-table-column></el-table><el-table v-else :data="transportFactors" stripe><el-table-column prop="vehicleName" label="车辆名称"><template #default="s"><el-input v-model="s.row.vehicleName"/></template></el-table-column><el-table-column prop="energyType" label="能源类型"><template #default="s"><el-select v-model="s.row.energyType"><el-option label="柴油" value="柴油"/><el-option label="汽油" value="汽油"/></el-select></template></el-table-column><el-table-column label="碳排因子"><template #default="s"><el-input-number v-model="s.row.emissionFactor" :min="0"/></template></el-table-column><el-table-column label="操作"><template #default="s"><el-button link type="primary" @click="saveFactor('transport',s.row)">保存</el-button><el-button link type="danger" @click="deleteFactor('transport',s.row)">删除</el-button></template></el-table-column></el-table></div></section>

    <section v-else-if="active==='versions'" class="workspace-section"><div class="panel"><div class="panel-heading"><div><h2>核算版本</h2><p class="muted">版本保存后数据快照不可变</p></div><el-button type="primary" @click="saveVersion">保存当前版本</el-button></div><el-table :data="versions"><el-table-column prop="versionNumber" label="版本" width="90"><template #default="scope">v{{ scope.row.versionNumber }}</template></el-table-column><el-table-column prop="createdAt" label="保存时间"/><el-table-column prop="createdBy" label="保存人"/><el-table-column prop="netEmission" label="净排放（t）"><template #default="scope">{{ scope.row.netEmission==null?'—':format(scope.row.netEmission,3) }}</template></el-table-column><el-table-column prop="totalCost" label="总成本（万元）"><template #default="scope">{{ scope.row.totalCost==null?'—':format(scope.row.totalCost,4) }}</template></el-table-column><el-table-column label="报告" width="180"><template #default="scope"><el-button link type="primary" @click="report(scope.row.id,'excel')">Excel</el-button><el-button link type="primary" @click="report(scope.row.id,'pdf')">PDF</el-button></template></el-table-column><el-table-column label="快照" width="90"><template #default="scope"><el-button link @click="viewVersion(scope.row.id)">查看</el-button></template></el-table-column></el-table></div></section>

    <el-dialog v-model="snapshotDialog" :title="`版本快照 v${snapshotData?.versionNumber || ''}`" width="760px"><div v-if="snapshotData"><dl class="detail-list"><dt>保存时间</dt><dd>{{ new Date(snapshotData.savedAt).toLocaleString() }}</dd><dt>项目名称</dt><dd>{{ snapshotData.project?.projectName }}</dd><dt>建筑面积</dt><dd>{{ format(snapshotData.project?.buildingArea, 0) }} ㎡</dd><dt>建材记录</dt><dd>{{ snapshotData.buildMaterials?.length || 0 }} 条</dd><dt>运输记录</dt><dd>{{ snapshotData.transportRecords?.length || 0 }} 条</dd><dt>施工记录</dt><dd>{{ snapshotData.constructionRecords?.length || 0 }} 条</dd><dt>回收记录</dt><dd>{{ snapshotData.recyclingRecords?.length || 0 }} 条</dd><dt>净碳排放</dt><dd>{{ format(snapshotData.summary?.emission?.netEmission, 6) }} tCO₂e</dd><dt>总成本</dt><dd>{{ format(snapshotData.summary?.cost?.totalCost, 4) }} 万元</dd></dl><h3>阶段排放</h3><div v-for="stage in snapshotData.summary?.emission?.stages || []" :key="stage.name" class="analysis-line"><span>{{ stage.name }}</span><strong>{{ format(stage.emission, 6) }} tCO₂e</strong></div></div><template #footer><el-button @click="snapshotDialog=false">关闭</el-button></template></el-dialog>
  </div>
</template>
