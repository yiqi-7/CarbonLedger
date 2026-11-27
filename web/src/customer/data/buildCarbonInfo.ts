export interface BuildCarbonMaterial {
  emissionAmount: number
  totalPrice: number
}

export class BuildCarbonInfo {
  totalEmission: number
  totalMaterialCost: number
  emissionPerArea: number

  constructor() {
    this.totalEmission = 0
    this.totalMaterialCost = 0
    this.emissionPerArea = 0
  }

  update(materials: BuildCarbonMaterial[], buildingArea: number): void {
    this.totalEmission = materials.reduce((total, material) => total + material.emissionAmount, 0)
    this.totalMaterialCost = materials.reduce((total, material) => total + material.totalPrice, 0)
    this.emissionPerArea = buildingArea > 0
      ? this.totalEmission / buildingArea * 1000
      : 0
  }
}
