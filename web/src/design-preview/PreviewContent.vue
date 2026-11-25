<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { ArrowRight, Download, EditPen, Plus, Search, Close, TopRight, FolderOpened } from '@element-plus/icons-vue'
import type { Material, PageId } from './types'
import { formatNumber as num, usePreview } from './state'

const props = defineProps<{ page: PageId }>()
const emit = defineEmits<{ navigate: [page: PageId] }>()
const state = usePreview()
const { project, materials, materialEmission, totalEmission, netEmission, totalCost, stages } = state
const query = ref('')
const category = ref('全部类别')
const types = computed(() => [...new Set(materials.value.map(row => row.type))])
watch(types, current => {
  if (category.value !== '全部类别' && !current.includes(category.value)) category.value = '全部类别'
})
const quantity = (value: number) => new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 6 }).format(value)
const filtered = computed(() => materials.value.filter(row => (category.value === '全部类别' || category.value === row.type) && `${row.name} ${row.type}`.toLowerCase().includes(query.value.trim().toLowerCase())))
const filteredEmission = computed(() => filtered.value.reduce((sum, row) => sum + row.quantity * row.factor / 1000, 0))
const editor = ref(false)
const editorName = ref<HTMLInputElement>()
const editorTrigger = ref<HTMLElement>()
const draft = reactive<Material>({ id: 0, name: '', type: '混凝土', quantity: 1, unit: 'm³', factor: 0, price: 0 })
async function editMaterial(row?: Material) {
  editorTrigger.value = document.activeElement as HTMLElement
  Object.assign(draft, row ?? { id: 0, name: '', type: '混凝土', quantity: 1, unit: 'm³', factor: 0, price: 0 })
  editor.value = true
  await nextTick()
  editorName.value?.focus()
  editorName.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
function closeEditor() { editor.value = false; editorTrigger.value?.focus() }
function saveMaterial() {
  if (!draft.name.trim()) { editorName.value?.focus(); return }
  state.saveMaterial({ ...draft, name: draft.name.trim() })
  closeEditor()
}
function exportMaterials() {
  const rows = [['建材名称', '类别', '数量', '单位', '碳排放因子(kgCO₂e/单位)', '指导单价(元/单位)', '碳排放(tCO₂e)'], ...filtered.value.map(row => [row.name, row.type, row.quantity, row.unit, row.factor, row.price, (row.quantity * row.factor / 1000).toFixed(2)])]
  const csv = '\uFEFF' + rows.map(row => row.map(value => '"' + String(value).replace(/^[=+@-]/, "'$&").replaceAll('"', '""') + '"').join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = '示例项目-建材清单.csv'; anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  state.notify(`已导出 ${filtered.value.length} 条示例建材记录。`)
}
const projectDraft = reactive({ ...project })
watch(() => props.page, () => { Object.assign(projectDraft, project); editor.value = false })
function saveProject() {
  if (!projectDraft.name.trim() || !projectDraft.location.trim() || !projectDraft.manager.trim()) return
  Object.assign(project, projectDraft, { name: projectDraft.name.trim(), location: projectDraft.location.trim(), manager: projectDraft.manager.trim() })
  state.notify('示例项目信息已保存，仅在当前预览会话中生效。')
}
const loginName = ref('')
const loginPassword = ref('')
function enterPreview() {
  loginPassword.value = ''
  emit('navigate', 'projects')
  state.notify('已进入示例项目目录。')
}
</script>

<template>
  <div class="preview-content" :class="`page-${page}`">
    <template v-if="page === 'overview'">
      <div class="content-heading"><div><h1>项目概览</h1><p>{{ project.name }}<span class="heading-divider">·</span>{{ project.location }}</p></div><div class="heading-actions"><button class="secondary-action" @click="emit('navigate', 'project')">项目信息</button><button class="primary-action" @click="emit('navigate', 'materials')">管理建材<ArrowRight aria-hidden="true" /></button></div></div>
      <div class="overview-grid">
        <section class="metrics-strip" aria-label="核算摘要">
          <div class="metric-cell"><span>建造阶段碳排放</span><div><strong>{{ num(totalEmission) }}</strong><small>tCO₂e</small></div><p>生产、运输与现场施工合计</p></div>
          <div class="metric-cell"><span>单位面积碳排放</span><div><strong>{{ num(totalEmission * 1000 / project.area) }}</strong><small>kgCO₂e/m²</small></div><p>建筑面积 {{ num(project.area, 0) }} m²</p></div>
          <div class="metric-cell"><span>建材费用</span><div><strong>{{ num(totalCost) }}</strong><small>万元</small></div><p>按清单数量与示例单价计算</p></div>
        </section>
        <section class="stage-panel">
          <div class="panel-heading"><h2>各阶段碳排放</h2><span>单位：tCO₂e</span></div>
          <div class="stage-bars"><div v-for="(stage, index) in stages" :key="stage.name" class="stage-row"><div class="stage-label"><span>{{ stage.name }}</span><strong>{{ num(stage.value) }}<small>{{ num(stage.value / totalEmission * 100, 1) }}%</small></strong></div><div class="stage-track"><div :class="`stage-fill stage-${index}`" :style="{ width: `${stage.value / totalEmission * 100}%` }"></div></div></div></div>
          <div class="recovery-line"><span>回收减排抵扣</span><b>−48.90 tCO₂e</b></div><div class="net-line"><span>抵扣后净排放</span><strong>{{ num(netEmission) }} <small>tCO₂e</small></strong></div>
        </section>
        <section class="project-summary"><div class="panel-heading"><h2>核算信息</h2><button class="text-action" aria-label="编辑项目信息" @click="emit('navigate', 'project')"><EditPen aria-hidden="true" /></button></div><dl><div><dt>建筑类型</dt><dd>{{ project.type }}</dd></div><div><dt>建筑面积</dt><dd>{{ num(project.area, 0) }} m²</dd></div><div><dt>项目负责人</dt><dd>{{ project.manager }}</dd></div><div><dt>核算标准</dt><dd>{{ project.standard }}</dd></div></dl><p class="calculation-note">示例包含建材生产、运输和施工阶段。材料编辑后自动更新结果；运输、施工与回收值为固定示例。</p></section>
        <section class="ledger-panel"><div class="panel-heading"><h2>建材碳排放清单</h2><button class="text-action" @click="emit('navigate', 'materials')">查看清单<ArrowRight aria-hidden="true" /></button></div><div class="table-scroll" tabindex="0" role="region" aria-label="建材碳排放摘要，可横向滚动"><table class="preview-table"><thead><tr><th>建材名称</th><th class="numeric">数量</th><th>单位</th><th class="numeric">碳排放 / tCO₂e</th><th class="numeric">占生产阶段</th></tr></thead><tbody><tr v-for="row in materials" :key="row.id"><td>{{ row.name }}</td><td class="numeric">{{ quantity(row.quantity) }}</td><td>{{ row.unit }}</td><td class="numeric">{{ num(row.quantity * row.factor / 1000) }}</td><td class="numeric">{{ num(materialEmission > 0 ? row.quantity * row.factor / 1000 / materialEmission * 100 : 0, 1) }}%</td></tr></tbody><tfoot><tr><th colspan="3">合计</th><td class="numeric">{{ num(materialEmission) }}</td><td class="numeric">{{ materialEmission > 0 ? '100.0%' : '—' }}</td></tr></tfoot></table></div></section>
      </div>
    </template>

    <template v-else-if="page === 'materials'">
      <div class="content-heading"><div><h1>建材清单</h1><p>{{ project.name }} · 共 {{ materials.length }} 项建材</p></div><div class="heading-actions"><button class="secondary-action" :disabled="!filtered.length" @click="exportMaterials"><Download aria-hidden="true" />导出清单</button><button class="primary-action" @click="editMaterial()"><Plus aria-hidden="true" />添加建材</button></div></div>
      <form v-if="editor" class="material-editor" @submit.prevent="saveMaterial">
        <div class="panel-heading"><h2>{{ draft.id ? '编辑建材' : '添加建材' }}</h2><button type="button" class="text-action" aria-label="取消编辑" @click="closeEditor"><Close aria-hidden="true" /></button></div>
        <div class="field-grid material-fields"><label class="preview-field"><span>建材名称</span><input ref="editorName" v-model="draft.name" required maxlength="80" placeholder="请输入建材名称" /></label><label class="preview-field"><span>类别</span><select v-model="draft.type"><option>混凝土</option><option>钢材</option><option>砌体</option><option>门窗</option><option>其他</option></select></label><label class="preview-field"><span>数量</span><input v-model.number="draft.quantity" required type="number" min="0.001" max="100000000" step="any" /></label><label class="preview-field"><span>单位</span><select v-model="draft.unit"><option>m³</option><option>t</option><option>m²</option><option>kg</option><option>件</option></select></label><label class="preview-field"><span>碳排放因子 / kgCO₂e每单位</span><input v-model.number="draft.factor" required type="number" min="0" max="10000000" step="any" /></label><label class="preview-field"><span>单价 / 元每单位</span><input v-model.number="draft.price" required type="number" min="0" max="100000000" step="any" /></label></div>
        <div class="form-actions"><span>仅更新当前预览中的示例清单</span><button type="button" class="secondary-action" @click="closeEditor">取消</button><button type="submit" class="primary-action">保存建材</button></div>
      </form>
      <section class="material-ledger"><div class="table-toolbar"><label class="search-field"><Search aria-hidden="true" /><span class="sr-only">搜索建材</span><input v-model="query" placeholder="搜索建材名称、类别" type="search" /></label><label><span class="sr-only">建材类别</span><select v-model="category"><option>全部类别</option><option v-for="type in types" :key="type">{{ type }}</option></select></label><a class="guidance-link" href="https://www.zjzj.net/" target="_blank" rel="noopener noreferrer">指导价格<TopRight aria-hidden="true" /></a></div>
        <div class="table-scroll" tabindex="0" role="region" aria-label="建材清单，可横向滚动"><table class="preview-table material-table"><thead><tr><th>建材名称 / 类别</th><th class="numeric">数量</th><th>单位</th><th class="numeric">碳排放因子<small>kgCO₂e/单位</small></th><th class="numeric">单价<small>元/单位</small></th><th class="numeric">碳排放<small>tCO₂e</small></th><th><span class="sr-only">操作</span></th></tr></thead><tbody><tr v-for="row in filtered" :key="row.id"><td><span class="material-name">{{ row.name }}</span><small class="material-type">{{ row.type }}</small></td><td class="numeric">{{ quantity(row.quantity) }}</td><td>{{ row.unit }}</td><td class="numeric">{{ num(row.factor) }}</td><td class="numeric">{{ num(row.price) }}</td><td class="numeric emission-value">{{ num(row.quantity * row.factor / 1000) }}</td><td><button class="text-action" :aria-label="`编辑${row.name}`" @click="editMaterial(row)">编辑</button></td></tr><tr v-if="!filtered.length"><td colspan="7"><div class="empty-state"><Search aria-hidden="true" /><h2>未找到匹配的建材</h2><p>试试其他关键词，或清除筛选条件。</p><button class="secondary-action" @click="query = ''; category = '全部类别'">清除筛选</button></div></td></tr></tbody></table></div>
        <div class="table-summary"><span>显示 {{ filtered.length }} / {{ materials.length }} 项</span><span>当前清单碳排放合计 <strong>{{ num(filteredEmission) }}</strong> tCO₂e</span></div>
      </section><p class="page-note">示例因子与单价用于比较界面效果，实际核算请以项目采用的标准和价格为准。</p>
    </template>

    <template v-else-if="page === 'project'">
      <div class="content-heading"><div><h1>项目信息</h1><p>维护项目基本信息与核算依据</p></div><button class="secondary-action" @click="emit('navigate', 'overview')">返回项目概览</button></div>
      <form class="project-form" @submit.prevent="saveProject"><section class="form-section"><h2>基本信息</h2><div class="field-grid"><label class="preview-field field-wide"><span>项目名称</span><input v-model="projectDraft.name" maxlength="80" required /></label><label class="preview-field"><span>项目所在地</span><input v-model="projectDraft.location" maxlength="80" required /></label><label class="preview-field"><span>建筑类型</span><select v-model="projectDraft.type"><option>公共建筑</option><option>居住建筑</option><option>工业建筑</option></select></label><label class="preview-field"><span>建筑面积 / m²</span><input v-model.number="projectDraft.area" required type="number" min="1" max="1000000000" step="any" /><small>用于计算单位面积碳排放</small></label><label class="preview-field"><span>项目负责人</span><input v-model="projectDraft.manager" maxlength="30" required /></label></div></section><section class="form-section"><h2>核算依据</h2><div class="field-grid"><label class="preview-field field-wide"><span>采用标准</span><input :value="project.standard" readonly /><small>《建筑碳排放计算标准》</small></label></div></section><div class="form-actions"><span>更改仅保存在本次预览中</span><button class="secondary-action" type="button" @click="Object.assign(projectDraft, project); state.notify('已恢复当前保存的示例信息。')">重置更改</button><button type="submit" class="primary-action">保存信息</button></div></form>
    </template>

    <template v-else-if="page === 'projects'">
      <div class="content-heading"><div><h1>我的项目</h1><p>选择项目，查看建造阶段的碳排放核算</p></div><span class="project-count">1 个示例项目</span></div>
      <div class="directory-list"><button class="directory-project" @click="emit('navigate', 'overview')"><div class="directory-icon"><FolderOpened aria-hidden="true" /></div><div class="directory-detail"><h2>{{ project.name }}</h2><p>{{ project.location }}<span>·</span>{{ project.type }}</p><dl><div><dt>建筑面积</dt><dd>{{ num(project.area, 0) }} m²</dd></div><div><dt>建材记录</dt><dd>{{ materials.length }} 项</dd></div><div><dt>项目负责人</dt><dd>{{ project.manager }}</dd></div></dl></div><span class="directory-open">进入项目<ArrowRight aria-hidden="true" /></span></button></div><p class="page-note">此处为设计预览的示例项目，所有方案使用同一份数据。</p>
    </template>

    <template v-else>
      <div class="login-composition"><div class="login-brand"><h1>碳建智算平台</h1><p>建筑工程 · 建造阶段碳排放核算</p></div><form class="login-form" @submit.prevent="enterPreview"><h2>登录</h2><label class="preview-field"><span>账号</span><input v-model="loginName" autocomplete="off" placeholder="输入示例账号" /></label><label class="preview-field"><span>密码</span><input v-model="loginPassword" type="password" autocomplete="off" placeholder="输入示例密码" /></label><button type="submit" class="primary-action">进入预览<ArrowRight aria-hidden="true" /></button><p>这是登录样式预览，无需真实账号密码。</p></form><a class="login-return" href="/">打开当前正式界面<TopRight aria-hidden="true" /></a></div>
    </template>
  </div>
</template>
