import { api, apiMessage } from '@/api'

// Keep the customer's linked lists and row identities while replacing their
// persistence with the authenticated, project-scoped service.
export function createProjectPersistence({ projectId, lists, summaries, onError }) {
  const path = `/projects/${projectId}`
  let queue = Promise.resolve()
  let pendingCount = 0
  const resolvedIds = new Map()
  let nextTemporaryId = -1

  function replaceRows(list, rows) {
    const existing = new Map(list.toArray().map(row => [row.id, row]))
    const temporary = list.toArray().filter(row => row.id < 0)
    list.head = null
    list.count = 0
    for (const row of rows) {
      const target = existing.get(row.id)
      list.append(target ? Object.assign(target, row) : row)
    }
    temporary.forEach(row => list.append(row))
  }

  async function refresh() {
    const kinds = Object.keys(lists)
    const responses = await Promise.all([
      ...kinds.map(kind => api.get(`${path}/${kind}`)),
      api.get(`${path}/analysis`),
    ])
    kinds.forEach((kind, index) => replaceRows(lists[kind], responses[index].data))
    const summary = responses.at(-1).data
    Object.entries(summaries).forEach(([kind, target]) => Object.assign(target, summary[kind]))
  }

  function report(error) {
    onError(apiMessage(error, error instanceof Error ? error.message : '操作失败，请重试'))
  }

  function enqueue(action, refreshAfter = true) {
    pendingCount += 1
    const operation = queue.then(async () => {
      const result = await action()
      if (refreshAfter) {
        try {
          await refresh()
        } catch (error) {
          report(error)
          onError('数据已保存，但汇总刷新失败，请刷新页面查看最新结果')
        }
      }
      return result
    }).catch(error => {
      report(error)
      return null
    }).finally(() => {
      pendingCount -= 1
    })
    queue = operation.then(() => undefined)
    return operation
  }

  function temporaryId() {
    return nextTemporaryId--
  }

  function resolveId(id) {
    return resolvedIds.get(id) ?? id
  }

  function adoptCreated(list, temporary, created, drafts) {
    const previousId = temporary.id
    resolvedIds.set(previousId, created.id)
    if (drafts[previousId]) {
      drafts[created.id] = drafts[previousId]
      delete drafts[previousId]
    }
    Object.assign(temporary, created)
    // A pending build row is held outside its linked list.
    if (!list.toArray().some(row => row.id === created.id)) list.append(temporary)
  }

  function clearDraft(drafts, id, field, input) {
    const resolvedId = resolveId(id)
    const row = drafts[resolvedId]
    if (!row || row[field] !== input) return
    delete row[field]
    if (!Object.keys(row).length) delete drafts[resolvedId]
  }

  // Edits made while POST is in flight must follow that POST, using its real ID.
  // Keep a draft overlay until PATCH succeeds so adoption/refresh cannot erase it.
  function queueDraftPatch(kind, material, updates, drafts) {
    const originalId = material.id
    const inputs = Object.fromEntries(Object.entries(updates).map(([field, value]) => [field, value == null ? '' : String(value)]))
    if (!(resolveId(originalId) > 0)) Object.assign(material, updates)
    if (!drafts[originalId]) drafts[originalId] = {}
    Object.assign(drafts[originalId], inputs)
    return enqueue(async () => {
      const id = resolveId(originalId)
      if (!Number.isSafeInteger(id) || id <= 0) return false
      const result = await patch(kind, id, updates)
      Object.entries(inputs).forEach(([field, input]) => clearDraft(drafts, originalId, field, input))
      return result
    })
  }

  async function waitForIdle() {
    // New blur handlers can append work while the previous request completes.
    while (pendingCount > 0) await queue
  }

  async function patch(kind, id, updates) {
    const resolvedId = resolveId(id)
    const { data } = await api.patch(`${path}/${kind}/${resolvedId}`, updates)
    const row = lists[kind].toArray().find(candidate => candidate.id === resolvedId)
    if (row) Object.assign(row, data)
    return data
  }

  async function remove(kind, material, drafts) {
    const id = resolveId(material.id)
    if (id > 0) await api.delete(`${path}/${kind}/${id}`)
    lists[kind].removeById(id)
    delete drafts[id]
  }

  return {
    path, refresh, enqueue, report, temporaryId, resolveId, adoptCreated, clearDraft,
    queueDraftPatch, waitForIdle, patch, remove,
    get pendingCount() { return pendingCount },
  }
}
