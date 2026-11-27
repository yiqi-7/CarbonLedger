export function useCustomerFactorConfiguration({
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
  format,
  creatingBuildMaterials = new Set(),
  documentRef = globalThis.document,
  windowRef = globalThis.window,
}) {
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

  function updateBuildConfigSuggestionsPosition(material, event) {
    const bounds = event.currentTarget.getBoundingClientRect()
    const desiredHeight = Math.min(220, Math.max(80, buildConfigSuggestions(material).length * 36 + 8))
    const availableBelow = windowRef.innerHeight - bounds.bottom - 8
    const availableAbove = bounds.top - 8
    const showBelow = availableBelow >= desiredHeight || availableBelow >= availableAbove
    const availableSpace = Math.max(0, showBelow ? availableBelow : availableAbove)
    const maxHeight = Math.max(80, Math.min(220, availableSpace))
    activeBuildConfigMaterialId.value = material.id
    buildConfigSuggestionsPosition.top = showBelow
      ? bounds.bottom
      : Math.max(8, bounds.top - maxHeight - 3)
    buildConfigSuggestionsPosition.width = Math.min(Math.max(bounds.width, 250), windowRef.innerWidth - 16)
    buildConfigSuggestionsPosition.left = Math.max(
      8,
      Math.min(bounds.left, windowRef.innerWidth - buildConfigSuggestionsPosition.width - 8)
    )
    buildConfigSuggestionsPosition.maxHeight = maxHeight
  }

  // Keep the existing template handler name while exposing the positioning operation
  // independently for callers and focused tests.
  function showBuildConfigSuggestions(material, event) {
    updateBuildConfigSuggestionsPosition(material, event)
  }

  function flushPendingBuildInput(id) {
    const active = documentRef?.activeElement
    const originalId = active?.closest?.('.pending-build-material-row')
      ?.querySelector('[data-pending-material-id]')?.dataset.pendingMaterialId
    if (originalId === String(id)) active.blur()
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
          const { data } = await projectApi.createRecord('build-materials', {
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

  return {
    findBuildCarbonConfiguration,
    buildConfigSuggestions,
    updateBuildConfigSuggestionsPosition,
    showBuildConfigSuggestions,
    selectBuildMaterialConfiguration,
    handleBuildMaterialNameBlur,
    updatePendingBuildMaterial,
    cancelPendingBuildMaterial,
    flushPendingBuildInput,
    // Kept in the injected contract for callers that provide shared formatting or notices.
    notify,
    format,
  }
}
