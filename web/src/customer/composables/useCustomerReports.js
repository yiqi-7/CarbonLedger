/**
 * Customer-owned report actions.
 *
 * Version snapshots and version reports are owned by ProjectToolsView. The
 * customer workspace only exports the current calculation report, and keeps
 * that action behind the same save/unsaved-content guard as row exports.
 */
export function useCustomerReports({
  projectApi,
  persistence,
  canSave,
  notify,
  prepareExport,
  getProjectName,
}) {
  async function exportProjectReport() {
    if (!canSave()) return
    if (!await prepareExport()) return

    const result = await persistence.enqueue(async () => {
      await projectApi.exportReport(`${getProjectName() || '项目'}-报告书.xlsx`)
      return true
    }, false)
    if (result) notify('项目报告书已导出')
  }

  return { exportProjectReport }
}
