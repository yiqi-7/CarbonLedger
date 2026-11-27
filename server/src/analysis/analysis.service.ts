import { Injectable } from '@nestjs/common'
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
import { AnalysisCalculator, type AnalysisSummary } from './analysis-calculator'
import { AnalysisDataLoader } from './analysis-data.loader'

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

/** Coordinates loading the complete project data set and authoritative summaries. */
@Injectable()
export class AnalysisService {
  constructor(
    private readonly loader: AnalysisDataLoader,
    private readonly calculator: AnalysisCalculator,
  ) {}

  async buildBundle(projectId: number, userId: number): Promise<ProjectBundle> {
    const data = await this.loader.load(projectId, userId)
    const summary: AnalysisSummary = this.calculator.calculate(data)
    return {
      projectInfo: data.projectInfo,
      factors: data.factors,
      buildMaterials: data.buildMaterials,
      transportRecords: data.transportRecords,
      constructionRecords: data.constructionRecords,
      recyclingRecords: data.recyclingRecords,
      summary,
    }
  }
}
