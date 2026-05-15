<template>
  <div class="internal-jobs-page">
    <div class="page-toolbar">
      <div class="toolbar-left">
        <el-input
          v-model="keyword"
          placeholder="搜索岗位名称/部门"
          clearable
          style="width: 260px"
          @keyup.enter="fetchList"
          @clear="fetchList"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width: 140px" @change="fetchList">
          <el-option label="招聘中" value="open" />
          <el-option label="已关闭" value="closed" />
          <el-option label="已招满" value="filled" />
        </el-select>
      </div>
      <el-button type="primary" @click="openDialog()">
        <el-icon><Plus /></el-icon> 新增岗位
      </el-button>
    </div>

    <el-table :data="list" v-loading="loading" stripe style="width: 100%">
      <el-table-column prop="id" label="ID" width="60" />
      <el-table-column prop="title" label="岗位名称" min-width="180" />
      <el-table-column prop="department" label="部门" width="120" />
      <el-table-column label="学历要求" width="100">
        <template #default="{ row }">
          {{ row.educationRequired || '--' }}
        </template>
      </el-table-column>
      <el-table-column label="工作年限" width="100">
        <template #default="{ row }">
          <template v-if="row.experienceYearsMin">
            {{ row.experienceYearsMin }}{{ row.experienceYearsMax ? ' - ' + row.experienceYearsMax : '+' }} 年
          </template>
          <span v-else>--</span>
        </template>
      </el-table-column>
      <el-table-column label="必备技能" min-width="180">
        <template #default="{ row }">
          <el-tag v-for="s in (row.requiredSkills || []).slice(0, 4)" :key="s" size="small" style="margin:1px">{{ s }}</el-tag>
          <el-tag v-if="(row.requiredSkills || []).length > 4" size="small">+{{ row.requiredSkills.length - 4 }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="薪资范围" width="160">
        <template #default="{ row }">
          <template v-if="row.salaryMin">
            {{ (row.salaryMin / 1000).toFixed(1) }}K{{ row.salaryMax ? ' - ' + (row.salaryMax / 1000).toFixed(1) + 'K' : '+' }}
          </template>
          <span v-else>--</span>
        </template>
      </el-table-column>
      <el-table-column label="招聘人数" width="80" prop="headcount" />
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'open' ? 'success' : row.status === 'closed' ? 'info' : 'warning'" size="small">
            {{ row.status === 'open' ? '招聘中' : row.status === 'closed' ? '已关闭' : '已招满' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="openDialog(row)">编辑</el-button>
          <el-button link type="danger" size="small" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-wrap" v-if="total > 0">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="fetchList"
        @size-change="fetchList"
      />
    </div>

    <!-- 新增/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEdit ? '编辑岗位' : '新增岗位'"
      width="680px"
      :close-on-click-modal="false"
      destroy-on-close
    >
      <el-form ref="formRef" :model="form" :rules="rules" label-width="100px" label-position="right">
        <el-form-item label="岗位名称" prop="title">
          <el-input v-model="form.title" placeholder="如：高级Java开发工程师" maxlength="300" />
        </el-form-item>
        <el-form-item label="所属部门" prop="department">
          <el-input v-model="form.department" placeholder="如：技术部" maxlength="200" />
        </el-form-item>
        <el-form-item label="岗位描述" prop="description">
          <el-input v-model="form.description" type="textarea" :rows="3" placeholder="岗位职责和工作内容" />
        </el-form-item>
        <el-form-item label="任职要求" prop="requirement">
          <el-input v-model="form.requirement" type="textarea" :rows="3" placeholder="任职资格和条件" />
        </el-form-item>

        <el-divider content-position="left">硬性筛选规则</el-divider>

        <el-form-item label="最低学历">
          <el-select v-model="form.educationRequired" placeholder="不限" clearable>
            <el-option v-for="e in educationOptions" :key="e" :label="e" :value="e" />
          </el-select>
        </el-form-item>
        <el-form-item label="工作年限">
          <el-col :span="11">
            <el-input-number v-model="form.experienceYearsMin" :min="0" :max="30" placeholder="最低" controls-position="right" style="width:100%" />
          </el-col>
          <el-col :span="2" style="text-align:center">—</el-col>
          <el-col :span="11">
            <el-input-number v-model="form.experienceYearsMax" :min="0" :max="30" placeholder="最高" controls-position="right" style="width:100%" />
          </el-col>
        </el-form-item>
        <el-form-item label="必备技能">
          <el-select
            v-model="form.requiredSkills"
            multiple filterable allow-create default-first-option
            placeholder="输入技能名称后回车添加"
            style="width:100%"
          />
        </el-form-item>
        <el-form-item label="优先技能">
          <el-select
            v-model="form.preferredSkills"
            multiple filterable allow-create default-first-option
            placeholder="输入技能名称后回车添加"
            style="width:100%"
          />
        </el-form-item>
        <el-form-item label="技能匹配">
          <el-radio-group v-model="form.skillMatchMode">
            <el-radio value="any">满足任一即可</el-radio>
            <el-radio value="all">必须全部满足</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="优先城市">
          <el-select
            v-model="form.cityPreferred"
            multiple filterable allow-create default-first-option
            placeholder="输入城市名后回车添加"
            style="width:100%"
          />
        </el-form-item>

        <el-divider content-position="left">其他信息</el-divider>

        <el-form-item label="岗位分类">
          <el-input v-model="form.jobCategory" placeholder="如：后端开发" maxlength="100" />
        </el-form-item>
        <el-form-item label="薪资范围">
          <el-col :span="11">
            <el-input-number v-model="form.salaryMin" :min="0" :step="1000" placeholder="最低" controls-position="right" style="width:100%" />
          </el-col>
          <el-col :span="2" style="text-align:center">—</el-col>
          <el-col :span="11">
            <el-input-number v-model="form.salaryMax" :min="0" :step="1000" placeholder="最高" controls-position="right" style="width:100%" />
          </el-col>
        </el-form-item>
        <el-form-item label="工作类型">
          <el-select v-model="form.jobType">
            <el-option label="全职" value="全职" />
            <el-option label="兼职" value="兼职" />
            <el-option label="实习" value="实习" />
          </el-select>
        </el-form-item>
        <el-form-item label="招聘人数">
          <el-input-number v-model="form.headcount" :min="1" :max="999" controls-position="right" />
        </el-form-item>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status">
            <el-radio value="open">招聘中</el-radio>
            <el-radio value="closed">已关闭</el-radio>
            <el-radio value="filled">已招满</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search, Plus } from '@element-plus/icons-vue'
import type { FormInstance, FormRules } from 'element-plus'
import { listInternalJobs, createInternalJob, updateInternalJob, deleteInternalJob, type InternalJob } from '@/api/internalJob'

const list = ref<InternalJob[]>([])
const loading = ref(false)
const keyword = ref('')
const statusFilter = ref('')
const page = ref(1)
const pageSize = ref(10)
const total = ref(0)

const dialogVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const editId = ref<number | null>(null)
const formRef = ref<FormInstance>()

const educationOptions = ['博士', '硕士', '本科', '大专', '高中']

const defaultForm = () => ({
  title: '',
  department: '',
  description: '',
  requirement: '',
  educationRequired: '',
  experienceYearsMin: null as number | null,
  experienceYearsMax: null as number | null,
  requiredSkills: [] as string[],
  preferredSkills: [] as string[],
  skillMatchMode: 'any' as 'all' | 'any',
  cityPreferred: [] as string[],
  jobCategory: '',
  headcount: 1,
  salaryMin: null as number | null,
  salaryMax: null as number | null,
  jobType: '全职',
  status: 'open' as 'open' | 'closed' | 'filled',
})

const form = reactive(defaultForm())

const rules: FormRules = {
  title: [{ required: true, message: '请输入岗位名称', trigger: 'blur' }],
  description: [{ required: true, message: '请输入岗位描述', trigger: 'blur' }],
}

async function fetchList() {
  loading.value = true
  try {
    const res: any = await listInternalJobs({
      keyword: keyword.value || undefined,
      status: statusFilter.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
    })
    if (res.success) {
      list.value = res.data.list
      total.value = res.data.total
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '加载失败')
  } finally {
    loading.value = false
  }
}

function openDialog(row?: InternalJob) {
  if (row) {
    isEdit.value = true
    editId.value = row.id!
    Object.assign(form, {
      title: row.title,
      department: row.department || '',
      description: row.description,
      requirement: row.requirement || '',
      educationRequired: row.educationRequired || '',
      experienceYearsMin: row.experienceYearsMin ?? null,
      experienceYearsMax: row.experienceYearsMax ?? null,
      requiredSkills: row.requiredSkills || [],
      preferredSkills: row.preferredSkills || [],
      skillMatchMode: row.skillMatchMode || 'any',
      cityPreferred: row.cityPreferred || [],
      jobCategory: row.jobCategory || '',
      headcount: row.headcount || 1,
      salaryMin: row.salaryMin ?? null,
      salaryMax: row.salaryMax ?? null,
      jobType: row.jobType || '全职',
      status: row.status || 'open',
    })
  } else {
    isEdit.value = false
    editId.value = null
    Object.assign(form, defaultForm())
  }
  dialogVisible.value = true
}

async function handleSave() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    if (isEdit.value && editId.value) {
      await updateInternalJob(editId.value, { ...form })
      ElMessage.success('更新成功')
    } else {
      await createInternalJob({ ...form })
      ElMessage.success('创建成功，正在生成岗位向量...')
    }
    dialogVisible.value = false
    fetchList()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleDelete(row: InternalJob) {
  try {
    await ElMessageBox.confirm(`确定删除岗位「${row.title}」？此操作不可恢复。`, '确认删除', { type: 'warning' })
    await deleteInternalJob(row.id!)
    ElMessage.success('删除成功')
    fetchList()
  } catch { /* 用户取消 */ }
}

onMounted(() => { fetchList() })
</script>

<style scoped>
.internal-jobs-page { padding: 0; }
.page-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 16px;
}
.toolbar-left { display: flex; gap: 12px; }
.pagination-wrap { display: flex; justify-content: flex-end; margin-top: 16px; }
</style>
