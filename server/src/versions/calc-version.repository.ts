import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

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
        snapshot: true,
        createdBy: { select: { username: true } },
      },
    })
  }

  findById(projectId: number, versionId: number) {
    return this.prisma.calcVersion.findFirst({ where: { id: versionId, projectId } })
  }

  create(input: { projectId: number; versionNumber: number; snapshot: string; createdByUserId: number }) {
    return this.prisma.calcVersion.create({ data: input })
  }

  updateSnapshot(versionId: number, snapshot: string) {
    return this.prisma.calcVersion.update({ where: { id: versionId }, data: { snapshot } })
  }

  remove(versionId: number) {
    return this.prisma.calcVersion.delete({ where: { id: versionId } })
  }
}
