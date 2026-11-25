import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Body, Controller, Patch, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import type { NestExpressApplication } from '@nestjs/platform-express'
import request from 'supertest'
import { configureBodyParser } from './configure-body-parser'
import { UpdateProjectDto } from './projects/project.dto'

@Controller('projects')
class ProjectBodyTestController {
  @Patch(':id')
  update(@Body() body: UpdateProjectDto) {
    return { imageLength: body.modelImage?.length, projectName: body.projectName }
  }
}

describe('customer project JSON uploads', () => {
  let app: NestExpressApplication

  beforeAll(async () => {
    const module = await Test.createTestingModule({ controllers: [ProjectBodyTestController] }).compile()
    app = module.createNestApplication<NestExpressApplication>()
    configureBodyParser(app)
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
  })

  afterAll(async () => { await app?.close() })

  it('accepts a 10MB image encoded as JSON through the project DTO', async () => {
    const modelImage = `data:image/png;base64,${Buffer.alloc(10 * 1024 * 1024).toString('base64')}`
    const response = await request(app.getHttpServer()).patch('/projects/1')
      .send({ projectName: '客户模型图片', buildingArea: 100, modelImage }).expect(200)
    expect(response.body).toEqual({ imageLength: modelImage.length, projectName: '客户模型图片' })
  })

  it('continues rejecting JSON beyond the configured request limit', async () => {
    await request(app.getHttpServer()).patch('/projects/1')
      .send({ projectName: '超大请求', buildingArea: 100, modelImage: 'x'.repeat(20 * 1024 * 1024) })
      .expect(413)
  })
})
