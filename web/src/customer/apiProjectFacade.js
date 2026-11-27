import * as apiModule from '@/api'

const defaultApi = apiModule.api
const defaultDownloadFile = apiModule.downloadApiFile

/** 项目工作区的 HTTP 边界。组件和持久化队列不再拼接项目端点。 */
export function createProjectApi({ projectId, apiClient = defaultApi, downloadFile = defaultDownloadFile }) {
  const path = `/projects/${projectId}`
  const get = suffix => apiClient.get(`${path}/${suffix}`)
  const post = (suffix, body) => apiClient.post(`${path}/${suffix}`, body)
  const patch = (suffix, body) => apiClient.patch(`${path}/${suffix}`, body)
  const remove = suffix => apiClient.delete(`${path}/${suffix}`)
  const download = (suffix, filename) => downloadFile(`${path}/${suffix}`, filename)

  return {
    path,
    getProject: () => apiClient.get(path),
    getRows: kind => get(kind),
    getAnalysis: () => get('analysis'),
    getFactorConfigurations: () => Promise.all([get('build-factors'), get('transport-factors')]),
    createRecord: (kind, body) => post(kind, body),
    patchRecord: (kind, id, body) => patch(`${kind}/${id}`, body),
    deleteRecord: (kind, id) => remove(`${kind}/${id}`),
    importRecords: (kind, form) => post(`imports/${kind}`, form),
    exportRecords: (kind, filename) => download(`exports/${kind}`, filename),
    exportReport: filename => download('reports/current/excel', filename),
    patchProject: body => apiClient.patch(path, body),
  }
}
