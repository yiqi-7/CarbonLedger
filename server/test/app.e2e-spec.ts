import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import { Test } from '@nestjs/testing'
import { ValidationPipe, type INestApplication } from '@nestjs/common'
import request from 'supertest'
import ExcelJS from 'exceljs'
import sharp from 'sharp'
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
  let transportRecordId: number
  let configurableBuildId: number

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }))
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

  it('管理员拒绝注册申请后账号不能登录并记录审计', async () => {
    await server()
      .post('/api/auth/register')
      .send({ username: 'rejected-user', password: 'password1', remark: '拒绝测试' })
      .expect(201)
    const pending = await server()
      .get('/api/admin/users/pending')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    const rejected = pending.body.find((user: { username: string }) => user.username === 'rejected-user')
    expect(rejected).toBeTruthy()
    await server()
      .post(`/api/admin/users/${rejected.id}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(201)
    const blocked = await server()
      .post('/api/auth/login')
      .send({ username: 'rejected-user', password: 'password1' })
      .expect(401)
    expect(String(blocked.body.message)).toContain('拒绝')
    const logs = await server()
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    const rejectionLog = logs.body.find((log: { action: string; targetId: string }) => log.action === 'REGISTER_REJECTED' && log.targetId === String(rejected.id))
    expect(rejectionLog).toMatchObject({ targetType: 'USER', result: 'SUCCESS', detail: 'rejected-user' })
  })

  it('注册校验：拒绝未知字段、密码不足 6 位、备注超过 200 字、用户名重复都会被拒绝', async () => {
    await server()
      .post('/api/auth/register')
      .send({ username: 'unknown-field', password: 'password1', remark: '', isAdmin: true })
      .expect(400)
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

  it('连续登录失败会临时锁定账号', async () => {
    for (let index = 0; index < 5; index += 1) {
      await server()
        .post('/api/auth/login')
        .send({ username: 'ratelimit-only-user', password: 'wrong-password' })
        .expect(401)
    }
    await server()
      .post('/api/auth/login')
      .send({ username: 'ratelimit-only-user', password: 'any-password' })
      .expect(429)
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

    const initialModelImage = await sharp({
      create: { width: 3, height: 2, channels: 3, background: '#287a54' },
    }).png().toBuffer()
    const imageUpload = await server()
      .post(`/api/projects/${projectId}/model-image`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', initialModelImage, { filename: 'model.png', contentType: 'image/png' })
      .expect(201)
    await server()
      .post(`/api/projects/${projectId}/model-image`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', Buffer.from('not-an-image'), { filename: 'fake.png', contentType: 'image/png' })
      .expect(400)
    expect(imageUpload.body.modelImage).toMatch(/^data:image\/png;base64,/)
    expect(imageUpload.body.modelImageName).toBe('model.png')
    await server()
      .post(`/api/projects/${projectId}/model-image`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', Buffer.alloc(10 * 1024 * 1024 + 1), { filename: 'too-large.png', contentType: 'image/png' })
      .expect(413)
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
      const protectedRecycle = await server()
        .patch(`/api/projects/${projectId}/recycling-records/${recycling.body[0].id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ materialName: '篡改名称', materialType: '玻璃', recyclingFactor: 999, recyclingCoefficient: 9, recyclingQuantity: 200 })
        .expect(200)
      expect(protectedRecycle.body).toMatchObject({
        materialName: material.body.materialName,
        materialType: '金属',
        recyclingFactor: material.body.recyclingFactor,
        recyclingCoefficient: material.body.recyclingCoefficient,
        recyclingQuantity: 100,
      })
      await server()
        .delete(`/api/projects/${projectId}/recycling-records/${recycling.body[0].id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
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

  it('建材：自定义行换配置保留数量价格，联动创建、更新及移除回收记录', async () => {
    const noRecyclingFactor = await server()
      .post(`/api/projects/${projectId}/build-factors`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: '换配置初始材料', category: '混凝土', materialUnit: 'm³', emissionFactor: 100 })
      .expect(201)
    const recyclingFactor = await server()
      .post(`/api/projects/${projectId}/build-factors`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: '换配置玻璃', category: '玻璃', materialUnit: 'm²', emissionFactor: 60, recyclingFactor: 50, recyclingCoefficient: 0.8 })
      .expect(201)
    const created = await server()
      .post(`/api/projects/${projectId}/build-materials`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ factorConfigId: noRecyclingFactor.body.id, quantity: 20, marketPrice: 30, unitPrice: 25 })
      .expect(201)
    configurableBuildId = created.body.id
    const updated = await server()
      .patch(`/api/projects/${projectId}/build-materials/${configurableBuildId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ factorConfigId: recyclingFactor.body.id })
      .expect(200)
    expect(updated.body).toMatchObject({
      materialName: '换配置玻璃', type: '玻璃', unit: 'm²', emissionFactor: 60,
      recyclingFactor: 50, recyclingCoefficient: 0.8, isParticipatingInRecyclingCalculation: true,
      quantity: 20, marketPrice: 30, unitPrice: 25, isCustomMaterial: true,
    })
    expect(updated.body.emissionAmount).toBeCloseTo(1.2)
    expect(updated.body.totalPrice).toBeCloseTo(0.05)
    const recyclingList = await server()
      .get(`/api/projects/${projectId}/recycling-records`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    const linked = recyclingList.body.find((item: { sourceBuildMaterialId: number }) => item.sourceBuildMaterialId === configurableBuildId)
    expect(linked).toMatchObject({ materialName: '换配置玻璃', materialType: '玻璃', unit: 'm²', recyclingQuantity: 20, reductionAmount: 0.8 })
    await server()
      .patch(`/api/projects/${projectId}/recycling-records/${linked.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ recyclingQuantity: 12, recyclingUnitPrice: 5 })
      .expect(200)

    // 修改因子库不会偷偷改写已有记录；只有显式重选配置才带入新因子。
    await server()
      .patch(`/api/projects/${projectId}/build-factors/${recyclingFactor.body.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: '换配置金属', category: '金属', materialUnit: 'kg', emissionFactor: 90, recyclingFactor: 30, recyclingCoefficient: 0.5 })
      .expect(200)
    const quantityOnly = await server()
      .patch(`/api/projects/${projectId}/build-materials/${configurableBuildId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ quantity: 10 })
      .expect(200)
    expect(quantityOnly.body).toMatchObject({ materialName: '换配置玻璃', emissionFactor: 60, recyclingFactor: 50, quantity: 10 })
    expect(quantityOnly.body.emissionAmount).toBeCloseTo(0.6)
    await server()
      .patch(`/api/projects/${projectId}/build-materials/${configurableBuildId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ factorConfigId: recyclingFactor.body.id })
      .expect(200)
    const synced = await server()
      .get(`/api/projects/${projectId}/recycling-records`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    expect(synced.body.find((item: { id: number }) => item.id === linked.id)).toMatchObject({
      materialName: '换配置金属', materialType: '金属', unit: 'kg', recyclingQuantity: 10,
      recyclingFactor: 30, recyclingCoefficient: 0.5, recyclingUnitPrice: 5,
      reductionAmount: 0.15, residualValue: 0.005,
    })
    const reset = await server()
      .patch(`/api/projects/${projectId}/build-materials/${configurableBuildId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ factorConfigId: noRecyclingFactor.body.id })
      .expect(200)
    expect(reset.body).toMatchObject({ recyclingFactor: 0, recyclingCoefficient: 0, isParticipatingInRecyclingCalculation: false })
    const afterReset = await server()
      .get(`/api/projects/${projectId}/recycling-records`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    expect(afterReset.body.some((item: { sourceBuildMaterialId: number }) => item.sourceBuildMaterialId === configurableBuildId)).toBe(false)
  })

  it('建材：导入行不可重选配置，修改数量价格保留原始因子', async () => {
    const factor = await server()
      .post(`/api/projects/${projectId}/build-factors`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: '导入保护建材', category: '金属', materialUnit: 't', emissionFactor: 100 })
      .expect(201)
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('材料清单')
    sheet.addRow(['材料名称', '材料类别', '用量', '碳排放因子', '市场价', '成交价', '回收因子', '回收系数'])
    sheet.addRow(['导入保护建材', '金属', 10, 7, 9, 5, 3, 0.5])
    const bytes = Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer)
    const imported = await server()
      .post(`/api/projects/${projectId}/imports/build-materials`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', bytes, { filename: 'build.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .expect(201)
    expect(imported.body).toMatchObject({ imported: 1, skippedRows: 0 })
    const records = await server()
      .get(`/api/projects/${projectId}/build-materials`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    const record = records.body.find((item: { materialName: string }) => item.materialName === '导入保护建材')
    const updated = await server()
      .patch(`/api/projects/${projectId}/build-materials/${record.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ factorConfigId: factor.body.id, quantity: 8, unitPrice: 6 })
      .expect(200)
    expect(updated.body).toMatchObject({
      materialName: '导入保护建材', type: '金属', unit: 't', emissionFactor: 7,
      recyclingFactor: 3, recyclingCoefficient: 0.5, quantity: 8, marketPrice: 9,
      unitPrice: 6, isCustomMaterial: false,
    })
    expect(updated.body.emissionAmount).toBeCloseTo(0.056)
    expect(updated.body.totalPrice).toBeCloseTo(0.0048)
  })

  it('客户回收操作：删除自动行后只在对应建材修改时重建，读取、快照及其他建材操作不重建', async () => {
    const project = await server().post('/api/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ projectName: '回收删除兼容性', buildingArea: 100 }).expect(201)
    const base = `/api/projects/${project.body.id}`
    const createMaterial = (name: string) => server().post(`${base}/build-materials`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ materialName: name, type: '金属', unit: 't', quantity: 10, emissionFactor: 100, unitPrice: 50, recyclingFactor: 20, recyclingCoefficient: 0.5 }).expect(201)
    const source = await createMaterial('待删回收来源')
    const recycling = await server().get(`${base}/recycling-records`)
      .set('Authorization', `Bearer ${userToken}`).expect(200)
    const recyclingId = recycling.body[0].id
    await server().delete(`${base}/recycling-records/${recyclingId}`)
      .set('Authorization', `Bearer ${adminToken}`).expect(403)
    await server().delete(`/api/projects/${projectId}/recycling-records/${recyclingId}`)
      .set('Authorization', `Bearer ${userToken}`).expect(404)
    await server().delete(`${base}/recycling-records/${recyclingId}`)
      .set('Authorization', `Bearer ${userToken}`).expect(200)
    const assertDeleted = async () => {
      const rows = await server().get(`${base}/recycling-records`)
        .set('Authorization', `Bearer ${userToken}`).expect(200)
      expect(rows.body.some((row: { sourceBuildMaterialId: number }) => row.sourceBuildMaterialId === source.body.id)).toBe(false)
    }
    await assertDeleted()
    await server().get(`${base}/analysis`).set('Authorization', `Bearer ${userToken}`).expect(200)
    const version = await server().post(`${base}/versions`)
      .set('Authorization', `Bearer ${userToken}`).expect(201)
    const snapshot = await server().get(`${base}/versions/${version.body.id}`)
      .set('Authorization', `Bearer ${userToken}`).expect(200)
    expect(snapshot.body.recyclingRecords).toEqual([])
    await assertDeleted()
    const other = await createMaterial('另一条建材')
    await assertDeleted()
    await server().patch(`${base}/build-materials/${other.body.id}`)
      .set('Authorization', `Bearer ${userToken}`).send({ quantity: 5 }).expect(200)
    await assertDeleted()
    await server().delete(`${base}/build-materials/${other.body.id}`)
      .set('Authorization', `Bearer ${userToken}`).expect(200)
    await assertDeleted()
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('材料清单')
    sheet.addRow(['材料名称', '类型', '用量', '碳排因子', '单价', '回收因子', '回收系数'])
    sheet.addRow(['另一次导入', '金属', 1, 10, 5, 1, 0.5])
    await server().post(`${base}/imports/build-materials`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', Buffer.from(await workbook.xlsx.writeBuffer()), 'materials.xlsx').expect(201)
    await assertDeleted()
    await server().patch(`${base}/build-materials/${source.body.id}`)
      .set('Authorization', `Bearer ${userToken}`).send({ quantity: 4 }).expect(200)
    const restored = await server().get(`${base}/recycling-records`)
      .set('Authorization', `Bearer ${userToken}`).expect(200)
    expect(restored.body.find((row: { sourceBuildMaterialId: number }) => row.sourceBuildMaterialId === source.body.id))
      .toMatchObject({ recyclingQuantity: 4, recyclingFactor: 20, recyclingCoefficient: 0.5, reductionAmount: 0.04 })
    await server().delete(base).set('Authorization', `Bearer ${userToken}`).expect(200)
  })

  it('客户建材导入：同名配置补类别单位、类别补单位、显式单位回退，并保留表内因子价格', async () => {
    const project = await server().post('/api/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ projectName: '客户导入兼容性', buildingArea: 100 }).expect(201)
    const base = `/api/projects/${project.body.id}`
    await server().post(`${base}/build-factors`).set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'Matched Material', category: '验收类别', materialUnit: 'kg', emissionFactor: 999 }).expect(201)
    const workbook = new ExcelJS.Workbook()
    workbook.addWorksheet('材料清单').addRow(['这是说明页'])
    const sheet = workbook.addWorksheet('客户材料')
    sheet.addRow(['名称', '类别', '使用量', '单位', '碳排放系数', '市场价', '成交价', '回收因子', '可回收系数'])
    sheet.addRow(['matched material', '', '2kg', '件', '7kg/kg', '—', '0元', 3, 0.5])
    sheet.addRow(['未配置名称', '验收类别', 3, '', 8, 12, 4, 0, 0])
    sheet.addRow(['新类别', '独立类别', 4, '件', 0, '/', 5, 0, 0])
    const bytes = Buffer.from(await workbook.xlsx.writeBuffer())
    const imported = await server().post(`${base}/imports/build-materials`)
      .set('Authorization', `Bearer ${userToken}`).attach('file', bytes, 'client.xlsx').expect(201)
    expect(imported.body).toMatchObject({ imported: 3, skippedRows: 0, sheetName: '客户材料' })
    const records = await server().get(`${base}/build-materials`)
      .set('Authorization', `Bearer ${userToken}`).expect(200)
    expect(records.body[0]).toMatchObject({ materialName: 'matched material', type: '验收类别', unit: 'kg', quantity: 2, emissionFactor: 7, marketPrice: null, unitPrice: 0, recyclingFactor: 3, recyclingCoefficient: 0.5, isCustomMaterial: false })
    expect(records.body[1]).toMatchObject({ materialName: '未配置名称', type: '验收类别', unit: 'kg', emissionFactor: 8, unitPrice: 4 })
    expect(records.body[2]).toMatchObject({ materialName: '新类别', type: '独立类别', unit: '件', emissionFactor: 0, marketPrice: null })
    const repeated = await server().post(`${base}/imports/build-materials`)
      .set('Authorization', `Bearer ${userToken}`).attach('file', bytes, 'client.xlsx').expect(201)
    expect(repeated.body).toMatchObject({ imported: 0, skippedRows: 3 })
    sheet.addRow(['无单位配置', '不存在类别', 1, '', 1, '', 1, 0, 0])
    const invalid = await server().post(`${base}/imports/build-materials`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', Buffer.from(await workbook.xlsx.writeBuffer()), 'client.xlsx').expect(400)
    expect(invalid.body.message).toContain('补充“单位”列')
    const unchanged = await server().get(`${base}/build-materials`)
      .set('Authorization', `Bearer ${userToken}`).expect(200)
    expect(unchanged.body).toEqual(records.body)
    await server().delete(base).set('Authorization', `Bearer ${userToken}`).expect(200)
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
    transportRecordId = record.body.id
  })

  it('运输：自定义行换车联动能源与因子，并用最新数量、运距和单价重算', async () => {
    const factor = await server()
      .post(`/api/projects/${projectId}/transport-factors`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ vehicleName: '回归测试汽油车', energyType: '汽油', emissionFactor: 0.42 })
      .expect(201)
    await server()
      .patch(`/api/projects/${projectId}/transport-records/${transportRecordId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        factorConfigId: String(factor.body.id),
        transportedMaterial: '水泥',
        transportQuantity: 20,
        transportDistance: 80,
        transportUnitPrice: 2.5,
        energyType: '柴油',
        emissionFactor: 999,
        emissionAmount: 999,
        transportTotalPrice: 999,
      })
      .expect(400)
    const updated = await server()
      .patch(`/api/projects/${projectId}/transport-records/${transportRecordId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        factorConfigId: String(factor.body.id),
        transportedMaterial: '水泥',
        transportQuantity: 20,
        transportDistance: 80,
        transportUnitPrice: 2.5,
      })
      .expect(200)
    expect(updated.body).toMatchObject({
      vehicleName: '回归测试汽油车', energyType: '汽油', emissionFactor: 0.42,
      transportedMaterial: '水泥', transportQuantity: 20, transportDistance: 80,
      transportUnitPrice: 2.5, isCustomMaterial: true,
    })
    expect(updated.body.emissionAmount).toBeCloseTo(0.672)
    expect(updated.body.transportTotalPrice).toBeCloseTo(0.02)

    const quantityOnly = await server()
      .patch(`/api/projects/${projectId}/transport-records/${transportRecordId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ transportQuantity: 30 })
      .expect(200)
    expect(quantityOnly.body).toMatchObject({
      vehicleName: '回归测试汽油车', energyType: '汽油', emissionFactor: 0.42,
      transportDistance: 80, transportUnitPrice: 2.5,
    })
    expect(quantityOnly.body.emissionAmount).toBeCloseTo(1.008)
    expect(quantityOnly.body.transportTotalPrice).toBeCloseTo(0.02)
  })

  it('运输：Excel 导入行保留车辆和原始因子，仍可修改货物与数量价格', async () => {
    const workbook = new ExcelJS.Workbook()
    const sheet = workbook.addWorksheet('运输记录清单')
    sheet.addRow(['车辆名称', '运输货物', '运输量', '运距', '能源类型', '碳排放因子', '运输单价（元）'])
    sheet.addRow(['导入柴油车', '砂石', 10, 50, '柴油', 0.18, 2])
    const bytes = Buffer.from((await workbook.xlsx.writeBuffer()) as ArrayBuffer)
    const imported = await server()
      .post(`/api/projects/${projectId}/imports/transport-records`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', bytes, { filename: 'transport.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .expect(201)
    expect(imported.body).toMatchObject({ imported: 1, skippedRows: 0 })
    const records = await server()
      .get(`/api/projects/${projectId}/transport-records`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    const record = records.body.find((item: { vehicleName: string }) => item.vehicleName === '导入柴油车')
    expect(record.isCustomMaterial).toBe(false)
    const updated = await server()
      .patch(`/api/projects/${projectId}/transport-records/${record.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ factorConfigId: transportFactorId, transportedMaterial: '碎石', transportQuantity: 25, transportDistance: 60, transportUnitPrice: 3 })
      .expect(200)
    expect(updated.body).toMatchObject({
      vehicleName: '导入柴油车', energyType: '柴油', emissionFactor: 0.18,
      transportedMaterial: '碎石', transportQuantity: 25, transportDistance: 60,
      transportUnitPrice: 3, isCustomMaterial: false,
    })
    expect(updated.body.emissionAmount).toBeCloseTo(0.27)
    expect(updated.body.transportTotalPrice).toBeCloseTo(0.018)
  })

  it('建材与运输：拒绝无效或其他项目的配置，不能通过其他项目路径修改记录', async () => {
    const otherProject = await server()
      .post('/api/projects')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ projectName: '运输配置隔离测试', buildingArea: 100 })
      .expect(201)
    const otherFactors = await server()
      .get(`/api/projects/${otherProject.body.id}/transport-factors`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    const before = await server()
      .get(`/api/projects/${projectId}/transport-records`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    for (const factorConfigId of [999999, otherFactors.body[0].id]) {
      await server()
        .patch(`/api/projects/${projectId}/transport-records/${transportRecordId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ factorConfigId, transportQuantity: 999 })
        .expect(404)
    }
    await server()
      .patch(`/api/projects/${projectId}/transport-records/${transportRecordId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ factorConfigId: 1.5 })
      .expect(400)
    await server()
      .patch(`/api/projects/${otherProject.body.id}/transport-records/${transportRecordId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ factorConfigId: otherFactors.body[0].id, transportQuantity: 999 })
      .expect(404)
    const after = await server()
      .get(`/api/projects/${projectId}/transport-records`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    expect(after.body).toEqual(before.body)
    const otherBuildFactors = await server()
      .get(`/api/projects/${otherProject.body.id}/build-factors`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    const buildBefore = await server()
      .get(`/api/projects/${projectId}/build-materials`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    for (const factorConfigId of [999999, otherBuildFactors.body[0].id]) {
      await server()
        .patch(`/api/projects/${projectId}/build-materials/${configurableBuildId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ factorConfigId, quantity: 999 })
        .expect(404)
    }
    await server()
      .patch(`/api/projects/${otherProject.body.id}/build-materials/${configurableBuildId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ factorConfigId: otherBuildFactors.body[0].id, quantity: 999 })
      .expect(404)
    const buildAfter = await server()
      .get(`/api/projects/${projectId}/build-materials`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    expect(buildAfter.body).toEqual(buildBefore.body)
    await server()
      .delete(`/api/projects/${otherProject.body.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
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

    const importedWorkbook = new ExcelJS.Workbook()
    const importedSheet = importedWorkbook.addWorksheet('工程台班清单')
    importedSheet.addRow(['机械名称', '台班数', '能源类型', '单位台班能耗', '碳排放因子', '台班单价（元）'])
    importedSheet.addRow(['进口塔吊', 2, '电力', 80, 0.581, 600])
    const importedBytes = Buffer.from((await importedWorkbook.xlsx.writeBuffer()) as ArrayBuffer)
    const imported = await server()
      .post(`/api/projects/${projectId}/imports/construction-records`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', importedBytes, { filename: 'construction.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      .expect(201)
    expect(imported.body).toMatchObject({ imported: 1, skippedRows: 0 })
    const constructionList = await server()
      .get(`/api/projects/${projectId}/construction-records`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200)
    const importedRecord = constructionList.body.find((item: any) => item.machineryName === '进口塔吊')
    const patchedImported = await server()
      .patch(`/api/projects/${projectId}/construction-records/${importedRecord.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ machineryName: '不应改名', energyType: '柴油', energyPerShift: 999, shiftCount: 3, shiftUnitPrice: 700 })
      .expect(200)
    expect(patchedImported.body).toMatchObject({ machineryName: '进口塔吊', energyType: '电力', energyPerShift: 80, emissionFactor: 0.581, shiftCount: 3, shiftUnitPrice: 700 })
  })

  it('运输货物、施工机械和自定义回收名称去除首尾空白，拒绝清空且保留原记录', async () => {
    const cases = [
      { kind: 'transport-records', field: 'transportedMaterial', name: '校验货物', data: { factorConfigId: transportFactorId, transportQuantity: 10, transportDistance: 20, transportUnitPrice: 2 } },
      { kind: 'construction-records', field: 'machineryName', name: '校验机械', data: { energyType: '电力', shiftCount: 2, energyPerShift: 100, shiftUnitPrice: 500 } },
      { kind: 'recycling-records', field: 'materialName', name: '校验回收材料', data: { materialType: '金属', recyclingQuantity: 10, recyclingFactor: 100, recyclingCoefficient: 0.5, recyclingUnitPrice: 10 } },
    ]
    for (const { kind, field, name, data } of cases) {
      const url = `/api/projects/${projectId}/${kind}`
      await server()
        .post(url)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...data, [field]: ' \t\n　 ' })
        .expect(400)
      const created = await server()
        .post(url)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ ...data, [field]: `  ${name}　` })
        .expect(201)
      expect(created.body[field]).toBe(name)
      for (const blank of ['', ' \t\n　 ']) {
        await server()
          .patch(`${url}/${created.body.id}`)
          .set('Authorization', `Bearer ${userToken}`)
          .send({ [field]: blank })
          .expect(400)
      }
      const records = await server()
        .get(url)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
      expect(records.body.find((record: { id: number }) => record.id === created.body.id)).toEqual(created.body)
      const renamed = await server()
        .patch(`${url}/${created.body.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ [field]: `  ${name}更新　` })
        .expect(200)
      expect(renamed.body[field]).toBe(`${name}更新`)
      await server()
        .delete(`${url}/${created.body.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200)
    }
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

    const validModelImage = await sharp({
      create: { width: 4, height: 3, channels: 3, background: '#287a54' },
    }).png().toBuffer()
    await server()
      .post(`/api/projects/${projectId}/model-image`)
      .set('Authorization', `Bearer ${userToken}`)
      .attach('file', validModelImage, { filename: 'report-model.png', contentType: 'image/png' })
      .expect(201)
    const imageVersion = await server()
      .post(`/api/projects/${projectId}/versions`)
      .set('Authorization', `Bearer ${userToken}`)
      .expect(201)

    const reportXlsx = await server()
      .get(`/api/projects/${projectId}/reports/${imageVersion.body.id}/excel`)
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
    const exportedWorkbook = new ExcelJS.Workbook()
    await exportedWorkbook.xlsx.load(reportXlsx.body as Buffer)
    expect(exportedWorkbook.getWorksheet('项目总览')?.getImages().length).toBeGreaterThan(0)

    const reportPdf = await server()
      .get(`/api/projects/${projectId}/reports/${imageVersion.body.id}/pdf`)
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
    expect((reportPdf.body as Buffer).includes(Buffer.from('/Subtype /Image'))).toBe(true)

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
    await server()
      .patch(`/api/projects/${projectId}/transport-records/${transportRecordId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ factorConfigId: transportFactorId, transportQuantity: 999 })
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
    expect(logs.body.some((log: { action: string }) => log.action === 'REPORT_EXPORTED')).toBe(true)
    const successfulVersionLog = logs.body.find((log: { action: string }) => log.action === 'VERSION_SAVED')
    expect(successfulVersionLog).toMatchObject({ userId: expect.any(Number), targetType: 'PROJECT', targetId: String(projectId), result: 'SUCCESS' })
    expect(successfulVersionLog.detail).toMatch(/^版本 v\d+$/)
    expect(Date.parse(successfulVersionLog.createdAt)).not.toBeNaN()
    expect(JSON.stringify(logs.body)).not.toMatch(/DujU83QQ5mX16WBwhoJt|Bearer|accessToken|password/i)
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
    const logs = await server()
      .get('/api/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200)
    const deletion = logs.body.find((log: { action: string; targetId: string }) => log.action === 'PROJECT_DELETED' && log.targetId === String(projectId))
    expect(deletion).toBeTruthy()
    expect(deletion).toMatchObject({
      userId: expect.any(Number),
      targetType: 'PROJECT',
      targetId: String(projectId),
      detail: '',
      result: 'SUCCESS',
    })
    expect(Date.parse(deletion.createdAt)).not.toBeNaN()
  })
})
