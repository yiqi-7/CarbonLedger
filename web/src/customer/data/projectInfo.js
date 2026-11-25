import { reactive } from 'vue'

// The API owns each project's values. Never share a browser-local project
// draft between projects or authenticated accounts.
const defaults = {
  projectName: '', province: '', cityDistrict: '', address: '',
  buildingArea: 0, floorCount: '', buildingType: '', structureType: '',
  designLife: '', modelImage: null, modelImageName: '', startDate: '',
  plannedCompletionDate: '', projectManager: '',
  accountingStandard: 'GB/T 51366-2019',
  accountingStages: ['建造生产阶段', '建造运输阶段', '施工建造阶段', '建造日常维护'],
}

export const ProjectInfo = reactive({ ...defaults, accountingStages: [...defaults.accountingStages] })

export function saveProjectInfo(projectInfo) {
  for (const key of Object.keys(defaults)) {
    if (Object.hasOwn(projectInfo, key)) ProjectInfo[key] = projectInfo[key]
  }
}

if (typeof window !== 'undefined') window.ProjectInfo = ProjectInfo
