import { BadRequestException, Injectable } from '@nestjs/common'
import type { CalcVersionSnapshot } from '@carbonledger/shared'
import type { ProjectBundle } from '../analysis/analysis.service'

export interface VersionListProjection {
  name: string
  netEmission: number | null
  totalCost: number | null
}

/** Builds and reads the immutable JSON document stored for a calculation version. */
@Injectable()
export class SnapshotFactory {
  create(versionNumber: number, userId: number, bundle: ProjectBundle): CalcVersionSnapshot {
    return {
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
  }

  serialize(snapshot: CalcVersionSnapshot): string {
    return JSON.stringify(snapshot)
  }

  parse(serialized: string): CalcVersionSnapshot {
    try {
      const snapshot = JSON.parse(serialized) as Partial<CalcVersionSnapshot>
      if (!snapshot || typeof snapshot !== 'object' || !snapshot.summary || !snapshot.project) {
        throw new Error('invalid snapshot shape')
      }
      return snapshot as CalcVersionSnapshot
    } catch {
      throw new BadRequestException('核算版本快照损坏，无法读取')
    }
  }

  project(serialized: string, versionNumber: number): VersionListProjection {
    let name = `版本 v${versionNumber}`
    let netEmission: number | null = null
    let totalCost: number | null = null
    try {
      const snapshot = this.parse(serialized)
      netEmission = snapshot.summary?.emission?.netEmission ?? null
      totalCost = snapshot.summary?.cost?.totalCost ?? null
      name = snapshot.name || name
    } catch {
      // A malformed snapshot should not make the version list unavailable.
    }
    return { name, netEmission, totalCost }
  }

  /**
   * Rename the existing JSON document in place. This deliberately retains the
   * existing snapshot representation and only changes its name property.
   */
  rename(serialized: string, name: string): string {
    const snapshot = this.parse(serialized)
    snapshot.name = name
    return this.serialize(snapshot)
  }
}
