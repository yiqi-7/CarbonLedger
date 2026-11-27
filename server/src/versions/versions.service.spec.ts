import { describe, expect, it, vi } from 'vitest'
import type { AnalysisService } from '../analysis/analysis.service'
import type { AuditService } from '../audit/audit.service'
import type { ProjectsService } from '../projects/projects.service'
import type { CalcVersionRepository } from './calc-version.repository'
import { SnapshotFactory } from './snapshot.factory'
import { VersionsService } from './versions.service'

const bundle = {
  projectInfo: { id: 42, projectName: 'Demo' },
  factors: { build: [], transport: [] },
  buildMaterials: [], transportRecords: [], constructionRecords: [], recyclingRecords: [],
  summary: { build: {}, transport: {}, construction: {}, recycling: {}, emission: {}, cost: {} },
} as never

describe('VersionsService boundaries', () => {
  it('delegates save numbering and snapshot creation before auditing', async () => {
    const events: string[] = []
    const repository = {
      findLatest: vi.fn().mockImplementation(async () => { events.push('latest'); return { versionNumber: 2 } }),
      create: vi.fn().mockImplementation(async () => { events.push('create'); return { id: 8, createdAt: 'now' } }),
    }
    const snapshots = new SnapshotFactory()
    const service = new VersionsService(
      repository as unknown as CalcVersionRepository,
      snapshots,
      { buildBundle: vi.fn().mockImplementation(async () => { events.push('bundle'); return bundle }) } as unknown as AnalysisService,
      { assertOwner: vi.fn().mockImplementation(async () => { events.push('owner') }) } as unknown as ProjectsService,
      { record: vi.fn().mockImplementation(async () => { events.push('audit') }) } as unknown as AuditService,
    )

    await expect(service.save(42, 7)).resolves.toEqual({ id: 8, versionNumber: 3, createdAt: 'now' })
    expect(events).toEqual(['owner', 'bundle', 'latest', 'create', 'audit'])
    expect(repository.create).toHaveBeenCalledWith(expect.objectContaining({ projectId: 42, versionNumber: 3, createdByUserId: 7 }))
  })

  it('retries a composite version conflict with a fresh number and snapshot', async () => {
    const events: string[] = []
    const repository = {
      findLatest: vi.fn()
        .mockImplementationOnce(async () => { events.push('latest-1'); return null })
        .mockImplementationOnce(async () => { events.push('latest-2'); return { versionNumber: 1 } }),
      create: vi.fn()
        .mockImplementationOnce(async () => {
          events.push('create-1')
          throw { code: 'P2002', meta: { target: ['projectId', 'versionNumber'] } }
        })
        .mockImplementationOnce(async () => { events.push('create-2'); return { id: 9, createdAt: 'later' } }),
    }
    const audit = { record: vi.fn().mockImplementation(async () => { events.push('audit') }) }
    const snapshots = new SnapshotFactory()
    const service = new VersionsService(
      repository as unknown as CalcVersionRepository,
      snapshots,
      { buildBundle: vi.fn().mockImplementation(async () => { events.push('bundle'); return bundle }) } as unknown as AnalysisService,
      { assertOwner: vi.fn().mockImplementation(async () => { events.push('owner') }) } as unknown as ProjectsService,
      audit as unknown as AuditService,
    )

    await expect(service.save(42, 7)).resolves.toEqual({ id: 9, versionNumber: 2, createdAt: 'later' })
    expect(events).toEqual(['owner', 'bundle', 'latest-1', 'create-1', 'latest-2', 'create-2', 'audit'])
    expect(repository.create).toHaveBeenNthCalledWith(1, expect.objectContaining({ versionNumber: 1 }))
    expect(repository.create).toHaveBeenNthCalledWith(2, expect.objectContaining({ versionNumber: 2 }))
    expect(JSON.parse(repository.create.mock.calls[0][0].snapshot).versionNumber).toBe(1)
    expect(JSON.parse(repository.create.mock.calls[1][0].snapshot).versionNumber).toBe(2)
    expect(audit.record).toHaveBeenCalledWith(7, 'VERSION_SAVED', 'PROJECT', '42', '版本 v2')
  })

  it('delegates detail parsing and preserves the public response shape', async () => {
    const snapshots = new SnapshotFactory()
    const snapshot = snapshots.create(3, 7, bundle)
    const service = new VersionsService(
      { findById: vi.fn().mockResolvedValue({ id: 8, snapshot: snapshots.serialize(snapshot) }) } as unknown as CalcVersionRepository,
      snapshots,
      {} as AnalysisService,
      { assertOwner: vi.fn().mockResolvedValue(undefined) } as unknown as ProjectsService,
      {} as AuditService,
    )

    await expect(service.detail(42, 7, 8)).resolves.toEqual({ id: 8, ...snapshot })
  })
})
