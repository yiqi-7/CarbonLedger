<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api, apiMessage, downloadApiFile, type BuildMaterial, type ConstructionRecord, type RecyclingRecord, type TransportRecord } from '@/api'
import BarChart from '@/components/BarChart.vue'
import CompositionChart from '@/components/CompositionChart.vue'
import PriceCompareChart from '@/components/PriceCompareChart.vue'
import { aggregateTop, currentQuarterLabel, formatNumber, stageLabel, topPriceSeries, type BarItem } from '@/utils/chart'
import { districtsOf, normalizeDistrict, provinces } from '@/data/cities'

const route = useRoute(); const router = useRouter(); const projectId = Number(route.params.id)
const project = ref<any>(null); const active = ref('overview'); const loading = ref(true); const error = ref('')
const build = ref<BuildMaterial[]>([]); const transport = ref<TransportRecord[]>([]); const construction = ref<ConstructionRecord[]>([]); const recycling = ref<RecyclingRecord[]>([]); const analysis = ref<any>(null); const versions = ref<any[]>([])
const buildFactors = ref<any[]>([]); const transportFactors = ref<any[]>([]); const factorTab = ref('build'); const buildSearch = ref(''); const buildType = ref('全部'); const transportSearch = ref(''); const transportEnergy = ref('全部'); const constructionSearch = ref(''); const constructionEnergy = ref('全部'); const recyclingSearch = ref(''); const recyclingType = ref('全部回收'); const importLoading = ref('')
const title = computed(() => project.value?.projectName || '项目工作区'); const analysisStage = ref('build'); const costStage = ref('build'); const stageFileInput = ref<HTMLInputElement | null>(null)

/** 旧版阶段页：标题栏 + 导入/导出/手动录入，表格区负责筛选与录入 */
const stagePages = ['build', 'transport', 'construction', 'recycling']
const stageTitle = computed(() => ({ build: '建材碳排放计算', transport: '运输碳排放计算', construction: '施工阶段碳排放计算', recycling: '回收碳计算' }[active.value as 'build'|'transport'|'construction'|'recycling'] || ''))
const stageSubtitle = computed(() => ({ build: '材料清单与用量录入', transport: '建材运输进场 · 车辆能耗核算', construction: '施工建造阶段 · 工程台班核算', recycling: '回收阶段材料减碳核算' }[active.value as 'build'|'transport'|'construction'|'recycling'] || ''))
const stageKind = computed(() => active.value === 'build' ? 'build-materials' : active.value === 'transport' ? 'transport-records' : 'construction-records')
const stageRecordName = computed(() => ({ build: '材料清单', transport: '运输记录清单', construction: '工程台班清单', recycling: '回收材料清单' }[active.value as 'build'|'transport'|'construction'|'recycling'] || ''))

/** 新建行（旧版：手动录入即在表格尾部插入一行待填写） */
const entrySaving = ref(false)
const rowSaving = ref(false)
const pendingBuild = ref<{ key: number; name: string; category: string; unit: string; quantity: number | null; marketPrice: number | null; unitPrice: number | null } | null>(null)
const pendingTransport = ref<{ key: number; factorConfigId: number | null; transportedMaterial: string; transportQuantity: number | null; transportDistance: number | null; transportUnitPrice: number | null } | null>(null)
const pendingConstruction = ref<{ key: number; machineryName: string; energyType: '电力'|'柴油'|'汽油'; shiftCount: number | null; energyPerShift: number | null; shiftUnitPrice: number | null } | null>(null)
const pendingBuildName = computed({
  get: () => pendingBuild.value?.name ? `${pendingBuild.value.category}:${pendingBuild.value.name}` : '',
  set: (value: string) => selectBuildConfigByName(value),
})
let pendingKey = 0
function selectBuildConfig(item: any) { if (!pendingBuild.value) return; pendingBuild.value.name = item.name; pendingBuild.value.category = item.category; pendingBuild.value.unit = item.materialUnit }
async function startEntry() {
  if (active.value === 'build' && !pendingBuild.value) {
    pendingBuild.value = { key: ++pendingKey, name: '', category: '', unit: '', quantity: 1, marketPrice: null, unitPrice: 1 }
  } else if (active.value === 'transport' && !pendingTransport.value) {
    if (!transportFactors.value.length) { ElMessage.warning('请先在因子配置中添加运输车辆'); return }
    pendingTransport.value = { key: ++pendingKey, factorConfigId: transportFactors.value[0].id, transportedMaterial: '', transportQuantity: 1, transportDistance: 1, transportUnitPrice: 1 }
  } else if (active.value === 'construction' && !pendingConstruction.value) {
    pendingConstruction.value = { key: ++pendingKey, machineryName: '', energyType: '电力', shiftCount: 1, energyPerShift: 1, shiftUnitPrice: 1 }
  }
  await nextTick()
  document.querySelector('.legacy-pending-row')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
function selectBuildConfigByName(value: string) {
  const [category, ...parts] = value.split(':')
  const name = parts.join(':')
  const config = buildFactors.value.find(item => item.category === category && item.name === name)
  if (config) selectBuildConfig(config)
}
function cancelEntry() { pendingBuild.value = null; pendingTransport.value = null; pendingConstruction.value = null }
async function createEntry(kind: string, payload: Record<string, unknown>, message: string) {
  if (entrySaving.value) return
  entrySaving.value = true
  try {
    await api.post(`/projects/${projectId}/${kind}`, payload)
    cancelEntry()
    ElMessage.success(message)
    try { await refresh() } catch { ElMessage.warning('记录已保存，暂时无法刷新，请稍后刷新页面') }
  } catch(e) { ElMessage.error(errorText(e)) } finally { entrySaving.value = false }
}
async function confirmBuild() {
  if (entrySaving.value) return
  const pending = pendingBuild.value
  if (!pending) return
  const config = buildFactors.value.find(item => item.name === pending.name && item.category === pending.category)
  if (!config) { ElMessage.warning('请从因子库选择建材名称'); return }
  if (!pending.quantity || !pending.unitPrice) { ElMessage.warning('用量和成交价必须大于 0'); return }
  await createEntry('build-materials', { factorConfigId: config.id, quantity: pending.quantity, marketPrice: pending.marketPrice, unitPrice: pending.unitPrice }, '建材记录已添加')
}
async function confirmTransport() {
  if (entrySaving.value) return
  const pending = pendingTransport.value
  if (!pending) return
  if (!pending.factorConfigId || !pending.transportedMaterial.trim()) { ElMessage.warning('请选择车辆并填写运输货物'); return }
  await createEntry('transport-records', { factorConfigId: pending.factorConfigId, transportedMaterial: pending.transportedMaterial, transportQuantity: pending.transportQuantity, transportDistance: pending.transportDistance, transportUnitPrice: pending.transportUnitPrice }, '运输记录已添加')
}
async function confirmConstruction() {
  if (entrySaving.value) return
  const pending = pendingConstruction.value
  if (!pending) return
  if (!pending.machineryName.trim()) { ElMessage.warning('请填写机械名称'); return }
  await createEntry('construction-records', { machineryName: pending.machineryName, energyType: pending.energyType, shiftCount: pending.shiftCount, energyPerShift: pending.energyPerShift, shiftUnitPrice: pending.shiftUnitPrice }, '施工记录已添加')
}
function triggerStageImport() { stageFileInput.value?.click() }
function openRecyclingFactorSetup() { factorTab.value = 'build'; active.value = 'factors'; ElMessage.info('请在对应建材因子配置中设置回收因子和回收系数') }

const stageRows = computed(() => analysisStage.value==='build' ? build.value.map(x=>({name:x.materialName, quantity:x.quantity, unit:x.unit, factor:x.emissionFactor, emission:x.emissionAmount, share:analysis.value?.build?.totalEmission ? x.emissionAmount/analysis.value.build.totalEmission*100 : 0})) : analysisStage.value==='transport' ? transport.value.map(x=>({name:`${x.vehicleName} · ${x.transportedMaterial}`,quantity:x.transportQuantity,unit:'t',factor:x.emissionFactor,emission:x.emissionAmount,share:analysis.value?.transport?.totalEmission ? x.emissionAmount/analysis.value.transport.totalEmission*100 : 0})) : analysisStage.value==='construction' ? construction.value.filter(x=>x.machineryName.trim()).map(x=>({name:x.machineryName,quantity:x.shiftCount,unit:'台班',factor:x.emissionFactor,emission:x.emissionAmount/1000,share:analysis.value?.construction?.totalEmission ? x.emissionAmount/analysis.value.construction.totalEmission*100 : 0})) : recycling.value.map(x=>({name:x.materialName,quantity:x.recyclingQuantity,unit:'',factor:x.recyclingFactor,emission:-x.reductionAmount,share:analysis.value?.recycling?.totalReduction ? x.reductionAmount/analysis.value.recycling.totalReduction*100 : 0})))
const costRows = computed(() => costStage.value==='build' ? analysis.value?.cost?.buildDetails || [] : costStage.value==='transport' ? transport.value.map(x=>({id:x.id,materialName:`${x.vehicleName} · ${x.transportedMaterial}`,totalPrice:x.transportTotalPrice,costShare:analysis.value?.cost?.totalCost ? x.transportTotalPrice/analysis.value.cost.totalCost*100 : 0,carbonCostIntensity:null})) : construction.value.filter(x=>x.machineryName.trim()).map(x=>({id:x.id,materialName:x.machineryName,totalPrice:x.totalPrice,costShare:analysis.value?.cost?.totalCost ? x.totalPrice/analysis.value.cost.totalCost*100 : 0,carbonCostIntensity:null})))
const categories = ['全部','混凝土','金属','砌体','保温材料','水泥及砂浆','玻璃','其他']; const energyTypes = ['全部','柴油','汽油']; const constructionTypes = ['全部','电力','柴油','汽油']; const recyclingTypes = ['全部回收','金属','保温材料','玻璃','其他']
const filteredBuild = computed(() => build.value.filter(x => (!buildSearch.value.trim() || x.materialName.toLowerCase() === buildSearch.value.trim().toLowerCase()) && (buildType.value === '全部' || x.type === buildType.value)))
const filteredTransport = computed(() => transport.value.filter(x => (!transportSearch.value || `${x.vehicleName} ${x.transportedMaterial}`.toLowerCase().includes(transportSearch.value.trim().toLowerCase())) && (transportEnergy.value === '全部' || x.energyType === transportEnergy.value)))
const filteredConstruction = computed(() => construction.value.filter(x => (!constructionSearch.value || x.machineryName.toLowerCase().includes(constructionSearch.value.trim().toLowerCase())) && (constructionEnergy.value === '全部' || x.energyType === constructionEnergy.value)))
const filteredRecycling = computed(() => recycling.value.filter(x => (!recyclingSearch.value.trim() || x.materialName.toLowerCase() === recyclingSearch.value.trim().toLowerCase()) && (recyclingType.value === '全部回收' || x.materialType === recyclingType.value)))
const cityOptions = computed(() => districtsOf(project.value?.province || ''))
function syncDistrict() { if (project.value) project.value.cityDistrict = normalizeDistrict(project.value.province || '', project.value.cityDistrict || '') }
const lifecycleChart = computed<BarItem[]>(() =>
  (analysis.value?.emission?.stages || []).map((stage: any) => ({
    label: stageLabel(stage.name),
    value: Number(stage.emission || 0),
    color: stage.emission < 0 ? '#67bd79' : undefined,
  })),
)
const buildChart = computed<BarItem[]>(() => aggregateTop(build.value, x => x.materialName, x => x.emissionAmount))
const transportChart = computed<BarItem[]>(() => aggregateTop(transport.value, x => x.vehicleName, x => x.emissionAmount))
const constructionChart = computed<BarItem[]>(() => aggregateTop(construction.value, x => x.machineryName, x => x.emissionAmount / 1000))
const recyclingChart = computed<BarItem[]>(() => aggregateTop(recycling.value, x => x.materialType, x => -x.reductionAmount))
const buildPriceChart = computed(() => topPriceSeries(build.value, { labelOf: x => x.materialName, weightOf: x => x.emissionAmount, marketPriceOf: x => x.marketPrice, dealPriceOf: x => x.unitPrice }))
const transportCostChart = computed<BarItem[]>(() => aggregateTop(transport.value, x => x.vehicleName, x => x.transportTotalPrice))
const constructionCostChart = computed<BarItem[]>(() => aggregateTop(construction.value, x => x.machineryName, x => x.totalPrice))
const recyclingComposition = computed<BarItem[]>(() => aggregateTop(recycling.value, x => x.materialType, x => x.reductionAmount))
const pageStats = computed(() => {
  const a = analysis.value
  if (active.value==='build') return [
    { label: '材料种类', value: String(build.value.length), unit: '种' },
    { label: '碳排放总量', value: format(a?.build?.totalEmission, 3), unit: 'tCO₂e' },
    { label: '建材总成本', value: format(a?.build?.totalMaterialCost, 4), unit: '万元' },
    { label: '单位面积碳排', value: format(a?.build?.emissionPerArea, 2), unit: 'kgCO₂e/㎡' },
  ]
  if (active.value==='transport') return [
    { label: '运输阶段碳排放量', value: format(a?.transport?.totalEmission, 3), unit: 'tCO₂e' },
  ]
  if (active.value==='construction') return [
    { label: '施工碳排放总量', value: format(Number(a?.construction?.totalEmission ?? 0) / 1000, 3), unit: 'tCO₂e' },
    { label: '机械台班总数', value: String(a?.construction?.totalShiftCount ?? 0), unit: '台班' },
    ...Object.entries(a?.construction?.energyTotals || {}).map(([name, item]: [string, any]) => ({ label: `${name}消耗`, value: format(item.energyTotal,3), unit: item.unit })),
  ]
  if (active.value==='recycling') return [
    { label: '可回收阶段总减碳排量', value: format(a?.recycling?.totalReduction, 3), unit: 'tCO₂e' },
    { label: '可回收材料总量', value: format(a?.recycling?.totalRecyclingQuantity, 3), unit: 't' },
    { label: '综合回收利用率', value: format(a?.recycling?.recyclingUtilizationRate, 2), unit: '%' },
    { label: '回收残值估算', value: format(a?.recycling?.estimatedResidualValue, 4), unit: '万元' },
  ]
  return []
})
const format = formatNumber
function errorText(e: unknown) { return apiMessage(e, '操作失败') }
async function load() { loading.value = true; try { const [p,b,t,c,r,a,v,bf,tf] = await Promise.all([api.get(`/projects/${projectId}`),api.get(`/projects/${projectId}/build-materials`),api.get(`/projects/${projectId}/transport-records`),api.get(`/projects/${projectId}/construction-records`),api.get(`/projects/${projectId}/recycling-records`),api.get(`/projects/${projectId}/analysis`),api.get(`/projects/${projectId}/versions`),api.get(`/projects/${projectId}/build-factors`),api.get(`/projects/${projectId}/transport-factors`)]); project.value=p.data; build.value=b.data; transport.value=t.data; construction.value=c.data; recycling.value=r.data; analysis.value=a.data; versions.value=v.data; buildFactors.value=bf.data; transportFactors.value=tf.data } catch(e) { error.value=errorText(e) } finally { loading.value=false } }
async function refresh() { const [b,t,c,r,a,v] = await Promise.all([api.get(`/projects/${projectId}/build-materials`),api.get(`/projects/${projectId}/transport-records`),api.get(`/projects/${projectId}/construction-records`),api.get(`/projects/${projectId}/recycling-records`),api.get(`/projects/${projectId}/analysis`),api.get(`/projects/${projectId}/versions`)]); build.value=b.data; transport.value=t.data; construction.value=c.data; recycling.value=r.data; analysis.value=a.data; versions.value=v.data }
async function action(fn: () => Promise<unknown>, success: string): Promise<boolean> { try { await fn(); ElMessage.success(success); await refresh(); return true } catch(e) { ElMessage.error(errorText(e)); return false } }
async function removeRecord(kind: string, id: number) { await ElMessageBox.confirm('确定删除这条记录吗？', '删除确认', { type: 'warning' }); await action(() => api.delete(`/projects/${projectId}/${kind}/${id}`), '记录已删除') }

/** 每次仅提交当前字段，保留历史因子，避免覆盖其他编辑。 */
async function commitRow(kind: string, row: any, field: string, value: unknown = row[field]) {
  rowSaving.value = true
  try {
    if (['transportedMaterial', 'machineryName', 'materialName'].includes(field)) {
      value = String(value ?? '').trim()
      if (!value) throw new Error('名称或运输货物不能为空')
    }
    const result = await api.patch(`/projects/${projectId}/${kind}/${row.id}`, { [field]: value })
    if (kind === 'recycling-records' && field === 'recyclingQuantity' && Number(result.data.recyclingQuantity) < Number(value)) ElMessage.warning(`回收量不能超过对应建材用量，已按上限 ${result.data.recyclingQuantity} 计算`)
    await refresh()
  } catch(e) {
    ElMessage.error(e instanceof Error && !('response' in e) ? e.message : errorText(e))
    try { await refresh() } catch { ElMessage.error('暂时无法刷新记录，请恢复连接后刷新页面') }
  } finally { rowSaving.value = false }
}
function pendingRowClass({ row }: { row: { _pending?: boolean } }) { return row._pending ? 'legacy-pending-row' : '' }
function recordIndex(rows: { id: number }[], row: { id: number }) { return String(rows.findIndex(item => item.id === row.id) + 1).padStart(2, '0') }
const energyComposition = computed(() => Object.entries(analysis.value?.[active.value]?.energyTotals || {}).map(([name, value]) => {
  const item = value as any
  return { name, ...item, emissionAmount: Number(item.emissionAmount) / (active.value === 'construction' ? 1000 : 1) }
}))

async function importFile(kind: string, event: Event) { const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return; if (file.size > 20 * 1024 * 1024) { ElMessage.error('Excel 文件不能超过 20MB'); return }; importLoading.value=kind; const data = new FormData(); data.append('file', file); try { const result = await api.post(`/projects/${projectId}/imports/${kind}`, data); ElMessage.success(`导入 ${result.data.imported} 条，跳过 ${result.data.skippedRows || 0} 条${result.data.sheetName ? `（工作表：${result.data.sheetName}）` : ''}`); await refresh() } catch(e) { ElMessage.error(errorText(e)) } finally { importLoading.value=''; input.value='' } }
async function exportFile(kind: string) { try { await downloadApiFile(`/projects/${projectId}/exports/${kind}`, `${kind}.xlsx`); ElMessage.success('清单已导出') } catch(e) { ElMessage.error(errorText(e)) } }
async function saveProject() { try { await api.patch(`/projects/${projectId}`, project.value); ElMessage.success('项目资料已保存'); await load() } catch(e) { ElMessage.error(errorText(e)) } }
async function uploadModelImage(event: Event) { const input=event.target as HTMLInputElement; const file=input.files?.[0]; if(!file) return; if(file.size>10*1024*1024){ElMessage.error('模型图片不能超过 10MB');input.value='';return} const data=new FormData();data.append('file',file);try{const response=await api.post(`/projects/${projectId}/model-image`,data);project.value.modelImage=response.data.modelImage;project.value.modelImageName=response.data.modelImageName;ElMessage.success('模型图片已上传')}catch(e){ElMessage.error(errorText(e))}finally{input.value=''} }
async function removeModelImage() { try { await api.delete(`/projects/${projectId}/model-image`);project.value.modelImage=null;project.value.modelImageName='';ElMessage.success('模型图片已移除') } catch(e){ElMessage.error(errorText(e))} }
async function seedFactors() { await action(() => api.post(`/projects/${projectId}/factors/seed?overwrite=true`), '已重新装载旧版因子配置'); await load() }
async function saveVersion() { await action(async() => { const r=await api.post(`/projects/${projectId}/versions`); ElMessage.success(`已保存版本 v${r.data.versionNumber}`) }, '版本已保存') }
async function report(versionId: number, type: 'pdf'|'excel') { try { await downloadApiFile(`/projects/${projectId}/reports/${versionId}/${type}`, `${title.value}-报告.${type === 'pdf' ? 'pdf' : 'xlsx'}`) } catch(e) { ElMessage.error(errorText(e)) } }
async function reportCurrent(type: 'pdf'|'excel') { try { await downloadApiFile(`/projects/${projectId}/reports/current/${type}`, `${title.value}-当前核算.${type === 'pdf' ? 'pdf' : 'xlsx'}`) } catch(e) { ElMessage.error(errorText(e)) } }
const snapshotDialog = ref(false); const snapshotData = ref<any>(null)
async function viewVersion(versionId: number) { try { snapshotData.value = (await api.get(`/projects/${projectId}/versions/${versionId}`)).data; snapshotDialog.value = true } catch(e) { ElMessage.error(errorText(e)) } }
async function saveFactor(type: 'build'|'transport', row: any) { const path=type==='build'?'build-factors':'transport-factors'; try { if(row.id) await api.patch(`/projects/${projectId}/${path}/${row.id}`, row); else await api.post(`/projects/${projectId}/${path}`, row); ElMessage.success('因子配置已保存'); await load() } catch(e) { ElMessage.error(errorText(e)) } }
async function deleteFactor(type: 'build'|'transport', row: any) { await ElMessageBox.confirm('确定删除该因子配置吗？','删除确认',{type:'warning'}); await action(() => api.delete(`/projects/${projectId}/${type==='build'?'build-factors':'transport-factors'}/${row.id}`), '因子配置已删除'); await load() }
function newFactor() { if(factorTab.value==='build') buildFactors.value.push({category:'其他',name:'新建因子',emissionFactor:0,materialUnit:'t',recyclingFactor:0,recyclingCoefficient:0}); else transportFactors.value.push({vehicleName:'新建车辆',energyType:'柴油',emissionFactor:0}) }
onMounted(load)
</script>

<template>
  <div v-loading="loading" class="workspace-wrap">
    <div class="workspace-heading">
      <div><button class="back-link" @click="router.push('/projects')">← 返回项目台账</button><h1>{{ title }}</h1><p class="muted">{{ format(project?.buildingArea, 0) }} ㎡ · {{ project?.buildingType || '未填写类型' }} · {{ project?.accountingStandard }}</p></div>
      <div class="heading-actions"><el-button @click="refresh">刷新</el-button><el-button @click="reportCurrent('excel')">导出当前 Excel</el-button><el-button @click="reportCurrent('pdf')">导出当前 PDF</el-button><el-button type="primary" @click="saveVersion">保存核算版本</el-button></div>
    </div>
    <el-alert v-if="error" :title="error" type="error" show-icon :closable="false" />
    <nav class="workspace-tabs"><button v-for="tab in [['overview','总览'],['project','项目信息'],['factors','因子配置'],['build','建材碳排放'],['transport','运输碳排放'],['construction','施工碳排放'],['recycling','回收碳计算'],['analysis','分析'],['versions','版本'] ]" :key="tab[0]" :class="{active: active===tab[0]}" @click="cancelEntry(); active=tab[0]">{{ tab[1] }}</button></nav>

    <!-- 旧版阶段页：标题栏 + 操作，随后是统计、筛选、清单表格 -->
    <section v-if="stagePages.includes(active)" class="stage-page-heading">
      <div class="stage-title-block">
        <button class="back-link" @click="cancelEntry(); active='project'">‹ 返回项目信息</button>
        <h2>{{ stageTitle }}</h2>
        <p class="muted">{{ title }} · {{ stageSubtitle }}</p>
      </div>
      <div class="stage-actions">
        <template v-if="active!=='recycling'">
          <el-button :loading="importLoading===stageKind" @click="triggerStageImport">导入{{ active==='build'?'清单':active==='transport'?'运输清单':'工程台班' }}</el-button>
          <el-button @click="exportFile(stageKind)">导出{{ active==='build'?'清单':active==='transport'?'运输清单':'工程台班' }}</el-button>
          <input ref="stageFileInput" type="file" accept=".xlsx" hidden @change="importFile(stageKind,$event)"/>
          <el-button type="primary" :disabled="entrySaving || rowSaving" @click="startEntry">{{ active==='build'?'新增建材':'手动录入' }}</el-button>
        </template>
        <el-button v-else type="primary" @click="openRecyclingFactorSetup">设置回收因子</el-button>
      </div>
    </section>

    <section v-if="active==='overview'" class="workspace-section"><div class="stat-grid"><div class="stat-card accent"><span>净碳排放</span><strong>{{ format(analysis?.emission?.netEmission) }}</strong><small>tCO₂e</small></div><div class="stat-card"><span>建材生产</span><strong>{{ format(analysis?.build?.totalEmission) }}</strong><small>tCO₂e</small></div><div class="stat-card"><span>运输阶段</span><strong>{{ format(analysis?.transport?.totalEmission) }}</strong><small>tCO₂e</small></div><div class="stat-card"><span>施工阶段</span><strong>{{ format(Number(analysis?.construction?.totalEmission ?? 0) / 1000) }}</strong><small>tCO₂e</small></div><div class="stat-card"><span>回收减排</span><strong>{{ format(analysis?.recycling?.totalReduction) }}</strong><small>tCO₂e</small></div><div class="stat-card"><span>单位面积净排放</span><strong>{{ format(analysis?.emission?.unitAreaNetEmission, 2) }}</strong><small>kgCO₂e/㎡</small></div></div><div class="overview-columns"><div class="panel"><div class="panel-heading"><h2>生命周期阶段</h2><span class="muted">tCO₂e（回收为负值）</span></div><BarChart :items="lifecycleChart" empty-text="当前阶段暂无排放记录"/></div><div class="panel"><img v-if="project?.modelImage" class="overview-model-image" :src="project.modelImage" :alt="project.modelImageName || '项目模型'"/><div class="panel-heading"><h2>项目概况</h2></div><dl class="detail-list"><dt>项目地点</dt><dd>{{ [project?.province, project?.cityDistrict, project?.address].filter(Boolean).join(' ') || '未填写' }}</dd><dt>负责人</dt><dd>{{ project?.projectManager || '未填写' }}</dd><dt>设计使用年限</dt><dd>{{ project?.designLife || '未填写' }}</dd><dt>开工日期</dt><dd>{{ project?.startDate || '未填写' }}</dd><dt>计划竣工</dt><dd>{{ project?.plannedCompletionDate || '未填写' }}</dd><dt>记录总数</dt><dd>{{ build.length + transport.length + construction.length + recycling.length }}</dd></dl></div></div><div class="chart-grid"><div class="panel"><div class="panel-heading"><h2>建材碳排放</h2><span class="muted">按材料</span></div><BarChart :items="buildChart" empty-text="暂无建材记录"/></div><div class="panel"><div class="panel-heading"><h2>运输碳排放</h2><span class="muted">按车辆</span></div><BarChart :items="transportChart" empty-text="暂无运输记录"/></div><div class="panel"><div class="panel-heading"><h2>施工碳排放</h2><span class="muted">按机械</span></div><BarChart :items="constructionChart" empty-text="暂无施工记录"/></div><div class="panel"><div class="panel-heading"><h2>回收减碳构成</h2><span class="muted">按类别</span></div><CompositionChart :items="recyclingComposition" empty-text="暂无回收记录"/></div><div class="panel"><div class="panel-heading"><h2>建材市场价格对比</h2><span class="muted">元</span></div><PriceCompareChart :items="buildPriceChart" empty-text="暂无建材价格数据"/></div><div class="panel"><div class="panel-heading"><h2>运输成本</h2><span class="muted">按车辆</span></div><BarChart :items="transportCostChart" empty-text="暂无运输成本"/></div><div class="panel"><div class="panel-heading"><h2>施工成本</h2><span class="muted">按机械</span></div><BarChart :items="constructionCostChart" empty-text="暂无施工成本"/></div></div></section>

    <!-- 项目信息页：保持现有结构 -->
    <section v-else-if="active==='project'" class="workspace-section"><div class="panel"><div class="panel-heading"><h2>项目信息</h2><el-button type="primary" @click="saveProject">保存资料</el-button></div><el-form label-position="top"><div class="form-grid"><el-form-item label="项目名称"><el-input v-model="project.projectName"/></el-form-item><el-form-item label="建筑面积（㎡）"><el-input-number v-model="project.buildingArea" :min="0.000001" :controls="false" class="full-width"/></el-form-item><el-form-item label="建筑类型"><el-input v-model="project.buildingType"/></el-form-item><el-form-item label="结构类型"><el-input v-model="project.structureType"/></el-form-item><el-form-item label="楼层数"><el-input v-model="project.floorCount"/></el-form-item><el-form-item label="设计使用年限"><el-input v-model="project.designLife"/></el-form-item><el-form-item label="开工日期"><el-input v-model="project.startDate" type="date"/></el-form-item><el-form-item label="计划竣工日期"><el-input v-model="project.plannedCompletionDate" type="date"/></el-form-item><el-form-item label="项目负责人"><el-input v-model="project.projectManager"/></el-form-item><el-form-item label="核算标准"><el-input v-model="project.accountingStandard"/></el-form-item><el-form-item label="省份"><el-select v-model="project.province" filterable placeholder="选择省份" @change="syncDistrict"><el-option v-for="item in provinces" :key="item" :label="item" :value="item"/></el-select></el-form-item><el-form-item label="城市/区县"><el-select v-model="project.cityDistrict" filterable placeholder="先选择省份"><el-option v-for="item in cityOptions" :key="item" :label="item" :value="item"/></el-select></el-form-item></div><el-form-item label="项目地址"><el-input v-model="project.address"/></el-form-item><el-form-item label="项目模型图片"><div class="image-tools"><input type="file" accept="image/png,image/jpeg,image/webp" @change="uploadModelImage"/><el-button v-if="project.modelImage" type="danger" plain @click="removeModelImage">移除图片</el-button></div><img v-if="project.modelImage" class="model-preview" :src="project.modelImage" :alt="project.modelImageName || '项目模型'"/></el-form-item></el-form></div></section>

    <section v-else-if="active==='factors'" class="workspace-section"><div class="panel"><div class="panel-heading"><div><h2>因子配置</h2><p class="muted">项目使用的因子由旧版配置文件初始化，可按项目调整</p></div><div><el-button @click="newFactor">新增</el-button><el-button type="primary" @click="seedFactors">重新装载旧版因子</el-button></div></div><div class="factor-tabs"><button :class="{active:factorTab==='build'}" @click="factorTab='build'">建材因子（{{ buildFactors.length }}）</button><button :class="{active:factorTab==='transport'}" @click="factorTab='transport'">运输因子（{{ transportFactors.length }}）</button></div><el-table v-if="factorTab==='build'" :data="buildFactors" stripe><el-table-column prop="category" label="类别"><template #default="s"><el-input v-model="s.row.category"/></template></el-table-column><el-table-column prop="name" label="名称"><template #default="s"><el-input v-model="s.row.name"/></template></el-table-column><el-table-column label="碳排因子"><template #default="s"><el-input-number v-model="s.row.emissionFactor" :min="0"/></template></el-table-column><el-table-column label="单位"><template #default="s"><el-input v-model="s.row.materialUnit"/></template></el-table-column><el-table-column label="回收因子"><template #default="s"><el-input-number v-model="s.row.recyclingFactor" :min="0"/></template></el-table-column><el-table-column label="回收系数"><template #default="s"><el-input-number v-model="s.row.recyclingCoefficient" :min="0"/></template></el-table-column><el-table-column label="操作"><template #default="s"><el-button link type="primary" @click="saveFactor('build',s.row)">保存</el-button><el-button link type="danger" @click="deleteFactor('build',s.row)">删除</el-button></template></el-table-column></el-table><el-table v-else :data="transportFactors" stripe><el-table-column prop="vehicleName" label="车辆名称"><template #default="s"><el-input v-model="s.row.vehicleName"/></template></el-table-column><el-table-column prop="energyType" label="能源类型"><template #default="s"><el-select v-model="s.row.energyType"><el-option label="柴油" value="柴油"/><el-option label="汽油" value="汽油"/></el-select></template></el-table-column><el-table-column label="碳排因子"><template #default="s"><el-input-number v-model="s.row.emissionFactor" :min="0"/></template></el-table-column><el-table-column label="操作"><template #default="s"><el-button link type="primary" @click="saveFactor('transport',s.row)">保存</el-button><el-button link type="danger" @click="deleteFactor('transport',s.row)">删除</el-button></template></el-table-column></el-table></div></section>

    <section v-else-if="active==='analyisis-placeholder'" class="workspace-section"></section>
    <section v-else-if="active==='analysis'" class="workspace-section"><div class="analysis-grid"><div class="panel"><div class="panel-heading"><h2>生命周期碳排放</h2><span class="muted">建材 + 运输 + 施工 − 回收</span></div><div class="analysis-number">{{ format(analysis?.emission?.netEmission, 6) }} <small>tCO₂e</small></div><p class="muted">单位面积净排放 {{ format(analysis?.emission?.unitAreaNetEmission, 6) }} kgCO₂e/㎡</p><div class="stage-switch"><button v-for="stage in [{key:'build',label:'建材'},{key:'transport',label:'运输'},{key:'construction',label:'施工'},{key:'recycling',label:'回收'}]" :key="stage.key" :class="{active:analysisStage===stage.key}" @click="analysisStage=stage.key">{{ stage.label }}</button></div><el-table :data="stageRows" size="small"><el-table-column prop="name" label="材料/设备"/><el-table-column prop="quantity" label="用量"/><el-table-column prop="factor" label="因子"/><el-table-column prop="emission" label="排放（t）"/><el-table-column prop="share" label="占比"><template #default="s">{{ format(s.row.share,2) }}%</template></el-table-column></el-table><div v-for="stage in analysis?.emission?.stages" :key="stage.name" class="analysis-line"><span>{{ stage.name }}</span><strong>{{ format(stage.emission, 6) }}</strong></div></div><div class="panel"><div class="panel-heading"><h2>成本分析</h2><span class="muted">万元</span></div><div class="stage-switch"><button v-for="stage in [{key:'build',label:'建材'},{key:'transport',label:'运输'},{key:'construction',label:'施工'}]" :key="stage.key" :class="{active:costStage===stage.key}" @click="costStage=stage.key">{{ stage.label }}</button></div><div class="analysis-number">{{ format(analysis?.cost?.totalCost, 4) }} <small>万元</small></div><p class="muted">单位面积建材成本 {{ format(analysis?.cost?.unitAreaBuildCost, 6) }} 万元/㎡</p><div class="analysis-line"><span>建材成本</span><strong>{{ format(analysis?.cost?.buildCost, 4) }}</strong></div><div v-if="analysis?.cost?.topBuildMaterial" class="analysis-line"><span>成本最高建材</span><strong>{{ analysis.cost.topBuildMaterial.materialName }} · {{ format(analysis.cost.topBuildMaterial.shareOfBuildCost, 2) }}%</strong></div><el-table :data="costRows" size="small"><el-table-column prop="materialName" label="材料/设备"/><el-table-column prop="totalPrice" label="总价（万元）"><template #default="s">{{ format(s.row.totalPrice, 4) }}</template></el-table-column><el-table-column prop="costShare" label="占比"><template #default="s">{{ format(s.row.costShare, 2) }}%</template></el-table-column></el-table></div></div></section>

    <section v-else-if="active==='versions'" class="workspace-section"><div class="panel"><div class="panel-heading"><div><h2>核算版本</h2><p class="muted">版本保存后数据快照不可变</p></div><el-button type="primary" @click="saveVersion">保存当前版本</el-button></div><el-table :data="versions"><el-table-column prop="versionNumber" label="版本" width="90"><template #default="scope">v{{ scope.row.versionNumber }}</template></el-table-column><el-table-column prop="createdAt" label="保存时间"/><el-table-column prop="createdBy" label="保存人"/><el-table-column prop="netEmission" label="净排放（t）"><template #default="scope">{{ scope.row.netEmission==null?'—':format(scope.row.netEmission,3) }}</template></el-table-column><el-table-column prop="totalCost" label="总成本（万元）"><template #default="scope">{{ scope.row.totalCost==null?'—':format(scope.row.totalCost,4) }}</template></el-table-column><el-table-column label="报告" width="180"><template #default="scope"><el-button link type="primary" @click="report(scope.row.id,'excel')">Excel</el-button><el-button link type="primary" @click="report(scope.row.id,'pdf')">PDF</el-button></template></el-table-column><el-table-column label="快照" width="90"><template #default="scope"><el-button link @click="viewVersion(scope.row.id)">查看</el-button></template></el-table-column></el-table></div></section>

    <!-- 四个阶段页：统计卡、筛选、旧版列清单（行内编辑 + 尾部新建行） -->
    <section v-else-if="stagePages.includes(active)" class="workspace-section stage-records">
      <div v-if="pageStats.length" class="stat-grid" :class="{'construction-stats': active==='construction'}"><div v-for="item in pageStats" :key="item.label" class="stat-card"><span>{{ item.label }}</span><strong>{{ item.value }}</strong><small>{{ item.unit }}</small></div></div>
      <section v-if="active==='transport' || active==='construction'" class="panel stage-energy">
        <div class="panel-heading"><h2>{{ active==='transport' ? '运输能源消耗构成' : '能源消耗构成' }}</h2><span v-if="active==='construction'" class="muted">能源碳排放因子：电力 0.581 kg/kWh · 柴油 2.632 kg/kg · 汽油 2.340 kg/kg</span></div>
        <div class="stage-energy-bar" role="img" :aria-label="energyComposition.map(item => `${item.name} ${format(item.share,1)}%`).join('，')">
          <span v-for="item in energyComposition" :key="item.name" :class="`energy-${item.name}`" :style="{width: `${item.share}%`}">{{ item.share>=7 ? `${item.name} ${format(item.share,1)}%` : '' }}</span>
        </div>
        <div class="stage-energy-breakdown"><div v-for="item in energyComposition" :key="item.name"><strong>{{ item.name }}</strong><small v-if="active==='construction'">{{ format(item.energyTotal,2) }} {{ item.unit }} · {{ format(item.emissionFactor,3) }} kg/{{ item.unit }}</small><span>{{ format(item.emissionAmount,3) }} tCO₂e · {{ format(item.share,1) }}%</span></div></div>
      </section>
      <div class="panel">
        <div class="panel-heading"><div><h2>{{ stageRecordName }}</h2><p class="muted">{{ active==='recycling' ? '自动联动记录来自建材回收因子；自定义记录可维护回收量与单价' : '修改后失焦即保存；带输入框的字段可编辑' }}</p></div><span class="muted">{{ active==='build'?filteredBuild.length:active==='transport'?filteredTransport.length:active==='construction'?filteredConstruction.length:filteredRecycling.length }} 条</span></div>
        <div class="filter-row">
          <el-input v-if="active==='build'" v-model="buildSearch" placeholder="搜索建材名称（完整名称匹配）"/><el-input v-else-if="active==='transport'" v-model="transportSearch" placeholder="搜索车辆或货物"/><el-input v-else-if="active==='construction'" v-model="constructionSearch" placeholder="搜索机械"/><el-input v-else v-model="recyclingSearch" placeholder="搜索回收材料（完整名称匹配）"/>
          <div class="filter-pills"><button v-for="item in active==='build'?categories:active==='transport'?energyTypes:active==='construction'?constructionTypes:recyclingTypes" :key="item" :class="{active:(active==='build'?buildType:active==='transport'?transportEnergy:active==='construction'?constructionEnergy:recyclingType)===item}" @click="active==='build'?buildType=item:active==='transport'?transportEnergy=item:active==='construction'?constructionEnergy=item:recyclingType=item">{{ item }}</button></div>
          <a v-if="active==='build'" class="price-source-link" href="https://www.zjzj.net/" target="_blank" rel="noopener">市场价来源：浙江造价在线 · {{ currentQuarterLabel() }}</a>
        </div>

        <el-form :disabled="rowSaving || entrySaving" class="stage-table-form">
        <el-table v-if="active==='build'" :data="pendingBuild ? [...filteredBuild, { id: -pendingBuild.key, _pending: true }] : filteredBuild" row-key="id" :row-class-name="pendingRowClass" stripe empty-text="没有符合条件的材料">
          <el-table-column label="序号" width="70"><template #default="s"><template v-if="s.row._pending && pendingBuild">新建</template><template v-else>{{ recordIndex(build, s.row) }}</template></template></el-table-column>
          <el-table-column prop="materialName" label="材料名称" min-width="140"><template #default="s"><template v-if="s.row._pending && pendingBuild"><el-select v-model="pendingBuildName" filterable placeholder="选择建材因子" size="small" @change="selectBuildConfigByName"><el-option v-for="item in buildFactors" :key="`${item.category}:${item.name}`" :label="`${item.name} · ${item.category}`" :value="`${item.category}:${item.name}`"/></el-select></template><template v-else><el-select v-if="s.row.isCustomMaterial" :model-value="buildFactors.find((item:any)=>item.name===s.row.materialName && item.category===s.row.type)?.id" filterable size="small" :placeholder="s.row.materialName" @change="(id:number)=>commitRow('build-materials',s.row,'factorConfigId',id)"><el-option v-for="item in buildFactors" :key="item.id" :value="item.id" :label="`${item.name} · ${item.category}`"/></el-select><span v-else>{{ s.row.materialName }}</span></template></template></el-table-column>
          <el-table-column prop="type" label="类型" min-width="100"><template #default="s"><template v-if="s.row._pending && pendingBuild">{{ pendingBuild.category || '选择后自动带入' }}</template><template v-else>{{ s.row.type }}</template></template></el-table-column>
          <el-table-column label="用量" min-width="130"><template #default="s"><template v-if="s.row._pending && pendingBuild"><div class="cell-quantity"><el-input-number v-model="pendingBuild.quantity" :min="0.000001" :controls="false" size="small"/><span>{{ pendingBuild.unit || '单位' }}</span></div></template><template v-else><div class="cell-quantity"><el-input-number v-model="s.row.quantity" :min="0.000001" :controls="false" size="small" @change="commitRow('build-materials',s.row,'quantity')"/><span>{{ s.row.unit }}</span></div></template></template></el-table-column>
          <el-table-column label="碳排放因子" min-width="120"><template #default="s"><template v-if="s.row._pending && pendingBuild">—</template><template v-else>{{ format(s.row.emissionFactor,2) }} kg/{{ s.row.unit }}</template></template></el-table-column>
          <el-table-column label="碳排放量" min-width="110"><template #default="s"><template v-if="s.row._pending && pendingBuild">—</template><template v-else>{{ format(s.row.emissionAmount,2) }} t</template></template></el-table-column>
          <el-table-column label="市场价（元）" min-width="120"><template #default="s"><template v-if="s.row._pending && pendingBuild"><el-input-number v-model="pendingBuild.marketPrice" :min="0" :controls="false" size="small"/></template><template v-else><el-input-number v-model="s.row.marketPrice" :min="0" :controls="false" size="small" @change="commitRow('build-materials',s.row,'marketPrice')"/></template></template></el-table-column>
          <el-table-column label="成交价（元）" min-width="120"><template #default="s"><template v-if="s.row._pending && pendingBuild"><el-input-number v-model="pendingBuild.unitPrice" :min="0.000001" :controls="false" size="small"/></template><template v-else><el-input-number v-model="s.row.unitPrice" :min="0.000001" :controls="false" size="small" @change="commitRow('build-materials',s.row,'unitPrice')"/></template></template></el-table-column>
          <el-table-column label="总价（万元）" min-width="110"><template #default="s"><template v-if="s.row._pending && pendingBuild">—</template><template v-else>{{ format(s.row.totalPrice,4) }}</template></template></el-table-column>
          <el-table-column label="回收因子" min-width="95"><template #default="s"><template v-if="s.row._pending && pendingBuild">—</template><template v-else>{{ s.row.recyclingFactor>0?format(s.row.recyclingFactor,2):'-' }}</template></template></el-table-column>
          <el-table-column label="回收系数" min-width="95"><template #default="s"><template v-if="s.row._pending && pendingBuild">—</template><template v-else>{{ s.row.recyclingFactor>0?format(s.row.recyclingCoefficient,2):'-' }}</template></template></el-table-column>
          <el-table-column label="操作" width="90" fixed="right"><template #default="s"><template v-if="s.row._pending && pendingBuild"><el-button link type="primary" :loading="entrySaving" @click="confirmBuild">确认</el-button><el-button link @click="cancelEntry">取消</el-button></template><template v-else><el-button link type="danger" @click="removeRecord('build-materials',s.row.id)">删除</el-button></template></template></el-table-column>
        </el-table>

        <el-table v-else-if="active==='transport'" :data="pendingTransport ? [...filteredTransport, { id: -pendingTransport.key, _pending: true }] : filteredTransport" row-key="id" :row-class-name="pendingRowClass" stripe empty-text="没有符合条件的运输记录">
          <el-table-column label="序号" width="70"><template #default="s"><template v-if="s.row._pending && pendingTransport">新建</template><template v-else>{{ recordIndex(transport, s.row) }}</template></template></el-table-column>
          <el-table-column label="车辆 / 车辆编号" min-width="150"><template #default="s"><template v-if="s.row._pending && pendingTransport"><el-select v-model="pendingTransport.factorConfigId" placeholder="选择车辆" size="small"><el-option v-for="item in transportFactors" :key="item.id" :value="item.id" :label="`${item.vehicleName} · ${item.energyType}`"/></el-select></template><template v-else><el-select v-if="s.row.isCustomMaterial" :model-value="transportFactors.find((item:any)=>item.vehicleName===s.row.vehicleName)?.id" size="small" :placeholder="s.row.vehicleName || '选择车辆'" @change="(id:number)=>commitRow('transport-records',s.row,'factorConfigId',id)"><el-option v-for="item in transportFactors" :key="item.id" :value="item.id" :label="`${item.vehicleName} · ${item.energyType}`"/></el-select><span v-else>{{ s.row.vehicleName }}</span></template></template></el-table-column>
          <el-table-column label="运输货物" min-width="130"><template #default="s"><template v-if="s.row._pending && pendingTransport"><el-input v-model="pendingTransport.transportedMaterial" placeholder="运输货物" size="small"/></template><template v-else><el-input v-model="s.row.transportedMaterial" size="small" @change="commitRow('transport-records',s.row,'transportedMaterial')"/></template></template></el-table-column>
          <el-table-column label="运输量 (t)" min-width="110"><template #default="s"><template v-if="s.row._pending && pendingTransport"><el-input-number v-model="pendingTransport.transportQuantity" :min="0.000001" :controls="false" size="small"/></template><template v-else><el-input-number v-model="s.row.transportQuantity" :min="0.000001" :controls="false" size="small" @change="commitRow('transport-records',s.row,'transportQuantity')"/></template></template></el-table-column>
          <el-table-column label="运距 (km)" min-width="110"><template #default="s"><template v-if="s.row._pending && pendingTransport"><el-input-number v-model="pendingTransport.transportDistance" :min="0.000001" :controls="false" size="small"/></template><template v-else><el-input-number v-model="s.row.transportDistance" :min="0.000001" :controls="false" size="small" @change="commitRow('transport-records',s.row,'transportDistance')"/></template></template></el-table-column>
          <el-table-column prop="energyType" label="能源类型" width="100"><template #default="s"><template v-if="s.row._pending && pendingTransport">自动带入</template><template v-else>{{ s.row.energyType }}</template></template></el-table-column>
          <el-table-column label="碳排放因子" min-width="130"><template #default="s"><template v-if="s.row._pending && pendingTransport">自动带入</template><template v-else>{{ format(s.row.emissionFactor,5) }} kg/t·km</template></template></el-table-column>
          <el-table-column label="碳排放量" min-width="110"><template #default="s"><template v-if="s.row._pending && pendingTransport">—</template><template v-else>{{ format(s.row.emissionAmount,3) }} t</template></template></el-table-column>
          <el-table-column label="运输单价（元）" min-width="120"><template #default="s"><template v-if="s.row._pending && pendingTransport"><el-input-number v-model="pendingTransport.transportUnitPrice" :min="0" :controls="false" size="small"/></template><template v-else><el-input-number v-model="s.row.transportUnitPrice" :min="0" :controls="false" size="small" @change="commitRow('transport-records',s.row,'transportUnitPrice')"/></template></template></el-table-column>
          <el-table-column label="运输总价（万元）" min-width="130"><template #default="s"><template v-if="s.row._pending && pendingTransport">—</template><template v-else>{{ format(s.row.transportTotalPrice,4) }}</template></template></el-table-column>
          <el-table-column label="操作" width="90" fixed="right"><template #default="s"><template v-if="s.row._pending && pendingTransport"><el-button link type="primary" :loading="entrySaving" @click="confirmTransport">确认</el-button><el-button link @click="cancelEntry">取消</el-button></template><template v-else><el-button link type="danger" @click="removeRecord('transport-records',s.row.id)">删除</el-button></template></template></el-table-column>
        </el-table>

        <el-table v-else-if="active==='construction'" :data="pendingConstruction ? [...filteredConstruction, { id: -pendingConstruction.key, _pending: true }] : filteredConstruction" row-key="id" :row-class-name="pendingRowClass" stripe empty-text="没有符合条件的工程台班">
          <el-table-column label="序号" width="70"><template #default="s"><template v-if="s.row._pending && pendingConstruction">新建</template><template v-else>{{ recordIndex(construction, s.row) }}</template></template></el-table-column>
          <el-table-column label="机械名称" min-width="130"><template #default="s"><template v-if="s.row._pending && pendingConstruction"><el-input v-model="pendingConstruction.machineryName" placeholder="机械名称" size="small"/></template><template v-else><el-input v-if="s.row.isCustomMaterial" v-model="s.row.machineryName" size="small" @change="commitRow('construction-records',s.row,'machineryName')"/><span v-else>{{ s.row.machineryName }}</span></template></template></el-table-column>
          <el-table-column label="台班数" min-width="100"><template #default="s"><template v-if="s.row._pending && pendingConstruction"><el-input-number v-model="pendingConstruction.shiftCount" :min="1" :step="1" step-strictly :controls="false" size="small"/></template><template v-else><el-input-number v-model="s.row.shiftCount" :min="1" :step="1" step-strictly :controls="false" size="small" @change="commitRow('construction-records',s.row,'shiftCount')"/></template></template></el-table-column>
          <el-table-column label="能源类型" width="120"><template #default="s"><template v-if="s.row._pending && pendingConstruction"><el-select v-model="pendingConstruction.energyType" size="small"><el-option label="电力" value="电力"/><el-option label="柴油" value="柴油"/><el-option label="汽油" value="汽油"/></el-select></template><template v-else><el-select v-if="s.row.isCustomMaterial" v-model="s.row.energyType" size="small" @change="commitRow('construction-records',s.row,'energyType')"><el-option label="电力" value="电力"/><el-option label="柴油" value="柴油"/><el-option label="汽油" value="汽油"/></el-select><span v-else>{{ s.row.energyType }}</span></template></template></el-table-column>
          <el-table-column label="单位台班能耗" min-width="130"><template #default="s"><template v-if="s.row._pending && pendingConstruction"><el-input-number v-model="pendingConstruction.energyPerShift" :min="0.000001" :controls="false" size="small"/></template><template v-else><div class="cell-quantity"><el-input-number v-if="s.row.isCustomMaterial" v-model="s.row.energyPerShift" :min="0.000001" :controls="false" size="small" @change="commitRow('construction-records',s.row,'energyPerShift')"/><span v-else>{{ format(s.row.energyPerShift,2) }}</span><span>{{ s.row.energyUnit }}</span></div></template></template></el-table-column>
          <el-table-column label="能源总耗" min-width="120"><template #default="s"><template v-if="s.row._pending && pendingConstruction">新增后计算</template><template v-else>{{ format(s.row.totalEnergy,2) }} {{ s.row.energyUnit }}</template></template></el-table-column>
          <el-table-column label="碳排放因子" min-width="110"><template #default="s"><template v-if="s.row._pending && pendingConstruction">新增后计算</template><template v-else>{{ format(s.row.emissionFactor,3) }}</template></template></el-table-column>
          <el-table-column label="碳排放量" min-width="110"><template #default="s"><template v-if="s.row._pending && pendingConstruction">新增后计算</template><template v-else>{{ format(s.row.emissionAmount/1000,3) }} t</template></template></el-table-column>
          <el-table-column label="台班单价（元）" min-width="120"><template #default="s"><template v-if="s.row._pending && pendingConstruction"><el-input-number v-model="pendingConstruction.shiftUnitPrice" :min="0" :controls="false" size="small"/></template><template v-else><el-input-number v-model="s.row.shiftUnitPrice" :min="0" :controls="false" size="small" @change="commitRow('construction-records',s.row,'shiftUnitPrice')"/></template></template></el-table-column>
          <el-table-column label="台班总价（万元）" min-width="130"><template #default="s"><template v-if="s.row._pending && pendingConstruction">—</template><template v-else>{{ format(s.row.totalPrice,4) }}</template></template></el-table-column>
          <el-table-column label="操作" width="90" fixed="right"><template #default="s"><template v-if="s.row._pending && pendingConstruction"><el-button link type="primary" :loading="entrySaving" @click="confirmConstruction">确认</el-button><el-button link @click="cancelEntry">取消</el-button></template><template v-else><el-button link type="danger" @click="removeRecord('construction-records',s.row.id)">删除</el-button></template></template></el-table-column>
        </el-table>

        <el-table v-else :data="filteredRecycling" stripe empty-text="没有符合条件的回收材料">
          <el-table-column label="序号" width="70"><template #default="s">{{ recordIndex(recycling, s.row) }}</template></el-table-column>
          <el-table-column label="回收材料" min-width="130"><template #default="s"><el-input v-if="s.row.isCustomMaterial" v-model="s.row.materialName" size="small" @change="commitRow('recycling-records',s.row,'materialName')"/><span v-else>{{ s.row.materialName }}</span></template></el-table-column>
          <el-table-column label="材料类别" width="110"><template #default="s"><el-select v-if="s.row.isCustomMaterial" v-model="s.row.materialType" size="small" @change="commitRow('recycling-records',s.row,'materialType')"><el-option v-for="t in recyclingTypes.slice(1)" :key="t" :label="t" :value="t"/></el-select><span v-else>{{ s.row.materialType }}</span></template></el-table-column>
          <el-table-column label="回收量" min-width="130"><template #default="s"><div class="cell-quantity"><el-input-number v-model="s.row.recyclingQuantity" :min="0.000001" :controls="false" size="small" @change="commitRow('recycling-records',s.row,'recyclingQuantity')"/><span>{{ s.row.unit }}</span></div></template></el-table-column>
          <el-table-column label="回收因子" min-width="110"><template #default="s"><el-input-number v-if="s.row.isCustomMaterial" v-model="s.row.recyclingFactor" :min="0" :controls="false" size="small" @change="commitRow('recycling-records',s.row,'recyclingFactor')"/><span v-else>{{ format(s.row.recyclingFactor,2) }}</span></template></el-table-column>
          <el-table-column label="回收系数" min-width="110"><template #default="s"><el-input-number v-if="s.row.isCustomMaterial" v-model="s.row.recyclingCoefficient" :min="0" :controls="false" size="small" @change="commitRow('recycling-records',s.row,'recyclingCoefficient')"/><span v-else>{{ format(s.row.recyclingCoefficient,2) }}</span></template></el-table-column>
          <el-table-column label="回收减碳量" min-width="110"><template #default="s">{{ format(s.row.reductionAmount,3) }} t</template></el-table-column>
          <el-table-column label="回收单价（元）" min-width="120"><template #default="s"><el-input-number v-model="s.row.recyclingUnitPrice" :min="0" :controls="false" size="small" @change="commitRow('recycling-records',s.row,'recyclingUnitPrice')"/></template></el-table-column>
          <el-table-column label="回收残值（万元）" min-width="130"><template #default="s">{{ format(s.row.residualValue,4) }}</template></el-table-column>
          <el-table-column label="操作" width="110" fixed="right"><template #default="s"><el-button v-if="s.row.isCustomMaterial" link type="danger" @click="removeRecord('recycling-records',s.row.id)">删除</el-button><span v-else class="muted">自动联动</span></template></el-table-column>
        </el-table>
        </el-form>
      </div>
    </section>

    <el-dialog v-model="snapshotDialog" :title="`版本快照 v${snapshotData?.versionNumber || ''}`" width="760px"><div v-if="snapshotData"><dl class="detail-list"><dt>保存时间</dt><dd>{{ new Date(snapshotData.savedAt).toLocaleString() }}</dd><dt>项目名称</dt><dd>{{ snapshotData.project?.projectName }}</dd><dt>建筑面积</dt><dd>{{ format(snapshotData.project?.buildingArea, 0) }} ㎡</dd><dt>建材记录</dt><dd>{{ snapshotData.buildMaterials?.length || 0 }} 条</dd><dt>运输记录</dt><dd>{{ snapshotData.transportRecords?.length || 0 }} 条</dd><dt>施工记录</dt><dd>{{ snapshotData.constructionRecords?.length || 0 }} 条</dd><dt>回收记录</dt><dd>{{ snapshotData.recyclingRecords?.length || 0 }} 条</dd><dt>净碳排放</dt><dd>{{ format(snapshotData.summary?.emission?.netEmission, 6) }} tCO₂e</dd><dt>总成本</dt><dd>{{ format(snapshotData.summary?.cost?.totalCost, 4) }} 万元</dd></dl><h3>阶段排放</h3><div v-for="stage in snapshotData.summary?.emission?.stages || []" :key="stage.name" class="analysis-line"><span>{{ stage.name }}</span><strong>{{ format(stage.emission, 6) }} tCO₂e</strong></div></div><template #footer><el-button @click="snapshotDialog=false">关闭</el-button></template></el-dialog>
  </div>
</template>