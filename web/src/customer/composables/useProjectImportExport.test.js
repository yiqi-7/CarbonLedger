import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useProjectImportExport } from './useProjectImportExport.js'

function createSubject(overrides = {}) {
  const notifications = []
  const projectApi = {
    importRecords: vi.fn(async () => ({ data: { imported: 2, skippedRows: 1 } })),
    exportRecords: vi.fn(async () => undefined),
    exportReport: vi.fn(async () => undefined),
  }
  const persistence = {
    enqueue: vi.fn(async (action, refreshAfter, onSuccess) => {
      const result = await action()
      onSuccess?.(result)
      return result
    }),
    waitForIdle: vi.fn(async () => undefined),
  }
  const materialList = { toArray: () => [] }
  const transportMaterialList = { toArray: () => [] }
  const constructionMaterialList = { toArray: () => [] }
  const pendingBuildMaterials = ref([])
  const documentRef = { activeElement: { blur: vi.fn() } }
  const options = {
    projectApi,
    persistence,
    canSave: vi.fn(() => true),
    notify: message => notifications.push(message),
    loadCarbonConfigurations: vi.fn(async () => undefined),
    hasUnsavedChanges: vi.fn(() => false),
    materialEditDrafts: {},
    transportEditDrafts: {},
    constructionEditDrafts: {},
    materialList,
    transportMaterialList,
    constructionMaterialList,
    pendingBuildMaterials,
    getProjectName: () => '示例项目',
    documentRef,
    FormDataCtor: class {
      append = vi.fn()
    },
    ...overrides,
  }
  return { model: useProjectImportExport(options), options, notifications }
}

function eventWithFile() {
  const event = { target: { files: [{ name: 'rows.xlsx' }], value: 'rows.xlsx' } }
  return event
}

describe('useProjectImportExport', () => {
  it('resets the file input after import, including when the import rejects', async () => {
    const { model, options } = createSubject()
    const event = eventWithFile()
    await model.importRows('build-materials', event, '材料')
    expect(event.target.value).toBe('')

    options.projectApi.importRecords.mockRejectedValueOnce(new Error('network error'))
    const rejectedEvent = eventWithFile()
    await expect(model.importRows('build-materials', rejectedEvent, '材料')).rejects.toThrow('network error')
    expect(rejectedEvent.target.value).toBe('')
  })

  it('rejects exports with unsaved row drafts after waiting for the queue', async () => {
    const { model, options, notifications } = createSubject({
      materialList: { toArray: () => [{ id: 4, quantity: 10 }] },
      materialEditDrafts: { 4: { quantity: '11' } },
    })
    await model.exportRows('build-materials', '建材清单.xlsx', '建材清单')

    expect(options.persistence.waitForIdle).toHaveBeenCalledOnce()
    expect(options.persistence.enqueue).not.toHaveBeenCalled()
    expect(options.projectApi.exportRecords).not.toHaveBeenCalled()
    expect(notifications).toContain('还有未保存的内容，请先完成保存或取消未完成的记录，再导出')
    expect(options.documentRef.activeElement.blur).toHaveBeenCalledOnce()
  })

  it('keeps a successful import and reports configuration refresh failure', async () => {
    const { model, options, notifications } = createSubject({
      loadCarbonConfigurations: vi.fn(async () => { throw new Error('refresh failed') }),
    })
    const event = eventWithFile()
    await model.importRows('transport-records', event, '运输记录')

    expect(options.projectApi.importRecords).toHaveBeenCalledOnce()
    expect(options.persistence.enqueue).toHaveBeenCalledWith(expect.any(Function), true, expect.any(Function))
    expect(event.target.value).toBe('')
    expect(notifications).toContain('已导入 2 条运输记录，跳过 1 行数据；配置刷新失败，请刷新页面后继续新增')
  })

  it('queues exports without a post-export refresh and retains filenames and response messages', async () => {
    const { model, options, notifications } = createSubject()
    await model.exportRows('construction-records', '工程台班清单.xlsx', '工程台班清单')
    await model.exportProjectReport()

    expect(options.projectApi.exportRecords).toHaveBeenCalledWith('construction-records', '工程台班清单.xlsx')
    expect(options.projectApi.exportReport).toHaveBeenCalledWith('示例项目-报告书.xlsx')
    expect(options.persistence.enqueue).toHaveBeenNthCalledWith(1, expect.any(Function), false)
    expect(options.persistence.enqueue).toHaveBeenNthCalledWith(2, expect.any(Function), false)
    expect(notifications).toEqual(['工程台班清单已导出', '项目报告书已导出'])
  })
})
