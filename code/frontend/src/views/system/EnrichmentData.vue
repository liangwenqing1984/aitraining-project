<template>
  <div class="system-page">
    <el-card shadow="never" class="search-card">
      <el-form :inline="true" :model="searchForm">
        <el-form-item label="任务ID">
          <el-input v-model="searchForm.taskId" placeholder="任务ID" clearable style="width: 280px" @keyup.enter="handleSearch" />
        </el-form-item>
        <el-form-item label="关键字">
          <el-input v-model="searchForm.keyword" placeholder="公司名/职位名/JobID" clearable style="width: 200px" @keyup.enter="handleSearch" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">搜索</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card shadow="never">
      <el-table :data="records" stripe v-loading="loading" row-key="id">
        <el-table-column prop="taskId" label="任务ID" width="130" show-overflow-tooltip />
        <el-table-column prop="companyName" label="公司名称" width="160" show-overflow-tooltip />
        <el-table-column prop="jobName" label="职位名称" width="160" show-overflow-tooltip />
        <el-table-column prop="jobCategoryL1" label="一级分类" width="100" />
        <el-table-column prop="jobCategoryL2" label="二级分类" width="100" />
        <el-table-column prop="companyIndustry" label="行业" width="100" />
        <el-table-column label="月薪范围" width="140">
          <template #default="{ row }">
            <span v-if="row.salaryMonthlyMin || row.salaryMonthlyMax">
              {{ row.salaryMonthlyMin ? (row.salaryMonthlyMin / 1000).toFixed(1) + 'k' : '?' }} - {{ row.salaryMonthlyMax ? (row.salaryMonthlyMax / 1000).toFixed(1) + 'k' : '?' }}
            </span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="经验" width="80">
          <template #default="{ row }">
            <span v-if="row.experienceYearsMin || row.experienceYearsMax">{{ row.experienceYearsMin ?? '?' }}-{{ row.experienceYearsMax ?? '?' }}年</span>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="educationNormalized" label="学历" width="80" />
        <el-table-column label="工作模式" width="90">
          <template #default="{ row }">
            <el-tag v-if="row.workMode" size="small" type="success">{{ row.workMode }}</el-tag>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column prop="modelUsed" label="模型" width="100" show-overflow-tooltip />
        <el-table-column prop="enrichedAt" label="更新时间" width="160" />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="editRecord(row)">
              <el-icon><Edit /></el-icon>编辑
            </el-button>
            <el-button link type="danger" size="small" @click="handleDelete(row)">
              <el-icon><Delete /></el-icon>删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        style="margin-top: 16px; justify-content: flex-end; display: flex"
        @current-change="loadRecords"
        @size-change="loadRecords"
      />
    </el-card>

    <!-- 编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      title="编辑增强数据"
      width="700px"
      destroy-on-close
      class="form-dialog"
    >
      <template #header>
        <div class="dialog-header">
          <span class="dialog-header-icon">
            <el-icon :size="18"><Edit /></el-icon>
          </span>
          <span>编辑增强数据</span>
        </div>
      </template>

      <el-form ref="formRef" :model="form" label-width="110px" label-position="left" class="edit-form">
        <el-form-item label="职位名称">
          <el-input :model-value="currentRecord?.jobName" disabled />
        </el-form-item>
        <el-form-item label="公司名称">
          <el-input :model-value="currentRecord?.companyName" disabled />
        </el-form-item>
        <el-form-item label="月薪下限">
          <el-input-number v-model="form.salaryMonthlyMin" :min="0" :step="1000" style="width: 100%" />
        </el-form-item>
        <el-form-item label="月薪上限">
          <el-input-number v-model="form.salaryMonthlyMax" :min="0" :step="1000" style="width: 100%" />
        </el-form-item>
        <el-form-item label="年薪估算">
          <el-input-number v-model="form.salaryAnnualEstimate" :min="0" :step="10000" style="width: 100%" />
        </el-form-item>
        <el-form-item label="一级分类">
          <el-input v-model="form.jobCategoryL1" />
        </el-form-item>
        <el-form-item label="二级分类">
          <el-input v-model="form.jobCategoryL2" />
        </el-form-item>
        <el-form-item label="行业">
          <el-input v-model="form.companyIndustry" />
        </el-form-item>
        <el-form-item label="学历">
          <el-input v-model="form.educationNormalized" />
        </el-form-item>
        <el-form-item label="经验年限下限">
          <el-input-number v-model="form.experienceYearsMin" :min="0" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="经验年限上限">
          <el-input-number v-model="form.experienceYearsMax" :min="0" :step="1" style="width: 100%" />
        </el-form-item>
        <el-form-item label="工作模式">
          <el-select v-model="form.workMode" clearable placeholder="选择工作模式" style="width: 100%">
            <el-option label="远程" value="远程" />
            <el-option label="现场" value="现场" />
            <el-option label="混合" value="混合" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键技能">
          <el-input v-model="keySkillsStr" placeholder="逗号分隔" />
        </el-form-item>
        <el-form-item label="必需技能">
          <el-input v-model="requiredSkillsStr" placeholder="逗号分隔" />
        </el-form-item>
        <el-form-item label="优先技能">
          <el-input v-model="preferredSkillsStr" placeholder="逗号分隔" />
        </el-form-item>
        <el-form-item label="福利">
          <el-input v-model="benefitsStr" placeholder="逗号分隔" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false" :disabled="saving" size="default">取消</el-button>
          <el-button type="primary" size="default" @click="handleSave" :loading="saving">
            <el-icon v-if="!saving"><Check /></el-icon>
            <span>{{ saving ? '保存中...' : '保存修改' }}</span>
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { Edit, Delete, Check } from '@element-plus/icons-vue'
import { listEnrichments, updateEnrichment, deleteEnrichment } from '@/api/llm'

const records = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const currentRecord = ref<any>(null)
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const searchForm = reactive({ taskId: '', keyword: '' })
const formRef = ref<FormInstance>()

const form = reactive({
  salaryMonthlyMin: null as number | null,
  salaryMonthlyMax: null as number | null,
  salaryAnnualEstimate: null as number | null,
  jobCategoryL1: '',
  jobCategoryL2: '',
  companyIndustry: '',
  educationNormalized: '',
  experienceYearsMin: null as number | null,
  experienceYearsMax: null as number | null,
  workMode: '',
})

const keySkillsStr = ref('')
const requiredSkillsStr = ref('')
const preferredSkillsStr = ref('')
const benefitsStr = ref('')

async function loadRecords() {
  loading.value = true
  try {
    const res: any = await listEnrichments({
      taskId: searchForm.taskId || undefined,
      keyword: searchForm.keyword || undefined,
      page: currentPage.value,
      pageSize: pageSize.value,
    })
    if (res.success) {
      records.value = res.data.list
      total.value = res.data.total
    }
  } catch { /* handled by interceptor */ }
  finally { loading.value = false }
}

function handleSearch() { currentPage.value = 1; loadRecords() }
function handleReset() { searchForm.taskId = ''; searchForm.keyword = ''; currentPage.value = 1; loadRecords() }

function editRecord(row: any) {
  currentRecord.value = row
  form.salaryMonthlyMin = row.salaryMonthlyMin ?? null
  form.salaryMonthlyMax = row.salaryMonthlyMax ?? null
  form.salaryAnnualEstimate = row.salaryAnnualEstimate ?? null
  form.jobCategoryL1 = row.jobCategoryL1 || ''
  form.jobCategoryL2 = row.jobCategoryL2 || ''
  form.companyIndustry = row.companyIndustry || ''
  form.educationNormalized = row.educationNormalized || ''
  form.experienceYearsMin = row.experienceYearsMin ?? null
  form.experienceYearsMax = row.experienceYearsMax ?? null
  form.workMode = row.workMode || ''
  keySkillsStr.value = (row.keySkills || []).join(', ')
  requiredSkillsStr.value = (row.requiredSkills || []).join(', ')
  preferredSkillsStr.value = (row.preferredSkills || []).join(', ')
  benefitsStr.value = (row.benefits || []).join(', ')
  dialogVisible.value = true
}

async function handleSave() {
  if (!currentRecord.value) return
  saving.value = true
  try {
    const parseList = (s: string) => s.split(',').map(x => x.trim()).filter(Boolean)
    const res: any = await updateEnrichment(currentRecord.value.taskId, currentRecord.value.jobId, {
      salary_monthly_min: form.salaryMonthlyMin,
      salary_monthly_max: form.salaryMonthlyMax,
      salary_annual_estimate: form.salaryAnnualEstimate,
      job_category_l1: form.jobCategoryL1,
      job_category_l2: form.jobCategoryL2,
      company_industry: form.companyIndustry,
      education_normalized: form.educationNormalized,
      experience_years_min: form.experienceYearsMin,
      experience_years_max: form.experienceYearsMax,
      work_mode: form.workMode,
      key_skills: parseList(keySkillsStr.value),
      required_skills: parseList(requiredSkillsStr.value),
      preferred_skills: parseList(preferredSkillsStr.value),
      benefits: parseList(benefitsStr.value),
    })
    if (res.success) {
      ElMessage.success('增强记录已更新')
      dialogVisible.value = false
      loadRecords()
    }
  } catch { /* handled by interceptor */ }
  finally { saving.value = false }
}

async function handleDelete(row: any) {
  try {
    await ElMessageBox.confirm(
      `确定要删除该增强记录吗？（职位：${row.jobName || row.jobId}）`,
      '确认删除',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
    )
    const res: any = await deleteEnrichment(row.taskId, row.jobId)
    if (res.success) { ElMessage.success('增强记录已删除'); loadRecords() }
  } catch { /* cancelled */ }
}

onMounted(() => { loadRecords() })
</script>

<style scoped>
.system-page { padding: 0; }
.search-card { margin-bottom: 16px; }
.text-muted { color: #c0c4cc; font-size: 13px; }
</style>

<style>
.form-dialog {
  --dialog-radius: 12px;
}
.form-dialog .el-dialog {
  border-radius: var(--dialog-radius);
  overflow: hidden;
}
.form-dialog .el-dialog__header {
  padding: 20px 24px 0;
  border-bottom: none;
}
.form-dialog .el-dialog__body {
  padding: 16px 24px 8px;
}
.form-dialog .el-dialog__footer {
  padding: 12px 24px 20px;
}
.dialog-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 17px;
  font-weight: 600;
  color: #1f2937;
}
.dialog-header-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.12) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #667eea;
}
.edit-form .el-form-item {
  margin-bottom: 18px;
}
.edit-form .el-form-item__label {
  color: #4b5563;
  font-weight: 500;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
.dialog-footer .el-button {
  border-radius: 8px;
  padding: 9px 20px;
  font-weight: 500;
}
.dialog-footer .el-button--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.25);
}
.dialog-footer .el-button--primary:hover {
  box-shadow: 0 4px 14px rgba(102, 126, 234, 0.35);
}
</style>
