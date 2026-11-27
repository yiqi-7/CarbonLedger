import { reactive } from 'vue'

export interface ProjectInfoState {
  projectName: string
  province: string
  cityDistrict: string
  address: string
  buildingArea: number
  floorCount: string | number
  buildingType: string
  structureType: string
  designLife: string | number
  modelImage: string | null
  modelImageName: string
  startDate: string
  plannedCompletionDate: string
  projectManager: string
  accountingStandard: string
  accountingStages: string[]
}

const defaults: ProjectInfoState = {
  projectName: '', province: '', cityDistrict: '', address: '',
  buildingArea: 0, floorCount: '', buildingType: '', structureType: '',
  designLife: '', modelImage: null, modelImageName: '', startDate: '',
  plannedCompletionDate: '', projectManager: '',
  accountingStandard: 'GB/T 51366-2019',
  accountingStages: ['建造生产阶段', '建造运输阶段', '施工建造阶段', '建造日常维护'],
}

export const ProjectInfo = reactive<ProjectInfoState>({
  ...defaults,
  accountingStages: [...defaults.accountingStages],
})

export function saveProjectInfo(projectInfo: Partial<ProjectInfoState>): void {
  const keys = Object.keys(defaults) as Array<keyof ProjectInfoState>
  for (const key of keys) {
    if (Object.hasOwn(projectInfo, key)) {
      ;(ProjectInfo as unknown as Record<string, unknown>)[key] = projectInfo[key]
    }
  }
}

declare global {
  interface Window {
    ProjectInfo: ProjectInfoState
  }
}

if (typeof window !== 'undefined') window.ProjectInfo = ProjectInfo
