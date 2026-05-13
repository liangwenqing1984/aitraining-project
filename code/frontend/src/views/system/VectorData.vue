<template>
  <div class="system-page">
    <el-card shadow="never" class="search-card">
      <el-tabs v-model="activeTab" @tab-change="onTabChange">
        <el-tab-pane label="职位向量索引" name="job" />
        <el-tab-pane label="文档向量索引" name="doc" />
      </el-tabs>
    </el-card>

    <!-- 职位向量 Tab -->
    <template v-if="activeTab === 'job'">
      <el-card shadow="never" class="search-card">
        <el-form :inline="true" :model="jobSearch">
          <el-form-item label="任务ID">
            <el-input v-model="jobSearch.taskId" placeholder="任务ID" clearable style="width: 280px" @keyup.enter="loadJobRecords" />
          </el-form-item>
          <el-form-item label="关键字">
            <el-input v-model="jobSearch.keyword" placeholder="职位ID/内容" clearable style="width: 200px" @keyup.enter="loadJobRecords" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleJobSearch">搜索</el-button>
            <el-button @click="handleJobReset">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-card shadow="never">
        <div class="action-bar">
          <el-button type="danger" plain @click="handleDeleteJobByTask">
            <el-icon><Delete /></el-icon>按任务批量删除
          </el-button>
        </div>

        <el-table :data="jobRecords" stripe v-loading="jobLoading" row-key="id">
          <el-table-column prop="taskId" label="任务ID" width="140" show-overflow-tooltip />
          <el-table-column prop="jobId" label="职位ID" width="140" show-overflow-tooltip />
          <el-table-column prop="jobName" label="职位名称" width="160" show-overflow-tooltip />
          <el-table-column prop="companyName" label="公司名称" width="160" show-overflow-tooltip />
          <el-table-column prop="textPreview" label="内容摘要" min-width="240" show-overflow-tooltip />
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ row }">
              <el-popconfirm title="确定删除该条向量索引？" confirm-button-text="删除" @confirm="handleDeleteJobRecord(row)">
                <template #reference>
                  <el-button link type="danger" size="small">
                    <el-icon><Delete /></el-icon>删除
                  </el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-model:current-page="jobPage"
          v-model:page-size="jobPageSize"
          :total="jobTotal"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          style="margin-top: 16px; justify-content: flex-end; display: flex"
          @current-change="loadJobRecords"
          @size-change="loadJobRecords"
        />
      </el-card>
    </template>

    <!-- 文档向量 Tab -->
    <template v-if="activeTab === 'doc'">
      <el-card shadow="never" class="search-card">
        <el-form :inline="true" :model="docSearch">
          <el-form-item label="来源类型">
            <el-select v-model="docSearch.sourceType" clearable placeholder="全部" style="width: 180px">
              <el-option label="帮助文档" value="doc_section" />
              <el-option label="用户手册" value="user_doc" />
              <el-option label="诊断文档" value="diagnostic" />
              <el-option label="设计文档" value="design_doc" />
              <el-option label="后端源代码" value="backend_source" />
              <el-option label="前端源代码" value="frontend_source" />
            </el-select>
          </el-form-item>
          <el-form-item label="关键字">
            <el-input v-model="docSearch.keyword" placeholder="标题/章节ID/路径" clearable style="width: 200px" @keyup.enter="loadDocRecords" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="handleDocSearch">搜索</el-button>
            <el-button @click="handleDocReset">重置</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-card shadow="never">
        <div class="action-bar">
          <el-popconfirm title="确定删除该类型全部文档向量？" confirm-button-text="确认删除" @confirm="handleDeleteDocByType">
            <template #reference>
              <el-button type="danger" plain :disabled="!docSearch.sourceType">
                <el-icon><Delete /></el-icon>按类型批量删除
              </el-button>
            </template>
          </el-popconfirm>
        </div>

        <el-table :data="docRecords" stripe v-loading="docLoading" row-key="id">
          <el-table-column prop="sectionId" label="章节/文件ID" width="200" show-overflow-tooltip />
          <el-table-column prop="sectionTitle" label="标题" width="200" show-overflow-tooltip />
          <el-table-column label="来源类型" width="110">
            <template #default="{ row }">
              <el-tag :type="sourceTypeTag(row.sourceType)" size="small">{{ sourceTypeLabel(row.sourceType) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="filePath" label="文件路径" width="200" show-overflow-tooltip />
          <el-table-column prop="chunkIndex" label="片段索引" width="80" />
          <el-table-column prop="createdAt" label="创建时间" width="170" />
          <el-table-column label="操作" width="80" fixed="right">
            <template #default="{ row }">
              <el-popconfirm title="确定删除该条文档向量？" confirm-button-text="删除" @confirm="handleDeleteDocRecord(row)">
                <template #reference>
                  <el-button link type="danger" size="small">
                    <el-icon><Delete /></el-icon>删除
                  </el-button>
                </template>
              </el-popconfirm>
            </template>
          </el-table-column>
        </el-table>

        <el-pagination
          v-model:current-page="docPage"
          v-model:page-size="docPageSize"
          :total="docTotal"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          style="margin-top: 16px; justify-content: flex-end; display: flex"
          @current-change="loadDocRecords"
          @size-change="loadDocRecords"
        />
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import { listJobEmbeddings, deleteRAGIndex } from '@/api/llm'
import { listDocEmbeddings, deleteDocBySourceType, deleteDocBySection } from '@/api/chat'

const activeTab = ref('job')

const SOURCE_LABELS: Record<string, string> = {
  doc_section: '帮助文档',
  user_doc: '用户手册',
  diagnostic: '诊断文档',
  design_doc: '设计文档',
  backend_source: '后端源代码',
  frontend_source: '前端源代码',
}
const SOURCE_TAGS: Record<string, string> = {
  doc_section: '',
  user_doc: 'success',
  diagnostic: 'warning',
  design_doc: 'info',
  backend_source: 'danger',
  frontend_source: '',
}

function sourceTypeLabel(st: string) { return SOURCE_LABELS[st] || st || '未知' }
function sourceTypeTag(st: string) { return SOURCE_TAGS[st] || '' }

// ==================== 职位向量 ====================

const jobRecords = ref<any[]>([])
const jobLoading = ref(false)
const jobPage = ref(1)
const jobPageSize = ref(10)
const jobTotal = ref(0)
const jobSearch = reactive({ taskId: '', keyword: '' })

async function loadJobRecords() {
  jobLoading.value = true
  try {
    const res: any = await listJobEmbeddings({
      taskId: jobSearch.taskId || undefined,
      keyword: jobSearch.keyword || undefined,
      page: jobPage.value,
      pageSize: jobPageSize.value,
    })
    if (res.success) {
      jobRecords.value = res.data.list
      jobTotal.value = res.data.total
    }
  } catch { /* handled */ }
  finally { jobLoading.value = false }
}

function handleJobSearch() { jobPage.value = 1; loadJobRecords() }
function handleJobReset() { jobSearch.taskId = ''; jobSearch.keyword = ''; jobPage.value = 1; loadJobRecords() }

async function handleDeleteJobRecord(row: any) {
  try {
    const res: any = await deleteRAGIndex(row.taskId)
    if (res.success) { ElMessage.success(`已删除 ${res.data.deletedCount} 条向量索引`); loadJobRecords() }
  } catch { /* handled */ }
}

async function handleDeleteJobByTask() {
  const taskId = jobSearch.taskId
  if (!taskId) { ElMessage.warning('请先输入要删除的任务ID'); return }
  try {
    await ElMessageBox.confirm(`确定删除任务 ${taskId} 的全部向量索引吗？此操作不可恢复。`, '确认批量删除', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' })
    const res: any = await deleteRAGIndex(taskId)
    if (res.success) { ElMessage.success(`已删除 ${res.data.deletedCount} 条向量索引`); loadJobRecords() }
  } catch { /* cancelled */ }
}

// ==================== 文档向量 ====================

const docRecords = ref<any[]>([])
const docLoading = ref(false)
const docPage = ref(1)
const docPageSize = ref(10)
const docTotal = ref(0)
const docSearch = reactive({ sourceType: '', keyword: '' })

async function loadDocRecords() {
  docLoading.value = true
  try {
    const res: any = await listDocEmbeddings({
      sourceType: docSearch.sourceType || undefined,
      keyword: docSearch.keyword || undefined,
      page: docPage.value,
      pageSize: docPageSize.value,
    })
    if (res.success) {
      docRecords.value = res.data.list
      docTotal.value = res.data.total
    }
  } catch { /* handled */ }
  finally { docLoading.value = false }
}

function handleDocSearch() { docPage.value = 1; loadDocRecords() }
function handleDocReset() { docSearch.sourceType = ''; docSearch.keyword = ''; docPage.value = 1; loadDocRecords() }

async function handleDeleteDocRecord(row: any) {
  try {
    const res: any = await deleteDocBySection(row.sectionId)
    if (res.success) { ElMessage.success(`已删除 ${res.data.deletedCount} 条文档向量`); loadDocRecords() }
  } catch { /* handled */ }
}

async function handleDeleteDocByType() {
  if (!docSearch.sourceType) return
  const label = sourceTypeLabel(docSearch.sourceType)
  try {
    const res: any = await deleteDocBySourceType(docSearch.sourceType)
    if (res.success) { ElMessage.success(`已删除 ${label} 下 ${res.data.deletedCount} 条文档向量`); loadDocRecords() }
  } catch { /* handled */ }
}

function onTabChange(tab: string) {
  if (tab === 'job' && jobRecords.value.length === 0) loadJobRecords()
  if (tab === 'doc' && docRecords.value.length === 0) loadDocRecords()
}

// 初始加载
loadJobRecords()
</script>

<style scoped>
.system-page { padding: 0; }
.search-card { margin-bottom: 16px; }
.action-bar { margin-bottom: 16px; }
</style>
