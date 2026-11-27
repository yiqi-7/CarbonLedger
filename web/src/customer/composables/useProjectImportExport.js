import { hasMeaningfulTemporaryRows, hasRowDraftChanges } from '../unsavedChanges.js'

export function useProjectImportExport({
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
  getProjectName,
  documentRef = { activeElement: null },
  FormDataCtor = globalThis.FormData,
}) {
  async function importRows(kind, event, label) {
    const file = event.target.files?.[0]
    if (!file || !canSave()) return
    const form = new FormDataCtor()
    form.append('file', file)
    let configurationRefreshFailed = false
    try {
      await persistence.enqueue(async () => {
        const { data } = await projectApi.importRecords(kind, form)
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

  async function prepareExport(kind = null) {
    documentRef.activeElement?.blur?.()
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

  async function exportRows(kind, filename, label) {
    if (!canSave()) return
    if (!await prepareExport(kind)) return
    const result = await persistence.enqueue(async () => {
      await projectApi.exportRecords(kind, filename)
      return true
    }, false)
    if (result) notify(`${label}已导出`)
  }

  async function exportProjectReport() {
    if (!canSave()) return
    if (!await prepareExport()) return
    const result = await persistence.enqueue(async () => {
      await projectApi.exportReport(`${getProjectName() || '项目'}-报告书.xlsx`)
      return true
    }, false)
    if (result) notify('项目报告书已导出')
  }

  return { importRows, exportRows, prepareExport, exportProjectReport }
}
