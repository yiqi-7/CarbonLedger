import { Injectable, NotFoundException } from '@nestjs/common'
import {
  ACCOUNTING_STAGES,
  computeBuildSummary,
  computeConstructionSummary,
  computeCostAnalysis,
  computeEmissionAnalysis,
  computeRecyclingSummary,
  computeTransportSummary,
} from '@carbonledger/shared'
import type {
  BuildCarbonSummary,
  BuildFactorConfig,
  BuildMaterialRecord,
  ConstructionCarbonSummary,
  ConstructionRecord,
  CostAnalysis,
  EmissionAnalysis,
  ProjectInfo,
  RecyclingCarbonSummary,
  RecyclingRecord,
  TransportCarbonSummary,
  TransportFactorConfig,
  TransportRecord,
} from '@carbonledger/shared'
import { PrismaService } from '../prisma/prisma.service'
import { ProjectsService } from '../projects/projects.service'

export interface ProjectBundle {
  projectInfo: ProjectInfo
  factors: { build: BuildFactorConfig[]; transport: TransportFactorConfig[] }
  buildMaterials: BuildMaterialRecord[]
  transportRecords: TransportRecord[]
  constructionRecords: ConstructionRecord[]
  recyclingRecords: RecyclingRecord[]
  summary: {
    build: BuildCarbonSummary
    transport: TransportCarbonSummary
    construction: ConstructionCarbonSummary
    recycling: RecyclingCarbonSummary
    emission: EmissionAnalysis
    cost: CostAnalysis
  }
}

/** 组装项目全量数据并按旧版口径计算全部汇总（服务端为权威计算） */
@Injectable()
export class AnalysisService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly projects: ProjectsService,
  ) {}

  async buildBundle(projectId: number, userId?: number): Promise<ProjectBundle> {
    if (userId != null) await this.projects.assertOwner(projectId, userId)
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

    const projectInfo: ProjectInfo = {
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
    }

    const build = computeBuildSummary(buildMaterials, project.buildingArea)
    const typedTransportRecords = transportRecords as unknown as TransportRecord[]
    const typedConstructionRecords = constructionRecords as unknown as ConstructionRecord[]
    const typedRecyclingRecords = recyclingRecords as unknown as RecyclingRecord[]
    const transport = computeTransportSummary(typedTransportRecords)
    const construction = computeConstructionSummary(typedConstructionRecords)
    const recycling = computeRecyclingSummary(typedRecyclingRecords, build.totalEmission)
    const emission = computeEmissionAnalysis(
      buildMaterials as unknown as BuildMaterialRecord[],
      build,
      transport,
      construction,
      recycling,
      project.buildingArea,
    )
    const cost = computeCostAnalysis(
      buildMaterials as unknown as BuildMaterialRecord[],
      typedTransportRecords,
      typedConstructionRecords,
      emission.netEmission,
      project.buildingArea,
    )

    return {
      projectInfo,
      factors: {
        build: buildFactors as unknown as BuildFactorConfig[],
        transport: transportFactors as unknown as TransportFactorConfig[],
      },
      buildMaterials: buildMaterials as unknown as BuildMaterialRecord[],
      transportRecords: typedTransportRecords,
      constructionRecords: typedConstructionRecords,
      recyclingRecords: typedRecyclingRecords,
      summary: { build, transport, construction, recycling, emission, cost },
    }
  }
}