import { transportEnergyTypes } from './transportMaterialInfo'

export interface TransportCarbonMaterial {
  energyType: string
  emissionAmount: number
}

export interface TransportEnergyTotal {
  emissionAmount: number
  share: number
}

export class TransportCarbonInfo {
  totalEmission: number
  energyTotals: Record<string, TransportEnergyTotal>

  constructor() {
    this.totalEmission = 0
    this.energyTotals = Object.fromEntries(
      transportEnergyTypes.map(energyType => [
        energyType,
        { emissionAmount: 0, share: 0 }
      ])
    )
  }

  update(materials: TransportCarbonMaterial[]): void {
    this.totalEmission = materials.reduce((total, material) => total + material.emissionAmount, 0)

    for (const energyType of transportEnergyTypes) {
      const emissionAmount = materials
        .filter(material => material.energyType === energyType)
        .reduce((total, material) => total + material.emissionAmount, 0)
      this.energyTotals[energyType] = {
        emissionAmount,
        share: this.totalEmission > 0 ? emissionAmount / this.totalEmission * 100 : 0
      }
    }
  }
}
