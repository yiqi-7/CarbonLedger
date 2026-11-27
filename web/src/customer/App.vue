<script setup>
import { computed, nextTick, reactive, ref } from 'vue'
import { ArrowLeft, ArrowRight, Check, Download, Plus, Search, Upload } from '@element-plus/icons-vue'
import { useCustomerRuntime } from './composables/useCustomerRuntime.js'
import { useAnalysisViewModel } from './composables/useAnalysisViewModel.js'
import { useCostAnalysisViewModel } from './composables/useCostAnalysisViewModel.js'
import { useProjectImportExport } from './composables/useProjectImportExport.js'
import { useProjectInfoEditor } from './composables/useProjectInfoEditor.js'
import { useCustomerRecordPersistence } from './composables/useCustomerRecordPersistence.js'
import { useCustomerRecordFields } from './composables/useCustomerRecordFields.js'
import { useCustomerFactorConfiguration } from './composables/useCustomerFactorConfiguration.js'
import { useRecordFilters } from './composables/useRecordFilters.js'
import { createProjectPersistence } from './apiPersistence.js'
import { createProjectApi } from './apiProjectFacade.js'
import { formatDisplayNumber } from './formatDisplayNumber.js'
import AppSidebar from './components/AppSidebar.vue'
import DashboardHome from './components/DashboardHome.vue'
import chinaCities from '@/data/chinaCities.json'
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
const analysisColors = ['#0071E3', '#86868B', '#6E6E73', '#34C759', '#A1A1A6', '#5E5E63', '#C7C7CC', '#424245']
const analysisSelectedStage = ref(analysisStages[0])
const costAnalysisStages = ['建材', '运输', '施工']
const costAnalysisColors = ['#0071E3', '#86868B', '#6E6E73', '#34C759', '#A1A1A6', '#5E5E63']
const costAnalysisSelectedStage = ref(costAnalysisStages[0])
const provinces = Object.keys(chinaCities)
const cities = computed(() => chinaCities[draft.province] ?? [])

const projectId = Number(new URLSearchParams(window.location.search).get('projectId'))
const projectApi = createProjectApi({ projectId })
const dataReady = ref(false)
const persistence = createProjectPersistence({
  projectApi,
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
// Pending numeric inputs use the customer's blur-only binding. Keep their
// focused text outside reactivity until blur so a render cannot reset typing.
const pendingBuildInputDrafts = {}
let savedProjectDraft = { ...draft, accountingStages: [...draft.accountingStages] }

const runtime = useCustomerRuntime({
  projectId,
  projectApi,
  persistence,
  draft,
  dataReady,
  uploadedImageUrl,
  ProjectInfo,
  saveProjectInfo,
  getSavedProjectDraft: () => savedProjectDraft,
  setSavedProjectDraft: value => { savedProjectDraft = value },
  pendingBuildMaterials,
  pendingBuildInputDrafts,
  materialList,
  transportMaterialList,
  constructionMaterialList,
  recyclingMaterialList,
  materialEditDrafts,
  transportEditDrafts,
  constructionEditDrafts,
  recyclingEditDrafts,
  notify,
  loadCarbonConfigurations,
})
const { hasUnsavedChanges, prepareToLeave, returnToProjects } = runtime
const projectImportExport = useProjectImportExport({
  projectApi,
  persistence,
  canSave,
  notify,
  loadCarbonConfigurations,
  hasUnsavedChanges,
  materialEditDrafts,
  transportEditDrafts,
  constructionEditDrafts,
  materialList,
  transportMaterialList,
  constructionMaterialList,
  pendingBuildMaterials,
  getProjectName: () => ProjectInfo.projectName,
  documentRef: document,
})
const { importRows, exportRows, prepareExport, exportProjectReport } = projectImportExport
const projectInfoEditor = useProjectInfoEditor({
  draft,
  uploadedImageUrl,
  ProjectInfo,
  projectApi,
  persistence,
  canSave,
  notify,
  saveProjectInfo,
  getSavedProjectDraft: () => savedProjectDraft,
  setSavedProjectDraft: value => { savedProjectDraft = value },
  FileCtor: File,
  URLRef: URL,
})
const { handleFileChange, removeUploadedImage, readFileAsDataUrl, saveProjectChanges } = projectInfoEditor
const recordPersistence = useCustomerRecordPersistence({
  projectApi,
  persistence,
  canSave,
  transportVehicleConfigurations,
  transportMaterialList,
  constructionMaterialList,
  documentRef: document,
})
const { registerRowInputOwner, saveRow, deleteRow } = recordPersistence
const recordFields = useCustomerRecordFields({
  materialEditDrafts,
  transportEditDrafts,
  constructionEditDrafts,
  recyclingEditDrafts,
  registerRowInputOwner,
  saveRow,
  persistence,
  transportConfigList,
  constructionEnergyTypes,
  recyclingCategories,
  notify,
  formatNumber,
  getRecyclingQuantityLimit,
})
const {
  setMaterialDraft,
  updateMaterial,
  setTransportDraft,
  updateTransportMaterial,
  setConstructionDraft,
  updateConstructionMaterial,
  setRecyclingDraft,
  updateRecyclingMaterial,
} = recordFields

function canSave() {
  if (dataReady.value) return true
  notify('项目数据尚未加载完成，请刷新后重试')
  return false
}

async function navigateToPage(page) {
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
const allConstructionMaterials = computed(() => constructionMaterialList.toArray())
const countedConstructionMaterials = computed(() =>
  allConstructionMaterials.value.filter(material => material.id > 0 && material.machineryName.trim())
)
const allTransportMaterials = computed(() => transportMaterialList.toArray())
const countedTransportMaterials = computed(() => allTransportMaterials.value.filter(material => material.id > 0))
const {
  recyclingQuantityGroups,
  filteredMaterials,
  filteredRecyclingMaterials,
  filteredConstructionMaterials,
  filteredTransportMaterials,
} = useRecordFilters({
  allMaterials,
  allRecyclingMaterials,
  allConstructionMaterials,
  allTransportMaterials,
  materialCategory,
  materialSearch,
  recyclingCategory,
  recyclingSearch,
  constructionCategory,
  constructionSearch,
  transportCategory,
  transportSearch,
})
const {
  analysisPieItems,
  analysisPieTotal,
  analysisPieGradient,
  analysisLifecycleStages,
  analysisNetEmission,
  analysisUnitAreaEmission,
  analysisMaxStageEmission,
  analysisBuildMaterialDetails
} = useAnalysisViewModel({
  analysisSelectedStage,
  analysisColors,
  allMaterials,
  countedTransportMaterials,
  countedConstructionMaterials,
  allRecyclingMaterials,
  buildCarbonInfo,
  transportCarbonInfo,
  constructionCarbonInfo,
  recyclingCarbonInfo,
  ProjectInfo
})
const {
  costAnalysisTotal,
  costAnalysisBuildTotal,
  costAnalysisTopBuildMaterial,
  costAnalysisArea,
  costAnalysisCarbonIntensity,
  costAnalysisChartItems,
  costAnalysisChartMax,
  costAnalysisChartTicks,
  costAnalysisBuildDetails
} = useCostAnalysisViewModel({
  costAnalysisSelectedStage,
  allMaterials,
  countedTransportMaterials,
  countedConstructionMaterials,
  analysisNetEmission,
  ProjectInfo
})
const indicators = [
  { name: '建材生产', description: '材料生产与加工产生的排放' },
  { name: '材料运输', description: '材料运至施工现场产生的排放' },
  { name: '施工能耗', description: '施工机械能源消耗产生的排放' },
  { name: '材料回收', description: '回收减碳量与残值估算' }
]

// 项目因子保持客户原有选择方式，由后台按项目隔离保存。
async function loadCarbonConfigurations() {
  const [build, transport] = await projectApi.getFactorConfigurations()
  buildConfigList.replaceAll(build.data)
  transportConfigList.replaceAll(transport.data)
}

const factorConfiguration = useCustomerFactorConfiguration({
  buildConfigList,
  materialList,
  materialEditDrafts,
  pendingBuildMaterials,
  pendingBuildInputDrafts,
  activeBuildConfigMaterialId,
  buildConfigSuggestionsPosition,
  projectApi,
  persistence,
  canSave,
  notify,
  format: formatNumber,
  creatingBuildMaterials,
  documentRef: document,
  windowRef: window,
})
const {
  findBuildCarbonConfiguration,
  buildConfigSuggestions,
  updateBuildConfigSuggestionsPosition,
  showBuildConfigSuggestions,
  selectBuildMaterialConfiguration,
  handleBuildMaterialNameBlur,
  updatePendingBuildMaterial,
  cancelPendingBuildMaterial,
  flushPendingBuildInput,
} = factorConfiguration



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

function getRecyclingQuantityLimit(recyclingMaterial) {
  const sourceMaterial = recyclingMaterial.sourceBuildMaterialId
    ? allMaterials.value.find(material => material.id === recyclingMaterial.sourceBuildMaterialId)
    : allMaterials.value.find(material => material.materialName === recyclingMaterial.materialName)
  return sourceMaterial ? sourceMaterial.quantity : null
}

function selectProvince() {
  draft.cityDistrict = cities.value[0] ?? ''
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

async function createProject(event) {
  const result = await saveProjectChanges(event)
  if (result) await navigateToPage('建材碳排放')
}

</script>

<template>
  <div class="app-shell">
    <AppSidebar
      :active-page="activePage"
      :navigation="navigation"
      :collapsed="sidebarCollapsed"
      @navigate="navigateToPage"
      @toggle="toggleSidebar"
      @exit="returnToProjects"
    />

    <main class="main-content" :class="{ 'main-content-expanded': sidebarCollapsed }">
      <header v-if="activePage === '项目信息'" class="top-header">
        <div class="breadcrumb"><span>{{ ProjectInfo.projectName || '当前项目' }}</span><ArrowRight class="action-icon" aria-hidden="true" /><strong>项目信息</strong></div>
        <div class="header-actions">
          <button v-if="activePage === '项目信息'" class="button button-primary" type="submit" form="project-form">
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
          <button class="button button-primary" type="button" @click="exportProjectReport"><Download class="action-icon" aria-hidden="true" /> 导出报告</button>
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
