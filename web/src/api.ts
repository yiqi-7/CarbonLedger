import axios from 'axios'

export const api = axios.create({ baseURL: '/api', timeout: 20000 })

export function apiMessage(error: unknown, fallback = '操作失败'): string {
  const value = error as { response?: { data?: { message?: string | string[] } } }
  const message = value.response?.data?.message
  return Array.isArray(message) ? message.join('；') : message || fallback
}

export async function downloadApiFile(path: string, fallbackName: string): Promise<void> {
  const response = await api.get(path, { responseType: 'blob' })
  const disposition = String(response.headers['content-disposition'] || '')
  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1]
  const filename = encoded ? decodeURIComponent(encoded) : fallbackName
  const url = URL.createObjectURL(response.data)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

api.interceptors.request.use(config => {
  const token = typeof localStorage === 'undefined' ? null : localStorage.getItem('carbon-ledger-token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      const currentToken = localStorage.getItem('carbon-ledger-token')
      const requestAuthorization = axios.AxiosHeaders.from(error.config?.headers ?? {}).get('Authorization')
      // A request from the expired session can finish after a fresh login.
      // Only the current session's failure may invalidate the stored token.
      if (!currentToken || requestAuthorization === `Bearer ${currentToken}`) {
        localStorage.removeItem('carbon-ledger-token')
        window.dispatchEvent(new Event('carbon-ledger-unauthorized'))
      }
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
  isCustomMaterial: boolean
  id: number; materialName: string; type: string; quantity: number; unit: string
  emissionFactor: number; marketPrice: number | null; unitPrice: number; emissionAmount: number; totalPrice: number
  recyclingFactor: number; recyclingCoefficient: number
}
export type TransportRecord = {
  isCustomMaterial: boolean
  id: number; vehicleName: string; transportedMaterial: string; transportQuantity: number
  transportDistance: number; energyType: string; emissionFactor: number; transportUnitPrice: number
  emissionAmount: number; transportTotalPrice: number
}
export type ConstructionRecord = {
  isCustomMaterial: boolean; energyUnit: string
  id: number; machineryName: string; shiftCount: number; energyType: string; energyPerShift: number
  emissionFactor: number; shiftUnitPrice: number; totalEnergy: number; emissionAmount: number; totalPrice: number
}
export type RecyclingRecord = {
  unit: string; recyclingUnitPrice: number
  id: number; materialName: string; materialType: string; recyclingQuantity: number
  recyclingFactor: number; recyclingCoefficient: number; reductionAmount: number; residualValue: number
  sourceBuildMaterialId: number | null; isCustomMaterial: boolean
}
