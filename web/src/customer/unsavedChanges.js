function sameValue(left, right) {
  if (left === right) return true
  if (Array.isArray(left) && Array.isArray(right)) return JSON.stringify(left) === JSON.stringify(right)
  return (left == null || left === '') && (right == null || right === '')
}

export function hasProjectDraftChanges(draft, baseline) {
  return Object.keys(baseline).some(key => !sameValue(draft[key], baseline[key]))
}

export function hasRowDraftChanges(drafts, rows) {
  const byId = new Map(rows.map(row => [String(row.id), row]))
  return Object.entries(drafts).some(([id, fields]) => Object.entries(fields).some(([field, value]) => {
    const original = byId.get(id)?.[field]
    return String(value ?? '').trim() !== String(original ?? '').trim()
  }))
}

export function hasMeaningfulTemporaryRows({ build, transport, construction }) {
  return build.some(row => String(row.materialName ?? '').trim() || row.quantity !== 1 || row.unitPrice !== 1 || row.marketPrice != null)
    || transport.some(row => row.id < 0 && (
      String(row.transportedMaterial ?? '').trim() || row.transportQuantity !== 1 || row.transportDistance !== 1
      || row.transportUnitPrice !== 1 || (row.initialFactorConfigId != null && row.factorConfigId !== row.initialFactorConfigId)
    ))
    || construction.some(row => row.id < 0 && (
      String(row.machineryName ?? '').trim() || row.shiftCount !== 1 || row.energyPerShift !== 1
      || row.shiftUnitPrice !== 1 || row.energyType !== '电力'
    ))
}

export function protectUnsavedChanges(event, dirty) {
  if (!dirty) return
  event.preventDefault()
  event.returnValue = ''
}
