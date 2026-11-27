export function useCustomerRecordPersistence({
  projectApi,
  persistence,
  canSave,
  transportVehicleConfigurations,
  transportMaterialList,
  constructionMaterialList,
  documentRef = globalThis.document,
}) {
  const rowInputOwners = new WeakMap()

  function registerRowInputOwner(target, kind, id) {
    rowInputOwners.set(target, { kind, id })
  }

  function flushCreatedRowInput(kind, id) {
    const active = documentRef?.activeElement
    const owner = active && rowInputOwners.get(active)
    if (owner?.kind === kind && owner.id === id) active.blur()
  }

  async function saveRow(kind, material, field, updates, drafts, input, _target) {
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
      const { data } = await projectApi.createRecord(kind, payload)
      flushCreatedRowInput(kind, originalId)
      persistence.adoptCreated(list, material, data, drafts)
      return data
    })
    if (result !== null) persistence.clearDraft(drafts, originalId, field, input)
  }

  function deleteRow(kind, material, drafts) {
    if (!canSave()) return
    return persistence.enqueue(() => persistence.remove(kind, material, drafts))
  }

  return { registerRowInputOwner, saveRow, deleteRow }
}
