import axios from 'axios'

export const api = axios.create({ baseURL: '/api', timeout: 20000 })

api.interceptors.request.use(config => {
  const token = typeof localStorage === 'undefined' ? null : localStorage.getItem('carbon-ledger-token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('carbon-ledger-token')
      window.dispatchEvent(new Event('carbon-ledger-unauthorized'))
    }
    return Promise.reject(error)
  },
)

export type AuthUser = { id: number; username: string; role: 'USER' | 'ADMIN'; status: string }
export type ProjectSummary = {
  id: number
  projectName: string
  province: string
  cityDistrict: string
  buildingArea: number
  buildingType: string
  updatedAt: string
  latestVersion: { versionNumber: number; createdAt: string } | null
  recordCounts: Record<string, number>
}

export type Project = ProjectSummary & Record<string, unknown>

export type BuildMaterial = {
  id: number; materialName: string; type: string; quantity: number; unit: string
  emissionFactor: number; marketPrice: number | null; unitPrice: number; emissionAmount: number; totalPrice: number
  recyclingFactor: number; recyclingCoefficient: number
}
export type TransportRecord = {
  id: number; vehicleName: string; transportedMaterial: string; transportQuantity: number
  transportDistance: number; energyType: string; emissionFactor: number; transportUnitPrice: number
  emissionAmount: number; transportTotalPrice: number
}
export type ConstructionRecord = {
  id: number; machineryName: string; shiftCount: number; energyType: string; energyPerShift: number
  emissionFactor: number; shiftUnitPrice: number; totalEnergy: number; emissionAmount: number; totalPrice: number
}
export type RecyclingRecord = {
  id: number; materialName: string; materialType: string; recyclingQuantity: number
  recyclingFactor: number; recyclingCoefficient: number; reductionAmount: number; residualValue: number
  sourceBuildMaterialId: number | null; isCustomMaterial: boolean
}
