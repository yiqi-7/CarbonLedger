<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { api, apiMessage, type ProjectSummary } from '@/api'
import { districtsOf, normalizeDistrict, provinces } from '@/data/cities'

const router = useRouter(); const projects = ref<ProjectSummary[]>([]); const loading = ref(true); const saving = ref(false); const dialog = ref(false); const pageError = ref('')
const removing = ref<number | null>(null)
const cityOptions = computed(() => districtsOf(form.province))
function syncDistrict() { form.cityDistrict = normalizeDistrict(form.province, form.cityDistrict) }
const form = reactive({ projectName: '', buildingArea: 0, province: '', cityDistrict: '', address: '', buildingType: '', structureType: '', floorCount: '', designLife: '', startDate: '', plannedCompletionDate: '', projectManager: '', accountingStandard: 'GB/T 51366-2019' })
async function load() { loading.value = true; pageError.value = ''; try { projects.value = (await api.get('/projects')).data } catch (error) { pageError.value = apiMessage(error, '项目列表加载失败') } finally { loading.value = false } }
function openCreate() { if (saving.value) return; Object.assign(form, { projectName: '', buildingArea: 0, province: '', cityDistrict: '', address: '', buildingType: '', structureType: '', floorCount: '', designLife: '', startDate: '', plannedCompletionDate: '', projectManager: '', accountingStandard: 'GB/T 51366-2019' }); dialog.value = true }
async function create() { if (saving.value) return; if (!form.projectName.trim() || !(form.buildingArea > 0)) { ElMessage.warning('请填写项目名称和大于 0 的建筑面积'); return }; saving.value = true; try { await api.post('/projects', { ...form, projectName: form.projectName.trim() }); dialog.value = false; ElMessage.success('项目已创建'); await load() } catch (error) { ElMessage.error(apiMessage(error, '项目创建失败')) } finally { saving.value = false } }
async function remove(project: ProjectSummary) { if (removing.value !== null) return; removing.value = project.id; try { await ElMessageBox.confirm(`确定永久删除“${project.projectName}”？此操作不可恢复。`, '删除项目', { type: 'warning' }); await api.delete(`/projects/${project.id}`); ElMessage.success('项目已删除'); await load() } catch (error: unknown) { if (error !== 'cancel' && error !== 'close') ElMessage.error(apiMessage(error, '项目删除失败')) } finally { removing.value = null } }
onMounted(load)
</script>
<template>
  <div class="content-wrap projects-page">
    <div class="page-heading">
      <div><h1>我的项目</h1><p class="muted">查看项目资料、核算记录和已保存的版本。</p></div>
      <el-button type="primary" class="primary-button" @click="openCreate">新建项目</el-button>
    </div>
    <el-alert v-if="pageError" :title="pageError" type="error" show-icon :closable="false" class="project-load-error">
      <template #default><el-button link type="primary" @click="load">重新加载</el-button></template>
    </el-alert>
    <div v-loading="loading" class="project-directory">
      <el-table v-if="loading || projects.length" :data="projects" class="projects-table" empty-text="正在读取项目">
        <el-table-column label="项目名称" min-width="250">
          <template #default="scope">
            <button class="project-name-link" :aria-label="'打开项目：' + scope.row.projectName" @click="router.push('/projects/' + scope.row.id)">{{ scope.row.projectName }}</button>
            <p class="project-location">{{ [scope.row.province, scope.row.cityDistrict].filter(Boolean).join(' · ') || '未填写项目地点' }}</p>
          </template>
        </el-table-column>
        <el-table-column label="建筑面积（㎡）" min-width="145" align="right"><template #default="scope">{{ Number(scope.row.buildingArea || 0).toLocaleString() }}</template></el-table-column>
        <el-table-column label="建材记录" width="100" align="right"><template #default="scope">{{ scope.row.recordCounts?.buildMaterials || 0 }} 条</template></el-table-column>
        <el-table-column label="最新版本" width="110"><template #default="scope">{{ scope.row.latestVersion ? 'v' + scope.row.latestVersion.versionNumber : '无版本' }}</template></el-table-column>
        <el-table-column label="更新日期" width="130"><template #default="scope">{{ new Date(scope.row.updatedAt).toLocaleDateString() }}</template></el-table-column>
        <el-table-column label="操作" width="180">
          <template #default="scope">
            <div class="project-actions">
              <el-button link type="primary" @click="router.push('/projects/' + scope.row.id)">打开项目</el-button>
              <el-dropdown>
                <el-button text class="more-button" :aria-label="scope.row.projectName + '的更多操作'">更多</el-button>
                <template #dropdown><el-dropdown-menu>
                  <el-dropdown-item @click="router.push('/projects/' + scope.row.id + '/tools')">因子配置</el-dropdown-item>
                  <el-dropdown-item @click="router.push('/projects/' + scope.row.id + '/tools?tab=versions')">核算版本与报告</el-dropdown-item>
                  <el-dropdown-item :disabled="removing !== null" divided @click="remove(scope.row)">删除项目</el-dropdown-item>
                </el-dropdown-menu></template>
              </el-dropdown>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div v-else-if="!pageError" class="empty-state">
        <h3>暂无项目</h3><p>新建项目后，可以填写工程信息并录入核算数据。</p>
        <el-button type="primary" @click="openCreate">新建项目</el-button>
      </div>
    </div>
    <el-dialog v-model="dialog" title="新建项目" width="min(620px, calc(100% - 32px))" :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving"><el-form id="create-project-form" label-position="top" :disabled="saving" @submit.prevent="create"><el-form-item label="项目名称" required><el-input v-model="form.projectName" placeholder="例如：中心大厦 A 座建设工程" /></el-form-item><div class="form-grid"><el-form-item label="建筑面积（㎡）" required><el-input-number v-model="form.buildingArea" :min="0" :controls="false" class="full-width" /></el-form-item><el-form-item label="建筑类型"><el-select v-model="form.buildingType" placeholder="选择建筑类型"><el-option label="商业综合体" value="商业综合体"/><el-option label="住宅" value="住宅"/><el-option label="公共建筑" value="公共建筑"/></el-select></el-form-item><el-form-item label="省份"><el-select v-model="form.province" filterable placeholder="选择省份" @change="syncDistrict"><el-option v-for="item in provinces" :key="item" :label="item" :value="item"/></el-select></el-form-item><el-form-item label="城市/区县"><el-select v-model="form.cityDistrict" filterable placeholder="先选择省份"><el-option v-for="item in cityOptions" :key="item" :label="item" :value="item"/></el-select></el-form-item><el-form-item label="结构类型"><el-input v-model="form.structureType" /></el-form-item><el-form-item label="楼层数"><el-input v-model="form.floorCount" /></el-form-item><el-form-item label="设计使用年限"><el-input v-model="form.designLife" /></el-form-item><el-form-item label="项目负责人"><el-input v-model="form.projectManager" /></el-form-item><el-form-item label="开工日期"><el-input v-model="form.startDate" type="date" /></el-form-item><el-form-item label="计划竣工日期"><el-input v-model="form.plannedCompletionDate" type="date" /></el-form-item></div><el-form-item label="项目地址"><el-input v-model="form.address" /></el-form-item><el-form-item label="核算标准"><el-input v-model="form.accountingStandard" /></el-form-item></el-form><template #footer><el-button :disabled="saving" @click="dialog = false">取消</el-button><el-button type="primary" :loading="saving" native-type="submit" form="create-project-form">创建项目</el-button></template></el-dialog>
  </div>
</template>

<style scoped>
:global(body:has(.projects-page)) { min-width: 0; }
.project-directory { min-height: 200px; }
.project-name-link { display: block; max-width: 100%; padding: 2px 0; border: 0; background: transparent; color: var(--platform-ink); font-size: 15px; font-weight: 600; text-align: left; line-height: 1.6; overflow-wrap: anywhere; cursor: pointer; }
.project-name-link:hover { color: var(--el-color-primary); text-decoration: underline; text-underline-offset: 4px; }
.project-name-link:focus-visible { outline: 2px solid var(--color-focus); outline-offset: 3px; }
.project-location { height: auto; margin: 5px 0 0; color: var(--platform-muted); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
.project-actions { display: flex; align-items: center; gap: 8px; }
.projects-table :deep(.el-table__cell .cell) { padding-inline: 18px; }
.projects-table :deep(td.el-table__cell) { padding-block: 19px; }
.empty-state { padding: 60px 24px; }
.empty-state p { margin-bottom: 24px; }
</style>
