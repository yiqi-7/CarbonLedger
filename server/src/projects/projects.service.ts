import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AuditService } from '../audit/audit.service'
import { LegacyConfigService } from './legacy-config.service'
import { BuildFactorDto, CreateProjectDto, TransportFactorDto, UpdateProjectDto } from './project.dto'
import type { TransportEnergyType } from '@carbonledger/shared'

@Injectable()
export class ProjectsService implements OnModuleInit {
  private readonly logger = new Logger(ProjectsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly legacyConfig: LegacyConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.legacyConfig.load()
  }

  /** 校验项目归属：非所有者一律拒绝（管理员同样不能越权访问他人项目数据） */
  async assertOwner(projectId: number, userId: number): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ownerId: true },
    })
    if (!project) throw new NotFoundException('项目不存在')
    if (project.ownerId !== userId) throw new ForbiddenException('没有权限访问该项目')
  }

  async list(userId: number) {
    const projects = await this.prisma.project.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: 'desc' },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1, select: { versionNumber: true, createdAt: true } },
        _count: { select: { buildMaterials: true, transportRecords: true, constructionRecords: true, recyclingRecords: true } },
      },
    })
    return projects.map(project => ({
      id: project.id,
      projectName: project.projectName,
      province: project.province,
      cityDistrict: project.cityDistrict,
      buildingArea: project.buildingArea,
      buildingType: project.buildingType,
      updatedAt: project.updatedAt,
      createdAt: project.createdAt,
      latestVersion: project.versions[0] ?? null,
      recordCounts: project._count,
    }))
  }

  async create(userId: number, dto: CreateProjectDto) {
    if (!(Number(dto.buildingArea) > 0)) {
      throw new BadRequestException('建筑面积必须大于 0')
    }
    const project = await this.prisma.project.create({
      data: {
        ownerId: userId,
        projectName: dto.projectName,
        province: dto.province ?? '',
        cityDistrict: dto.cityDistrict ?? '',
        address: dto.address ?? '',
        buildingArea: Number(dto.buildingArea),
        floorCount: dto.floorCount ?? '',
        buildingType: dto.buildingType ?? '',
        structureType: dto.structureType ?? '',
        designLife: dto.designLife ?? '',
        modelImage: dto.modelImage ?? null,
        modelImageName: dto.modelImageName ?? '',
        startDate: dto.startDate ?? '',
        plannedCompletionDate: dto.plannedCompletionDate ?? '',
        projectManager: dto.projectManager ?? '',
        accountingStandard: dto.accountingStandard ?? 'GB/T 51366-2019',
      },
    })
    // 新建项目时按旧版配置文件初始化项目级因子配置
    await this.seedFactors(project.id)
    await this.audit.record(userId, 'PROJECT_CREATED', 'PROJECT', String(project.id), project.projectName)
    return this.detail(project.id, userId)
  }

  async detail(projectId: number, userId: number) {
    await this.assertOwner(projectId, userId)
    const project = await this.prisma.project.findUnique({ where: { id: projectId } })
    if (!project) throw new NotFoundException('项目不存在')
    return project
  }

  async updateModelImage(projectId: number, userId: number, image: Buffer, filename: string, mimeType: string) {
    await this.assertOwner(projectId, userId)
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType)) {
      throw new BadRequestException('模型图片仅支持 PNG、JPG 或 WEBP')
    }
    if (image.length > 10 * 1024 * 1024) throw new BadRequestException('模型图片不能超过 10MB')
    const dataUrl = `data:${mimeType};base64,${image.toString('base64')}`
    return this.prisma.project.update({ where: { id: projectId }, data: { modelImage: dataUrl, modelImageName: filename } })
  }

  async removeModelImage(projectId: number, userId: number) {
    await this.assertOwner(projectId, userId)
    return this.prisma.project.update({ where: { id: projectId }, data: { modelImage: null, modelImageName: '' } })
  }

  async update(projectId: number, userId: number, dto: UpdateProjectDto) {
    await this.assertOwner(projectId, userId)
    if (!(Number(dto.buildingArea) > 0)) {
      throw new BadRequestException('建筑面积必须大于 0')
    }
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        projectName: dto.projectName,
        province: dto.province ?? '',
        cityDistrict: dto.cityDistrict ?? '',
        address: dto.address ?? '',
        buildingArea: Number(dto.buildingArea),
        floorCount: dto.floorCount ?? '',
        buildingType: dto.buildingType ?? '',
        structureType: dto.structureType ?? '',
        designLife: dto.designLife ?? '',
        modelImage: dto.modelImage ?? null,
        modelImageName: dto.modelImageName ?? '',
        startDate: dto.startDate ?? '',
        plannedCompletionDate: dto.plannedCompletionDate ?? '',
        projectManager: dto.projectManager ?? '',
        accountingStandard: dto.accountingStandard ?? 'GB/T 51366-2019',
      },
    })
    await this.audit.record(userId, 'PROJECT_UPDATED', 'PROJECT', String(projectId), project.projectName)
    return project
  }

  /** 立即永久删除（不设回收站），级联删除核算数据、版本、因子配置 */
  async remove(projectId: number, userId: number): Promise<{ deleted: true }> {
    await this.assertOwner(projectId, userId)
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { projectName: true },
    })
    await this.prisma.project.delete({ where: { id: projectId } })
    // 审计仅记录最少事件元数据，不保留核算明细
    await this.audit.record(userId, 'PROJECT_DELETED', 'PROJECT', String(projectId), project?.projectName ?? '')
    return { deleted: true }
  }

  // ---------- 因子配置 ----------

  async listBuildFactors(projectId: number, userId: number) {
    await this.assertOwner(projectId, userId)
    return this.prisma.buildFactorConfig.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
    })
  }

  async createBuildFactor(projectId: number, userId: number, dto: BuildFactorDto) {
    await this.assertOwner(projectId, userId)
    return this.prisma.buildFactorConfig.create({
      data: {
        projectId,
        category: dto.category,
        name: dto.name,
        emissionFactor: Number(dto.emissionFactor),
        materialUnit: dto.materialUnit,
        recyclingFactor: Number(dto.recyclingFactor ?? 0),
        recyclingCoefficient: Number(dto.recyclingCoefficient ?? 0),
      },
    })
  }

  async updateBuildFactor(projectId: number, userId: number, factorId: number, dto: BuildFactorDto) {
    await this.assertOwner(projectId, userId)
    const existing = await this.prisma.buildFactorConfig.findFirst({
      where: { id: factorId, projectId },
    })
    if (!existing) throw new NotFoundException('建材因子配置不存在')
    return this.prisma.buildFactorConfig.update({
      where: { id: factorId },
      data: {
        category: dto.category,
        name: dto.name,
        emissionFactor: Number(dto.emissionFactor),
        materialUnit: dto.materialUnit,
        recyclingFactor: Number(dto.recyclingFactor ?? 0),
        recyclingCoefficient: Number(dto.recyclingCoefficient ?? 0),
      },
    })
  }

  async removeBuildFactor(projectId: number, userId: number, factorId: number) {
    await this.assertOwner(projectId, userId)
    const existing = await this.prisma.buildFactorConfig.findFirst({
      where: { id: factorId, projectId },
    })
    if (!existing) throw new NotFoundException('建材因子配置不存在')
    await this.prisma.buildFactorConfig.delete({ where: { id: factorId } })
    return { deleted: true }
  }

  async listTransportFactors(projectId: number, userId: number) {
    await this.assertOwner(projectId, userId)
    return this.prisma.transportFactorConfig.findMany({
      where: { projectId },
      orderBy: { id: 'asc' },
    })
  }

  async createTransportFactor(projectId: number, userId: number, dto: TransportFactorDto) {
    await this.assertOwner(projectId, userId)
    const energyType = this.assertEnergyType(dto.energyType)
    return this.prisma.transportFactorConfig.create({
      data: {
        projectId,
        vehicleName: dto.vehicleName,
        energyType,
        emissionFactor: Number(dto.emissionFactor),
      },
    })
  }

  async updateTransportFactor(
    projectId: number,
    userId: number,
    factorId: number,
    dto: TransportFactorDto,
  ) {
    await this.assertOwner(projectId, userId)
    const existing = await this.prisma.transportFactorConfig.findFirst({
      where: { id: factorId, projectId },
    })
    if (!existing) throw new NotFoundException('运输因子配置不存在')
    return this.prisma.transportFactorConfig.update({
      where: { id: factorId },
      data: {
        vehicleName: dto.vehicleName,
        energyType: this.assertEnergyType(dto.energyType),
        emissionFactor: Number(dto.emissionFactor),
      },
    })
  }

  async removeTransportFactor(projectId: number, userId: number, factorId: number) {
    await this.assertOwner(projectId, userId)
    const existing = await this.prisma.transportFactorConfig.findFirst({
      where: { id: factorId, projectId },
    })
    if (!existing) throw new NotFoundException('运输因子配置不存在')
    await this.prisma.transportFactorConfig.delete({ where: { id: factorId } })
    return { deleted: true }
  }

  /** 用旧版配置文件初始化项目级因子（新建项目自动调用；也可手动重新装载） */
  async seedFactors(projectId: number, overwrite = false) {
    const existingBuild = await this.prisma.buildFactorConfig.count({ where: { projectId } })
    const existingTransport = await this.prisma.transportFactorConfig.count({ where: { projectId } })
    if (!overwrite && (existingBuild > 0 || existingTransport > 0)) {
      return { seeded: false, buildFactors: existingBuild, transportFactors: existingTransport }
    }
    if (overwrite) {
      await this.prisma.buildFactorConfig.deleteMany({ where: { projectId } })
      await this.prisma.transportFactorConfig.deleteMany({ where: { projectId } })
    }
    const buildFactors = this.legacyConfig.getBuildFactors()
    const transportFactors = this.legacyConfig.getTransportFactors()
    if (buildFactors.length > 0) {
      await this.prisma.buildFactorConfig.createMany({
        data: buildFactors.map(factor => ({ projectId, ...factor })),
      })
    }
    if (transportFactors.length > 0) {
      await this.prisma.transportFactorConfig.createMany({
        data: transportFactors.map(factor => ({ projectId, ...factor })),
      })
    }
    this.logger.log(
      `项目 ${projectId} 已装载旧版因子：建材 ${buildFactors.length} 条、运输 ${transportFactors.length} 条`,
    )
    return {
      seeded: true,
      buildFactors: buildFactors.length,
      transportFactors: transportFactors.length,
    }
  }

  private assertEnergyType(value: string): TransportEnergyType {
    if (value !== '柴油' && value !== '汽油') {
      throw new BadRequestException('运输能源类型仅支持 柴油 / 汽油')
    }
    return value
  }
}