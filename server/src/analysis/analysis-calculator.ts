import { Injectable } from '@nestjs/common'
import {
  computeBuildSummary,
  computeConstructionSummary,
  computeCostAnalysis,
  computeEmissionAnalysis,
  computeRecyclingSummary,
  computeTransportSummary,
} from '@carbonledger/shared'
import type {
  BuildCarbonSummary,
  BuildMaterialRecord,
  ConstructionCarbonSummary,
  CostAnalysis,
  EmissionAnalysis,
  RecyclingCarbonSummary,
  TransportCarbonSummary,
  TransportRecord,
  ConstructionRecord,
  RecyclingRecord,
} from '@carbonledger/shared'
import type { AnalysisData } from './analysis-data.loader'

export interface AnalysisSummary {
  build: BuildCarbonSummary
  transport: TransportCarbonSummary
  construction: ConstructionCarbonSummary
  recycling: RecyclingCarbonSummary
  emission: EmissionAnalysis
  cost: CostAnalysis
}

/** Applies the authoritative shared formulas to a loaded analysis data set. */
@Injectable()
export class AnalysisCalculator {
  calculate(data: AnalysisData): AnalysisSummary {
    const buildMaterials = data.buildMaterials as BuildMaterialRecord[]
    const transportRecords = data.transportRecords as TransportRecord[]
    const constructionRecords = data.constructionRecords as ConstructionRecord[]
    const recyclingRecords = data.recyclingRecords as RecyclingRecord[]
    const build = computeBuildSummary(buildMaterials, data.buildingArea)
    const transport = computeTransportSummary(transportRecords)
    const construction = computeConstructionSummary(constructionRecords)
    const recycling = computeRecyclingSummary(recyclingRecords, build.totalEmission)
    const emission = computeEmissionAnalysis(
      buildMaterials,
      build,
      transport,
      construction,
      recycling,
      data.buildingArea,
    )
    const cost = computeCostAnalysis(
      buildMaterials,
      transportRecords,
      constructionRecords,
      emission.netEmission,
      data.buildingArea,
    )
    return { build, transport, construction, recycling, emission, cost }
  }
}
