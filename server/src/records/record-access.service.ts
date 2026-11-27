import { Injectable } from '@nestjs/common'
import { ProjectsService } from '../projects/projects.service'

@Injectable()
export class RecordAccessService {
  constructor(private readonly projects: ProjectsService) {}

  async assertOwner(projectId: number, userId: number): Promise<void> {
    await this.projects.assertOwner(projectId, userId)
  }
}
