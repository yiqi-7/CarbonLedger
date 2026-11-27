export interface ConstructionEnergyType {
  unit: string
  emissionFactor: number
}

export const constructionEnergyTypes: Record<string, ConstructionEnergyType> = {
  电力: { unit: 'kWh', emissionFactor: 0.581 },
  柴油: { unit: 'kg', emissionFactor: 2.632 },
  汽油: { unit: 'kg', emissionFactor: 2.34 }
}

export interface ConstructionMaterialInfoInput {
  machineryName: string
  shiftCount: number
  energyType: string
  energyPerShift: number
  shiftUnitPrice: number
  emissionFactor?: number
  isCustomMaterial?: boolean
}

export interface ConstructionMaterialInfoUpdates {
  [key: string]: unknown
}

export class ConstructionMaterialInfo {
  static nextId: number

  id: number
  machineryName: string
  shiftCount: number
  energyType: string
  energyUnit: string
  energyPerShift: number
  totalEnergy: number
  emissionFactor: number
  emissionAmount: number
  shiftUnitPrice: number
  totalPrice: number
  isCustomMaterial: boolean

  constructor({
    machineryName,
    shiftCount,
    energyType,
    energyPerShift,
    shiftUnitPrice,
    emissionFactor,
    isCustomMaterial = false
  }: ConstructionMaterialInfoInput) {
    const energy = constructionEnergyTypes[energyType]
    if (!energy) throw new Error(`Unsupported construction energy type: ${energyType}`)

    this.id = ConstructionMaterialInfo.nextId++
    this.machineryName = machineryName
    this.shiftCount = shiftCount
    this.energyType = energyType
    this.energyUnit = energy.unit
    this.energyPerShift = energyPerShift
    this.totalEnergy = shiftCount * energyPerShift
    this.emissionFactor = emissionFactor ?? energy.emissionFactor
    this.emissionAmount = this.totalEnergy * this.emissionFactor
    this.shiftUnitPrice = shiftUnitPrice
    this.totalPrice = shiftCount * shiftUnitPrice / 10000
    this.isCustomMaterial = isCustomMaterial
  }
}

ConstructionMaterialInfo.nextId = 1

class ConstructionMaterialNode {
  material: ConstructionMaterialInfo
  next: ConstructionMaterialNode | null

  constructor(material: ConstructionMaterialInfo) {
    this.material = material
    this.next = null
  }
}

export class ConstructionMaterialInfoList {
  head: ConstructionMaterialNode | null
  count: number

  constructor(materials: ConstructionMaterialInfo[] = []) {
    this.head = null
    this.count = 0
    materials.forEach(material => this.append(material))
  }

  append(material: ConstructionMaterialInfo): ConstructionMaterialInfo {
    const node = new ConstructionMaterialNode(material)
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

  removeById(id: number): ConstructionMaterialInfo | null {
    let previous: ConstructionMaterialNode | null = null
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

  toArray(): ConstructionMaterialInfo[] {
    const materials: ConstructionMaterialInfo[] = []
    let current = this.head
    while (current) {
      materials.push(current.material)
      current = current.next
    }
    return materials
  }

  updateById(id: number, updates: ConstructionMaterialInfoUpdates): ConstructionMaterialInfo | null {
    let current = this.head
    while (current) {
      if (current.material.id === id) {
        const material = current.material
        const values = { ...material, ...updates } as ConstructionMaterialInfo & ConstructionMaterialInfoInput
        const energy = constructionEnergyTypes[values.energyType]
        if (!energy) throw new Error(`Unsupported construction energy type: ${values.energyType}`)
        const emissionFactor = Object.hasOwn(updates, 'energyType')
          ? energy.emissionFactor
          : values.emissionFactor
        Object.assign(material, updates, {
          energyUnit: energy.unit,
          emissionFactor,
          totalEnergy: values.shiftCount * values.energyPerShift,
          emissionAmount: values.shiftCount * values.energyPerShift * emissionFactor,
          totalPrice: values.shiftCount * values.shiftUnitPrice / 10000
        })
        return material
      }
      current = current.next
    }
    return null
  }
}

export const constructionMaterialInfoList = new ConstructionMaterialInfoList()
