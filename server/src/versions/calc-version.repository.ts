import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

/**
 * The composite version key is the only expected unique conflict while saving.
 * Keep the check structural so it also works with Prisma's wrapped errors in tests.
 */
export function isVersionNumberConflict(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { code?: unknown; meta?: { target?: unknown } }
  if (candidate.code !== 'P2002') return false

  const target = candidate.meta?.target
  if (Array.isArray(target)) return target.includes('projectId') && target.includes('versionNumber')
  return typeof target === 'string' && target.includes('projectId') && target.includes('versionNumber')
}

/** Persistence boundary for calculation versions. Every read is scoped to its project. */
@Injectable()
export class CalcVersionRepository {
  constructor(private readonly prisma: PrismaService) {}

  findLatest(projectId: number) {
    return this.prisma.calcVersion.findFirst({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    })
  }

  findMany(projectId: number) {
    return this.prisma.calcVersion.findMany({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
      select: {
        id: true,
        versionNumber: true,
        createdAt: true,
        name: true,
        snapshot: true,
        createdBy: { select: { username: true } },
      },
    })
  }

  findById(projectId: number, versionId: number) {
    return this.prisma.calcVersion.findFirst({ where: { id: versionId, projectId } })
  }

  create(input: { projectId: number; versionNumber: number; name: string | null; snapshot: string; createdByUserId: number }) {
    return this.prisma.calcVersion.create({ data: input })
  }

  updateName(versionId: number, name: string) {
    return this.prisma.calcVersion.update({ where: { id: versionId }, data: { name } })
  }

  updateSnapshot(versionId: number, snapshot: string) {
    return this.prisma.calcVersion.update({ where: { id: versionId }, data: { snapshot } })
  }

  remove(versionId: number) {
    return this.prisma.calcVersion.delete({ where: { id: versionId } })
  }
}
