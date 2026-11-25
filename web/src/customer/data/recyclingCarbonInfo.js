export class RecyclingCarbonInfo {
  constructor() {
    this.totalReduction = 0
    this.totalRecyclingQuantity = 0
    this.recyclingUtilizationRate = 0
    this.estimatedResidualValue = 0
  }

  update(materials, totalBuildingEmission) {
    this.totalReduction = materials.reduce(
      (total, material) => total + material.recyclingQuantity *
        material.recyclingFactor * material.recyclingCoefficient / 1000,
      0
    )
    this.totalRecyclingQuantity = materials.reduce((total, material) => total + material.recyclingQuantity, 0)
    this.estimatedResidualValue = materials.reduce((total, material) => total + material.residualValue, 0)
    this.recyclingUtilizationRate = totalBuildingEmission > 0
      ? this.totalReduction / totalBuildingEmission * 100
      : 0
  }
}
