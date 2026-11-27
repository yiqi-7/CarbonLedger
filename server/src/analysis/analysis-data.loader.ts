import { Injectable, NotFoundException } from '@nestjs/common'
import { ACCOUNTING_STAGES } from '@carbonledger/shared'
import type {
  BuildFactorConfig,
  BuildMaterialRecord,
  ConstructionRecord,
  ProjectInfo,
  RecyclingRecord,
  TransportFactorConfig,
  TransportRecord,
} from '@carbonledger/shared'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectsService } from '../projects/projects.service'

/** Data loaded for the analysis bundle before summary calculations are applied. */
export interface AnalysisData {
  projectInfo: ProjectInfo
  factors: { build: BuildFactorConfig[]; transport: TransportFactorConfig[] }
  buildMaterials: BuildMaterialRecord[]
  transportRecords: TransportRecord[]
  constructionRecords: ConstructionRecord[]
  recyclingRecords: RecyclingRecord[]
  buildingArea: number
}

/** Loads the complete, project-scoped analysis input set in the legacy query order. */
@Injectable()
export class AnalysisDataLoader {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async load(projectId: number, userId: number): Promise<AnalysisData> {
    await this.projects.assertOwner(projectId, userId)
    const project = await this.prisma.project.findUnique({ where: { id: projectId } })
    if (!project) throw new NotFoundException('项目不存在')

    const [buildFactors, transportFactors, buildMaterials, transportRecords, constructionRecords, recyclingRecords] =
      await Promise.all([
        this.prisma.buildFactorConfig.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
        this.prisma.transportFactorConfig.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
        this.prisma.buildMaterial.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
        this.prisma.transportRecord.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
        this.prisma.constructionRecord.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
        this.prisma.recyclingRecord.findMany({ where: { projectId }, orderBy: { id: 'asc' } }),
      ])

    return {
      projectInfo: {
        projectName: project.projectName,
        province: project.province,
        cityDistrict: project.cityDistrict,
        address: project.address,
        buildingArea: project.buildingArea,
        floorCount: project.floorCount,
        buildingType: project.buildingType,
        structureType: project.structureType,
        designLife: project.designLife,
        modelImage: project.modelImage,
        modelImageName: project.modelImageName,
        startDate: project.startDate,
        plannedCompletionDate: project.plannedCompletionDate,
        projectManager: project.projectManager,
        accountingStandard: project.accountingStandard,
        accountingStages: ACCOUNTING_STAGES,
      },
      factors: {
        build: buildFactors as unknown as BuildFactorConfig[],
        transport: transportFactors as unknown as TransportFactorConfig[],
      },
      buildMaterials: buildMaterials as unknown as BuildMaterialRecord[],
      transportRecords: transportRecords as unknown as TransportRecord[],
      constructionRecords: constructionRecords as unknown as ConstructionRecord[],
      recyclingRecords: recyclingRecords as unknown as RecyclingRecord[],
      buildingArea: project.buildingArea,
    }
  }
}
