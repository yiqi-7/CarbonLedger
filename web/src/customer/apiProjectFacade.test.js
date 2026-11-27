import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProjectApi } from './apiProjectFacade.js'

const apiClient = {
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}
const downloadFile = vi.fn()

function createFacade() {
  return createProjectApi({ projectId: 42, apiClient, downloadFile })
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('customer project API facade version methods', () => {
  it('lists versions through the project-scoped GET endpoint', async () => {
    await createFacade().listVersions()

    expect(apiClient.get).toHaveBeenCalledWith('/projects/42/versions')
  })

  it('saves a version with the project-scoped POST endpoint and no body', async () => {
    await createFacade().saveVersion()

    expect(apiClient.post).toHaveBeenCalledWith('/projects/42/versions')
  })

  it('gets a version snapshot by ID', async () => {
    await createFacade().getVersion(7)

    expect(apiClient.get).toHaveBeenCalledWith('/projects/42/versions/7')
  })

  it('renames a version with the expected request body', async () => {
    await createFacade().renameVersion(7, '方案一')

    expect(apiClient.patch).toHaveBeenCalledWith('/projects/42/versions/7', { name: '方案一' })
  })

  it('deletes a version by ID', async () => {
    await createFacade().deleteVersion(7)

    expect(apiClient.delete).toHaveBeenCalledWith('/projects/42/versions/7')
  })

  it('exports a selected version report with the requested filename', async () => {
    await createFacade().exportVersionReport(7, 'pdf', '客户项目-报告.pdf')

    expect(downloadFile).toHaveBeenCalledWith('/projects/42/reports/7/pdf', '客户项目-报告.pdf')
  })

  it('exports the current report PDF with the requested filename', async () => {
    await createFacade().exportCurrentReportPdf('客户项目-当前核算.pdf')

    expect(downloadFile).toHaveBeenCalledWith('/projects/42/reports/current/pdf', '客户项目-当前核算.pdf')
  })

  it('preserves the existing current Excel report export', async () => {
    await createFacade().exportReport('客户项目-报告书.xlsx')

    expect(downloadFile).toHaveBeenCalledWith('/projects/42/reports/current/excel', '客户项目-报告书.xlsx')
  })
})
