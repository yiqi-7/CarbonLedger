export interface BuildMaterialInfoInput {
  materialName: string
  type: string
  quantity: number
  unit: string
  emissionFactor: number
  marketPrice?: number | null
  unitPrice: number
  recyclingFactor?: number
  recyclingCoefficient?: number
  isParticipatingInRecyclingCalculation?: boolean
  isCustomMaterial?: boolean
}

export interface BuildMaterialInfoUpdates {
  [key: string]: unknown
}

export class BuildMaterialInfo {
  static nextId: number

  id: number
  materialName: string
  type: string
  quantity: number
  unit: string
  emissionFactor: number
  emissionAmount: number
  marketPrice: number | null
  unitPrice: number
  totalPrice: number
  recyclingFactor: number
  recyclingCoefficient: number
  isParticipatingInRecyclingCalculation: boolean
  isCustomMaterial: boolean

  constructor({
    materialName,
    type,
    quantity,
    unit,
    emissionFactor,
    marketPrice = null,
    unitPrice,
    recyclingFactor = 0,
    recyclingCoefficient = 0,
    isParticipatingInRecyclingCalculation = recyclingFactor > 0,
    isCustomMaterial = false,
  }: BuildMaterialInfoInput) {
    this.id = BuildMaterialInfo.nextId++
    this.materialName = materialName
    this.type = type
    this.quantity = quantity
    this.unit = unit
    this.emissionFactor = emissionFactor
    this.emissionAmount = quantity * emissionFactor / 1000
    this.marketPrice = marketPrice
    this.unitPrice = unitPrice
    this.totalPrice = quantity * unitPrice / 10000
    this.recyclingFactor = recyclingFactor
    this.recyclingCoefficient = recyclingCoefficient
    this.isParticipatingInRecyclingCalculation = isParticipatingInRecyclingCalculation
    this.isCustomMaterial = isCustomMaterial
  }
}

BuildMaterialInfo.nextId = 1

class BuildMaterialNode {
  material: BuildMaterialInfo
  next: BuildMaterialNode | null

  constructor(material: BuildMaterialInfo) {
    this.material = material
    this.next = null
  }
}

export class BuildMaterialInfoList {
  head: BuildMaterialNode | null
  count: number

  constructor(materials: BuildMaterialInfo[] = []) {
    this.head = null
    this.count = 0
    materials.forEach(material => this.append(material))
  }

  append(material: BuildMaterialInfo): BuildMaterialInfo {
    const node = new BuildMaterialNode(material)
    if (!this.head) {
      this.head = node
    } else {
      let current = this.head
      while (current.next) current = current.next
      current.next = node
    }
    this.count += 1
    return node.material
  }

  removeById(id: number): BuildMaterialInfo | null {
    let previous: BuildMaterialNode | null = null
    let current = this.head

    while (current) {
      if (current.material.id === id) {
        if (previous) previous.next = current.next
        else this.head = current.next
        this.count -= 1
        return current.material
      }
      previous = current
      current = current.next
    }

    return null
  }

  toArray(): BuildMaterialInfo[] {
    const materials: BuildMaterialInfo[] = []
    let current = this.head
    while (current) {
      materials.push(current.material)
      current = current.next
    }
    return materials
  }

  updateById(id: number, updates: BuildMaterialInfoUpdates): BuildMaterialInfo | null {
    let current = this.head
    while (current) {
      if (current.material.id === id) {
        Object.assign(current.material, updates)
        current.material.emissionAmount =
          current.material.quantity * current.material.emissionFactor / 1000
        current.material.totalPrice = current.material.quantity * current.material.unitPrice / 10000
        return current.material
      }
      current = current.next
    }
    return null
  }
}

export const buildMaterialInfoList = new BuildMaterialInfoList()
