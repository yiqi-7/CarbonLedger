export const constructionEnergyTypes = {
  电力: { unit: 'kWh', emissionFactor: 0.581 },
  柴油: { unit: 'kg', emissionFactor: 2.632 },
  汽油: { unit: 'kg', emissionFactor: 2.34 }
}

export class ConstructionMaterialInfo {
  constructor({
    machineryName,
    shiftCount,
    energyType,
    energyPerShift,
    shiftUnitPrice,
    emissionFactor,
    isCustomMaterial = false
  }) {
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
  constructor(material) {
    this.material = material
    this.next = null
  }
}

export class ConstructionMaterialInfoList {
  constructor(materials = []) {
    this.head = null
    this.count = 0
    materials.forEach(material => this.append(material))
  }

  append(material) {
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

  removeById(id) {
    let previous = null
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

  toArray() {
    const materials = []
    let current = this.head
    while (current) {
      materials.push(current.material)
      current = current.next
    }
    return materials
  }

  updateById(id, updates) {
    let current = this.head
    while (current) {
      if (current.material.id === id) {
        const material = current.material
        const values = { ...material, ...updates }
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
