import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import request from 'supertest'
import { AppModule } from '../src/app.module'

/**
 * 端到端测试：账号申请/审批/登录、项目隔离、四类数据核算与回收联动、版本快照不可变。
 */
describe('CarbonLedger API (e2e)', () => {
  let app: INestApplication
  let adminToken: string
  let userToken: string
  let otherToken: string
  let projectId: number
  let factorConfigId: number
  let transportFactorId: number

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
    await app.init()
  })

  afterAll(async () => {
    await app?.close()
  })

  const server = () => request(app.getHttpServer())

  it('健康检查可用', async () => {
    const response = await server().get('/api/health').expect(200)
    expect(response.body.status).toBe('ok')
  })

  it('未审批账号不能登录；审批后可以登录', async () => {
    await server()
      .post('/api/auth/register')
      .send({ username: 'user1', password: 'password1', remark: '测试用户一' })
      .expect(201)

    // 待审批：登录被拒
    const blocked = await server()
      .post('/api/auth/login')
      .send({ username: 'user1', password: 'password1' })
      .expect(401)
    expect(String(blocked.body.message)).toContain('审批')

    // 管理员登录
    const adminLogin = await server()
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'test-admin-password-only' })
      .expect(200)
    adminToken = adminLogin.body.accessToken
    expect(adminToken).toBeTruthy()

    // 审批
    const pending = await server()
      .get('/api/admin/users/pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    const pendingUser = pending.body.find((user: { username: string }) => user.username === 'user1')
    expect(pendingUser).toBeTruthy()
    await server()
      .post(`/api/admin/users/${pendingUser.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201)

    const login = await server()
      .post('/api/auth/login')
      .send({ username: 'user1', password: 'password1' })
      .expect(200)
    userToken = login.body.accessToken
    expect(login.body.user.role).toBe('USER')
  })

  it('注册校验：密码不足 6 位、备注超过 200 字、用户名重复都会被拒绝', async () => {
    await server()
      .post('/api/auth/register')
      .send({ username: 'shortpw', password: '123', remark: '' })
      .expect(400)
    await server()
      .post('/api/auth/register')
      .send({ username: 'longremark', password: 'password1', remark: 'x'.repeat(201) })
      .expect(400)
    await server()
      .post('/api/auth/register')
      .send({ username: 'user1', password: 'password1', remark: '' })
      .expect(409)
  })

  it('创建项目：建筑面积必须大于 0，并自动装载旧版因子配置', async () => {
    await server()
      .post('/api/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ projectName: '无效项目', buildingArea: 0 })
      .expect(400)

    const created = await server()
      .post('/api/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        projectName: '中心大厦 A 座建设工程',
        province: '广东省',
        cityDistrict: '深圳市',
        buildingArea: 86500,
        buildingType: '商业综合体',
        structureType: '钢筋混凝土框架-剪力墙结构',
        designLife: '50 年',
        floorCount: '32 / 3',
      })
      .expect(201)
    projectId = created.body.id
    expect(projectId).toBeGreaterThan(0)

    const imageUpload = await server()
      .post(`/api/projects/${projectId}/model-image`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', Buffer.from('png-image-fixture'), { filename: 'model.png', contentType: 'image/png' })
      .expect(201)
    expect(imageUpload.body.modelImage).toMatch(/^data:image\/png;base64,/)
    expect(imageUpload.body.modelImageName).toBe('model.png')
    await server()
      .delete(`/api/projects/${projectId}/model-image`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)

    const buildFactors = await server()
      .get(`/api/projects/${projectId}/build-factors`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    expect(buildFactors.body.length).toBeGreaterThan(0)
    factorConfigId = buildFactors.body[0].id

    const transportFactors = await server()
      .get(`/api/projects/${projectId}/transport-factors`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    expect(transportFactors.body.length).toBeGreaterThan(0)
    transportFactorId = transportFactors.body[0].id
  })

  it('创建建材并自动生成回收记录（回收因子 > 0）', async () => {
    const factor = await server()
      .get(`/api/projects/${projectId}/build-factors`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    const withRecycling = factor.body.find(
      (item: { recyclingFactor: number }) => item.recyclingFactor > 0,
    )
    const usableFactorId = withRecycling?.id ?? factorConfigId

    const material = await server()
      .post(`/api/projects/${projectId}/build-materials`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ factorConfigId: usableFactorId, quantity: 100, unitPrice: 300, marketPrice: 320 })
      .expect(201)
    expect(material.body.emissionAmount).toBeGreaterThan(0)

    const recycling = await server()
      .get(`/api/projects/${projectId}/recycling-records`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    if (withRecycling) {
      expect(recycling.body).toHaveLength(1)
      expect(recycling.body[0].recyclingQuantity).toBe(100)
      expect(recycling.body[0].sourceBuildMaterialId).toBe(material.body.id)
    }

    // 建材用量改小 → 回收量收缩
    await server()
      .patch(`/api/projects/${projectId}/build-materials/${material.body.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ quantity: 40 })
      .expect(200)
    const afterUpdate = await server()
      .get(`/api/projects/${projectId}/recycling-records`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    if (withRecycling) expect(afterUpdate.body[0].recyclingQuantity).toBe(40)
  })

  it('运输：必须使用已有车辆配置；缺配置时拒绝创建', async () => {
    await server()
      .post(`/api/projects/${projectId}/transport-records`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        factorConfigId: 999999,
        transportedMaterial: '钢材',
        transportQuantity: 10,
        transportDistance: 50,
        transportUnitPrice: 0.8,
      })
      .expect(404)

    const record = await server()
      .post(`/api/projects/${projectId}/transport-records`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        factorConfigId: transportFactorId,
        transportedMaterial: '钢材',
        transportQuantity: 10,
        transportDistance: 50,
        transportUnitPrice: 0.8,
      })
      .expect(201)
    // 排放 = 50 × 10 × 因子 ÷ 1000；总价 = 50 × 0.8 ÷ 10000（旧版式子）
    expect(record.body.transportTotalPrice).toBeCloseTo(0.004)
  })

  it('施工：台班数必须整数，排放按 kg 存储', async () => {
    await server()
      .post(`/api/projects/${projectId}/construction-records`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        machineryName: '塔吊',
        energyType: '电力',
        shiftCount: 1.5,
        energyPerShift: 100,
        shiftUnitPrice: 500,
      })
      .expect(400)

    const record = await server()
      .post(`/api/projects/${projectId}/construction-records`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        machineryName: '塔吊',
        energyType: '电力',
        shiftCount: 10,
        energyPerShift: 100,
        shiftUnitPrice: 500,
      })
      .expect(201)
    expect(record.body.totalEnergy).toBe(1000)
    expect(record.body.emissionAmount).toBeCloseTo(581)
    expect(record.body.totalPrice).toBeCloseTo(0.5)
  })

  it('分析接口返回旧版口径汇总', async () => {
    const analysis = await server()
      .get(`/api/projects/${projectId}/analysis`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    expect(analysis.body.build.totalEmission).toBeGreaterThan(0)
    expect(analysis.body.emission.stages).toHaveLength(4)
    expect(analysis.body.emission.stages[3].name).toBe('回收碳计算')
    expect(analysis.body.cost.totalCost).toBeGreaterThan(0)
    expect(analysis.body.construction.energyTotals['电力'].emissionFactor).toBeCloseTo(0.581)
  })

  it('核算版本：快照不可变，修改数据不影响历史版本', async () => {
    const saved = await server()
      .post(`/api/projects/${projectId}/versions`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(201)
    expect(saved.body.versionNumber).toBe(1)

    const snapshotBefore = await server()
      .get(`/api/projects/${projectId}/versions/${saved.body.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    const emissionBefore = snapshotBefore.body.summary.build.totalEmission

    // 修改建材用量后，历史版本不变
    const materials = await server()
      .get(`/api/projects/${projectId}/build-materials`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    await server()
      .patch(`/api/projects/${projectId}/build-materials/${materials.body[0].id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ quantity: 200 })
      .expect(200)

    const snapshotAfter = await server()
      .get(`/api/projects/${projectId}/versions/${saved.body.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    expect(snapshotAfter.body.summary.build.totalEmission).toBeCloseTo(emissionBefore)
    expect(snapshotAfter.body.buildMaterials[0].quantity).toBe(materials.body[0].quantity)

    // 新版本反映最新数据
    const second = await server()
      .post(`/api/projects/${projectId}/versions`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(201)
    expect(second.body.versionNumber).toBe(2)
    const secondSnapshot = await server()
      .get(`/api/projects/${projectId}/versions/${second.body.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    expect(secondSnapshot.body.summary.build.totalEmission).toBeGreaterThan(emissionBefore)

    const reportXlsx = await server()
      .get(`/api/projects/${projectId}/reports/${saved.body.id}/excel`)
      .set('Authorization', `Bearer ${userToken}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () => callback(null, Buffer.concat(chunks)))
      })
      .expect(200)
    expect(reportXlsx.headers['content-type']).toContain('spreadsheetml.sheet')
    expect(Buffer.isBuffer(reportXlsx.body)).toBe(true)
    expect(reportXlsx.body.length).toBeGreaterThan(1000)

    const reportPdf = await server()
      .get(`/api/projects/${projectId}/reports/${saved.body.id}/pdf`)
      .set('Authorization', `Bearer ${userToken}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () => callback(null, Buffer.concat(chunks)))
      })
      .expect(200)
    expect(reportPdf.headers['content-type']).toContain('application/pdf')
    expect((reportPdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF')

    const currentPdf = await server()
      .get(`/api/projects/${projectId}/reports/current/pdf`)
      .set('Authorization', `Bearer ${userToken}`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () => callback(null, Buffer.concat(chunks)))
      })
      .expect(200)
    expect((currentPdf.body as Buffer).subarray(0, 4).toString()).toBe('%PDF')
  })

  it('跨用户隔离：其他用户不能访问项目、记录、版本与分析', async () => {
    await server()
      .post('/api/auth/register')
      .send({ username: 'user2', password: 'password2', remark: '' })
      .expect(201)
    const pending = await server()
      .get('/api/admin/users/pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    const other = pending.body.find((user: { username: string }) => user.username === 'user2')
    await server()
      .post(`/api/admin/users/${other.id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201)
    const login = await server()
      .post('/api/auth/login')
      .send({ username: 'user2', password: 'password2' })
      .expect(200)
    otherToken = login.body.accessToken

    await server()
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403)
    await server()
      .get(`/api/projects/${projectId}/build-materials`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403)
    await server()
      .get(`/api/projects/${projectId}/analysis`)
      .set('Authorization', `Bearer ${otherToken}`)
      .expect(403)

    // 管理员也不能浏览他人项目内容
    await server()
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(403)

    // 未登录访问被拒绝
    await server().get('/api/projects').expect(401)
  })

  it('管理员接口仅管理员可用', async () => {
    await server()
      .get('/api/admin/users/pending')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403)
    const logs = await server()
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    expect(Array.isArray(logs.body)).toBe(true)
    expect(logs.body.some((log: { action: string }) => log.action === 'VERSION_SAVED')).toBe(true)
  })

  it('项目永久删除后不可再访问', async () => {
    await server()
      .delete(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    await server()
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(404)
  })
})