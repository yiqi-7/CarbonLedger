import type { ConstructionEnergyType, TransportEnergyType } from '@carbonledger/shared'

/**
 * Inputs for authorized import coordination.
 * These types live in the records boundary so child services never depend on import-export.
 */

export interface ImportedBuildMaterialInput {
  materialName: string
  type: string
  quantity: number
  unit: string
  emissionFactor: number
  marketPrice: number | null
  unitPrice: number
  recyclingFactor: number
  recyclingCoefficient: number
}

export interface ImportedTransportRecordInput {
  vehicleName: string
  transportedMaterial: string
  transportQuantity: number
  transportDistance: number
  energyType: TransportEnergyType
  emissionFactor: number
  transportUnitPrice: number
}

export interface ImportedConstructionRecordInput {
  machineryName: string
  shiftCount: number
  energyType: ConstructionEnergyType
  energyPerShift: number
  emissionFactor: number
  shiftUnitPrice: number
}

export interface ImportedBuildMaterialsInput {
  materials: ImportedBuildMaterialInput[]
}

export interface ImportedTransportRecordsInput {
  records: ImportedTransportRecordInput[]
  skippedRows: number
}

export interface ImportedConstructionRecordsInput {
  records: ImportedConstructionRecordInput[]
  skippedRows: number
}

export interface ImportedRecordsWriteResult {
  imported: number
  skippedRows: number
}
