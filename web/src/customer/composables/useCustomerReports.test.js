import { describe, expect, it, vi } from 'vitest'
import { useCustomerReports } from './useCustomerReports.js'

function createSubject(overrides = {}) {
  const notifications = []
  const projectApi = { exportReport: vi.fn(async () => undefined) }
  const persistence = {
    enqueue: vi.fn(async (action, refreshAfter) => {
      expect(refreshAfter).toBe(false)
      return action()
    }),
  }
  const options = {
    projectApi,
    persistence,
    canSave: vi.fn(() => true),
    notify: message => notifications.push(message),
    prepareExport: vi.fn(async () => true),
    getProjectName: () => '示例项目',
    ...overrides,
  }
  return { model: useCustomerReports(options), options, notifications }
}

describe('useCustomerReports', () => {
  it('exports the current Excel report with the existing filename and success message', async () => {
    const { model, options, notifications } = createSubject()

    await model.exportProjectReport()

    expect(options.prepareExport).toHaveBeenCalledOnce()
    expect(options.projectApi.exportReport).toHaveBeenCalledWith('示例项目-报告书.xlsx')
    expect(notifications).toEqual(['项目报告书已导出'])
  })

  it('keeps the current report behind the save and unsaved-change guards', async () => {
    const { model, options, notifications } = createSubject({
      canSave: vi.fn(() => false),
    })

    await model.exportProjectReport()
    expect(options.prepareExport).not.toHaveBeenCalled()
    expect(options.persistence.enqueue).not.toHaveBeenCalled()

    options.canSave.mockReturnValue(true)
    options.prepareExport.mockResolvedValue(false)
    await model.exportProjectReport()
    expect(options.persistence.enqueue).not.toHaveBeenCalled()
    expect(options.projectApi.exportReport).not.toHaveBeenCalled()
    expect(notifications).toEqual([])
  })

  it('uses the fallback project filename when the current project has no name', async () => {
    const { model, options } = createSubject({ getProjectName: () => '' })

    await model.exportProjectReport()

    expect(options.projectApi.exportReport).toHaveBeenCalledWith('项目-报告书.xlsx')
  })
})
