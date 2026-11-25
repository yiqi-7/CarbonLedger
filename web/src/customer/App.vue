<script setup>
import { computed, markRaw, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ArrowLeft, ArrowRight, Check, Download, Plus, Search, Upload } from '@element-plus/icons-vue'
import { api, apiMessage, downloadApiFile } from '@/api'
import { createProjectPersistence } from './apiPersistence.js'
import { formatDisplayNumber } from './formatDisplayNumber.js'
import { hasMeaningfulTemporaryRows, hasProjectDraftChanges, hasRowDraftChanges, protectUnsavedChanges } from './unsavedChanges.js'
import AppSidebar from './components/AppSidebar.vue'
import DashboardHome from './components/DashboardHome.vue'
import chinaCities from './data/chinaCities.json'
import { ProjectInfo, saveProjectInfo } from './data/projectInfo.js'
import { BuildMaterialInfo, buildMaterialInfoList } from './data/buildMaterialInfo.js'
import { BuildCarbonInfo } from './data/buildCarbonInfo.js'
import {
  BuildCarbonConfigInfo,
  BuildCarbonConfigInfoList,
  buildCarbonConfigInfoList
} from './data/buildCarbonConfigInfo.js'
import { RecyclingMateiralInfo, recyclingMateiralInfoList } from './data/recyclingMaterialInfo.js'
import { RecyclingCarbonInfo } from './data/recyclingCarbonInfo.js'
import { ConstructionMaterialInfo, constructionEnergyTypes, constructionMaterialInfoList } from './data/constructionMaterialInfo.js'
import { ConstructionCarbonInfo } from './data/constructionCarbonInfo.js'
import { TransportMaterialInfo, transportEnergyTypes, transportMaterialInfoList } from './data/transportMaterialInfo.js'
import { TransportCarbonInfo } from './data/transportCarbonInfo.js'
import {
  TransportCarbonConfigInfo,
  TransportCarbonConfigInfoList,
  transportCarbonConfigInfoList
} from './data/transportCarbonConfigInfo.js'


const navigation = [
  '首页',
  '项目信息',
  '建材碳排放',
  '运输碳排放',
  '施工碳排放',
  '回收碳计算',
  '碳排放分析',
  '成本分析'
]

const LimitTime = '2026-12-01'
// 是否强制要求网络校时：true = 拿不到网络时间即锁定（严格防改本机时钟）；
// false = 网络时间优先，取不到时退回本机时间继续按 LimitTime 判定（避免外网波动导致整站不可用）。
const requireNetworkTime = false
const networkTimeAvailable = ref(false)
const networkTimeNow = ref(null)
const networkTimeAtSync = ref(null)
const networkTimeSyncedAt = ref(0)
const localTimeNow = ref(Date.now())
let fallbackNoticeShown = false
const currentTimestamp = computed(() =>
  networkTimeAvailable.value && networkTimeNow.value !== null
    ? networkTimeNow.value
    : localTimeNow.value
)
const navigationLocked = computed(() => {
  if (requireNetworkTime && !networkTimeAvailable.value) return true
  let limitTimestamp
  try {
    limitTimestamp = parseLimitTime(LimitTime)
  } catch (error) {
    console.error('Invalid LimitTime value.', error)
    return false
  }
  return currentTimestamp.value > limitTimestamp
})
const activePage = ref('项目信息')
const sidebarCollapsed = ref(false)
const message = ref('')
const draft = reactive({ ...ProjectInfo, accountingStages: [...ProjectInfo.accountingStages] })
const uploadedImageUrl = ref(typeof ProjectInfo.modelImage === 'string' ? ProjectInfo.modelImage : '')
const materialList = reactive(buildMaterialInfoList)
const buildCarbonInfo = reactive(new BuildCarbonInfo())
const buildConfigList = reactive(buildCarbonConfigInfoList)
const recyclingMaterialList = reactive(recyclingMateiralInfoList)
const recyclingCarbonInfo = reactive(new RecyclingCarbonInfo())
const constructionMaterialList = reactive(constructionMaterialInfoList)
const constructionCarbonInfo = reactive(new ConstructionCarbonInfo())
const transportMaterialList = reactive(transportMaterialInfoList)
const transportCarbonInfo = reactive(new TransportCarbonInfo())
const transportConfigList = reactive(transportCarbonConfigInfoList)
const recyclingCategory = ref('全部回收')
const recyclingSearch = ref('')
const constructionCategory = ref('全部')
const constructionSearch = ref('')
const transportCategory = ref('全部')
const transportSearch = ref('')
const materialCategory = ref('全部')
const materialSearch = ref('')
const activeBuildConfigMaterialId = ref(null)
const buildConfigSuggestionsPosition = reactive({ top: 0, left: 0, width: 250, maxHeight: 220 })
const pendingBuildMaterials = ref([])
let nextPendingBuildMaterialId = 1
const materialFileInput = ref(null)
const constructionFileInput = ref(null)
const transportFileInput = ref(null)
let networkTimeTimer = null
let networkTimeRequest = null
const materialEditDrafts = reactive({})
const recyclingEditDrafts = reactive({})
const constructionEditDrafts = reactive({})
const transportEditDrafts = reactive({})
const recyclingCategories = ['金属', '保温材料', '玻璃', '其他']
const constructionEnergyTypeNames = Object.keys(constructionEnergyTypes)
const transportEnergyTypeNames = transportEnergyTypes
const transportVehicleConfigurations = computed(() => transportConfigList.toArray())
const buildMaterialCategories = ['混凝土', '金属', '砌体', '保温材料', '水泥及砂浆', '玻璃', '其他']
const analysisStages = ['建材碳排放', '运输碳排放', '施工碳排放', '回收碳排放']
const analysisColors = ['#3974ae', '#528576', '#758ca8', '#8b9ba7', '#4d8290', '#9c886b', '#727d96', '#80998c']
const analysisSelectedStage = ref(analysisStages[0])
const costAnalysisStages = ['建材', '运输', '施工']
const costAnalysisColors = ['#3974ae', '#6688aa', '#758ca8', '#528576', '#8b9ba7', '#4d8290']
const costAnalysisSelectedStage = ref(costAnalysisStages[0])
const provinces = Object.keys(chinaCities)
const cities = computed(() => chinaCities[draft.province] ?? [])

const projectId = Number(new URLSearchParams(window.location.search).get('projectId'))
const dataReady = ref(false)
const persistence = createProjectPersistence({
  projectId,
  lists: {
    'build-materials': materialList,
    'transport-records': transportMaterialList,
    'construction-records': constructionMaterialList,
    'recycling-records': recyclingMaterialList,
  },
  summaries: {
    build: buildCarbonInfo,
    transport: transportCarbonInfo,
    construction: constructionCarbonInfo,
    recycling: recyclingCarbonInfo,
  },
  onError: notify,
})
const creatingBuildMaterials = new Set()
const rowInputOwners = new WeakMap()
// Pending numeric inputs use the customer's blur-only binding. Keep their
// focused text outside reactivity until blur so a render cannot reset typing.
const pendingBuildInputDrafts = {}
let savedProjectDraft = { ...draft, accountingStages: [...draft.accountingStages] }

function hasUnsavedChanges() {
  if (persistence.pendingCount > 0) return true
  if (!dataReady.value) return false
  return hasProjectDraftChanges(draft, savedProjectDraft)
    || hasRowDraftChanges(materialEditDrafts, [...materialList.toArray(), ...pendingBuildMaterials.value])
    || hasRowDraftChanges(pendingBuildInputDrafts, pendingBuildMaterials.value)
    || hasRowDraftChanges(transportEditDrafts, transportMaterialList.toArray())
    || hasRowDraftChanges(constructionEditDrafts, constructionMaterialList.toArray())
    || hasRowDraftChanges(recyclingEditDrafts, recyclingMaterialList.toArray())
    || hasMeaningfulTemporaryRows({
      build: pendingBuildMaterials.value,
      transport: transportMaterialList.toArray(),
      construction: constructionMaterialList.toArray(),
    })
}

function onBeforeUnload(event) {
  // A focused input may not have emitted its usual blur-save yet.
  document.activeElement?.blur?.()
  protectUnsavedChanges(event, hasUnsavedChanges())
}

async function prepareToLeave() {
  document.activeElement?.blur?.()
  await persistence.waitForIdle()
  return !hasUnsavedChanges()
}

function capturePendingBuildInput(event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement) || target.type !== 'number') return
  const row = target.closest('.pending-build-material-row')
  const originalId = row?.querySelector('[data-pending-material-id]')?.dataset.pendingMaterialId
  const pending = pendingBuildMaterials.value.find(item => String(item.id) === originalId)
  if (!pending) return
  const fields = { '新建建材用量': 'quantity', '新建建材市场价': 'marketPrice', '新建建材单价': 'unitPrice' }
  const field = fields[target.getAttribute('aria-label')]
  if (field) {
    if (!pendingBuildInputDrafts[pending.id]) pendingBuildInputDrafts[pending.id] = {}
    pendingBuildInputDrafts[pending.id][field] = target.value
  }
}

function flushPendingBuildInput(id) {
  const active = document.activeElement
  const originalId = active?.closest?.('.pending-build-material-row')
    ?.querySelector('[data-pending-material-id]')?.dataset.pendingMaterialId
  if (originalId === String(id)) active.blur()
}

function flushCreatedRowInput(kind, id) {
  const active = document.activeElement
  const owner = active && rowInputOwners.get(active)
  if (owner?.kind === kind && owner.id === id) active.blur()
}

window.addEventListener('beforeunload', onBeforeUnload)
document.addEventListener('input', capturePendingBuildInput, true)
// The same-origin platform router consults this before unmounting the iframe.
window.carbonLedgerCustomer = { hasUnsavedChanges, prepareToLeave }

function reportProjectState(state, error = '') {
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'carbon-ledger-project-state', state, message: error }, window.location.origin)
  }
}

async function returnToProjects() {
  if (window.parent !== window) {
    window.parent.postMessage({ type: 'carbon-ledger-projects' }, window.location.origin)
    return
  }
  if (await prepareToLeave() || window.confirm('还有未保存的内容，确定返回我的项目吗？')) {
    window.location.assign('/projects')
  }
}

function canSave() {
  if (dataReady.value) return true
  notify('项目数据尚未加载完成，请刷新后重试')
  return false
}

async function loadProjectData() {
  if (!Number.isSafeInteger(projectId) || projectId <= 0) {
    notify('请从项目列表打开项目')
    reportProjectState('error', '项目地址无效，请返回我的项目重新打开。')
    return
  }
  try {
    const [response] = await Promise.all([
      api.get(persistence.path), loadCarbonConfigurations(), persistence.refresh(),
    ])
    saveProjectInfo(response.data)
    Object.assign(draft, ProjectInfo, { accountingStages: [...ProjectInfo.accountingStages] })
    uploadedImageUrl.value = typeof ProjectInfo.modelImage === 'string' ? ProjectInfo.modelImage : ''
    savedProjectDraft = { ...draft, accountingStages: [...draft.accountingStages] }
    dataReady.value = true
    reportProjectState('ready')
  } catch (error) {
    persistence.report(error)
    reportProjectState('error', apiMessage(error, '项目数据加载失败，请检查网络后重试。'))
  }
}

async function saveRow(kind, material, field, updates, drafts, input, target) {
  if (!canSave()) return
  const originalId = material.id
  const isTemporary = originalId < 0
  if (!drafts[originalId]) drafts[originalId] = {}
  drafts[originalId][field] = input
  const unchanged = Object.entries(updates).every(([key, value]) => {
    if (kind === 'transport-records' && key === 'factorConfigId') {
      const config = transportVehicleConfigurations.value.find(item => item.id === value)
      return config && material.vehicleName === config.vehicleName
        && material.energyType === config.energyType && material.emissionFactor === config.emissionFactor
    }
    return material[key] === value
  })
  if (!isTemporary && unchanged && persistence.pendingCount === 0) {
    persistence.clearDraft(drafts, originalId, field, input)
    return
  }
  if (isTemporary) {
    // Empty customer rows stay local until their required name is entered.
    const localUpdates = { ...updates }
    if (kind === 'transport-records' && updates.factorConfigId) {
      const config = transportVehicleConfigurations.value.find(item => item.id === updates.factorConfigId)
      Object.assign(localUpdates, {
        vehicleName: config.vehicleName, energyType: config.energyType, emissionFactor: config.emissionFactor,
      })
    }
    const list = kind === 'transport-records' ? transportMaterialList : constructionMaterialList
    list.updateById(material.id, localUpdates)
    const name = kind === 'transport-records' ? material.transportedMaterial : material.machineryName
    if (!name.trim()) {
      persistence.clearDraft(drafts, originalId, field, input)
      return
    }
  }
  const result = await persistence.enqueue(async () => {
    const id = persistence.resolveId(originalId)
    if (id > 0) return persistence.patch(kind, id, updates)
    const list = kind === 'transport-records' ? transportMaterialList : constructionMaterialList
    if (!list.toArray().some(row => row.id === id)) return false
    const payload = kind === 'transport-records'
      ? {
          factorConfigId: material.factorConfigId,
          transportedMaterial: material.transportedMaterial,
          transportQuantity: material.transportQuantity,
          transportDistance: material.transportDistance,
          transportUnitPrice: material.transportUnitPrice,
        }
      : {
          machineryName: material.machineryName, energyType: material.energyType,
          shiftCount: material.shiftCount, energyPerShift: material.energyPerShift,
          shiftUnitPrice: material.shiftUnitPrice,
        }
    const { data } = await api.post(`${persistence.path}/${kind}`, payload)
    flushCreatedRowInput(kind, originalId)
    persistence.adoptCreated(list, material, data, drafts)
    return data
  })
  if (result !== null) {
    persistence.clearDraft(drafts, originalId, field, input)
  }
}

function deleteRow(kind, material, drafts) {
  if (!canSave()) return
  return persistence.enqueue(() => persistence.remove(kind, material, drafts))
}

async function importRows(kind, event, label) {
  const file = event.target.files?.[0]
  if (!file || !canSave()) return
  const form = new FormData()
  form.append('file', file)
  let configurationRefreshFailed = false
  try {
    await persistence.enqueue(async () => {
      const { data } = await api.post(`${persistence.path}/imports/${kind}`, form)
      try {
        await loadCarbonConfigurations()
      } catch {
        configurationRefreshFailed = true
      }
      return data
    }, true, result => {
      if (result) notify(`已导入 ${result.imported} 条${label}${result.skippedRows ? `，跳过 ${result.skippedRows} 行数据` : ''}${configurationRefreshFailed ? '；配置刷新失败，请刷新页面后继续新增' : ''}`)
    })
  } finally {
    event.target.value = ''
  }
}

async function exportRows(kind, filename, label) {
  if (!canSave()) return
  if (!await prepareExport(kind)) return
  const result = await persistence.enqueue(async () => {
    await downloadApiFile(`${persistence.path}/exports/${kind}`, filename)
    return true
  }, false)
  if (result) notify(`${label}已导出`)
}

async function prepareExport(kind = null) {
  document.activeElement?.blur?.()
  await persistence.waitForIdle()
  const build = kind === null || kind === 'build-materials'
  const transport = kind === null || kind === 'transport-records'
  const construction = kind === null || kind === 'construction-records'
  const dirty = (kind === null && hasUnsavedChanges())
    || (build && hasRowDraftChanges(materialEditDrafts, [...materialList.toArray(), ...pendingBuildMaterials.value]))
    || (transport && hasRowDraftChanges(transportEditDrafts, transportMaterialList.toArray()))
    || (construction && hasRowDraftChanges(constructionEditDrafts, constructionMaterialList.toArray()))
    || hasMeaningfulTemporaryRows({
      build: build ? pendingBuildMaterials.value : [],
      transport: transport ? transportMaterialList.toArray() : [],
      construction: construction ? constructionMaterialList.toArray() : [],
    })
  if (dirty) notify('还有未保存的内容，请先完成保存或取消未完成的记录，再导出')
  return !dirty
}

function parseLimitTime(value) {
  const parts = String(value).trim().split('-')
  if (parts.length < 1 || parts.length > 6 ||
    !/^\d{4}$/.test(parts[0]) ||
    parts.slice(1).some(part => !/^\d{1,2}$/.test(part))) {
    throw new Error('LimitTime 格式应为 年-月-日-小时-分-秒')
  }
  const [yearValue, monthValue, dayValue, hourValue, minuteValue, secondValue] = parts
  const year = Number(yearValue)
  const month = monthValue === undefined ? 1 : Number(monthValue)
  const day = dayValue === undefined ? 1 : Number(dayValue)
  const hour = hourValue === undefined ? 0 : Number(hourValue)
  const minute = minuteValue === undefined ? 0 : Number(minuteValue)
  const second = secondValue === undefined ? 0 : Number(secondValue)
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(hour, minute, second, 0)
  if (year < 1 || year > 9999 || month < 1 || month > 12 ||
    day < 1 || date.getFullYear() !== year || date.getMonth() !== month - 1 ||
    date.getDate() !== day || hour < 0 || hour > 23 ||
    minute < 0 || minute > 59 || second < 0 || second > 59) {
    throw new Error('LimitTime 包含无效的日期或时间')
  }
  return date.getTime()
}

async function syncNetworkTime() {
  if (networkTimeRequest) return networkTimeRequest
  networkTimeRequest = (async () => {
    const response = await fetch('/api/health', {
      cache: 'no-store'
    })
    if (!response.ok) {
      throw new Error(`读取网络时间失败：HTTP ${response.status}`)
    }
    const result = await response.json()
    if (typeof result.time !== 'string') {
      throw new Error('网络时间服务返回了无效的 UTC 时间')
    }
    const timestamp = Date.parse(result.time)
    if (!Number.isFinite(timestamp)) {
      throw new Error('网络时间服务返回了无法解析的时间')
    }
    networkTimeNow.value = timestamp
    networkTimeAtSync.value = timestamp
    networkTimeSyncedAt.value = performance.now()
    networkTimeAvailable.value = true
  })()
  try {
    await networkTimeRequest
  } catch (error) {
    networkTimeAvailable.value = false
    throw error
  } finally {
    networkTimeRequest = null
  }
}

async function navigateToPage(page) {
  if (navigationLocked.value) {
    notify(requireNetworkTime && !networkTimeAvailable.value
      ? '无法获取网络时间，页面导航已锁定'
      : '已超过 LimitTime，页面导航已锁定')
    return
  }

  document.activeElement?.blur?.()
  activePage.value = page
  await nextTick()
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
}
function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}
const allMaterials = computed(() => materialList.toArray())
const allRecyclingMaterials = computed(() => recyclingMaterialList.toArray())
const recyclingQuantityGroups = computed(() => {
  const groups = new Map()
  const aliases = { '㎡': 'm²', m2: 'm²', 'm^2': 'm²', '平方米': 'm²', '㎥': 'm³', m3: 'm³', 'm^3': 'm³', '立方米': 'm³', '吨': 't', '千克': 'kg', '公斤': 'kg' }
  for (const material of allRecyclingMaterials.value) {
    const rawUnit = String(material.unit ?? '').trim()
    const unit = (aliases[rawUnit] ?? rawUnit) || '未标注单位'
    groups.set(unit, (groups.get(unit) ?? 0) + material.recyclingQuantity)
  }
  return [...groups].map(([unit, quantity]) => ({ unit, quantity }))
})
const allConstructionMaterials = computed(() => constructionMaterialList.toArray())
const countedConstructionMaterials = computed(() =>
  allConstructionMaterials.value.filter(material => material.id > 0 && material.machineryName.trim())
)
const allTransportMaterials = computed(() => transportMaterialList.toArray())
const countedTransportMaterials = computed(() => allTransportMaterials.value.filter(material => material.id > 0))
const filteredMaterials = computed(() => {
  const query = materialSearch.value.trim().toLocaleLowerCase()
  return allMaterials.value.filter(material => {
    const matchesCategory = materialCategory.value === '全部' || material.type === materialCategory.value
    const matchesName = !query || material.materialName.toLocaleLowerCase() === query
    return matchesCategory && matchesName
  })
})
const filteredRecyclingMaterials = computed(() => {
  const query = recyclingSearch.value.trim().toLocaleLowerCase()
  return allRecyclingMaterials.value.filter(material => {
    const matchesCategory = recyclingCategory.value === '全部回收' || material.materialType === recyclingCategory.value
    const matchesName = !query || material.materialName.toLocaleLowerCase() === query
    return matchesCategory && matchesName
  })
})
const filteredConstructionMaterials = computed(() => {
  const query = constructionSearch.value.trim().toLocaleLowerCase()
  return allConstructionMaterials.value.filter(material => {
    const matchesCategory = constructionCategory.value === '全部' || material.energyType === constructionCategory.value
    const matchesName = !query || material.machineryName.toLocaleLowerCase().includes(query)
    return matchesCategory && matchesName
  })
})
const filteredTransportMaterials = computed(() => {
  const query = transportSearch.value.trim().toLocaleLowerCase()
  return allTransportMaterials.value.filter(material => {
    const matchesCategory = transportCategory.value === '全部' || material.energyType === transportCategory.value
    const matchesName = !query ||
      material.vehicleName.toLocaleLowerCase().includes(query) ||
      material.transportedMaterial.toLocaleLowerCase().includes(query)
    return matchesCategory && matchesName
  })
})
const analysisPieItems = computed(() => {
  if (analysisSelectedStage.value === '建材碳排放') {
    return allMaterials.value.map(material => ({
      name: material.materialName,
      quantity: material.quantity,
      unit: material.unit,
      factor: material.emissionFactor,
      emission: material.emissionAmount
    }))
  }
  if (analysisSelectedStage.value === '运输碳排放') {
    return countedTransportMaterials.value.map(material => ({
      name: material.transportedMaterial,
      quantity: material.transportQuantity,
      unit: 't',
      factor: material.emissionFactor,
      emission: material.emissionAmount
    }))
  }
  if (analysisSelectedStage.value === '施工碳排放') {
    return countedConstructionMaterials.value.map(material => ({
      name: material.machineryName,
      quantity: material.shiftCount,
      unit: '台班',
      factor: material.emissionFactor,
      emission: material.emissionAmount / 1000
    }))
  }
  return allRecyclingMaterials.value.map(material => ({
    name: material.materialName,
    quantity: material.recyclingQuantity,
    unit: material.unit,
    factor: material.recyclingFactor * material.recyclingCoefficient,
    emission: material.reductionAmount
  }))
})
const analysisPieTotal = computed(() =>
  analysisPieItems.value.reduce((total, item) => total + item.emission, 0)
)
const analysisPieGradient = computed(() => {
  if (analysisPieTotal.value <= 0) return 'conic-gradient(#203957 0deg 360deg)'
  let currentAngle = 0
  const segments = analysisPieItems.value.map((item, index) => {
    const start = currentAngle
    currentAngle += item.emission / analysisPieTotal.value * 360
    return `${analysisColors[index % analysisColors.length]} ${start}deg ${currentAngle}deg`
  })
  return `conic-gradient(${segments.join(', ')})`
})
const analysisLifecycleStages = computed(() => [
  { name: '建材碳排放', emission: buildCarbonInfo.totalEmission, color: '#3974ae' },
  { name: '运输碳排放', emission: transportCarbonInfo.totalEmission, color: '#6688aa' },
  { name: '施工碳排放', emission: constructionCarbonInfo.totalEmission / 1000, color: '#8b9ba7' },
  { name: '回收碳计算', emission: -recyclingCarbonInfo.totalReduction, color: '#528576' }
])
const analysisNetEmission = computed(() =>
  analysisLifecycleStages.value.reduce((total, stage) => total + stage.emission, 0)
)
const analysisUnitAreaEmission = computed(() => {
  const area = Number(ProjectInfo.buildingArea) || 0
  return area > 0 ? analysisNetEmission.value * 1000 / area : 0
})
const analysisMaxStageEmission = computed(() =>
  Math.max(0, ...analysisLifecycleStages.value.map(stage => Math.abs(stage.emission)))
)
const analysisBuildMaterialDetails = computed(() => {
  const total = buildCarbonInfo.totalEmission
  return allMaterials.value
    .map((material, index) => ({
      ...material,
      rank: index + 1,
      share: total > 0 ? material.emissionAmount / total * 100 : 0
    }))
    .sort((left, right) => right.emissionAmount - left.emissionAmount)
})
const costAnalysisTotal = computed(() =>
  allMaterials.value.reduce((total, material) => total + material.totalPrice, 0) +
  countedTransportMaterials.value.reduce((total, material) => total + material.transportTotalPrice, 0) +
  countedConstructionMaterials.value.reduce((total, material) => total + material.totalPrice, 0)
)
const costAnalysisBuildTotal = computed(() =>
  allMaterials.value.reduce((total, material) => total + material.totalPrice, 0)
)
const costAnalysisTopBuildMaterial = computed(() =>
  allMaterials.value.reduce(
    (highest, material) => !highest || material.totalPrice > highest.totalPrice ? material : highest,
    null
  )
)
const costAnalysisArea = computed(() => {
  const area = Number(ProjectInfo.buildingArea) || 0
  return area > 0 ? costAnalysisBuildTotal.value / area : 0
})
const costAnalysisCarbonIntensity = computed(() =>
  costAnalysisTotal.value > 0 ? analysisNetEmission.value / costAnalysisTotal.value : 0
)
const costAnalysisChartItems = computed(() => {
  let items
  if (costAnalysisSelectedStage.value === '运输') {
    items = countedTransportMaterials.value.map(material => ({
      id: material.id,
      name: material.vehicleName,
      detail: material.transportedMaterial,
      cost: material.transportTotalPrice
    }))
  } else if (costAnalysisSelectedStage.value === '施工') {
    items = countedConstructionMaterials.value.map(material => ({
      id: material.id,
      name: material.machineryName,
      detail: material.energyType,
      cost: material.totalPrice
    }))
  } else {
    items = allMaterials.value.map(material => ({
      id: material.id,
      name: material.materialName,
      detail: material.type,
      cost: material.totalPrice
    }))
  }
  return items.sort((left, right) => right.cost - left.cost)
})
const costAnalysisChartMax = computed(() =>
  Math.max(...costAnalysisChartItems.value.map(item => item.cost), 0) * 1.15
)
const costAnalysisChartTicks = computed(() =>
  [1, 0.75, 0.5, 0.25, 0].map(ratio => ({
    ratio,
    value: costAnalysisChartMax.value * ratio
  }))
)
const costAnalysisBuildDetails = computed(() =>
  allMaterials.value
    .map(material => ({
      ...material,
      costShare: costAnalysisTotal.value > 0 ? material.totalPrice / costAnalysisTotal.value * 100 : 0,
      carbonCostIntensity: material.totalPrice > 0 ? material.emissionAmount * 1000 / (material.totalPrice * 10000) : null
    }))
    .sort((left, right) => right.totalPrice - left.totalPrice)
)
const indicators = [
  { name: '建材生产', description: '材料生产与加工产生的排放' },
  { name: '材料运输', description: '材料运至施工现场产生的排放' },
  { name: '施工能耗', description: '施工机械能源消耗产生的排放' },
  { name: '材料回收', description: '回收减碳量与残值估算' }
]

onMounted(async () => {
  window.LimitTime = LimitTime
  // 校时与配置读取互不阻塞：外网时间服务较慢时，界面仍可立即读取碳排因子库。
  const timeSetup = (async () => {
    try {
      parseLimitTime(LimitTime)
      await syncNetworkTime()
    } catch (error) {
      console.warn('Unable to initialize network time restriction, falling back to local time.', error)
      if (requireNetworkTime) {
        notify(error instanceof Error ? `${error.message}，暂时无法验证时间限制` : '无法验证网络时间')
      } else if (!fallbackNoticeShown) {
        fallbackNoticeShown = true
        notify('无法连接网络时间服务，已改用本机时间校验有效期')
      }
    }
  })()
  networkTimeTimer = window.setInterval(() => {
    localTimeNow.value = Date.now()
    if (networkTimeAvailable.value && networkTimeNow.value !== null) {
      networkTimeNow.value = networkTimeAtSync.value +
        performance.now() - networkTimeSyncedAt.value
    }
    // 校时失败时降低重试频率（15 秒一次），避免外网异常时反复请求并刷屏报错。
    const retryInterval = networkTimeAvailable.value ? 60_000 : 15_000
    if (performance.now() - networkTimeSyncedAt.value >= retryInterval) {
      syncNetworkTime().catch(error => {
        if (networkTimeAvailable.value) {
          console.warn('Unable to refresh the current network time.', error)
        }
      })
    }
  }, 1000)

  await Promise.all([timeSetup, loadProjectData()])
})

// 项目因子保持客户原有选择方式，由后台按项目隔离保存。
async function loadCarbonConfigurations() {
  const [build, transport] = await Promise.all([
    api.get(`${persistence.path}/build-factors`),
    api.get(`${persistence.path}/transport-factors`),
  ])
  buildConfigList.replaceAll(build.data)
  transportConfigList.replaceAll(transport.data)
}

function findBuildCarbonConfiguration(materialName) {
  const normalizedName = String(materialName ?? '').trim().toLocaleLowerCase()
  return buildConfigList.toArray().find(configuration =>
    configuration.name.trim().toLocaleLowerCase() === normalizedName
  )
}



function buildConfigSuggestions(material) {
  const draftName = materialEditDrafts[material.id]?.materialName
  const query = String(draftName ?? material.materialName).trim().toLocaleLowerCase()
  const configurations = buildConfigList.toArray()
  if (!query) return configurations
  return configurations
    .filter(configuration => configuration.name.toLocaleLowerCase().includes(query))
    .slice(0, 10)
}

function showBuildConfigSuggestions(material, event) {
  const bounds = event.currentTarget.getBoundingClientRect()
  const desiredHeight = Math.min(220, Math.max(80, buildConfigSuggestions(material).length * 36 + 8))
  const availableBelow = window.innerHeight - bounds.bottom - 8
  const availableAbove = bounds.top - 8
  const showBelow = availableBelow >= desiredHeight || availableBelow >= availableAbove
  const availableSpace = Math.max(0, showBelow ? availableBelow : availableAbove)
  const maxHeight = Math.max(80, Math.min(220, availableSpace))
  activeBuildConfigMaterialId.value = material.id
  buildConfigSuggestionsPosition.top = showBelow
    ? bounds.bottom
    : Math.max(8, bounds.top - maxHeight - 3)
  buildConfigSuggestionsPosition.width = Math.min(Math.max(bounds.width, 250), window.innerWidth - 16)
  buildConfigSuggestionsPosition.left = Math.max(
    8,
    Math.min(bounds.left, window.innerWidth - buildConfigSuggestionsPosition.width - 8)
  )
  buildConfigSuggestionsPosition.maxHeight = maxHeight
}

async function selectBuildMaterialConfiguration(material, configuration) {
  if (!canSave()) return
  const originalId = material.id
  const pending = pendingBuildMaterials.value.find(candidate => candidate.id === originalId)
  const input = configuration.name
  if (!pending && persistence.pendingCount === 0 && material.materialName === configuration.name && material.type === configuration.category
    && material.unit === configuration.materialUnit && material.emissionFactor === configuration.emissionFactor
    && material.recyclingFactor === configuration.recyclingFactor && material.recyclingCoefficient === configuration.recyclingCoefficient) {
    persistence.clearDraft(materialEditDrafts, originalId, 'materialName', input)
    activeBuildConfigMaterialId.value = null
    return
  }
  if (!materialEditDrafts[originalId]) materialEditDrafts[originalId] = {}
  materialEditDrafts[originalId].materialName = input
  activeBuildConfigMaterialId.value = null
  if (creatingBuildMaterials.has(originalId)) {
    const result = await persistence.enqueue(async () => {
      const id = persistence.resolveId(originalId)
      if (!(id > 0)) return false
      return persistence.patch('build-materials', id, { factorConfigId: configuration.id })
    })
    if (result) persistence.clearDraft(materialEditDrafts, originalId, 'materialName', input)
    return
  }
  if (pending) pending.materialName = configuration.name
  if (pending) creatingBuildMaterials.add(originalId)
  try {
    const result = await persistence.enqueue(async () => {
      if (pending) {
        if (!pendingBuildMaterials.value.includes(pending)) return false
        const { data } = await api.post(`${persistence.path}/build-materials`, {
          factorConfigId: configuration.id,
          quantity: pending.quantity,
          marketPrice: pending.marketPrice,
          unitPrice: pending.unitPrice,
        })
        flushPendingBuildInput(originalId)
        pendingBuildMaterials.value = pendingBuildMaterials.value.filter(row => row.id !== originalId)
        persistence.adoptCreated(materialList, pending, data, materialEditDrafts)
        return data
      }
      return persistence.patch('build-materials', originalId, { factorConfigId: configuration.id })
    })
    if (result) persistence.clearDraft(materialEditDrafts, originalId, 'materialName', input)
  } finally {
    if (pending) creatingBuildMaterials.delete(originalId)
  }
}

function handleBuildMaterialNameBlur(material, event) {
  const isPending = pendingBuildMaterials.value.some(candidate => candidate.id === material.id)
  const isExisting = materialList.toArray().some(candidate => candidate.id === material.id)
  if (!isPending && !isExisting) {
    activeBuildConfigMaterialId.value = null
    return
  }

  const inputValue = materialEditDrafts[material.id]?.materialName ?? event.target.value
  const configuration = findBuildCarbonConfiguration(inputValue)
  if (configuration) {
    selectBuildMaterialConfiguration(material, configuration)
    return
  }

  const pending = pendingBuildMaterials.value.find(candidate => candidate.id === material.id)
  if (pending) {
    pending.materialName = ''
    if (materialEditDrafts[material.id]) delete materialEditDrafts[material.id].materialName
  } else if (materialEditDrafts[material.id]) {
    delete materialEditDrafts[material.id].materialName
  }
  activeBuildConfigMaterialId.value = null
}

function updatePendingBuildMaterial(pending, field, event) {
  const input = event.target.value
  if (pendingBuildInputDrafts[pending.id]) delete pendingBuildInputDrafts[pending.id][field]
  let value
  if (field === 'marketPrice' && !input.trim()) {
    value = null
  } else {
    value = Number(input)
    if (!Number.isFinite(value) || (field === 'marketPrice' ? value < 0 : value <= 0)) {
      event.target.value = pending[field] ?? ''
      persistence.clearDraft(materialEditDrafts, pending.id, field, input)
      return
    }
  }
  const originalId = pending.id
  if (creatingBuildMaterials.has(originalId) || persistence.resolveId(originalId) > 0) {
    void persistence.queueDraftPatch('build-materials', pending, { [field]: value }, materialEditDrafts)
  } else {
    pending[field] = value
    persistence.clearDraft(materialEditDrafts, originalId, field, input)
  }
  event.target.value = value == null ? '' : String(value)
}

function cancelPendingBuildMaterial(pending) {
  const originalId = pending.id
  delete pendingBuildInputDrafts[originalId]
  if (creatingBuildMaterials.has(originalId)) {
    void persistence.enqueue(async () => {
      const id = persistence.resolveId(originalId)
      if (id > 0) await persistence.remove('build-materials', { id }, materialEditDrafts)
    })
  }
  pendingBuildMaterials.value = pendingBuildMaterials.value.filter(item => item.id !== pending.id)
  delete materialEditDrafts[pending.id]
  if (activeBuildConfigMaterialId.value === pending.id) {
    activeBuildConfigMaterialId.value = null
  }
}



if (typeof window !== 'undefined') {
  window.ProjectInfo = ProjectInfo
  window.BuildMaterialInfo = BuildMaterialInfo
  window.buildMaterialInfoList = materialList
  window.BuildCarbonInfo = BuildCarbonInfo
  window.buildCarbonInfo = buildCarbonInfo
  window.BuildCarbonConfigInfo = BuildCarbonConfigInfo
  window.BuildCarbonConfigInfoList = BuildCarbonConfigInfoList
  window.buildCarbonConfigInfoList = buildConfigList
  window.RecyclingMateiralInfo = RecyclingMateiralInfo
  window.RecyclingCarbonInfo = RecyclingCarbonInfo
  window.recyclingMateiralInfoList = recyclingMaterialList
  window.recyclingCarbonInfo = recyclingCarbonInfo
  window.ConstructionMaterialInfo = ConstructionMaterialInfo
  window.constructionMaterialInfoList = constructionMaterialList
  window.ConstructionCarbonInfo = ConstructionCarbonInfo
  window.constructionCarbonInfo = constructionCarbonInfo
  window.TransportMaterialInfo = TransportMaterialInfo
  window.transportMaterialInfoList = transportMaterialList
  window.TransportCarbonInfo = TransportCarbonInfo
  window.transportCarbonInfo = transportCarbonInfo
  window.TransportCarbonConfigInfo = TransportCarbonConfigInfo
  window.TransportCarbonConfigInfoList = TransportCarbonConfigInfoList
  window.transportCarbonConfigInfoList = transportConfigList
}

function formatConstructionEmission(value) {
  return formatNumber(value / 1000, 3)
}

function notify(text) {
  message.value = text
  window.setTimeout(() => {
    message.value = ''
  }, 2600)
}

function setRecyclingDraft(materialId, field, event) {
  if (!recyclingEditDrafts[materialId]) recyclingEditDrafts[materialId] = {}
  recyclingEditDrafts[materialId][field] = event.target.value
}

function setConstructionDraft(materialId, field, event) {
  rowInputOwners.set(event.target, { kind: 'construction-records', id: materialId })
  if (!constructionEditDrafts[materialId]) constructionEditDrafts[materialId] = {}
  constructionEditDrafts[materialId][field] = event.target.value
}

function setTransportDraft(materialId, field, event) {
  rowInputOwners.set(event.target, { kind: 'transport-records', id: materialId })
  if (!transportEditDrafts[materialId]) transportEditDrafts[materialId] = {}
  transportEditDrafts[materialId][field] = event.target.value
}

async function updateTransportMaterial(material, field, event) {
  const inputValue = field === 'vehicleName' ? event.target.value : transportEditDrafts[material.id]?.[field] ?? event.target.value
  let updates

  if (['transportQuantity', 'transportDistance', 'emissionFactor', 'transportUnitPrice'].includes(field)) {
    const value = Number(inputValue)
    if (!Number.isFinite(value) || value <= 0) {
      event.target.value = String(material[field])
    } else {
      updates = { [field]: value }
    }
  } else if (field === 'vehicleName') {
    const configuration = transportConfigList.findByVehicleName(inputValue)
    if (material.isCustomMaterial && configuration) {
      updates = { factorConfigId: configuration.id }
    } else {
      event.target.value = material.vehicleName
    }
  } else if (field === 'transportedMaterial') {
    const value = inputValue.trim()
    if (value) {
      updates = { [field]: value }
    } else {
      event.target.value = material[field]
    }
  }

  if (updates) {
    await saveRow('transport-records', material, field, updates, transportEditDrafts, inputValue, event.target)
  } else {
    persistence.clearDraft(transportEditDrafts, material.id, field, inputValue)
  }
}

async function updateConstructionMaterial(material, field, event) {
  const inputValue = field === 'energyType' ? event.target.value : constructionEditDrafts[material.id]?.[field] ?? event.target.value
  let updates

  if (field === 'shiftCount') {
    const value = Number(inputValue)
    if (!Number.isSafeInteger(value) || value <= 0) {
      event.target.value = String(material.shiftCount)
    } else {
      updates = { shiftCount: value }
    }
  } else if (field === 'shiftUnitPrice' || field === 'energyPerShift') {
    const value = Number(inputValue)
    if (!Number.isFinite(value) || value <= 0) {
      event.target.value = String(material[field])
    } else if (field !== 'energyPerShift' || material.isCustomMaterial) {
      updates = { [field]: value }
    } else {
      event.target.value = String(material[field])
    }
  } else if (field === 'energyType') {
    if (material.isCustomMaterial && constructionEnergyTypes[inputValue]) {
      updates = { energyType: inputValue }
    } else {
      event.target.value = material.energyType
    }
  } else if (field === 'machineryName') {
    const value = inputValue.trim()
    if (material.isCustomMaterial && value) {
      updates = { [field]: value }
    } else {
      event.target.value = material[field]
    }
  }

  if (updates) {
    await saveRow('construction-records', material, field, updates, constructionEditDrafts, inputValue, event.target)
  } else {
    persistence.clearDraft(constructionEditDrafts, material.id, field, inputValue)
  }
}

async function updateRecyclingMaterial(material, field, event) {
  const inputValue = field === 'materialType' ? event.target.value : recyclingEditDrafts[material.id]?.[field] ?? event.target.value
  let updates
  if (['recyclingQuantity', 'recyclingFactor', 'recyclingUnitPrice'].includes(field)) {
    let value = Number(inputValue)
    if (field === 'recyclingQuantity') {
      const maximum = getRecyclingQuantityLimit(material)
      if (maximum !== null && value > maximum) {
        value = maximum
        notify(`回收量不能超过对应建材用量 ${formatNumber(maximum, 2)} ${material.unit}`)
      }
    }
    if (!Number.isFinite(value) || value < 0 || (field !== 'recyclingUnitPrice' && value === 0)) {
      event.target.value = String(material[field])
    } else if (field !== 'recyclingFactor' || material.isCustomMaterial) {
      event.target.value = String(value)
      updates = { [field]: value }
    } else {
      event.target.value = String(material[field])
    }
  } else if (field === 'materialType') {
    if (material.isCustomMaterial && recyclingCategories.includes(inputValue)) {
      updates = { materialType: inputValue }
    } else {
      event.target.value = material.materialType
    }
  } else if (field === 'materialName') {
    const value = inputValue.trim()
    if (material.isCustomMaterial && value) {
      updates = { materialName: value }
    } else {
      event.target.value = material.materialName
    }
  }

  if (updates) {
    await saveRow('recycling-records', material, field, updates, recyclingEditDrafts, inputValue, event.target)
  } else {
    persistence.clearDraft(recyclingEditDrafts, material.id, field, inputValue)
  }
}

function getRecyclingQuantityLimit(recyclingMaterial) {
  const sourceMaterial = recyclingMaterial.sourceBuildMaterialId
    ? allMaterials.value.find(material => material.id === recyclingMaterial.sourceBuildMaterialId)
    : allMaterials.value.find(material => material.materialName === recyclingMaterial.materialName)
  return sourceMaterial ? sourceMaterial.quantity : null
}

async function exportProjectReport() {
  if (navigationLocked.value) {
    notify(requireNetworkTime && !networkTimeAvailable.value ? '无法获取网络时间，无法导出报告书' : '已超过 LimitTime，无法导出报告书')
    return
  }
  if (!canSave()) return
  if (!await prepareExport()) return
  const result = await persistence.enqueue(async () => {
    await downloadApiFile(`${persistence.path}/reports/current/excel`, `${ProjectInfo.projectName || '项目'}-报告书.xlsx`)
    return true
  }, false)
  if (result) notify('项目报告书已导出')
}

function handleFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    notify('请选择 PNG、JPG 或 WebP 图片')
    event.target.value = ''
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    notify('图片不能超过 10MB')
    event.target.value = ''
    return
  }
  if (uploadedImageUrl.value) URL.revokeObjectURL(uploadedImageUrl.value)
  draft.modelImage = markRaw(file)
  draft.modelImageName = file.name
  uploadedImageUrl.value = URL.createObjectURL(file)
  // Keep the File in the draft, while allowing the same image to be selected
  // again after the user removes its preview.
  event.target.value = ''
}

function removeUploadedImage() {
  if (uploadedImageUrl.value) URL.revokeObjectURL(uploadedImageUrl.value)
  draft.modelImage = null
  draft.modelImageName = ''
  uploadedImageUrl.value = ''
}

function selectProvince() {
  draft.cityDistrict = cities.value[0] ?? ''
}

function setMaterialDraft(materialId, field, event) {
  if (!materialEditDrafts[materialId]) materialEditDrafts[materialId] = {}
  materialEditDrafts[materialId][field] = event.target.value
}

async function updateMaterial(material, field, event) {
  const inputValue = materialEditDrafts[material.id]?.[field] ?? event.target.value
  const numericFields = ['quantity', 'unitPrice']
  let updates

  if (field === 'marketPrice') {
    const value = String(inputValue).trim()
    if (!value) {
      updates = { marketPrice: null }
    } else if (Number.isFinite(Number(value)) && Number(value) >= 0) {
      updates = { marketPrice: Number(value) }
    } else {
      event.target.value = material.marketPrice ?? ''
    }
  } else if (numericFields.includes(field)) {
    // 用量与成交价允许小数（例如 12.5 m³、1234.5 元），只要求大于 0。
    const value = Number(inputValue)
    if (!Number.isFinite(value) || value <= 0) {
      event.target.value = String(material[field])
    } else {
      updates = { [field]: value }
    }
  }

  if (updates) {
    await saveRow('build-materials', material, field, updates, materialEditDrafts, inputValue, event.target)
  } else {
    persistence.clearDraft(materialEditDrafts, material.id, field, inputValue)
  }
}

function formatNumber(value, maximumFractionDigits = 0) {
  return formatDisplayNumber(value, maximumFractionDigits)
}

function formatResidualValue(value) {
  return `${formatNumber(value, 4)} 万元`
}

function addMaterial() {
  if (!canSave()) return
  const pending = {
    id: `pending-build-material-${nextPendingBuildMaterialId++}`,
    materialName: '',
    quantity: 1,
    marketPrice: null,
    unitPrice: 1
  }
  activeBuildConfigMaterialId.value = null
  pendingBuildMaterials.value.push(pending)
}

function addConstructionMaterial() {
  if (!canSave()) return
  constructionSearch.value = ''
  constructionCategory.value = '全部'
  const material = new ConstructionMaterialInfo({
    machineryName: '', shiftCount: 1, energyType: '电力',
    energyPerShift: 1, shiftUnitPrice: 1, isCustomMaterial: true,
  })
  material.id = persistence.temporaryId()
  constructionMaterialList.append(material)
}

function deleteConstructionMaterial(material) {
  return deleteRow('construction-records', material, constructionEditDrafts)
}

function addTransportMaterial() {
  if (!canSave()) return
  const configuration = transportVehicleConfigurations.value[0]
  if (!configuration) {
    notify('新增失败：没有可用的车辆碳排配置')
    return
  }
  transportSearch.value = ''
  transportCategory.value = '全部'
  const material = new TransportMaterialInfo({
    vehicleName: configuration.vehicleName, transportedMaterial: '',
    transportQuantity: 1, transportDistance: 1,
    energyType: configuration.energyType, emissionFactor: configuration.emissionFactor,
    transportUnitPrice: 1, isCustomMaterial: true,
  })
  material.id = persistence.temporaryId()
  material.factorConfigId = configuration.id
  material.initialFactorConfigId = configuration.id
  transportMaterialList.append(material)
}

function deleteTransportMaterial(material) {
  return deleteRow('transport-records', material, transportEditDrafts)
}

function deleteRecyclingMaterial(material) {
  return deleteRow('recycling-records', material, recyclingEditDrafts)
}

function importConstructionMaterials(event) {
  return importRows('construction-records', event, '工程台班')
}

function exportConstructionMaterials() {
  return exportRows('construction-records', '工程台班清单.xlsx', '工程台班清单')
}

function importTransportMaterials(event) {
  return importRows('transport-records', event, '运输记录')
}

function exportTransportMaterials() {
  return exportRows('transport-records', '运输记录清单.xlsx', '运输记录清单')
}

function deleteMaterial(material) {
  return deleteRow('build-materials', material, materialEditDrafts)
}

function importMaterials(event) {
  return importRows('build-materials', event, '材料')
}

function exportMaterials() {
  return exportRows('build-materials', '建材清单.xlsx', '建材清单')
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('The selected image could not be read.'))
    }, { once: true })
    reader.addEventListener('error', () => reject(reader.error ?? new Error('The selected image could not be read.')), { once: true })
    reader.readAsDataURL(file)
  })
}

async function createProject(event) {
  if (navigationLocked.value) {
    notify(requireNetworkTime && !networkTimeAvailable.value ? '无法获取网络时间，无法保存项目信息' : '已超过 LimitTime，无法保存项目信息')
    return
  }
  if (!event.target.reportValidity() || !canSave()) return
  const submittedDraft = { ...draft, accountingStages: [...draft.accountingStages] }
  const projectInfo = { ...submittedDraft }
  const result = await persistence.enqueue(async () => {
    if (projectInfo.modelImage instanceof File) projectInfo.modelImage = await readFileAsDataUrl(projectInfo.modelImage)
    // Only send editable project fields; account/project IDs come from the URL and token.
    const payload = Object.fromEntries(Object.keys(ProjectInfo).filter(key => key !== 'accountingStages').map(key => [key, projectInfo[key]]))
    const { data } = await api.patch(persistence.path, payload)
    saveProjectInfo(data)
    savedProjectDraft = submittedDraft
    return data
  }, true, () => notify('项目信息已保存'))
  if (result) {
    await navigateToPage('建材碳排放')
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', onBeforeUnload)
  document.removeEventListener('input', capturePendingBuildInput, true)
  delete window.carbonLedgerCustomer
  if (uploadedImageUrl.value) URL.revokeObjectURL(uploadedImageUrl.value)
  if (networkTimeTimer !== null) window.clearInterval(networkTimeTimer)
})
</script>

<template>
  <div class="app-shell">
    <AppSidebar
      :active-page="activePage"
      :navigation="navigation"
      :navigation-locked="navigationLocked"
      :collapsed="sidebarCollapsed"
      @navigate="navigateToPage"
      @toggle="toggleSidebar"
      @exit="returnToProjects"
    />

    <main class="main-content" :class="{ 'main-content-expanded': sidebarCollapsed }">
      <header v-if="activePage === '项目信息'" class="top-header">
        <div class="breadcrumb"><span>{{ ProjectInfo.projectName || '当前项目' }}</span><ArrowRight class="action-icon" aria-hidden="true" /><strong>项目信息</strong></div>
        <div class="header-actions">
          <button v-if="activePage === '项目信息'" class="button button-primary" type="submit" form="project-form" :disabled="navigationLocked">
            <Check class="action-icon" aria-hidden="true" /> 保存项目信息
          </button>
        </div>
      </header>

      <header v-else-if="activePage === '建材碳排放'" class="top-header material-header">
        <div class="material-page-title">
          <button class="back-button" type="button" aria-label="返回项目信息" @click="navigateToPage('项目信息')"><ArrowLeft class="action-icon" aria-hidden="true" /></button>
          <div><h1>建材碳排放</h1><p>{{ ProjectInfo.projectName }}</p></div>
        </div>
        <div class="header-actions">
          <button class="button button-outline" type="button" @click="materialFileInput?.click()"><Upload class="action-icon" aria-hidden="true" /> 导入清单</button>
          <button class="button button-outline" type="button" @click="exportMaterials"><Download class="action-icon" aria-hidden="true" /> 导出清单</button>
          <button class="button button-primary" type="button" @click="addMaterial"><Plus class="action-icon" aria-hidden="true" /> 新增建材</button>
          <input ref="materialFileInput" class="visually-hidden" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="importMaterials" />
        </div>
      </header>

      <header v-else-if="activePage === '运输碳排放'" class="top-header material-header transport-header">
        <div class="material-page-title">
          <button class="back-button" type="button" aria-label="返回项目信息" @click="navigateToPage('项目信息')"><ArrowLeft class="action-icon" aria-hidden="true" /></button>
          <div><h1>运输碳排放</h1><p>{{ ProjectInfo.projectName }}</p></div>
        </div>
        <div class="header-actions">
          <button class="button button-outline" type="button" @click="transportFileInput?.click()"><Upload class="action-icon" aria-hidden="true" /> 导入清单</button>
          <button class="button button-outline" type="button" @click="exportTransportMaterials"><Download class="action-icon" aria-hidden="true" /> 导出清单</button>
          <button class="button button-primary" type="button" @click="addTransportMaterial"><Plus class="action-icon" aria-hidden="true" /> 新增运输记录</button>
          <input ref="transportFileInput" class="visually-hidden" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="importTransportMaterials" />
        </div>
      </header>

      <header v-else-if="activePage === '回收碳计算'" class="top-header material-header">
        <div class="material-page-title">
          <button class="back-button" type="button" aria-label="返回项目信息" @click="navigateToPage('项目信息')"><ArrowLeft class="action-icon" aria-hidden="true" /></button>
          <div><h1>回收减碳</h1><p>{{ ProjectInfo.projectName }}</p></div>
        </div>
      </header>

      <header v-else-if="activePage === '施工碳排放'" class="top-header material-header construction-header">
        <div class="material-page-title">
          <button class="back-button" type="button" aria-label="返回项目信息" @click="navigateToPage('项目信息')"><ArrowLeft class="action-icon" aria-hidden="true" /></button>
          <div><h1>施工碳排放</h1><p>{{ ProjectInfo.projectName }}</p></div>
        </div>
        <div class="header-actions">
          <button class="button button-outline" type="button" @click="constructionFileInput?.click()"><Upload class="action-icon" aria-hidden="true" /> 导入清单</button>
          <button class="button button-outline" type="button" @click="exportConstructionMaterials"><Download class="action-icon" aria-hidden="true" /> 导出清单</button>
          <button class="button button-primary" type="button" @click="addConstructionMaterial"><Plus class="action-icon" aria-hidden="true" /> 新增工程台班</button>
          <input ref="constructionFileInput" class="visually-hidden" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" @change="importConstructionMaterials" />
        </div>
      </header>

      <header v-else-if="activePage === '碳排放分析'" class="top-header material-header analysis-header">
        <div class="material-page-title">
          <button class="back-button" type="button" aria-label="返回项目信息" @click="navigateToPage('项目信息')"><ArrowLeft class="action-icon" aria-hidden="true" /></button>
          <div><h1>排放分析</h1><p>{{ ProjectInfo.projectName }}</p></div>
        </div>
        <div class="header-actions">
          <button class="button button-primary" type="button" :disabled="navigationLocked" @click="exportProjectReport"><Download class="action-icon" aria-hidden="true" /> 导出报告</button>
        </div>
      </header>

      <header v-else-if="activePage === '成本分析'" class="top-header material-header cost-analysis-header">
        <div class="material-page-title">
          <button class="back-button" type="button" aria-label="返回项目信息" @click="navigateToPage('项目信息')"><ArrowLeft class="action-icon" aria-hidden="true" /></button>
          <div><h1>成本分析</h1><p>{{ ProjectInfo.projectName }}</p></div>
        </div>
      </header>

      <DashboardHome
        v-if="activePage === '首页'"
        :project-info="ProjectInfo"
        :build-materials="allMaterials"
        :transport-materials="countedTransportMaterials"
        :construction-materials="countedConstructionMaterials"
        :recycling-materials="allRecyclingMaterials"
        :build-emission="buildCarbonInfo.totalEmission"
        :transport-emission="transportCarbonInfo.totalEmission"
        :construction-emission="constructionCarbonInfo.totalEmission / 1000"
        :recycling-emission="recyclingCarbonInfo.totalReduction"
        :net-emission="analysisNetEmission"
        @edit-project="navigateToPage('项目信息')"
      />

      <section v-else class="page-container">
        <template v-if="activePage === '项目信息'">
          <div class="page-heading">
            <div>
              <h1>项目信息</h1>
            </div>
          </div>

          <form id="project-form" class="project-layout" @submit.prevent="createProject">
            <div class="project-main-column">
              <section class="surface-card project-card basic-card">
                <div class="section-title"><h2>基本信息</h2></div>
                <div class="field-grid">
                  <label class="field full-field required">项目名称
                    <input v-model="draft.projectName" required placeholder="请输入项目名称" />
                  </label>
                  <div class="field required">
                    <label for="project-location">项目地点</label>
                    <div class="location-input">
                      <select v-model="draft.province" aria-label="省份" @change="selectProvince">
                        <option v-for="province in provinces" :key="province" :value="province">{{ province }}</option>
                      </select>
                      <select id="project-location" v-model="draft.cityDistrict" aria-label="市/区" required>
                        <option v-for="city in cities" :key="city" :value="city">{{ city }}</option>
                      </select>
                    </div>
                  </div>
                  <label class="field">详细地址
                    <input v-model="draft.address" placeholder="请输入施工地址门牌号" />
                  </label>
                  <label class="field required">建筑面积
                    <span class="input-unit"><input v-model.number="draft.buildingArea" class="area-input" required type="number" min="0.01" step="any" /><small>m²</small></span>
                  </label>
                  <label class="field">地上 / 地下层数
                    <span class="input-unit"><input v-model="draft.floorCount" type="text" /><small>层</small></span>
                  </label>
                  <fieldset class="field full-field required">
                    <legend>建筑类型</legend>
                    <div class="choice-row">
                      <label class="choice"><input v-model="draft.buildingType" type="radio" name="building-type" value="商业综合体" />商业综合体</label>
                      <label class="choice"><input v-model="draft.buildingType" type="radio" name="building-type" value="住宅" />住宅</label>
                      <label class="choice"><input v-model="draft.buildingType" type="radio" name="building-type" value="公共建筑" />公共建筑</label>
                    </div>
                  </fieldset>
                  <label class="field">结构类型
                    <select v-model="draft.structureType"><option>钢筋混凝土框架-剪力墙结构</option><option>钢结构</option><option>砖混结构</option></select>
                  </label>
                  <label class="field">设计使用年限
                    <select v-model="draft.designLife"><option>50 年</option><option>70 年</option><option>100 年</option></select>
                  </label>
                </div>
              </section>

              <section class="surface-card project-card upload-card">
                <div class="section-title"><h2>项目图片</h2></div>
                <p>用于项目概览，可选。</p>
                <label class="upload-zone">
                  <input type="file" accept="image/png,image/jpeg,image/webp" @change="handleFileChange" />
                  <Upload class="upload-icon" aria-hidden="true" />
                  <strong>{{ draft.modelImageName || '点击选择项目图片' }}</strong>
                  <small>支持 JPG、PNG、WebP，单张不超过 10MB</small>
                </label>
                <div v-if="uploadedImageUrl" class="project-image-preview">
                  <img :src="uploadedImageUrl" :alt="draft.modelImageName || '项目图片'" />
                  <button class="button button-outline" type="button" @click="removeUploadedImage">移除图片</button>
                </div>
              </section>

              <section class="surface-card project-card timeline-card">
                <div class="section-title"><h2>项目周期与负责人</h2></div>
                <div class="field-grid">
                  <label class="field">开工日期<input v-model="draft.startDate" type="date" /></label>
                  <label class="field">计划竣工日期<input v-model="draft.plannedCompletionDate" type="date" /></label>
                  <label class="field">项目负责人
                    <input v-model="draft.projectManager" placeholder="请输入项目负责人" />
                  </label>
                  <label class="field">核算标准
                    <select v-model="draft.accountingStandard"><option>GB/T 51366-2019</option></select>
                  </label>
                </div>
              </section>
            </div>

            <aside class="project-side-column">
              <section class="surface-card project-card indicator-card">
                <div class="section-title"><h2>核算范围</h2></div>
                <div v-for="indicator in indicators" :key="indicator.name" class="indicator-option">
                  <span class="indicator-copy"><strong>{{ indicator.name }}</strong><small>{{ indicator.description }}</small></span>
                </div>
              </section>

              <section class="surface-card project-card hint-card">
                <div class="section-title"><h2>填写说明</h2></div>
                <p>建筑面积用于计算单位面积指标。保存后，可填写建材、运输和施工记录。</p>
              </section>
            </aside>
          </form>
        </template>

        <template v-else-if="activePage === '运输碳排放'">
          <section class="material-stats transport-stats">
            <article class="material-stat-card"><span>运输碳排放</span><strong class="emission-stat">{{ formatNumber(transportCarbonInfo.totalEmission, 1) }}<small> tCO₂e</small></strong></article>
          </section>

          <section class="construction-energy-card transport-energy-card">
            <header class="construction-energy-heading">
              <h2>碳排放构成（按能源）</h2>
            </header>
            <div class="construction-energy-bar" role="img" :aria-label="transportEnergyTypeNames.map(energyType => `${energyType} ${formatNumber(transportCarbonInfo.energyTotals[energyType].share, 1)}%`).join('，')">
              <span
                v-for="energyType in transportEnergyTypeNames"
                :key="energyType"
                :class="`energy-segment energy-${energyType}`"
                :style="{ width: `${transportCarbonInfo.energyTotals[energyType].share}%` }"
              >{{ transportCarbonInfo.energyTotals[energyType].share >= 7 ? `${energyType} ${formatNumber(transportCarbonInfo.energyTotals[energyType].share, 1)}%` : '' }}</span>
            </div>
            <div class="transport-energy-breakdown">
              <article v-for="energyType in transportEnergyTypeNames" :key="energyType" class="construction-energy-item" :class="`energy-item-${energyType}`">
                <span class="construction-energy-marker"></span>
                <strong class="transport-energy-name">{{ energyType }}</strong>
                <strong class="construction-energy-emission">{{ formatNumber(transportCarbonInfo.energyTotals[energyType].emissionAmount, 1) }}<small> tCO₂e</small></strong>
                <strong class="transport-energy-share">{{ formatNumber(transportCarbonInfo.energyTotals[energyType].share, 1) }}%</strong>
              </article>
            </div>
          </section>

          <section class="material-toolbar transport-toolbar">
            <label class="material-search">
              <Search class="action-icon" aria-hidden="true" />
              <input v-model="transportSearch" type="search" placeholder="搜索车辆编号、运输货物..." />
            </label>
            <div class="material-filters" aria-label="按能源类型筛选">
              <button
                v-for="energyType in ['全部', ...transportEnergyTypeNames]"
                :key="energyType"
                type="button"
                :class="{ active: transportCategory === energyType }"
                @click="transportCategory = energyType"
              >{{ energyType }}</button>
            </div>
          </section>

          <section class="material-table-card transport-table-card">
            <header class="material-table-heading"><h2>运输记录清单</h2><span>{{ filteredTransportMaterials.length }} 条</span></header>
            <div class="material-table-scroll">
              <table class="material-table transport-table">
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>车辆 / 车辆编号</th>
                    <th>运输货物</th>
                    <th>运输量 (t)</th>
                    <th>运距 (km)</th>
                    <th>能源类型</th>
                    <th>碳排放因子 (kgCO₂/t·km)</th>
                    <th>碳排放量</th>
                    <th>运输单价（元）</th>
                    <th>运输总价（万元）</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="material in filteredTransportMaterials" :key="material.id">
                    <td class="material-index">{{ String(allTransportMaterials.indexOf(material) + 1).padStart(2, '0') }}</td>
                    <td class="material-name-cell">
                      <select
                        v-if="material.isCustomMaterial"
                        class="material-type-select transport-vehicle-select"
                        :value="material.vehicleName"
                        :aria-label="`${material.vehicleName}车辆名称`"
                        @change="updateTransportMaterial(material, 'vehicleName', $event)"
                      >
                        <option
                          v-for="configuration in transportVehicleConfigurations"
                          :key="configuration.vehicleName"
                          :value="configuration.vehicleName"
                        >{{ configuration.vehicleName }}</option>
                      </select>
                      <strong v-else>{{ material.vehicleName }}</strong>
                    </td>
                    <td class="transport-cargo-cell">
                      <input
                        class="material-property-input transport-property-input"
                        :value="transportEditDrafts[material.id]?.transportedMaterial ?? material.transportedMaterial"
                        :aria-label="`${material.vehicleName}运输货物`"
                        @input="setTransportDraft(material.id, 'transportedMaterial', $event)"
                        @blur="updateTransportMaterial(material, 'transportedMaterial', $event)"
                      />
                    </td>
                    <td><input class="material-edit-input transport-edit-input" type="number" min="0.01" step="any" :value="transportEditDrafts[material.id]?.transportQuantity ?? material.transportQuantity" :aria-label="`${material.vehicleName}运输量`" @input="setTransportDraft(material.id, 'transportQuantity', $event)" @blur="updateTransportMaterial(material, 'transportQuantity', $event)" /></td>
                    <td><input class="material-edit-input transport-edit-input" type="number" min="0.01" step="any" :value="transportEditDrafts[material.id]?.transportDistance ?? material.transportDistance" :aria-label="`${material.vehicleName}运输距离`" @input="setTransportDraft(material.id, 'transportDistance', $event)" @blur="updateTransportMaterial(material, 'transportDistance', $event)" /></td>
                    <td>
                      <span class="material-type" :class="`construction-type-${material.energyType}`">{{ material.energyType }}</span>
                    </td>
                    <td class="transport-factor-cell">
                      <span>{{ formatNumber(material.emissionFactor, 5) }}</span>
                    </td>
                    <td class="material-emission">{{ formatNumber(material.emissionAmount, 1) }} t</td>
                    <td><input class="material-edit-input price-input transport-edit-input" type="number" min="0.01" step="any" :value="transportEditDrafts[material.id]?.transportUnitPrice ?? material.transportUnitPrice" :aria-label="`${material.vehicleName}运输单价`" @input="setTransportDraft(material.id, 'transportUnitPrice', $event)" @blur="updateTransportMaterial(material, 'transportUnitPrice', $event)" /></td>
                    <td class="material-total">{{ formatNumber(material.transportTotalPrice, 4) }}</td>
                    <td><button class="material-delete-button" type="button" :aria-label="`删除${material.vehicleName}运输记录`" @click="deleteTransportMaterial(material)">删除</button></td>
                  </tr>
                  <tr v-if="filteredTransportMaterials.length === 0">
                    <td class="empty-materials" colspan="11">没有符合条件的运输记录</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>

        <template v-else-if="activePage === '施工碳排放'">
          <section class="material-stats construction-stats">
            <article class="material-stat-card"><span>施工碳排放</span><strong class="construction-emission-stat">{{ formatConstructionEmission(constructionCarbonInfo.totalEmission) }}<small> tCO₂e</small></strong></article>
            <article class="material-stat-card"><span>机械台班总数</span><strong>{{ formatNumber(constructionCarbonInfo.totalShiftCount) }}<small> 台班</small></strong></article>
            <article class="material-stat-card"><span>电力消耗</span><strong class="electricity-stat">{{ formatNumber(constructionCarbonInfo.energyTotals['电力'].energyTotal) }}<small> kWh</small></strong></article>
            <article class="material-stat-card"><span>柴油消耗</span><strong class="diesel-stat">{{ formatNumber(constructionCarbonInfo.energyTotals['柴油'].energyTotal) }}<small> kg</small></strong></article>
            <article class="material-stat-card"><span>汽油消耗</span><strong class="gasoline-stat">{{ formatNumber(constructionCarbonInfo.energyTotals['汽油'].energyTotal) }}<small> kg</small></strong></article>
          </section>

          <section class="construction-energy-card">
            <header class="construction-energy-heading">
              <h2>碳排放构成（按能源）</h2>
              <span>能源碳排放因子：电力 0.581 kg/kWh · 柴油 2.632 kg/kg · 汽油 2.340 kg/kg</span>
            </header>
            <div class="construction-energy-bar" role="img" :aria-label="`电力 ${formatNumber(constructionCarbonInfo.energyTotals['电力'].share, 1)}%，柴油 ${formatNumber(constructionCarbonInfo.energyTotals['柴油'].share, 1)}%，汽油 ${formatNumber(constructionCarbonInfo.energyTotals['汽油'].share, 1)}%`">
              <span
                v-for="energyType in constructionEnergyTypeNames"
                :key="energyType"
                :class="`energy-segment energy-${energyType}`"
                :style="{ width: `${constructionCarbonInfo.energyTotals[energyType].share}%` }"
              >{{ constructionCarbonInfo.energyTotals[energyType].share >= 7 ? `${energyType} ${formatNumber(constructionCarbonInfo.energyTotals[energyType].share, 1)}%` : '' }}</span>
            </div>
            <div class="construction-energy-breakdown">
              <article v-for="energyType in constructionEnergyTypeNames" :key="energyType" class="construction-energy-item" :class="`energy-item-${energyType}`">
                <span class="construction-energy-marker"></span>
                <div class="construction-energy-copy">
                  <strong>{{ energyType }}</strong>
                  <small>{{ formatNumber(constructionCarbonInfo.energyTotals[energyType].energyTotal) }} {{ constructionCarbonInfo.energyTotals[energyType].unit }} · {{ constructionCarbonInfo.energyTotals[energyType].emissionFactor.toFixed(3) }} kg/{{ constructionCarbonInfo.energyTotals[energyType].unit }}</small>
                </div>
                <strong class="construction-energy-emission">{{ formatConstructionEmission(constructionCarbonInfo.energyTotals[energyType].emissionAmount) }}<small> tCO₂e</small></strong>
              </article>
            </div>
          </section>

          <section class="material-toolbar construction-toolbar">
            <label class="material-search">
              <Search class="action-icon" aria-hidden="true" />
              <input v-model="constructionSearch" type="search" placeholder="搜索机械名称..." />
            </label>
            <div class="material-filters" aria-label="按能源类型筛选">
              <button
                v-for="energyType in ['全部', ...constructionEnergyTypeNames]"
                :key="energyType"
                type="button"
                :class="{ active: constructionCategory === energyType }"
                @click="constructionCategory = energyType"
              >{{ energyType }}</button>
            </div>
          </section>

          <section class="material-table-card construction-table-card">
            <header class="material-table-heading"><h2>工程台班清单</h2><span>{{ filteredConstructionMaterials.length }} 条</span></header>
            <div class="material-table-scroll">
              <table class="material-table construction-table">
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>机械名称</th>
                    <th>台班数</th>
                    <th>能源类型</th>
                    <th>单位台班能耗</th>
                    <th>能源总耗</th>
                    <th>碳排放因子</th>
                    <th>碳排放量</th>
                    <th>台班单价（元）</th>
                    <th>台班总价（万元）</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="material in filteredConstructionMaterials" :key="material.id">
                    <td class="material-index">{{ String(allConstructionMaterials.indexOf(material) + 1).padStart(2, '0') }}</td>
                    <td class="material-name-cell">
                      <input v-if="material.isCustomMaterial" class="material-property-input" :value="constructionEditDrafts[material.id]?.machineryName ?? material.machineryName" :aria-label="`${material.machineryName}机械名称`" @input="setConstructionDraft(material.id, 'machineryName', $event)" @blur="updateConstructionMaterial(material, 'machineryName', $event)" />
                      <strong v-else>{{ material.machineryName }}</strong>
                    </td>
                    <td><input class="material-edit-input construction-edit-input" type="number" min="1" step="1" :value="constructionEditDrafts[material.id]?.shiftCount ?? material.shiftCount" :aria-label="`${material.machineryName}台班数`" @input="setConstructionDraft(material.id, 'shiftCount', $event)" @blur="updateConstructionMaterial(material, 'shiftCount', $event)" /></td>
                    <td>
                      <select v-if="material.isCustomMaterial" class="material-type-select" :value="material.energyType" :aria-label="`${material.machineryName}能源类型`" @change="updateConstructionMaterial(material, 'energyType', $event)">
                        <option v-for="energyType in constructionEnergyTypeNames" :key="energyType" :value="energyType">{{ energyType }}</option>
                      </select>
                      <span v-else class="material-type" :class="`construction-type-${material.energyType}`">{{ material.energyType }}</span>
                    </td>
                    <td class="construction-number-cell">
                      <input v-if="material.isCustomMaterial" class="material-edit-input construction-edit-input" type="number" min="0.01" step="any" :value="constructionEditDrafts[material.id]?.energyPerShift ?? material.energyPerShift" :aria-label="`${material.machineryName}单位台班能耗`" @input="setConstructionDraft(material.id, 'energyPerShift', $event)" @blur="updateConstructionMaterial(material, 'energyPerShift', $event)" />
                      <span v-else>{{ formatNumber(material.energyPerShift, 2) }}</span>
                      <small>{{ material.energyUnit }}</small>
                    </td>
                    <td class="construction-number-cell">{{ formatNumber(material.totalEnergy, 2) }}<small>{{ material.energyUnit }}</small></td>
                    <td class="material-factor">{{ material.emissionFactor.toFixed(3) }}</td>
                    <td class="material-emission">{{ formatConstructionEmission(material.emissionAmount) }} t</td>
                    <td><input class="material-edit-input price-input construction-edit-input" type="number" min="0.01" step="any" :value="constructionEditDrafts[material.id]?.shiftUnitPrice ?? material.shiftUnitPrice" :aria-label="`${material.machineryName}台班单价`" @input="setConstructionDraft(material.id, 'shiftUnitPrice', $event)" @blur="updateConstructionMaterial(material, 'shiftUnitPrice', $event)" /></td>
                    <td class="material-total">{{ formatNumber(material.totalPrice, 4) }}</td>
                    <td><button class="material-delete-button" type="button" :aria-label="`删除${material.machineryName}`" @click="deleteConstructionMaterial(material)">删除</button></td>
                  </tr>
                  <tr v-if="filteredConstructionMaterials.length === 0">
                    <td class="empty-materials" colspan="11">没有符合条件的工程台班</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>

        <template v-else-if="activePage === '回收碳计算'">
          <section class="material-stats recycling-stats">
            <article class="material-stat-card"><span>回收减碳量</span><strong class="recycling-emission-stat">{{ formatNumber(recyclingCarbonInfo.totalReduction, 1) }}<small> tCO₂e</small></strong></article>
            <article class="material-stat-card"><span>回收量（按单位）</span><strong v-for="group in recyclingQuantityGroups" :key="group.unit">{{ formatNumber(group.quantity, 3) }}<small> {{ group.unit }}</small></strong><strong v-if="recyclingQuantityGroups.length === 0">—</strong></article>
            <article class="material-stat-card"><span>回收减碳占建材排放比</span><strong>{{ buildCarbonInfo.totalEmission > 0 ? formatNumber(recyclingCarbonInfo.recyclingUtilizationRate, 1) : '—' }}<small v-if="buildCarbonInfo.totalEmission > 0"> %</small></strong></article>
            <article class="material-stat-card"><span>回收残值估算</span><strong class="recycling-value-stat">{{ formatResidualValue(recyclingCarbonInfo.estimatedResidualValue) }}</strong></article>
          </section>

          <section class="material-toolbar recycling-toolbar">
            <label class="material-search">
              <Search class="action-icon" aria-hidden="true" />
              <input v-model="recyclingSearch" type="search" placeholder="搜索回收材料名称..." />
            </label>
            <div class="material-filters" aria-label="按回收材料类别筛选">
              <button
                v-for="category in ['全部回收', ...recyclingCategories]"
                :key="category"
                type="button"
                :class="{ active: recyclingCategory === category }"
                @click="recyclingCategory = category"
              >{{ category }}</button>
            </div>
          </section>

          <section class="material-table-card recycling-table-card">
            <header class="material-table-heading"><h2>回收材料清单</h2><span>{{ filteredRecyclingMaterials.length }} 条</span></header>
            <div class="material-table-scroll">
              <table class="material-table recycling-table">
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>回收材料</th>
                    <th>材料类别</th>
                    <th>回收量</th>
                    <th>回收因子</th>
                    <th>回收系数</th>
                    <th>回收减碳量</th>
                    <th>回收单价（元）</th>
                    <th>回收残值（万元）</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="material in filteredRecyclingMaterials" :key="material.id">
                    <td class="material-index">{{ String(allRecyclingMaterials.indexOf(material) + 1).padStart(2, '0') }}</td>
                    <td class="recycling-material-name">
                      <input
                        v-if="material.isCustomMaterial"
                        class="material-property-input recycling-name-input"
                        :value="recyclingEditDrafts[material.id]?.materialName ?? material.materialName"
                        :aria-label="`${material.materialName}材料名称`"
                        @input="setRecyclingDraft(material.id, 'materialName', $event)"
                        @blur="updateRecyclingMaterial(material, 'materialName', $event)"
                      />
                      <strong v-else>{{ material.materialName }}</strong>
                    </td>
                    <td>
                      <select
                        v-if="material.isCustomMaterial"
                        class="material-type-select"
                        :value="recyclingEditDrafts[material.id]?.materialType ?? material.materialType"
                        :aria-label="`${material.materialName}材料类别`"
                        @change="updateRecyclingMaterial(material, 'materialType', $event)"
                      >
                        <option v-for="category in recyclingCategories" :key="category" :value="category">{{ category }}</option>
                      </select>
                      <span v-else class="material-type">{{ material.materialType }}</span>
                    </td>
                    <td>
                      <div class="material-quantity-cell recycling-quantity-cell">
                        <input
                          class="material-edit-input recycling-edit-input"
                          type="number"
                          min="0.01"
                          step="any"
                          :max="getRecyclingQuantityLimit(material) ?? undefined"
                          :value="recyclingEditDrafts[material.id]?.recyclingQuantity ?? material.recyclingQuantity"
                          :aria-label="`${material.materialName}回收量`"
                          @input="setRecyclingDraft(material.id, 'recyclingQuantity', $event)"
                          @blur="updateRecyclingMaterial(material, 'recyclingQuantity', $event)"
                        />
                        <span class="material-unit">{{ material.unit }}</span>
                      </div>
                    </td>
                    <td class="material-factor">
                      <input
                        v-if="material.isCustomMaterial"
                        class="material-edit-input factor-input"
                        type="number"
                        min="0.01"
                        step="any"
                        :value="recyclingEditDrafts[material.id]?.recyclingFactor ?? material.recyclingFactor"
                        :aria-label="`${material.materialName}回收因子`"
                        @input="setRecyclingDraft(material.id, 'recyclingFactor', $event)"
                        @blur="updateRecyclingMaterial(material, 'recyclingFactor', $event)"
                      />
                      <span v-else>{{ formatNumber(material.recyclingFactor, 1) }}</span>
                      <span> kg/{{ material.unit }}</span>
                    </td>
                    <td class="material-recycling-coefficient">{{ formatNumber(material.recyclingCoefficient, 2) }}</td>
                    <td class="material-emission">{{ formatNumber(material.reductionAmount, 1) }} t</td>
                    <td>
                      <input
                        class="material-edit-input recycling-edit-input recycling-price-input"
                        type="number"
                        min="0"
                        step="any"
                        :value="recyclingEditDrafts[material.id]?.recyclingUnitPrice ?? material.recyclingUnitPrice"
                        :aria-label="`${material.materialName}回收单价`"
                        @input="setRecyclingDraft(material.id, 'recyclingUnitPrice', $event)"
                        @blur="updateRecyclingMaterial(material, 'recyclingUnitPrice', $event)"
                      />
                    </td>
                    <td class="material-total">{{ formatResidualValue(material.residualValue) }}</td>
                    <td><button class="material-delete-button" type="button" :aria-label="`删除${material.materialName}`" @click="deleteRecyclingMaterial(material)">删除</button></td>
                  </tr>
                  <tr v-if="filteredRecyclingMaterials.length === 0">
                    <td class="empty-materials" colspan="10">没有符合条件的回收材料</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>

        <template v-else-if="activePage === '建材碳排放'">
          <section class="material-stats">
            <article class="material-stat-card"><span>材料条目</span><strong>{{ materialList.count }}<small> 条</small></strong></article>
            <article class="material-stat-card"><span>碳排放总量</span><strong class="emission-stat">{{ formatNumber(buildCarbonInfo.totalEmission, 3) }}<small> tCO₂e</small></strong></article>
            <article class="material-stat-card"><span>建材总成本</span><strong>{{ formatNumber(buildCarbonInfo.totalMaterialCost, 4) }}<small> 万元</small></strong></article>
            <article class="material-stat-card"><span>单位面积碳排</span><strong>{{ formatNumber(buildCarbonInfo.emissionPerArea, 1) }}<small> kg/m²</small></strong></article>
          </section>

          <section class="material-toolbar">
            <label class="material-search">
              <Search class="action-icon" aria-hidden="true" />
              <input v-model="materialSearch" type="search" placeholder="搜索建材名称（完整名称匹配）..." />
            </label>
            <a class="guidance-price-link" href="https://www.zjzj.net/" target="_blank" rel="noopener noreferrer">指导价格</a>
            <div class="material-filters build-material-filters" aria-label="按材料类型筛选">
              <button
                v-for="category in ['全部', ...buildMaterialCategories]"
                :key="category"
                type="button"
                :class="{ active: materialCategory === category }"
                @click="materialCategory = category"
              >{{ category === '全部' ? '全部' : category }}</button>
            </div>
          </section>

          <section class="material-table-card">
            <header class="material-table-heading">
              <h2>材料清单</h2>
              <span>{{ filteredMaterials.length }} 条</span>
            </header>
            <div class="material-table-scroll">
              <table class="material-table build-material-table">
                <thead>
                  <tr>
                    <th>序号</th>
                    <th>材料名称</th>
                    <th>类型</th>
                    <th>用量</th>
                    <th>碳排放因子</th>
                    <th>碳排放量</th>
                    <th>市场价（元）</th>
                    <th>成交价（元）</th>
                    <th>总价（万元）</th>
                    <th>回收因子</th>
                    <th>回收系数</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="material in filteredMaterials" :key="material.id">
                    <td class="material-index">{{ String(allMaterials.indexOf(material) + 1).padStart(2, '0') }}</td>
                    <td class="material-name-cell">
                      <div v-if="material.isCustomMaterial" class="build-config-combobox">
                        <input
                          class="material-property-input material-name-input"
                          type="text"
                          role="combobox"
                          aria-autocomplete="list"
                          :aria-expanded="activeBuildConfigMaterialId === material.id && buildConfigSuggestions(material).length > 0"
                          :aria-label="`${material.materialName || '新建建材'}名称`"
                          :value="materialEditDrafts[material.id]?.materialName ?? material.materialName"
                          @focus="showBuildConfigSuggestions(material, $event)"
                          @blur="handleBuildMaterialNameBlur(material, $event)"
                          @input="setMaterialDraft(material.id, 'materialName', $event); showBuildConfigSuggestions(material, $event)"
                          @keydown.esc="activeBuildConfigMaterialId = null"
                        />
                        <Teleport to="body">
                        <ul
                          v-if="activeBuildConfigMaterialId === material.id && buildConfigSuggestions(material).length"
                          class="build-config-suggestions"
                          role="listbox"
                          :style="{
                            top: `${buildConfigSuggestionsPosition.top}px`,
                            left: `${buildConfigSuggestionsPosition.left}px`,
                            width: `${buildConfigSuggestionsPosition.width}px`,
                            maxHeight: `${buildConfigSuggestionsPosition.maxHeight}px`
                          }"
                        >
                          <li v-for="configuration in buildConfigSuggestions(material)" :key="`${configuration.category}:${configuration.name}`" role="option">
                            <button
                              type="button"
                              @mousedown.prevent
                              @click="selectBuildMaterialConfiguration(material, configuration)"
                            >
                              <span>{{ configuration.name }}</span>
                              <small>{{ configuration.category }} · {{ configuration.materialUnit }}</small>
                            </button>
                          </li>
                        </ul>
                        </Teleport>
                      </div>
                      <strong v-else>{{ material.materialName }}</strong>
                    </td>
                    <td>
                      <span class="material-type">{{ material.type }}</span>
                    </td>
                    <td>
                      <div class="material-quantity-cell">
                        <input class="material-edit-input" type="number" min="0.01" step="any" :value="materialEditDrafts[material.id]?.quantity ?? material.quantity" :aria-label="`${material.materialName}用量`" @input="setMaterialDraft(material.id, 'quantity', $event)" @blur="updateMaterial(material, 'quantity', $event)" />
                        <span class="material-unit">{{ material.unit }}</span>
                      </div>
                    </td>
                    <td class="material-factor">
                      <span>{{ material.emissionFactor > 0 ? formatNumber(material.emissionFactor, 2) : '-' }}</span>
                      <span> kg/{{ material.unit }}</span>
                    </td>
                    <td class="material-emission">{{ formatNumber(material.emissionAmount, 2) }} t</td>
                    <td><input class="material-edit-input market-price-input" type="number" min="0" step="any" :value="materialEditDrafts[material.id]?.marketPrice ?? material.marketPrice ?? ''" :aria-label="`${material.materialName}市场价`" @input="setMaterialDraft(material.id, 'marketPrice', $event)" @blur="updateMaterial(material, 'marketPrice', $event)" /></td>
                    <td><input class="material-edit-input price-input" type="number" min="0.01" step="any" :value="materialEditDrafts[material.id]?.unitPrice ?? material.unitPrice" :aria-label="`${material.materialName}成交价`" @input="setMaterialDraft(material.id, 'unitPrice', $event)" @blur="updateMaterial(material, 'unitPrice', $event)" /></td>
                    <td class="material-total">{{ formatNumber(material.totalPrice, 4) }}</td>
                    <td class="material-recycling-factor">
                      {{ material.recyclingFactor === 0 ? '-' : formatNumber(material.recyclingFactor, 2) }}
                    </td>
                    <td class="material-recycling-coefficient">
                      {{ material.recyclingFactor === 0 && material.recyclingCoefficient === 0 ? '-' : formatNumber(material.recyclingCoefficient, 2) }}
                    </td>
                    <td><button class="material-delete-button" type="button" :aria-label="`删除${material.materialName}`" @click="deleteMaterial(material)">删除</button></td>
                  </tr>
                  <tr v-for="pending in pendingBuildMaterials" :key="pending.id" class="pending-build-material-row">
                    <td class="material-index">新建</td>
                    <td class="material-name-cell">
                      <div class="build-config-combobox">
                        <input
                          class="material-property-input material-name-input"
                          type="text"
                          role="combobox"
                          aria-autocomplete="list"
                          :aria-expanded="activeBuildConfigMaterialId === pending.id && buildConfigSuggestions(pending).length > 0"
                          :data-pending-material-id="pending.id"
                          aria-label="新建建材名称"
                          :value="materialEditDrafts[pending.id]?.materialName ?? pending.materialName"
                          @focus="showBuildConfigSuggestions(pending, $event)"
                          @blur="handleBuildMaterialNameBlur(pending, $event)"
                          @input="setMaterialDraft(pending.id, 'materialName', $event); showBuildConfigSuggestions(pending, $event)"
                          @keydown.esc="activeBuildConfigMaterialId = null"
                        />
                        <Teleport to="body">
                          <ul
                            v-if="activeBuildConfigMaterialId === pending.id && buildConfigSuggestions(pending).length"
                            class="build-config-suggestions"
                            role="listbox"
                            :style="{
                              top: `${buildConfigSuggestionsPosition.top}px`,
                              left: `${buildConfigSuggestionsPosition.left}px`,
                              width: `${buildConfigSuggestionsPosition.width}px`,
                              maxHeight: `${buildConfigSuggestionsPosition.maxHeight}px`
                            }"
                          >
                            <li v-for="configuration in buildConfigSuggestions(pending)" :key="`${configuration.category}:${configuration.name}`" role="option">
                              <button
                                type="button"
                                @mousedown.prevent
                                @click="selectBuildMaterialConfiguration(pending, configuration)"
                              >
                                <span>{{ configuration.name }}</span>
                                <small>{{ configuration.category }} · {{ configuration.materialUnit }}</small>
                              </button>
                            </li>
                          </ul>
                        </Teleport>
                      </div>
                    </td>
                    <td>-</td>
                    <td>
                      <div class="material-quantity-cell">
                        <input class="material-edit-input" type="number" min="0.01" step="any" :value="pending.quantity" aria-label="新建建材用量" @blur="updatePendingBuildMaterial(pending, 'quantity', $event)" />
                        <span class="material-unit">-</span>
                      </div>
                    </td>
                    <td class="material-factor">-</td>
                    <td class="material-emission">-</td>
                    <td><input class="material-edit-input market-price-input" type="number" min="0" step="any" :value="pending.marketPrice ?? ''" aria-label="新建建材市场价" @blur="updatePendingBuildMaterial(pending, 'marketPrice', $event)" /></td>
                    <td><input class="material-edit-input price-input" type="number" min="0.01" step="any" :value="pending.unitPrice" aria-label="新建建材单价" @blur="updatePendingBuildMaterial(pending, 'unitPrice', $event)" /></td>
                    <td class="material-total">-</td>
                    <td class="material-recycling-factor">-</td>
                    <td class="material-recycling-coefficient">-</td>
                    <td><button class="material-delete-button" type="button" aria-label="取消新建建材" @click="cancelPendingBuildMaterial(pending)">取消</button></td>
                  </tr>
                  <tr v-if="filteredMaterials.length === 0 && pendingBuildMaterials.length === 0">
                    <td class="empty-materials" colspan="12">没有符合条件的材料</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>

        <template v-else-if="activePage === '碳排放分析'">
          <div class="analysis-summary-grid">
            <section class="analysis-metric-card">
              <div><span>单位建筑面积净碳排放</span><strong>{{ formatNumber(analysisUnitAreaEmission, 2) }} <small>kgCO₂e/m²</small></strong></div>
            </section>
            <section class="analysis-metric-card net-emission-card">
              <div><span>净碳排放</span><strong>{{ formatNumber(analysisNetEmission, 3) }} <small>tCO₂e</small></strong></div>
            </section>
          </div>

          <div class="analysis-main-grid">
            <section class="surface-card analysis-card analysis-breakdown-card">
              <header class="analysis-card-heading">
                <div><h2>排放构成</h2><p>选择阶段，查看各条记录的贡献。</p></div>
                <select v-model="analysisSelectedStage" aria-label="选择碳排放阶段">
                  <option v-for="stage in analysisStages" :key="stage" :value="stage">{{ stage === '回收碳排放' ? '回收减碳' : stage }}</option>
                </select>
              </header>
              <div class="analysis-pie-layout">
                <div class="analysis-donut" :style="{ backgroundImage: analysisPieGradient }" role="img" :aria-label="`${analysisSelectedStage === '回收碳计算' ? '回收减碳，总减碳量' : `${analysisSelectedStage}，总排放`}${formatNumber(analysisPieTotal, 3)}吨`">
                  <div class="analysis-donut-center"><strong>{{ formatNumber(analysisPieTotal, 3) }}</strong><span>tCO₂e</span></div>
                </div>
                <div class="analysis-legend">
                  <div v-for="(item, index) in analysisPieItems" :key="`${item.name}-${index}`" class="analysis-legend-item">
                    <i :style="{ backgroundColor: analysisColors[index % analysisColors.length] }"></i>
                    <span>{{ item.name }}</span>
                    <strong>{{ formatNumber(analysisPieTotal > 0 ? item.emission / analysisPieTotal * 100 : 0, 1) }}%</strong>
                  </div>
                  <p v-if="analysisPieItems.length === 0" class="analysis-empty">当前阶段暂无排放记录</p>
                </div>
              </div>
              <div class="analysis-pie-table-scroll">
                <table class="analysis-compact-table">
                  <thead><tr><th>材料 / 设备</th><th>用量</th><th>{{ analysisSelectedStage === '回收碳计算' ? '回收因子' : '碳排放因子' }}</th><th>{{ analysisSelectedStage === '回收碳计算' ? '减碳量 (t)' : '排放量 (t)' }}</th></tr></thead>
                  <tbody>
                    <tr v-for="(item, index) in analysisPieItems" :key="`detail-${item.name}-${index}`">
                      <td><i :style="{ backgroundColor: analysisColors[index % analysisColors.length] }"></i>{{ item.name }}</td>
                      <td>{{ formatNumber(item.quantity, 2) }} {{ item.unit }}</td>
                      <td>{{ formatNumber(item.factor, 3) }}</td>
                      <td>{{ formatNumber(item.emission, 3) }}</td>
                    </tr>
                    <tr v-if="analysisPieItems.length === 0"><td class="analysis-empty-cell" colspan="4">暂无数据</td></tr>
                  </tbody>
                </table>
              </div>
            </section>

            <section class="surface-card analysis-card analysis-lifecycle-card">
              <header class="analysis-card-heading">
                <div><h2>各阶段排放与回收减碳</h2><p>净排放已扣除回收减碳量。</p></div>
              </header>
              <div class="analysis-stage-list">
                <article v-for="stage in analysisLifecycleStages" :key="stage.name" class="analysis-stage-row">
                  <div class="analysis-stage-label"><span><i :style="{ backgroundColor: stage.color }"></i>{{ stage.name === '回收碳计算' ? '回收减碳' : stage.name }}</span><strong :class="{ 'analysis-reduction-value': stage.emission < 0 }">{{ formatNumber(stage.emission, 3) }} <small>tCO₂e</small></strong></div>
                  <div class="analysis-stage-track"><span :style="{ width: `${analysisMaxStageEmission > 0 ? Math.abs(stage.emission) / analysisMaxStageEmission * 100 : 0}%`, backgroundColor: stage.color }"></span></div>
                </article>
              </div>
              <div class="analysis-net-total"><span>净碳排放总量</span><strong>{{ formatNumber(analysisNetEmission, 3) }} <small>tCO₂e</small></strong></div>
              <p class="analysis-formula">建材 + 运输 + 施工 − 回收减碳量</p>
            </section>
          </div>

          <section class="surface-card analysis-card analysis-material-details">
            <header class="analysis-card-heading">
              <div><h2>建材排放明细</h2><p>共 {{ analysisBuildMaterialDetails.length }} 条记录</p></div>
              <strong class="analysis-detail-total">{{ formatNumber(buildCarbonInfo.totalEmission, 3) }} <small>tCO₂e</small></strong>
            </header>
            <div class="analysis-details-scroll">
              <table class="analysis-detail-table">
                <thead><tr><th>排名</th><th>材料名称</th><th>材料类型</th><th>用量</th><th>碳排放因子 (kgCO₂e/单位)</th><th>碳排放量 (tCO₂e)</th><th>占比</th></tr></thead>
                <tbody>
                  <tr v-for="(material, index) in analysisBuildMaterialDetails" :key="material.id">
                    <td><span class="analysis-rank" :class="{ 'top-rank': index < 3 }">{{ String(index + 1).padStart(2, '0') }}</span></td>
                    <td class="analysis-detail-name">{{ material.materialName }}</td>
                    <td>{{ material.type }}</td>
                    <td>{{ formatNumber(material.quantity, 2) }} {{ material.unit }}</td>
                    <td>{{ formatNumber(material.emissionFactor, 3) }}</td>
                    <td class="analysis-detail-emission">{{ formatNumber(material.emissionAmount, 3) }}</td>
                    <td><div class="analysis-share-cell"><span>{{ formatNumber(material.share, 1) }}%</span><i><b :style="{ width: `${material.share}%` }"></b></i></div></td>
                  </tr>
                  <tr v-if="analysisBuildMaterialDetails.length === 0"><td class="analysis-empty-cell" colspan="7">暂无建材碳排放记录</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>

        <template v-else-if="activePage === '成本分析'">
          <div class="cost-analysis-summary">
            <section class="cost-metric-card">
              <span>总成本（建材＋运输＋施工）</span>
              <strong>{{ formatNumber(costAnalysisTotal, 4) }} <small>万元</small></strong>
            </section>
            <section class="cost-metric-card cost-top-material-card">
              <span>成本最高建材（占建材成本）</span>
              <strong>{{ costAnalysisTopBuildMaterial?.materialName || '暂无' }} <small>{{ formatNumber(costAnalysisBuildTotal > 0 && costAnalysisTopBuildMaterial ? costAnalysisTopBuildMaterial.totalPrice / costAnalysisBuildTotal * 100 : 0, 1) }}%</small></strong>
            </section>
            <section class="cost-metric-card">
              <span>单位面积建材成本</span>
              <strong>{{ formatNumber(costAnalysisArea, 4) }} <small>万元/㎡</small></strong>
            </section>
            <section class="cost-metric-card">
              <span>单位成本碳排放</span>
              <strong>{{ formatNumber(costAnalysisCarbonIntensity, 3) }} <small>t/万元</small></strong>
            </section>
          </div>

          <section class="surface-card cost-chart-card">
            <header class="cost-chart-heading">
              <div><h2>{{ costAnalysisSelectedStage }}总价对比</h2><p>按各项总价计算（单位：万元）</p></div>
              <div class="cost-chart-tabs" aria-label="选择成本对比阶段">
                <button
                  v-for="stage in costAnalysisStages"
                  :key="stage"
                  type="button"
                  :class="{ active: costAnalysisSelectedStage === stage }"
                  @click="costAnalysisSelectedStage = stage"
                >{{ stage }}</button>
              </div>
            </header>
            <div class="cost-chart-layout" role="img" :aria-label="`${costAnalysisSelectedStage}成本对比图，单位万元`">
              <div class="cost-chart-y-axis">
                <span v-for="tick in costAnalysisChartTicks" :key="tick.ratio">{{ formatNumber(tick.value, costAnalysisChartMax < 1 ? 4 : costAnalysisChartMax < 10 ? 2 : 1) }}</span>
              </div>
              <div class="cost-chart-scroll">
                <div class="cost-chart-plot">
                  <div v-for="tick in costAnalysisChartTicks" :key="`line-${tick.ratio}`" class="cost-chart-gridline" :style="{ top: `${(1 - tick.ratio) * 86.67}%` }"></div>
                  <div class="cost-chart-columns">
                    <article v-for="(item, index) in costAnalysisChartItems" :key="item.id" class="cost-chart-column" :title="`${item.name}：${formatNumber(item.cost, 4)} 万元`">
                      <span class="cost-chart-value" :style="{ bottom: `${44 + (costAnalysisChartMax > 0 ? item.cost / costAnalysisChartMax * 260 : 0)}px` }">{{ formatNumber(item.cost, costAnalysisChartMax < 1 ? 4 : costAnalysisChartMax < 10 ? 2 : 1) }}</span>
                      <div class="cost-chart-bar-wrap"><i :style="{ height: `${costAnalysisChartMax > 0 ? item.cost / costAnalysisChartMax * 100 : 0}%`, backgroundColor: costAnalysisColors[index % costAnalysisColors.length] }"></i></div>
                      <strong>{{ item.name }}</strong>
                    </article>
                    <p v-if="costAnalysisChartItems.length === 0" class="cost-chart-empty">当前阶段暂无成本记录</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section class="surface-card cost-detail-card">
            <header class="cost-detail-heading">
              <div><h2>建材成本明细</h2><p>共 {{ costAnalysisBuildDetails.length }} 条记录</p></div>
              <strong>{{ formatNumber(costAnalysisBuildDetails.reduce((total, material) => total + material.totalPrice, 0), 4) }} 万元</strong>
            </header>
            <div class="cost-detail-scroll">
              <table class="cost-detail-table">
                <thead><tr><th>材料名称</th><th>用量</th><th>单价（元）</th><th>总价（万元）</th><th>占总成本</th><th>成本碳强度</th></tr></thead>
                <tbody>
                  <tr v-for="material in costAnalysisBuildDetails" :key="material.id">
                    <td class="cost-material-name">{{ material.materialName }}</td>
                    <td>{{ formatNumber(material.quantity, 2) }} {{ material.unit }}</td>
                    <td>¥{{ formatNumber(material.unitPrice, 2) }}</td>
                    <td class="cost-detail-total">{{ formatNumber(material.totalPrice, 4) }}</td>
                    <td>{{ formatNumber(material.costShare, 1) }}%</td>
                    <td>{{ material.carbonCostIntensity === null ? '-' : `${formatNumber(material.carbonCostIntensity, 3)} kg/元` }}</td>
                  </tr>
                  <tr v-if="costAnalysisBuildDetails.length === 0"><td class="cost-detail-empty" colspan="6">暂无建材成本记录</td></tr>
                </tbody>
              </table>
            </div>
          </section>
        </template>

        <section v-else class="surface-card placeholder-card">
          <div class="placeholder-icon">▦</div>
          <h1>{{ activePage }}</h1>
          <p>请先保存项目信息，再开始管理{{ activePage }}相关数据。</p>
          <button class="button button-primary" type="button" @click="navigateToPage('项目信息')">前往项目信息</button>
        </section>
      </section>

      <div v-if="message" class="toast" role="status">{{ message }}</div>
    </main>
  </div>
</template>
