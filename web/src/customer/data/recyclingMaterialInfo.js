export class RecyclingMateiralInfo {
  constructor({
    materialName,
    materialType,
    recyclingQuantity,
    unit,
    recyclingFactor,
    recyclingCoefficient = 0,
    recyclingUnitPrice = 0,
    sourceBuildMaterialId = null,
    isCustomMaterial = false
  }) {
    this.id = RecyclingMateiralInfo.nextId++
    this.materialName = materialName
    this.materialType = materialType
    this.recyclingQuantity = recyclingQuantity
    this.unit = unit
    this.recyclingFactor = recyclingFactor
    this.recyclingCoefficient = recyclingCoefficient
    this.reductionAmount = recyclingQuantity * recyclingFactor * recyclingCoefficient / 1000
    this.recyclingUnitPrice = recyclingUnitPrice
    this.residualValue = recyclingQuantity * recyclingUnitPrice / 10000
    this.sourceBuildMaterialId = sourceBuildMaterialId
    this.isCustomMaterial = isCustomMaterial
  }
}

RecyclingMateiralInfo.nextId = 1

class RecyclingMateiralNode {
  constructor(material) {
    this.material = material
    this.next = null
  }
}

export class RecyclingMateiralInfoList {
  constructor(materials = []) {
    this.head = null
    this.count = 0
    materials.forEach(material => this.append(material))
  }

  append(material) {
    const node = new RecyclingMateiralNode(material)
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
        Object.assign(current.material, updates)
        current.material.reductionAmount =
          current.material.recyclingQuantity *
          current.material.recyclingFactor *
          current.material.recyclingCoefficient / 1000
        current.material.residualValue =
          current.material.recyclingQuantity * current.material.recyclingUnitPrice / 10000
        return current.material
      }
      current = current.next
    }
    return null
  }
}

export const recyclingMateiralInfoList = new RecyclingMateiralInfoList()
