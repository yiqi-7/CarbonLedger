export function useCustomerRecordFields({
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
}) {
  function setRecyclingDraft(materialId, field, event) {
    if (!recyclingEditDrafts[materialId]) recyclingEditDrafts[materialId] = {}
    recyclingEditDrafts[materialId][field] = event.target.value
  }

  function setConstructionDraft(materialId, field, event) {
    registerRowInputOwner(event.target, 'construction-records', materialId)
    if (!constructionEditDrafts[materialId]) constructionEditDrafts[materialId] = {}
    constructionEditDrafts[materialId][field] = event.target.value
  }

  function setTransportDraft(materialId, field, event) {
    registerRowInputOwner(event.target, 'transport-records', materialId)
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

  return {
    setMaterialDraft,
    updateMaterial,
    setTransportDraft,
    updateTransportMaterial,
    setConstructionDraft,
    updateConstructionMaterial,
    setRecyclingDraft,
    updateRecyclingMaterial,
  }
}
