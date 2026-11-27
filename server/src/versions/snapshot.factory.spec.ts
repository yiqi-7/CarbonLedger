import { describe, expect, it } from 'vitest'
import type { ProjectBundle } from '../analysis/analysis.service'
import { SnapshotFactory } from './snapshot.factory'

function bundle(): ProjectBundle {
  return {
    projectInfo: { id: 42, projectName: 'Demo' } as ProjectBundle['projectInfo'],
    factors: { build: [], transport: [] },
    buildMaterials: [],
    transportRecords: [],
    constructionRecords: [],
    recyclingRecords: [],
    summary: {
      build: {} as ProjectBundle['summary']['build'],
      transport: {} as ProjectBundle['summary']['transport'],
      construction: {} as ProjectBundle['summary']['construction'],
      recycling: {} as ProjectBundle['summary']['recycling'],
      emission: { netEmission: 12 } as ProjectBundle['summary']['emission'],
      cost: { totalCost: 34 } as ProjectBundle['summary']['cost'],
    },
  }
}

describe('SnapshotFactory', () => {
  it('builds the existing snapshot shape and round trips its JSON', () => {
    const factory = new SnapshotFactory()
    const snapshot = factory.create(3, 7, bundle())

    expect(snapshot).toMatchObject({
      versionNumber: 3,
      name: '版本 v3',
      savedByUserId: 7,
      project: bundle().projectInfo,
      summary: bundle().summary,
    })
    expect(factory.parse(factory.serialize(snapshot))).toEqual(snapshot)
  })

  it('renames only the existing snapshot name while retaining all snapshot data', () => {
    const factory = new SnapshotFactory()
    const original = factory.create(3, 7, bundle())

    const renamed = factory.parse(factory.rename(factory.serialize(original), ' Final '))

    expect(renamed).toEqual({ ...original, name: ' Final ' })
  })

  it('projects list values and preserves fallback values for malformed snapshots', () => {
    const factory = new SnapshotFactory()
    const serialized = factory.serialize(factory.create(3, 7, bundle()))

    expect(factory.project(serialized, 3)).toEqual({ name: '版本 v3', netEmission: 12, totalCost: 34 })
    expect(factory.project('{bad json', 3)).toEqual({ name: '版本 v3', netEmission: null, totalCost: null })
  })
})
