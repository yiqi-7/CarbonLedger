import { constructionEnergyTypes } from './constructionMaterialInfo.js'

export class ConstructionCarbonInfo {
  constructor() {
    this.totalEmission = 0
    this.totalShiftCount = 0
    this.energyTotals = Object.fromEntries(
      Object.entries(constructionEnergyTypes).map(([energyType, energy]) => [
        energyType,
        { energyTotal: 0, emissionAmount: 0, share: 0, unit: energy.unit, emissionFactor: energy.emissionFactor }
      ])
    )
  }

  update(materials) {
    this.totalShiftCount = materials.reduce((total, material) => total + material.shiftCount, 0)
    this.totalEmission = materials.reduce((total, material) => total + material.emissionAmount, 0)

    for (const [energyType, energy] of Object.entries(constructionEnergyTypes)) {
      const energyMaterials = materials.filter(material => material.energyType === energyType)
      const energyTotal = energyMaterials.reduce((total, material) => total + material.totalEnergy, 0)
      const emissionAmount = energyMaterials.reduce((total, material) => total + material.emissionAmount, 0)
      this.energyTotals[energyType] = {
        energyTotal,
        emissionAmount,
        share: this.totalEmission > 0 ? emissionAmount / this.totalEmission * 100 : 0,
        unit: energy.unit,
        emissionFactor: energyTotal > 0 ? emissionAmount / energyTotal : energy.emissionFactor
      }
    }
  }
}
