import { describe, expect, it, vi } from 'vitest'
import type { PrismaService } from '../prisma/prisma.service'
import { CalcVersionRepository } from './calc-version.repository'

describe('CalcVersionRepository', () => {
  it('scopes latest and list queries to the project and keeps descending numbering', async () => {
    const findFirst = vi.fn().mockResolvedValue({ versionNumber: 4 })
    const findMany = vi.fn().mockResolvedValue([])
    const repository = new CalcVersionRepository({ calcVersion: { findFirst, findMany } } as unknown as PrismaService)

    await repository.findLatest(42)
    await repository.findMany(42)

    expect(findFirst).toHaveBeenCalledWith({
      where: { projectId: 42 },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    })
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { projectId: 42 },
      orderBy: { versionNumber: 'desc' },
      select: expect.objectContaining({ name: true, snapshot: true }),
    }))
  })

  it('scopes detail and mutation lookup by both project and version IDs', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const repository = new CalcVersionRepository({ calcVersion: { findFirst } } as unknown as PrismaService)

    await repository.findById(42, 9)

    expect(findFirst).toHaveBeenCalledWith({ where: { id: 9, projectId: 42 } })
  })
})
