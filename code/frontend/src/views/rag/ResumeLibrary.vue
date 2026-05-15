<template>
  <div class="resume-library-page">
    <div class="page-toolbar">
      <div class="left-actions">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索姓名、期望岗位、技能..."
          clearable
          style="width: 280px"
          @keyup.enter="doSearch"
          @clear="doSearch"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" @click="doSearch">
          <el-icon><Search /></el-icon> 搜索
        </el-button>
      </div>
      <div class="right-actions">
        <el-button
          type="danger"
          :disabled="selectedIds.length === 0"
          @click="batchDeleteDialog = true"
        >
          <el-icon><Delete /></el-icon> 批量删除 ({{ selectedIds.length }})
        </el-button>
        <el-button type="success" @click="exportResumes">
          <el-icon><Download /></el-icon> 导出 Excel
        </el-button>
        <el-button type="primary" @click="showUploadDialog = true">
          <el-icon><Plus /></el-icon> 批量导入
        </el-button>
      </div>
    </div>

    <el-table
      v-loading="loading"
      :data="list"
      stripe
      @selection-change="handleSelectionChange"
      style="flex: 1"
      max-height="calc(100vh - 180px)"
    >
      <el-table-column type="selection" width="50" />
      <el-table-column prop="id" label="ID" width="60" sortable />
      <el-table-column prop="name" label="姓名" width="100" sortable>
        <template #default="{ row }">
          <span v-if="row.name" style="font-weight:500">{{ row.name }}</span>
          <span v-else style="color:#c0c4cc">--</span>
        </template>
      </el-table-column>
      <el-table-column prop="educationLevel" label="学历" width="80">
        <template #default="{ row }">
          <el-tag v-if="row.educationLevel" size="small" type="info">{{ row.educationLevel }}</el-tag>
          <span v-else style="color:#c0c4cc">--</span>
        </template>
      </el-table-column>
      <el-table-column prop="workYears" label="工龄" width="70">
        <template #default="{ row }">
          {{ row.workYears != null ? row.workYears + '年' : '--' }}
        </template>
      </el-table-column>
      <el-table-column prop="skills" label="技能" min-width="200">
        <template #default="{ row }">
          <el-tag
            v-for="s in (Array.isArray(row.skills) ? row.skills.slice(0, 5) : [])"
            :key="s"
            size="small"
            style="margin:1px"
          >{{ s }}</el-tag>
          <el-tag v-if="Array.isArray(row.skills) && row.skills.length > 5" size="small" type="info">
            +{{ row.skills.length - 5 }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="desiredPosition" label="期望岗位" width="140">
        <template #default="{ row }">
          {{ row.desiredPosition || '--' }}
        </template>
      </el-table-column>
      <el-table-column prop="desiredCity" label="期望城市" width="100">
        <template #default="{ row }">
          {{ row.desiredCity || '--' }}
        </template>
      </el-table-column>
      <el-table-column prop="phone" label="电话" width="130">
        <template #default="{ row }">
          {{ row.phone || '--' }}
        </template>
      </el-table-column>
      <el-table-column prop="originalFilename" label="源文件" width="180" show-overflow-tooltip />
      <el-table-column prop="parseConfidence" label="置信度" width="90" sortable>
        <template #default="{ row }">
          <el-progress
            v-if="row.parseConfidence != null"
            :percentage="Math.round((row.parseConfidence || 0) * 100)"
            :stroke-width="6"
            :color="row.parseConfidence > 0.7 ? '#67c23a' : row.parseConfidence > 0.5 ? '#e6a23c' : '#f56c6c'"
          />
          <span v-else>--</span>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="入库时间" width="160" sortable />
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="viewDetail(row)">
            <el-icon><View /></el-icon> 详情
          </el-button>
          <el-button link type="warning" size="small" @click="editResume(row)">
            <el-icon><Edit /></el-icon> 编辑
          </el-button>
          <el-popconfirm title="确定删除此简历？" @confirm="doDelete(row.id)">
            <template #reference>
              <el-button link type="danger" size="small"><el-icon><Delete /></el-icon> 删除</el-button>
            </template>
          </el-popconfirm>
        </template>
      </el-table-column>
    </el-table>

    <div class="page-pagination">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next"
        @current-change="fetchList"
        @size-change="onPageSizeChange"
      />
    </div>

    <!-- 详情对话框 -->
    <el-dialog v-model="detailVisible" title="简历详情" width="800px" destroy-on-close>
      <div v-if="detailData" class="resume-detail">
        <el-descriptions :column="2" size="small" border>
          <el-descriptions-item label="姓名">{{ detailData.name || '--' }}</el-descriptions-item>
          <el-descriptions-item label="学历">{{ detailData.educationLevel || '--' }}</el-descriptions-item>
          <el-descriptions-item label="邮箱">{{ detailData.email || '--' }}</el-descriptions-item>
          <el-descriptions-item label="电话">{{ detailData.phone || '--' }}</el-descriptions-item>
          <el-descriptions-item label="毕业院校">{{ detailData.school || '--' }}</el-descriptions-item>
          <el-descriptions-item label="专业">{{ detailData.major || '--' }}</el-descriptions-item>
          <el-descriptions-item label="毕业年份">{{ detailData.graduationYear || '--' }}</el-descriptions-item>
          <el-descriptions-item label="工作年限">{{ detailData.workYears != null ? detailData.workYears + ' 年' : '--' }}</el-descriptions-item>
          <el-descriptions-item label="期望岗位">{{ detailData.desiredPosition || '--' }}</el-descriptions-item>
          <el-descriptions-item label="期望城市">{{ detailData.desiredCity || '--' }}</el-descriptions-item>
          <el-descriptions-item label="工作类型">{{ detailData.jobType || '--' }}</el-descriptions-item>
          <el-descriptions-item label="源文件">{{ detailData.originalFilename || '--' }}</el-descriptions-item>
        </el-descriptions>

        <div v-if="detailData.skills?.length" style="margin-top: 12px">
          <strong>技能：</strong>
          <el-tag v-for="s in detailData.skills" :key="s" size="small" style="margin:2px">{{ s }}</el-tag>
        </div>

        <div v-if="detailData.projects?.length" style="margin-top: 12px">
          <strong>项目经验：</strong>
          <el-collapse>
            <el-collapse-item v-for="(p, i) in detailData.projects" :key="i" :title="p.name || '项目' + (i+1)">
              <div>角色: {{ p.role || '--' }} | 时长: {{ p.duration || '--' }}</div>
              <div>{{ p.description }}</div>
              <el-tag v-for="t in (p.techStack || [])" :key="t" size="small" style="margin:1px">{{ t }}</el-tag>
            </el-collapse-item>
          </el-collapse>
        </div>
      </div>
    </el-dialog>

    <!-- 编辑对话框 -->
    <el-dialog v-model="editVisible" title="编辑简历" width="700px" destroy-on-close @closed="editData = null">
      <el-form v-if="editData" :model="editData" label-width="100px" size="small">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="姓名"><el-input v-model="editData.name" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="学历">
              <el-select v-model="editData.educationLevel" clearable style="width:100%">
                <el-option v-for="e in ['高中','大专','本科','硕士','博士']" :key="e" :label="e" :value="e" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="邮箱"><el-input v-model="editData.email" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="电话"><el-input v-model="editData.phone" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="毕业院校"><el-input v-model="editData.school" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="专业"><el-input v-model="editData.major" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="毕业年份"><el-input-number v-model="editData.graduationYear" :min="1980" :max="2030" style="width:100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="工作年限"><el-input-number v-model="editData.workYears" :min="0" :max="50" style="width:100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="期望岗位"><el-input v-model="editData.desiredPosition" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="期望城市"><el-input v-model="editData.desiredCity" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="期望薪资下限"><el-input-number v-model="editData.desiredSalaryMin" :min="0" :step="1000" style="width:100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="期望薪资上限"><el-input-number v-model="editData.desiredSalaryMax" :min="0" :step="1000" style="width:100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="工作类型">
              <el-select v-model="editData.jobType" clearable style="width:100%">
                <el-option v-for="t in ['全职','兼职','实习','自由职业']" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="自我评价">
          <el-input v-model="editData.selfEvaluation" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="doSave">保存</el-button>
      </template>
    </el-dialog>

    <!-- 批量上传对话框 -->
    <el-dialog v-model="showUploadDialog" title="批量导入简历" width="600px" destroy-on-close @closed="batchResults = null">
      <el-upload
        ref="batchUploadRef"
        :auto-upload="false"
        multiple
        accept=".docx,.doc,.pdf,.txt"
        :show-file-list="true"
        :on-change="() => {}"
        drag
      >
        <div class="upload-zone">
          <el-icon :size="32" color="#667eea"><UploadFilled /></el-icon>
          <div class="upload-text">
            <span>拖拽或<em>点击上传</em>多个简历文件</span>
            <span class="upload-hint">支持 Word / PDF / TXT，单次最多 20 个文件</span>
          </div>
        </div>
      </el-upload>

      <div v-if="batchUploading" style="text-align:center; padding: 20px; color:#409eff;">
        <el-icon class="is-loading" :size="24"><Loading /></el-icon>
        <span style="margin-left:8px">正在批量解析...</span>
      </div>

      <div v-if="batchResults" class="batch-results" style="margin-top:12px">
        <el-alert
          :type="batchResults.failCount > 0 ? 'warning' : 'success'"
          :closable="false"
          show-icon
        >
          <template #title>
            共 {{ batchResults.total }} 个文件，成功 {{ batchResults.successCount }} 个，失败 {{ batchResults.failCount }} 个
          </template>
        </el-alert>
        <el-table :data="batchResults.results" size="small" style="margin-top:8px" max-height="300">
          <el-table-column prop="fileName" label="文件名" min-width="180" show-overflow-tooltip />
          <el-table-column label="状态" width="80">
            <template #default="{ row }">
              <el-tag :type="row.success ? 'success' : 'danger'" size="small">
                {{ row.success ? '成功' : '失败' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="name" label="姓名" width="80" />
          <el-table-column prop="educationLevel" label="学历" width="70" />
          <el-table-column prop="error" label="错误信息" min-width="140" show-overflow-tooltip />
        </el-table>
      </div>

      <template #footer>
        <el-button @click="showUploadDialog = false">关闭</el-button>
        <el-button type="primary" :loading="batchUploading" :disabled="batchUploading" @click="doBatchUpload">
          开始解析
        </el-button>
      </template>
    </el-dialog>

    <!-- 批量删除确认 -->
    <el-dialog v-model="batchDeleteDialog" title="批量删除确认" width="400px">
      <p>确定要删除选中的 <strong>{{ selectedIds.length }}</strong> 条简历吗？此操作不可恢复。</p>
      <template #footer>
        <el-button @click="batchDeleteDialog = false">取消</el-button>
        <el-button type="danger" :loading="deleting" @click="doBatchDelete">确定删除</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, View, Edit, Delete, Plus, Download, UploadFilled, Loading } from '@element-plus/icons-vue'
import type { UploadInstance } from 'element-plus'
import { listResumes, getResume, updateResume, deleteResume, batchParseResumes, batchDeleteResumes, exportResumesExcel } from '@/api/llm'

const loading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const list = ref<any[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const searchKeyword = ref('')
const selectedIds = ref<number[]>([])

// 详情
const detailVisible = ref(false)
const detailData = ref<any>(null)

// 编辑
const editVisible = ref(false)
const editData = ref<any>(null)

// 批量上传
const showUploadDialog = ref(false)
const batchUploadRef = ref<UploadInstance>()
const batchUploading = ref(false)
const batchResults = ref<any>(null)

// 批量删除
const batchDeleteDialog = ref(false)

async function fetchList() {
  loading.value = true
  try {
    const res: any = await listResumes({
      keyword: searchKeyword.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
    })
    if (res.success) {
      list.value = res.data.list
      total.value = res.data.total
    }
  } catch { /* ignore */ }
  finally { loading.value = false }
}

function doSearch() {
  page.value = 1
  fetchList()
}

function onPageSizeChange(ps: number) {
  pageSize.value = ps
  fetchList()
}

function handleSelectionChange(rows: any[]) {
  selectedIds.value = rows.map(r => r.id)
}

async function viewDetail(row: any) {
  try {
    const res: any = await getResume(row.id)
    if (res.success) {
      detailData.value = res.data
      detailVisible.value = true
    }
  } catch { /* ignore */ }
}

function editResume(row: any) {
  editData.value = {
    id: row.id,
    name: row.name || '',
    email: row.email || '',
    phone: row.phone || '',
    educationLevel: row.educationLevel || '',
    school: row.school || '',
    major: row.major || '',
    graduationYear: row.graduationYear || null,
    workYears: row.workYears ?? null,
    desiredPosition: row.desiredPosition || '',
    desiredCity: row.desiredCity || '',
    desiredSalaryMin: row.desiredSalaryMin || null,
    desiredSalaryMax: row.desiredSalaryMax || null,
    jobType: row.jobType || '',
    selfEvaluation: row.selfEvaluation || '',
  }
  editVisible.value = true
}

async function doSave() {
  if (!editData.value) return
  saving.value = true
  try {
    const res: any = await updateResume(editData.value.id, editData.value)
    if (res.success) {
      ElMessage.success('保存成功')
      editVisible.value = false
      fetchList()
    } else {
      ElMessage.error(res.error || '保存失败')
    }
  } catch {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

async function doDelete(id: number) {
  try {
    const res: any = await deleteResume(id)
    if (res.success) {
      ElMessage.success('删除成功')
      fetchList()
    } else {
      ElMessage.error(res.error || '删除失败')
    }
  } catch {
    ElMessage.error('删除失败')
  }
}

async function doBatchUpload() {
  const files = batchUploadRef.value?.uploadFiles?.map(f => f.raw!).filter(Boolean)
  if (!files || files.length === 0) {
    ElMessage.warning('请选择至少一个文件')
    return
  }

  batchUploading.value = true
  batchResults.value = null
  try {
    const res: any = await batchParseResumes(files)
    if (res.success) {
      batchResults.value = res.data
      ElMessage.success(res.message || '批量导入完成')
      fetchList()
    } else {
      ElMessage.error(res.error || '导入失败')
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '批量导入失败')
  } finally {
    batchUploading.value = false
  }
}

async function doBatchDelete() {
  deleting.value = true
  try {
    const res: any = await batchDeleteResumes(selectedIds.value)
    if (res.success) {
      ElMessage.success(res.message || `已删除 ${res.data.deletedCount} 条`)
      batchDeleteDialog.value = false
      selectedIds.value = []
      fetchList()
    } else {
      ElMessage.error(res.error || '删除失败')
    }
  } catch {
    ElMessage.error('批量删除失败')
  } finally {
    deleting.value = false
  }
}

async function exportResumes() {
  try {
    const res = await exportResumesExcel({ keyword: searchKeyword.value || undefined })
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `简历库导出_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch {
    ElMessage.error('导出失败')
  }
}

onMounted(() => { fetchList() })
</script>

<style scoped>
.resume-library-page {
  display: flex; flex-direction: column;
  height: calc(100vh - 64px); padding: 16px 20px;
  background: #f5f7fa;
}
.page-toolbar {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 12px;
}
.left-actions { display: flex; gap: 8px; }
.right-actions { display: flex; gap: 8px; }
.page-pagination {
  display: flex; justify-content: flex-end;
  padding: 12px 0; background: white;
}
.upload-zone {
  display: flex; flex-direction: column; align-items: center;
  padding: 30px 20px; gap: 12px;
}
.upload-text {
  display: flex; flex-direction: column; align-items: center;
  font-size: 13px; color: #606266; gap: 4px;
}
.upload-text em { color: #667eea; font-style: normal; }
.upload-hint { font-size: 11px; color: #c0c4cc; }
.resume-detail { max-height: 500px; overflow-y: auto; }
</style>
