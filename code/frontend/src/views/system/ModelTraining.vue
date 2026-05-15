<template>
  <div class="system-page">
    <el-card shadow="never" class="search-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="训练数据" name="dataset" />
        <el-tab-pane label="训练任务" name="training" />
        <el-tab-pane label="模型管理" name="models" />
      </el-tabs>
    </el-card>

    <!-- Tab 1: 训练数据 -->
    <template v-if="activeTab === 'dataset'">
      <el-card shadow="never" class="search-card">
        <el-form :inline="true" :model="datasetForm">
          <el-form-item label="选择任务">
            <el-select
              v-model="datasetForm.taskIds"
              multiple
              filterable
              placeholder="选择已完成的任务"
              style="width: 420px"
              clearable
            >
              <el-option
                v-for="t in tasks"
                :key="t.id"
                :label="`${t.name} (${t.source}, ${t.recordCount || 0}条, ${t.status})`"
                :value="t.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="正样本策略">
            <el-select v-model="datasetForm.positiveStrategy" style="width: 160px">
              <el-option label="同二级分类" value="same_l2" />
              <el-option label="同行业" value="same_industry" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="buildingDataset" @click="handleBuildDataset"><el-icon><FolderAdd /></el-icon>构建数据集</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <el-card shadow="never">
        <div class="table-header">已有数据集</div>
        <el-table :data="paginatedDatasets" v-loading="loadingDatasets" stripe>
          <el-table-column prop="name" label="文件名" min-width="260" />
          <el-table-column prop="pairCount" label="训练对数" width="100" />
          <el-table-column prop="size" label="大小" width="100" />
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" size="small" @click="handlePreviewDataset(row)"><el-icon><View /></el-icon>预览</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!loadingDatasets && datasets.length === 0" description="暂无数据集，请先选择任务构建" :image-size="60" />
        <el-pagination
          v-if="datasets.length > datasetPageSize"
          v-model:current-page="datasetPage"
          v-model:page-size="datasetPageSize"
          :total="datasets.length"
          layout="total, prev, pager, next"
          style="margin-top: 16px; justify-content: flex-end"
        />
      </el-card>

      <!-- 预览对话框 -->
      <el-dialog v-model="previewVisible" title="数据集样本预览" width="900px" destroy-on-close>
        <div v-if="previewSamples.length > 0">
          <div v-for="(s, i) in previewSamples" :key="i" class="sample-pair">
            <div class="sample-item">
              <span class="sample-label">Anchor (锚点)</span>
              <p class="sample-text">{{ s.anchor }}</p>
            </div>
            <div class="sample-item">
              <span class="sample-label positive">Positive (正样本: 同类)</span>
              <p class="sample-text">{{ s.positive }}</p>
            </div>
            <div class="sample-item">
              <span class="sample-label negative">Negative (负样本: 异类)</span>
              <p class="sample-text">{{ s.negative }}</p>
            </div>
          </div>
        </div>
        <el-empty v-else description="无法预览" />
      </el-dialog>
    </template>

    <!-- Tab 2: 训练任务 -->
    <template v-if="activeTab === 'training'">
      <el-card shadow="never" class="search-card">
        <el-form :inline="true" :model="trainingForm">
          <el-form-item label="数据集">
            <el-select v-model="trainingForm.datasetPath" placeholder="选择数据集" style="width: 280px" clearable filterable>
              <el-option v-for="d in datasets" :key="d.path" :label="`${d.name} (${d.pairCount}对)`" :value="d.path" />
            </el-select>
          </el-form-item>
          <el-form-item label="基座模型">
            <el-input v-model="trainingForm.baseModel" placeholder="nomic-ai/nomic-embed-text-v1.5" style="width: 280px" />
          </el-form-item>
          <el-form-item label="Epochs">
            <el-input-number v-model="trainingForm.epochs" :min="1" :max="20" size="small" style="width: 100px" />
          </el-form-item>
          <el-form-item label="Batch">
            <el-input-number v-model="trainingForm.batchSize" :min="4" :max="64" :step="4" size="small" style="width: 100px" />
          </el-form-item>
          <el-form-item label="LR">
            <el-input v-model="trainingForm.learningRate" placeholder="2e-5" size="small" style="width: 100px" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" :loading="startingTraining" :disabled="!trainingForm.datasetPath || !trainingForm.baseModel" @click="handleStartTraining">
              <el-icon><VideoPlay /></el-icon>开始训练
            </el-button>
          </el-form-item>
        </el-form>
        <el-alert type="warning" :closable="false" show-icon style="margin-top: 8px">
          <template #title>
            需要 Python 环境 (sentence-transformers + torch)。训练过程可能需要几分钟到几十分钟，取决于数据量和模型大小。
          </template>
        </el-alert>
      </el-card>

      <el-card shadow="never">
        <div class="table-header">训练任务列表</div>
        <el-table :data="trainingJobs" v-loading="loadingJobs" stripe>
          <el-table-column prop="id" label="ID" width="60" />
          <el-table-column prop="baseModel" label="基座模型" min-width="160" show-overflow-tooltip />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="进度" width="150">
            <template #default="{ row }">
              <el-progress
                v-if="row.status === 'running'"
                :percentage="Math.round(row.progress || 0)"
                :stroke-width="8"
                :indeterminate="row.progress === 0"
              />
              <span v-else-if="row.status === 'completed'">100%</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="评估" width="120">
            <template #default="{ row }">
              <span v-if="row.metrics?.accuracy_top1 != null">准确率 {{ (row.metrics.accuracy_top1 * 100).toFixed(1) }}%</span>
              <span v-else-if="row.metrics?.eval_pearson != null">Pearson {{ Number(row.metrics.eval_pearson).toFixed(3) }}</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建时间" width="170" show-overflow-tooltip />
          <el-table-column label="操作" width="210" fixed="right">
            <template #default="{ row }">
              <div style="display: flex; align-items: center; gap: 2px; white-space: nowrap;">
                <el-button v-if="row.status === 'running'" link type="warning" size="small" @click="handleStopJob(row)"><el-icon style="margin-right:2px;"><VideoPause /></el-icon>停止</el-button>
                <el-button link type="primary" size="small" @click="handleViewLog(row)"><el-icon style="margin-right:2px;"><Tickets /></el-icon>日志</el-button>
                <el-button link type="danger" size="small" @click="handleDeleteJob(row)"><el-icon style="margin-right:2px;"><Delete /></el-icon>删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <el-pagination
          v-model:current-page="jobPage"
          v-model:page-size="jobPageSize"
          :total="jobTotal"
          layout="total, prev, pager, next"
          style="margin-top: 16px; justify-content: flex-end"
          @current-change="loadTrainingJobs"
        />
      </el-card>

      <!-- 日志对话框 -->
      <el-dialog v-model="logVisible" title="训练日志" width="800px" destroy-on-close @closed="handleLogClosed">
        <el-input
          v-model="logContent"
          type="textarea"
          :rows="20"
          readonly
          style="font-family: monospace; font-size: 12px"
        />
      </el-dialog>
    </template>

    <!-- Tab 3: 模型管理 -->
    <template v-if="activeTab === 'models'">
      <el-card shadow="never">
        <div class="table-header">已训练模型</div>
        <el-table :data="paginatedModels" v-loading="loadingModels" stripe class="models-table">
          <el-table-column prop="name" label="模型名称" width="100" />
          <el-table-column prop="path" label="路径" min-width="280" show-overflow-tooltip />
          <el-table-column label="评估指标" width="200">
            <template #default="{ row }">
              <div v-if="row.metrics?.accuracy_top1 != null || row.metrics?.eval_pearson != null">
                <div v-if="row.metrics?.accuracy_top1 != null">Top-1 准确率: {{ (row.metrics.accuracy_top1 * 100).toFixed(1) }}%</div>
                <div v-if="row.metrics?.eval_pearson != null">Pearson: {{ Number(row.metrics.eval_pearson).toFixed(3) }}</div>
              </div>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column label="大小" width="110" align="right">
            <template #default="{ row }">
              <span v-if="row.sizeMB != null">{{ row.sizeMB.toFixed(1) }} MB</span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          <el-table-column prop="createdAt" label="创建时间" width="170" show-overflow-tooltip />
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <div style="display: flex; align-items: center; gap: 2px; white-space: nowrap;">
                <el-button link type="warning" size="small" @click="handleOpenEval(row)"><el-icon style="margin-right:2px;"><DataAnalysis /></el-icon>评估</el-button>
                <el-button link type="success" size="small" :disabled="!row.hasModelfile" @click="handleDeploy(row)"><el-icon style="margin-right:2px;"><Upload /></el-icon>部署</el-button>
                <el-button link type="danger" size="small" @click="handleDeleteModel(row)"><el-icon style="margin-right:2px;"><Delete /></el-icon>删除</el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!loadingModels && trainedModels.length === 0" description="暂无已训练模型" :image-size="60" />
        <el-pagination
          v-if="trainedModels.length > modelPageSize"
          v-model:current-page="modelPage"
          v-model:page-size="modelPageSize"
          :total="trainedModels.length"
          layout="total, prev, pager, next"
          style="margin-top: 16px; justify-content: flex-end"
        />
      </el-card>

      <!-- 部署确认对话框 -->
      <el-dialog v-model="deployVisible" title="部署模型到 Ollama" width="500px" destroy-on-close>
        <el-form :model="deployForm" label-width="100px">
          <el-form-item label="模型名称">
            <el-input v-model="deployForm.modelName" placeholder="例如: job-embed-v1" />
          </el-form-item>
        </el-form>
        <el-alert type="warning" :closable="false" show-icon style="margin-bottom: 16px">
          <template #title>
            部署后，需在「模型配置」中将 embedding 任务指向新模型。如果维度与当前 nomic-embed-text (768维) 不同，所有职位向量需要重新索引。
          </template>
        </el-alert>
        <template #footer>
          <el-button @click="deployVisible = false"><el-icon><Close /></el-icon>取消</el-button>
          <el-button type="primary" :loading="deploying" @click="handleConfirmDeploy"><el-icon><Check /></el-icon>确认部署</el-button>
        </template>
      </el-dialog>

      <!-- 评估对话框 -->
      <el-dialog v-model="evalVisible" title="评估模型" width="500px" destroy-on-close>
        <el-form :model="evalForm" label-width="100px">
          <el-form-item label="模型名称">
            <el-input :model-value="evalTarget?.name" disabled />
          </el-form-item>
          <el-form-item label="选择数据集">
            <el-select v-model="evalForm.datasetPath" placeholder="选择训练数据集" style="width: 100%" filterable>
              <el-option v-for="d in datasets" :key="d.path" :label="`${d.name} (${d.pairCount}对)`" :value="d.path" />
            </el-select>
          </el-form-item>
        </el-form>
        <el-alert type="info" :closable="false" show-icon style="margin-bottom: 16px">
          <template #title>
            选择用于评估的数据集，脚本将用该数据集计算 Pearson 相似度和 Top-1 准确率，写入模型目录的 metrics.json。
          </template>
        </el-alert>
        <template #footer>
          <el-button @click="evalVisible = false"><el-icon><Close /></el-icon>取消</el-button>
          <el-button type="primary" :loading="evaluating" :disabled="!evalForm.datasetPath" @click="handleDoEvaluate"><el-icon><DataAnalysis /></el-icon>开始评估</el-button>
        </template>
      </el-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { VideoPlay, VideoPause, Tickets, Delete, Upload, FolderAdd, View, Close, Check, DataAnalysis } from '@element-plus/icons-vue'
import {
  buildDataset, listDatasets, previewDataset,
  startTraining, listTrainingJobs, deleteTrainingJob, stopTraining, getTrainingStatus, deleteModel,
  listModels, deployModel, evaluateModel,
  type TrainingDataset, type TrainingJob, type TrainingModel,
} from '@/api/training'

const activeTab = ref('dataset')

// ========== Tab 1: 训练数据 ==========
const tasks = ref<any[]>([])
const datasetForm = reactive({
  taskIds: [] as string[],
  positiveStrategy: 'same_l2',
})
const buildingDataset = ref(false)
const loadingDatasets = ref(false)
const datasets = ref<TrainingDataset[]>([])
const datasetPage = ref(1)
const datasetPageSize = ref(10)
const paginatedDatasets = computed(() => {
  const start = (datasetPage.value - 1) * datasetPageSize.value
  return datasets.value.slice(start, start + datasetPageSize.value)
})
const previewVisible = ref(false)
const previewSamples = ref<any[]>([])

async function loadTasks() {
  try {
    const api = (await import('@/api/index')).default
    const res = await api.get('/tasks', { params: { pageSize: 200 } })
    tasks.value = res?.data?.list || res?.data || []
  } catch {}
}

async function loadDatasets() {
  loadingDatasets.value = true
  try {
    const res: any = await listDatasets()
    if (res.success) datasets.value = res.data
  } catch (e: any) {
    ElMessage.error('加载数据集失败')
  } finally {
    loadingDatasets.value = false
  }
}

async function handleBuildDataset() {
  if (datasetForm.taskIds.length === 0) {
    ElMessage.warning('请至少选择一个任务')
    return
  }
  buildingDataset.value = true
  try {
    const res: any = await buildDataset({ taskIds: datasetForm.taskIds, positiveStrategy: datasetForm.positiveStrategy })
    if (res.success) {
      ElMessage.success(`数据集构建完成，共 ${res.data.pairCount} 对训练数据`)
      await loadDatasets()
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '构建失败')
  } finally {
    buildingDataset.value = false
  }
}

async function handlePreviewDataset(row: TrainingDataset) {
  try {
    const res: any = await previewDataset(row.path)
    if (res.success) {
      previewSamples.value = res.data.samples
      previewVisible.value = true
    }
  } catch (e: any) {
    ElMessage.error('预览失败')
  }
}

// ========== Tab 2: 训练任务 ==========
const trainingForm = reactive({
  datasetPath: '',
  baseModel: 'nomic-ai/nomic-embed-text-v1.5',
  epochs: 3,
  batchSize: 16,
  learningRate: '2e-5',
})
const startingTraining = ref(false)
const loadingJobs = ref(false)
const trainingJobs = ref<TrainingJob[]>([])
const jobPage = ref(1)
const jobPageSize = ref(10)
const jobTotal = ref(0)
const logVisible = ref(false)
const logContent = ref('')
const logJobId = ref<number | null>(null)
let pollingTimer: ReturnType<typeof setInterval> | null = null
let logRefreshTimer: ReturnType<typeof setInterval> | null = null

async function loadTrainingJobs() {
  loadingJobs.value = true
  try {
    const res: any = await listTrainingJobs({ page: jobPage.value, pageSize: jobPageSize.value })
    if (res.success) {
      trainingJobs.value = res.data.list
      jobTotal.value = res.data.total
    }
  } catch {} finally {
    loadingJobs.value = false
  }
}

async function handleStartTraining() {
  if (!trainingForm.datasetPath || !trainingForm.baseModel) {
    ElMessage.warning('请选择数据集和基座模型')
    return
  }
  startingTraining.value = true
  try {
    const res: any = await startTraining({
      datasetPath: trainingForm.datasetPath,
      baseModel: trainingForm.baseModel,
      params: {
        epochs: trainingForm.epochs,
        batchSize: trainingForm.batchSize,
        learningRate: parseFloat(trainingForm.learningRate) || 2e-5,
      },
    })
    if (res.success) {
      ElMessage.success(`训练已启动，任务ID: ${res.data.jobId}`)
      activeTab.value = 'training'
      await loadTrainingJobs()
      startPolling()
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '启动训练失败')
  } finally {
    startingTraining.value = false
  }
}

function startPolling() {
  if (pollingTimer) clearInterval(pollingTimer)
  pollingTimer = setInterval(async () => {
    const hasRunning = trainingJobs.value.some(j => j.status === 'running')
    if (!hasRunning) { stopPolling(); return }
    await loadTrainingJobs()
  }, 3000)
}

function stopPolling() {
  if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null }
}

async function handleStopJob(row: TrainingJob) {
  try {
    await ElMessageBox.confirm(`确定停止训练任务 ${row.name}？`, '停止确认', { type: 'warning' })
  } catch { return }
  try {
    const res: any = await stopTraining(row.id)
    if (res.success) {
      ElMessage.success('训练已停止')
      await loadTrainingJobs()
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '停止失败')
  }
}

function handleViewLog(row: TrainingJob) {
  logJobId.value = row.id
  logContent.value = row.log || '暂无日志'
  logVisible.value = true
}

// 日志对话框打开时自动刷新，关闭时清理
watch(logVisible, (visible) => {
  if (visible) {
    logRefreshTimer = setInterval(async () => {
      if (!logJobId.value) return
      try {
        const res: any = await getTrainingStatus(logJobId.value)
        if (res.success && res.data) {
          logContent.value = res.data.log || '暂无日志'
        }
      } catch {}
    }, 2000)
  } else {
    if (logRefreshTimer) { clearInterval(logRefreshTimer); logRefreshTimer = null }
    logJobId.value = null
  }
})

function handleLogClosed() {
  // watch on logVisible handles cleanup
}

async function handleDeleteJob(row: TrainingJob) {
  try {
    await ElMessageBox.confirm(`确定删除训练任务 #${row.id}？关联的模型文件也将被删除。`, '删除确认', { type: 'warning' })
  } catch { return }
  try {
    await deleteTrainingJob(row.id)
    ElMessage.success('已删除')
    await loadTrainingJobs()
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '删除失败')
  }
}

function statusType(status: string) {
  const map: Record<string, string> = { pending: 'info', running: '', completed: 'success', failed: 'danger', stopped: 'warning' }
  return map[status] || 'info'
}
function statusLabel(status: string) {
  const map: Record<string, string> = { pending: '等待中', running: '训练中', completed: '已完成', failed: '失败', stopped: '已停止' }
  return map[status] || status
}

// ========== Tab 3: 模型管理 ==========
const loadingModels = ref(false)
const trainedModels = ref<TrainingModel[]>([])
const modelPage = ref(1)
const modelPageSize = ref(10)
const paginatedModels = computed(() => {
  const start = (modelPage.value - 1) * modelPageSize.value
  return trainedModels.value.slice(start, start + modelPageSize.value)
})
const deployVisible = ref(false)
const deploying = ref(false)
const deployTarget = ref<TrainingModel | null>(null)
const deployForm = reactive({ modelName: '' })

const evalVisible = ref(false)
const evaluating = ref(false)
const evalTarget = ref<TrainingModel | null>(null)
const evalForm = reactive({ datasetPath: '' })

async function loadModels() {
  loadingModels.value = true
  try {
    const res: any = await listModels()
    if (res.success) trainedModels.value = res.data
  } catch {} finally {
    loadingModels.value = false
  }
}

function handleDeploy(row: TrainingModel) {
  deployTarget.value = row
  deployForm.modelName = row.name
  deployVisible.value = true
}

function handleOpenEval(row: TrainingModel) {
  evalTarget.value = row
  evalForm.datasetPath = ''
  evalVisible.value = true
}

async function handleDoEvaluate() {
  if (!evalTarget.value || !evalForm.datasetPath) return
  evaluating.value = true
  try {
    const res: any = await evaluateModel(evalTarget.value.path, evalForm.datasetPath)
    if (res.success) {
      const pearson = res.data.metrics?.eval_pearson
      const top1 = res.data.metrics?.accuracy_top1
      ElMessage.success(`评估完成 — Pearson: ${pearson != null ? Number(pearson).toFixed(4) : 'N/A'}, Top-1: ${top1 != null ? (top1 * 100).toFixed(1) + '%' : 'N/A'}`)
      evalVisible.value = false
      await loadModels()
    } else {
      showEvalError(res.error || '评估失败', res.stdout, res.stderr)
    }
  } catch (e: any) {
    const data = e.response?.data
    if (e.code === 'ECONNABORTED' || e.message?.includes('timeout')) {
      ElMessage({ type: 'error', message: '评估请求超时（3分钟），模型加载或计算耗时过长，请检查网络和 Python 环境', duration: 15000, showClose: true })
    } else if (data) {
      showEvalError(data.error || '评估失败', data.stdout, data.stderr)
    } else {
      ElMessage({ type: 'error', message: '评估失败: ' + (e.message || '未知错误'), duration: 15000, showClose: true })
    }
  } finally {
    evaluating.value = false
  }
}

function showEvalError(error: string, stdout?: string, stderr?: string) {
  let msg = error
  if (stderr) msg += '\n\n[stderr]\n' + stderr
  if (stdout) msg += '\n\n[stdout]\n' + stdout
  ElMessage({ type: 'error', message: msg, duration: 20000, showClose: true })
}

async function handleConfirmDeploy() {
  if (!deployTarget.value || !deployForm.modelName) return
  deploying.value = true
  try {
    const res: any = await deployModel({ modelPath: deployTarget.value.path, modelName: deployForm.modelName })
    if (res.success) {
      ElMessage.success(`模型 ${deployForm.modelName} 已部署到 Ollama`)
      deployVisible.value = false
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '部署失败')
  } finally {
    deploying.value = false
  }
}

async function handleDeleteModel(row: TrainingModel) {
  try {
    await ElMessageBox.confirm(`确定删除模型 ${row.name}？此操作不可恢复。`, '删除确认', { type: 'warning' })
  } catch { return }
  try {
    const res: any = await deleteModel(row.name)
    if (res.success) {
      ElMessage.success(`模型 ${row.name} 已删除`)
      await loadModels()
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '删除失败')
  }
}

onMounted(() => {
  loadTasks()
  loadDatasets()
  loadTrainingJobs()
  loadModels()
})

onUnmounted(() => {
  if (pollingTimer) { clearInterval(pollingTimer); pollingTimer = null }
  if (logRefreshTimer) { clearInterval(logRefreshTimer); logRefreshTimer = null }
})
</script>

<style scoped>
.system-page { padding: 0; }
.search-card { margin-bottom: 16px; }
.table-header { font-size: 14px; font-weight: 600; margin-bottom: 12px; color: #303133; }

.sample-pair { margin-bottom: 24px; border-bottom: 1px solid #ebeef5; padding-bottom: 16px; }
.sample-pair:last-child { border-bottom: none; margin-bottom: 0; }
.sample-item { margin-bottom: 10px; }
.sample-label { font-size: 12px; font-weight: 600; display: inline-block; padding: 2px 8px; border-radius: 4px; background: #ecf5ff; color: #409eff; margin-bottom: 4px; }
.sample-label.positive { background: #f0f9eb; color: #67c23a; }
.sample-label.negative { background: #fef0f0; color: #f56c6c; }
.sample-text { font-size: 12px; color: #606266; line-height: 1.6; word-break: break-all; margin: 0; padding: 4px 8px; background: #f5f7fa; border-radius: 4px; max-height: 100px; overflow-y: auto; }

.models-table :deep(.el-table__cell) { white-space: nowrap; }
</style>
