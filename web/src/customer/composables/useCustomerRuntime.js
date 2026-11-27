import { onBeforeUnmount, onMounted } from 'vue'
import { apiMessage } from '@/api'
import { CUSTOMER_MESSAGE_TYPES } from '../bridge'
import { hasMeaningfulTemporaryRows, hasProjectDraftChanges, hasRowDraftChanges, protectUnsavedChanges } from '../unsavedChanges.js'

export function createCustomerRuntime(options) {
  const {
    projectId,
    projectApi,
    persistence,
    draft,
    dataReady,
    uploadedImageUrl,
    ProjectInfo,
    saveProjectInfo,
    getSavedProjectDraft,
    setSavedProjectDraft,
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
    messageFromError = apiMessage,
    messageTypes = CUSTOMER_MESSAGE_TYPES,
    protectChanges = protectUnsavedChanges,
    windowRef = globalThis.window,
    documentRef = globalThis.document,
    inputElementClass = globalThis.HTMLInputElement,
    urlRef = globalThis.URL,
  } = options

  function hasUnsavedChanges() {
    if (persistence.pendingCount > 0) return true
    if (!dataReady.value) return false
    return hasProjectDraftChanges(draft, getSavedProjectDraft())
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
    documentRef.activeElement?.blur?.()
    protectChanges(event, hasUnsavedChanges())
  }

  async function prepareToLeave() {
    documentRef.activeElement?.blur?.()
    await persistence.waitForIdle()
    return !hasUnsavedChanges()
  }

  function capturePendingBuildInput(event) {
    const target = event.target
    if (!inputElementClass || !(target instanceof inputElementClass) || target.type !== 'number') return
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

  function reportProjectState(state, error = '') {
    if (windowRef.parent !== windowRef) {
      windowRef.parent.postMessage({ type: messageTypes.projectState, state, message: error }, windowRef.location.origin)
    }
  }

  async function returnToProjects() {
    if (windowRef.parent !== windowRef) {
      windowRef.parent.postMessage({ type: messageTypes.projects }, windowRef.location.origin)
      return
    }
    if (await prepareToLeave() || windowRef.confirm('还有未保存的内容，确定返回我的项目吗？')) {
      windowRef.location.assign('/projects')
    }
  }

  async function loadProjectData() {
    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      notify('请从项目列表打开项目')
      reportProjectState('error', '项目地址无效，请返回我的项目重新打开。')
      return
    }
    try {
      const [response] = await Promise.all([
        projectApi.getProject(), loadCarbonConfigurations(), persistence.refresh(),
      ])
      saveProjectInfo(response.data)
      Object.assign(draft, ProjectInfo, { accountingStages: [...ProjectInfo.accountingStages] })
      uploadedImageUrl.value = typeof ProjectInfo.modelImage === 'string' ? ProjectInfo.modelImage : ''
      setSavedProjectDraft({ ...draft, accountingStages: [...draft.accountingStages] })
      dataReady.value = true
      reportProjectState('ready')
    } catch (error) {
      persistence.report(error)
      reportProjectState('error', messageFromError(error, '项目数据加载失败，请检查网络后重试。'))
    }
  }

  function mount() {
    windowRef.addEventListener('beforeunload', onBeforeUnload)
    documentRef.addEventListener('input', capturePendingBuildInput, true)
    // The same-origin platform router consults this before unmounting the iframe.
    windowRef.carbonLedgerCustomer = { hasUnsavedChanges, prepareToLeave }
  }

  function unmount() {
    windowRef.removeEventListener('beforeunload', onBeforeUnload)
    documentRef.removeEventListener('input', capturePendingBuildInput, true)
    delete windowRef.carbonLedgerCustomer
    if (uploadedImageUrl.value) urlRef.revokeObjectURL(uploadedImageUrl.value)
  }

  return {
    hasUnsavedChanges,
    onBeforeUnload,
    prepareToLeave,
    capturePendingBuildInput,
    reportProjectState,
    returnToProjects,
    loadProjectData,
    mount,
    unmount,
  }
}

export function useCustomerRuntime(options) {
  const runtime = createCustomerRuntime(options)
  runtime.mount()
  onMounted(() => runtime.loadProjectData())
  onBeforeUnmount(() => runtime.unmount())
  return runtime
}
