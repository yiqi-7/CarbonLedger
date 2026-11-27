import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { CalcVersionSnapshot } from '@carbonledger/shared'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { AnalysisService } from '../analysis/analysis.service'
import { ProjectsService } from '../projects/projects.service'
import { parseSnapshotOrThrow } from './snapshot'

@Injectable()
export class VersionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analysis: AnalysisService,
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
  ) {}

  /** 保存核算版本：显式点击保存后写入不可变快照 */
  async save(projectId: number, userId: number) {
    await this.projects.assertOwner(projectId, userId)
    const bundle = await this.analysis.buildBundle(projectId, userId)
    const last = await this.prisma.calcVersion.findFirst({
      where: { projectId },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true },
    })
    const versionNumber = (last?.versionNumber ?? 0) + 1
    const snapshot: CalcVersionSnapshot = {
      versionNumber,
      name: `版本 v${versionNumber}`,
      savedAt: new Date().toISOString(),
      savedByUserId: userId,
      project: bundle.projectInfo,
      factors: bundle.factors,
      buildMaterials: bundle.buildMaterials,
      transportRecords: bundle.transportRecords,
      constructionRecords: bundle.constructionRecords,
      recyclingRecords: bundle.recyclingRecords,
      summary: bundle.summary,
    }
    const created = await this.prisma.calcVersion.create({
      data: {
        projectId,
        versionNumber,
        snapshot: JSON.stringify(snapshot),
        createdByUserId: userId,
      },
    })
    await this.audit.record(
      userId,
      'VERSION_SAVED',
      'PROJECT',
      String(projectId),
      `版本 v${versionNumber}`,
    )
    return { id: created.id, versionNumber, createdAt: created.createdAt }
  }

  async list(projectId: number, userId: number) {
    await this.projects.assertOwner(projectId, userId)
    const versions = await this.prisma.calcVersion.findMany({
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
    return versions.map(version => {
      let netEmission: number | null = null
      let totalCost: number | null = null
      let name = `版本 v${version.versionNumber}`
      try {
        const snapshot = parseSnapshotOrThrow(version.snapshot)
        netEmission = snapshot.summary?.emission?.netEmission ?? null
        totalCost = snapshot.summary?.cost?.totalCost ?? null
        name = snapshot.name || name
      } catch {
        // 快照损坏时仍允许管理员看到版本列表，详情和导出会明确报错。
      }
      return {
        id: version.id,
        versionNumber: version.versionNumber,
        name,
        createdAt: version.createdAt,
        createdBy: version.createdBy.username,
        netEmission,
        totalCost,
      }
    })
  }

  async detail(projectId: number, userId: number, versionId: number): Promise<CalcVersionSnapshot & { id: number }> {
    await this.projects.assertOwner(projectId, userId)
    const version = await this.prisma.calcVersion.findFirst({
      where: { id: versionId, projectId },
    })
    if (!version) throw new NotFoundException('核算版本不存在')
    return { id: version.id, ...parseSnapshotOrThrow(version.snapshot) }
  }

  async rename(projectId: number, userId: number, versionId: number, name: string) {
    await this.projects.assertOwner(projectId, userId)
    const version = await this.prisma.calcVersion.findFirst({ where: { id: versionId, projectId } })
    if (!version) throw new NotFoundException('核算版本不存在')
    const trimmed = name.trim()
    if (!trimmed) throw new BadRequestException('版本名称不能为空')
    const snapshot = parseSnapshotOrThrow(version.snapshot)
    snapshot.name = trimmed
    await this.prisma.calcVersion.update({ where: { id: version.id }, data: { snapshot: JSON.stringify(snapshot) } })
    await this.audit.record(userId, 'VERSION_RENAMED', 'PROJECT', String(projectId), `版本 v${version.versionNumber}：${trimmed}`)
    return { id: version.id, name: trimmed }
  }

  async remove(projectId: number, userId: number, versionId: number) {
    await this.projects.assertOwner(projectId, userId)
    const version = await this.prisma.calcVersion.findFirst({ where: { id: versionId, projectId } })
    if (!version) throw new NotFoundException('核算版本不存在')
    await this.prisma.calcVersion.delete({ where: { id: version.id } })
    await this.audit.record(userId, 'VERSION_DELETED', 'PROJECT', String(projectId), `版本 v${version.versionNumber}`)
    return { id: version.id }
  }
}