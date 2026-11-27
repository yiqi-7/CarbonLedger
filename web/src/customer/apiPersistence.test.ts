import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createProjectPersistence } from './apiPersistence.js'

const mockedApi = vi.hoisted(() => ({
  api: { get: vi.fn(), patch: vi.fn(), delete: vi.fn() },
  downloadApiFile: vi.fn(),
}))
const { api } = mockedApi
vi.mock('@/api', () => ({ ...mockedApi, apiMessage: (_error: unknown, fallback: string) => fallback }))

function list(initial: any[] = []) {
  return {
    head: initial.length ? { rows: initial } : null as any,
    count: initial.length,
    toArray(): any[] { return this.head?.rows ?? [] },
    append(row: any) {
      if (!this.head) this.head = { rows: [] }
      this.head.rows.push(row)
      this.count += 1
    },
    removeById(id: number) {
      if (!this.head) return
      this.head.rows = this.head.rows.filter((row: any) => row.id !== id)
      this.count = this.head.rows.length
    },
  }
}

function setup(rows: any[] = []) {
  const records = list(rows)
  const summary = { totalEmission: 0 }
  const onError = vi.fn()
  const persistence = createProjectPersistence({
    projectId: 42,
    lists: { 'transport-records': records },
    summaries: { transport: summary },
    onError,
  })
  return { persistence, records, summary, onError }
}

beforeEach(() => vi.resetAllMocks())

describe('customer project persistence', () => {
  it('refreshes server values without dropping an empty draft row or replacing focused row objects', async () => {
    const saved = { id: 7, transportedMaterial: '钢筋', transportQuantity: 1 }
    const pending = { id: -1, transportedMaterial: '', transportQuantity: 3 }
    const { persistence, records, summary } = setup([saved, pending])
    api.get.mockImplementation(async (path: string) => ({ data: path.endsWith('/analysis')
      ? { transport: { totalEmission: 6 } }
      : [{ ...saved, transportQuantity: 9 }] }))

    await persistence.refresh()

    expect(records.toArray()).toEqual([{ ...saved, transportQuantity: 9 }, pending])
    expect(records.toArray()[0]).toBe(saved)
    expect(records.toArray()[1]).toBe(pending)
    expect(summary.totalEmission).toBe(6)
  })

  it('uses a created server ID for a queued edit or deletion while retaining unsaved fields', async () => {
    const pending = { id: -1, transportedMaterial: '钢筋' }
    const drafts: Record<string, any> = { '-1': { transportQuantity: '12' } }
    const { persistence, records } = setup([pending])
    persistence.adoptCreated(records, pending, { id: 99, transportedMaterial: '钢筋' }, drafts)
    api.patch.mockResolvedValue({ data: { id: 99, transportQuantity: 12 } })

    await persistence.patch('transport-records', -1, { transportQuantity: 12 })
    expect(api.patch).toHaveBeenCalledWith('/projects/42/transport-records/99', { transportQuantity: 12 })
    expect(records.toArray()).toHaveLength(1)
    expect(drafts['99'].transportQuantity).toBe('12')
    persistence.clearDraft(drafts, -1, 'transportQuantity', '11')
    expect(drafts['99'].transportQuantity).toBe('12')
    persistence.clearDraft(drafts, -1, 'transportQuantity', '12')
    expect(drafts['99']).toBeUndefined()
    await persistence.remove('transport-records', pending, drafts)
    expect(api.delete).toHaveBeenCalledWith('/projects/42/transport-records/99')
    expect(records.count).toBe(0)
  })

  it('serializes mutations and continues after an earlier request fails', async () => {
    const { persistence, onError } = setup()
    const order: string[] = []
    let finish!: () => void
    const first = persistence.enqueue(async () => {
      order.push('first')
      await new Promise<void>(resolve => { finish = resolve })
      throw new Error('保存失败')
    }, false)
    const second = persistence.enqueue(async () => { order.push('second'); return 2 }, false)
    await Promise.resolve()
    expect(order).toEqual(['first'])
    finish()
    expect(await first).toBeNull()
    expect(await second).toBe(2)
    expect(order).toEqual(['first', 'second'])
    expect(onError).toHaveBeenCalledWith('保存失败')
  })

  it('does not retry a successful create when the following summary refresh fails', async () => {
    const { persistence, onError } = setup()
    api.get.mockRejectedValue(new Error('offline'))
    const create = vi.fn().mockResolvedValue({ id: 99 })

    const showSuccess = vi.fn()
    expect(await persistence.enqueue(create, true, showSuccess)).toEqual({ id: 99 })
    expect(create).toHaveBeenCalledTimes(1)
    expect(showSuccess).not.toHaveBeenCalled()
    expect(onError).toHaveBeenCalledWith('数据已保存，但汇总刷新失败，请刷新页面查看最新结果')
  })

  it('persists successive edits made before the new record receives its server ID', async () => {
    const records = list()
    const pending = { id: 'pending-build-material-1', quantity: 1, unitPrice: 1 }
    const drafts: Record<string, any> = {}
    let serverRow = { id: 88, quantity: 1, unitPrice: 1 }
    const persistence = createProjectPersistence({
      projectId: 42, lists: { 'build-materials': records }, summaries: {}, onError: vi.fn(),
    })
    api.get.mockImplementation(async (path: string) => ({ data: path.endsWith('/analysis') ? {} : [{ ...serverRow }] }))
    api.patch.mockImplementation(async (_path: string, values: object) => {
      serverRow = { ...serverRow, ...values }
      return { data: { ...serverRow } }
    })
    let finishCreate!: () => void
    const create = persistence.enqueue(async () => {
      await new Promise<void>(resolve => { finishCreate = resolve })
      persistence.adoptCreated(records, pending, { ...serverRow }, drafts)
      return serverRow
    })
    await Promise.resolve()
    const editQuantity = persistence.queueDraftPatch('build-materials', pending, { quantity: 12.5 }, drafts)
    const editPrice = persistence.queueDraftPatch('build-materials', pending, { unitPrice: 6 }, drafts)
    const editQuantityAgain = persistence.queueDraftPatch('build-materials', pending, { quantity: 20 }, drafts)
    expect(persistence.pendingCount).toBe(4)
    finishCreate()
    await Promise.all([create, editQuantity, editPrice, editQuantityAgain])
    await persistence.waitForIdle()

    expect(api.patch.mock.calls).toEqual([
      ['/projects/42/build-materials/88', { quantity: 12.5 }],
      ['/projects/42/build-materials/88', { unitPrice: 6 }],
      ['/projects/42/build-materials/88', { quantity: 20 }],
    ])
    expect(serverRow).toEqual({ id: 88, quantity: 20, unitPrice: 6 })
    expect(records.toArray()[0]).toMatchObject(serverRow)
    expect(drafts).toEqual({})
    expect(persistence.pendingCount).toBe(0)
  })

  it('keeps unsaved edits after a queued PATCH fails and tracks queued work until it settles', async () => {
    const row = { id: 9, transportQuantity: 1 }
    const { persistence } = setup([row])
    const drafts: Record<string, any> = {}
    api.patch.mockRejectedValue(new Error('offline'))
    const saving = persistence.queueDraftPatch('transport-records', row, { transportQuantity: 12 }, drafts)
    expect(persistence.pendingCount).toBe(1)
    await saving
    await persistence.waitForIdle()
    expect(drafts['9'].transportQuantity).toBe('12')
    expect(row.transportQuantity).toBe(1)
    expect(persistence.pendingCount).toBe(0)
  })

  it('completes a cancellation queued while create is in flight using the new server ID', async () => {
    const pending = { id: -1, transportedMaterial: '钢筋' }
    const { persistence, records } = setup([pending])
    const drafts: Record<string, any> = { '-1': { transportedMaterial: '钢筋' } }
    let finishCreate!: () => void
    const create = persistence.enqueue(async () => {
      await new Promise<void>(resolve => { finishCreate = resolve })
      persistence.adoptCreated(records, pending, { id: 77, transportedMaterial: '钢筋' }, drafts)
    }, false)
    await Promise.resolve()
    const cancel = persistence.enqueue(async () => {
      const id = persistence.resolveId(-1)
      if (id > 0) await persistence.remove('transport-records', { id }, drafts)
    }, false)
    expect(api.delete).not.toHaveBeenCalled()
    finishCreate()
    await Promise.all([create, cancel])
    expect(api.delete).toHaveBeenCalledWith('/projects/42/transport-records/77')
    expect(records.toArray()).toEqual([])
    expect(drafts).toEqual({})
    expect(persistence.pendingCount).toBe(0)
  })
})
