import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { CalcVersionSnapshot } from '@carbonledger/shared'
import { AuditService } from '../audit/audit.service'
import { AnalysisService } from '../analysis/analysis.service'
import { ProjectsService } from '../projects/projects.service'
import { CalcVersionRepository } from './calc-version.repository'
import { SnapshotFactory } from './snapshot.factory'

@Injectable()
export class VersionsService {
  constructor(
    private readonly repository: CalcVersionRepository,
    private readonly snapshots: SnapshotFactory,
    private readonly analysis: AnalysisService,
    private readonly projects: ProjectsService,
    private readonly audit: AuditService,
  ) {}

  /** 保存核算版本：显式点击保存后写入不可变快照 */
  async save(projectId: number, userId: number) {
    await this.projects.assertOwner(projectId, userId)
    const bundle = await this.analysis.buildBundle(projectId, userId)
    const last = await this.repository.findLatest(projectId)
    const versionNumber = (last?.versionNumber ?? 0) + 1
    const snapshot = this.snapshots.create(versionNumber, userId, bundle)
    const created = await this.repository.create({
      projectId,
      versionNumber,
      snapshot: this.snapshots.serialize(snapshot),
      createdByUserId: userId,
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
    const versions = await this.repository.findMany(projectId)
    return versions.map(version => ({
      id: version.id,
      versionNumber: version.versionNumber,
      ...this.snapshots.project(version.snapshot, version.versionNumber),
      createdAt: version.createdAt,
      createdBy: version.createdBy.username,
    }))
  }

  async detail(projectId: number, userId: number, versionId: number): Promise<CalcVersionSnapshot & { id: number }> {
    await this.projects.assertOwner(projectId, userId)
    const version = await this.repository.findById(projectId, versionId)
    if (!version) throw new NotFoundException('核算版本不存在')
    return { id: version.id, ...this.snapshots.parse(version.snapshot) }
  }

  async rename(projectId: number, userId: number, versionId: number, name: string) {
    await this.projects.assertOwner(projectId, userId)
    const version = await this.repository.findById(projectId, versionId)
    if (!version) throw new NotFoundException('核算版本不存在')
    const trimmed = name.trim()
    if (!trimmed) throw new BadRequestException('版本名称不能为空')
    const snapshot = this.snapshots.rename(version.snapshot, trimmed)
    await this.repository.updateSnapshot(version.id, snapshot)
    await this.audit.record(userId, 'VERSION_RENAMED', 'PROJECT', String(projectId), `版本 v${version.versionNumber}：${trimmed}`)
    return { id: version.id, name: trimmed }
  }

  async remove(projectId: number, userId: number, versionId: number) {
    await this.projects.assertOwner(projectId, userId)
    const version = await this.repository.findById(projectId, versionId)
    if (!version) throw new NotFoundException('核算版本不存在')
    await this.repository.remove(version.id)
    await this.audit.record(userId, 'VERSION_DELETED', 'PROJECT', String(projectId), `版本 v${version.versionNumber}`)
    return { id: version.id }
  }
}
