import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { CalcVersionSnapshot } from '@carbonledger/shared'
import { AuditService } from '../audit/audit.service'
import { AnalysisService } from '../analysis/analysis.service'
import { ProjectsService } from '../projects/projects.service'
import { CalcVersionRepository, isVersionNumberConflict } from './calc-version.repository'
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

    // A concurrent save may win between findLatest and create. Re-read and rebuild
    // the snapshot after that conflict so its embedded number matches the row.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const last = await this.repository.findLatest(projectId)
      const versionNumber = (last?.versionNumber ?? 0) + 1
      const snapshot = this.snapshots.create(versionNumber, userId, bundle)
      try {
        const created = await this.repository.create({
          projectId,
          versionNumber,
          name: snapshot.name ?? null,
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
      } catch (error) {
        if (!isVersionNumberConflict(error) || attempt === 2) throw error
      }
    }

    throw new Error('Version save retry exhausted')
  }

  async list(projectId: number, userId: number) {
    await this.projects.assertOwner(projectId, userId)
    const versions = await this.repository.findMany(projectId)
    return versions.map(version => {
      const projection = this.snapshots.project(version.snapshot, version.versionNumber)
      return {
        id: version.id,
        versionNumber: version.versionNumber,
        ...projection,
        name: version.name ?? projection.name,
        createdAt: version.createdAt,
        createdBy: version.createdBy.username,
      }
    })
  }

  async detail(projectId: number, userId: number, versionId: number): Promise<CalcVersionSnapshot & { id: number }> {
    await this.projects.assertOwner(projectId, userId)
    const version = await this.repository.findById(projectId, versionId)
    if (!version) throw new NotFoundException('核算版本不存在')
    const snapshot = this.snapshots.parse(version.snapshot)
    return { id: version.id, ...snapshot, name: version.name ?? snapshot.name }
  }

  async rename(projectId: number, userId: number, versionId: number, name: string) {
    await this.projects.assertOwner(projectId, userId)
    const version = await this.repository.findById(projectId, versionId)
    if (!version) throw new NotFoundException('核算版本不存在')
    const trimmed = name.trim()
    if (!trimmed) throw new BadRequestException('版本名称不能为空')
    await this.repository.updateName(version.id, trimmed)
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
