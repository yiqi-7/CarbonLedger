export const transportEnergyTypes: string[] = ['柴油', '汽油']

export interface TransportMaterialInfoInput {
  vehicleName: string
  transportedMaterial: string
  transportQuantity: number
  transportDistance: number
  energyType: string
  emissionFactor: number
  transportUnitPrice: number
  isCustomMaterial?: boolean
}

export interface TransportMaterialInfoUpdates {
  [key: string]: unknown
}

export class TransportMaterialInfo {
  static nextId: number

  id: number
  vehicleName: string
  transportedMaterial: string
  transportQuantity: number
  transportDistance: number
  energyType: string
  emissionFactor: number
  emissionAmount: number
  transportUnitPrice: number
  transportTotalPrice: number
  isCustomMaterial: boolean

  constructor({
    vehicleName,
    transportedMaterial,
    transportQuantity,
    transportDistance,
    energyType,
    emissionFactor,
    transportUnitPrice,
    isCustomMaterial = false
  }: TransportMaterialInfoInput) {
    if (!transportEnergyTypes.includes(energyType)) {
      throw new Error(`Unsupported transport energy type: ${energyType}`)
    }

    this.id = TransportMaterialInfo.nextId++
    this.vehicleName = vehicleName
    this.transportedMaterial = transportedMaterial
    this.transportQuantity = transportQuantity
    this.transportDistance = transportDistance
    this.energyType = energyType
    this.emissionFactor = emissionFactor
    this.emissionAmount = transportDistance * transportQuantity * emissionFactor / 1000
    this.transportUnitPrice = transportUnitPrice
    this.transportTotalPrice = transportDistance * transportUnitPrice / 10000
    this.isCustomMaterial = isCustomMaterial
  }
}

TransportMaterialInfo.nextId = 1

class TransportMaterialNode {
  material: TransportMaterialInfo
  next: TransportMaterialNode | null

  constructor(material: TransportMaterialInfo) {
    this.material = material
    this.next = null
  }
}

export class TransportMaterialInfoList {
  head: TransportMaterialNode | null
  count: number

  constructor(materials: TransportMaterialInfo[] = []) {
    this.head = null
    this.count = 0
    materials.forEach(material => this.append(material))
  }

  append(material: TransportMaterialInfo): TransportMaterialInfo {
    const node = new TransportMaterialNode(material)
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

  removeById(id: number): TransportMaterialInfo | null {
    let previous: TransportMaterialNode | null = null
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

  toArray(): TransportMaterialInfo[] {
    const materials: TransportMaterialInfo[] = []
    let current = this.head
    while (current) {
      materials.push(current.material)
      current = current.next
    }
    return materials
  }

  updateById(id: number, updates: TransportMaterialInfoUpdates): TransportMaterialInfo | null {
    let current = this.head
    while (current) {
      if (current.material.id === id) {
        const material = current.material
        Object.assign(material, updates)
        material.emissionAmount =
          material.transportDistance * material.transportQuantity * material.emissionFactor / 1000
        material.transportTotalPrice = material.transportDistance * material.transportUnitPrice / 10000
        return material
      }
      current = current.next
    }
    return null
  }
}

export const transportMaterialInfoList = new TransportMaterialInfoList()
