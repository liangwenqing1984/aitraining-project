<template>
  <div class="rag-page">
    <div class="rag-layout">
      <!-- 左侧：搜索面板 -->
      <div class="search-panel">
        <div class="panel-header">
          <h3>语义搜索</h3>
          <span class="panel-subtitle">基于 AI 向量化的职位语义匹配</span>
        </div>

        <!-- 搜索输入 -->
        <div class="search-box">
          <el-input
            v-model="queryText"
            type="textarea"
            :rows="3"
            placeholder="描述你想要的职位，例如：&#10;需要5年以上经验的Java后端开发，熟悉微服务架构"
            @keyup.enter.ctrl="doSearch"
          />
          <div class="search-options">
            <el-select
              v-model="searchTaskId"
              placeholder="限定任务范围（可选）"
              clearable
              size="small"
              style="width: 100%"
            >
              <el-option
                v-for="t in taskOptions"
                :key="t.taskId"
                :label="`${t.taskId?.substring(0, 8)}... (${t.count}条)`"
                :value="t.taskId"
              />
            </el-select>
            <div class="option-row">
              <span class="option-label">返回数量</span>
              <el-slider v-model="searchLimit" :min="5" :max="50" :step="5" show-stops size="small" style="width: 140px" />
              <span class="option-value">{{ searchLimit }}</span>
            </div>
          </div>
          <el-button type="primary" :loading="searching" @click="doSearch" style="width: 100%; margin-top: 12px">
            搜索相似职位
          </el-button>
        </div>

        <!-- 索引管理 -->
        <div class="index-section">
          <div class="section-title">
            <span>向量索引管理</span>
            <el-button size="small" text @click="loadStats">刷新</el-button>
          </div>
          <div v-if="statsLoading" style="text-align: center; padding: 20px">
            <el-icon class="is-loading"><Loading /></el-icon>
          </div>
          <div v-else-if="statsList.length === 0" class="no-stats">
            暂无向量化数据，请选择任务进行索引
          </div>
          <div v-else class="stats-list">
            <div v-for="s in statsList" :key="s.taskId" class="stat-item">
              <span class="stat-id">{{ s.taskId?.substring(0, 10) }}...</span>
              <span class="stat-count">{{ s.count }} 条</span>
            </div>
          </div>
          <div class="index-action">
            <el-select
              v-model="indexTaskId"
              placeholder="选择要索引的任务"
              size="small"
              style="width: 100%"
              :loading="loadingTasks"
            >
              <el-option
                v-for="t in taskOptions"
                :key="t.taskId"
                :label="`${t.label || t.taskId?.substring(0, 8)} (${t.count}条记录)`"
                :value="t.taskId"
              />
            </el-select>
            <el-button
              type="warning"
              size="small"
              :loading="indexing"
              @click="doIndex"
              style="width: 100%; margin-top: 8px"
              :disabled="!indexTaskId"
            >
              开始向量化索引
            </el-button>
            <div v-if="indexProgress" class="index-progress">{{ indexProgress }}</div>
          </div>
        </div>
      </div>

      <!-- 右侧：搜索结果 -->
      <div class="result-panel">
        <div class="result-header">
          <h3>搜索结果</h3>
          <span v-if="searchResult" class="result-meta">
            共 {{ searchResult.count }} 条 · 耗时 {{ searchTime }}ms
          </span>
        </div>

        <div v-if="!searchResult && !searching" class="result-placeholder">
          <el-icon :size="48" color="#c0c4cc"><Search /></el-icon>
          <p>输入职位描述，AI 将为你找到最匹配的岗位</p>
          <div class="example-queries">
            <span class="example-label">试试：</span>
            <el-tag
              v-for="eq in exampleQueries"
              :key="eq"
              class="example-tag"
              @click="queryText = eq; doSearch()"
            >
              {{ eq }}
            </el-tag>
          </div>
        </div>

        <div v-if="searching" class="searching-hint">
          <el-icon class="is-loading" :size="24"><Loading /></el-icon>
          <span>正在搜索...</span>
        </div>

        <div v-if="searchResult && !searching" class="result-list">
          <div
            v-for="(item, idx) in searchResult.results"
            :key="item.id"
            class="result-card"
            :style="{ animationDelay: idx * 0.05 + 's' }"
          >
            <div class="card-header">
              <span class="card-title">{{ item.jobName || '未知职位' }}</span>
              <el-tag
                :type="item.similarity > 0.7 ? 'success' : item.similarity > 0.5 ? 'warning' : 'info'"
                size="small"
              >
                匹配度 {{ (item.similarity * 100).toFixed(0) }}%
              </el-tag>
            </div>
            <div class="card-tags">
              <el-tag v-if="item.jobCategoryL1" size="small" effect="plain">{{ item.jobCategoryL1 }}</el-tag>
              <el-tag v-if="item.jobCategoryL2" size="small" effect="plain">{{ item.jobCategoryL2 }}</el-tag>
              <el-tag v-if="item.companyIndustry" size="small" effect="plain" type="success">{{ item.companyIndustry }}</el-tag>
              <el-tag v-if="item.workCity" size="small" effect="plain" type="warning">{{ item.workCity }}</el-tag>
            </div>
            <div class="card-salary" v-if="item.salaryMonthlyMin || item.salaryMonthlyMax">
              💰 {{ item.salaryMonthlyMin ? (item.salaryMonthlyMin / 1000).toFixed(0) + 'K' : '?' }}
              - {{ item.salaryMonthlyMax ? (item.salaryMonthlyMax / 1000).toFixed(0) + 'K' : '?' }}
            </div>
            <div class="card-skills" v-if="item.keySkills && item.keySkills.length > 0">
              <el-tag
                v-for="sk in item.keySkills.slice(0, 8)"
                :key="sk"
                size="small"
                class="skill-tag"
              >{{ sk }}</el-tag>
            </div>
          </div>

          <el-empty v-if="searchResult.results.length === 0" description="未找到匹配的职位，请尝试其他描述" :image-size="80" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Loading } from '@element-plus/icons-vue'
import { ragSearch, startRAGIndex, getRAGStats, type RAGSearchResult } from '@/api/llm'
import { taskApi } from '@/api/task'

const queryText = ref('')
const searching = ref(false)
const searchLimit = ref(10)
const searchTaskId = ref('')
const searchResult = ref<{ query: string; results: RAGSearchResult[]; count: number } | null>(null)
const searchTime = ref(0)

const indexing = ref(false)
const indexTaskId = ref('')
const indexProgress = ref('')
const loadingTasks = ref(false)

const statsList = ref<any[]>([])
const statsLoading = ref(false)

const taskOptions = ref<{ taskId: string; count: number; label?: string }[]>([])

const exampleQueries = [
  '高薪Java后端开发，需要微服务经验',
  'Python数据分析岗位，机器学习方向',
  '前端开发，React和TypeScript',
  '产品经理，B端SaaS经验',
  '算法工程师，深度学习方向',
]

async function loadTasks() {
  loadingTasks.value = true
  try {
    const res: any = await taskApi.getTasks({ page: 1, pageSize: 100 })
    if (res.success && res.data) {
      const tasks = (res.data.list || res.data || []).filter(
        (t: any) => t.recordCount > 0
      )
      taskOptions.value = tasks.map((t: any) => ({
        taskId: t.id,
        count: t.recordCount || 0,
        label: t.name || t.id,
      }))
    }
  } catch { /* ignore */ }
  loadingTasks.value = false
}

async function loadStats() {
  statsLoading.value = true
  try {
    const res: any = await getRAGStats()
    if (res.success) {
      statsList.value = Array.isArray(res.data) ? res.data : (res.data ? [res.data] : [])
    }
  } catch { /* ignore */ }
  statsLoading.value = false
}

async function doSearch() {
  const q = queryText.value.trim()
  if (!q) {
    ElMessage.warning('请输入搜索内容')
    return
  }

  searching.value = true
  searchResult.value = null
  const start = Date.now()

  try {
    const res: any = await ragSearch(q, {
      limit: searchLimit.value,
      taskId: searchTaskId.value || undefined,
      minSimilarity: 0.3,
    })
    if (res.success) {
      searchResult.value = res.data
      searchTime.value = Date.now() - start
    } else {
      ElMessage.error(res.error || '搜索失败')
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '搜索失败，请检查 Ollama 服务是否运行')
  } finally {
    searching.value = false
  }
}

async function doIndex() {
  if (!indexTaskId.value) return

  indexing.value = true
  indexProgress.value = '正在启动向量化索引...'

  try {
    const res: any = await startRAGIndex(indexTaskId.value)
    if (res.success) {
      ElMessage.success('向量化索引已启动，请等待完成通知')
      indexProgress.value = '索引进行中，可点击刷新查看进度...'
      // 轮询等待完成
      const pollTimer = setInterval(async () => {
        try {
          const statsRes: any = await getRAGStats(indexTaskId.value)
          if (statsRes.success && statsRes.data) {
            const data = Array.isArray(statsRes.data) ? statsRes.data[0] : statsRes.data
            if (data && data.count > 0) {
              indexProgress.value = `已完成：${data.count} 条向量化`
              clearInterval(pollTimer)
              await loadStats()
              ElMessage.success(`向量化索引完成：${data.count} 条`)
              indexing.value = false
            }
          }
        } catch { /* ignore */ }
      }, 3000)

      setTimeout(() => {
        clearInterval(pollTimer)
        if (indexing.value) {
          indexing.value = false
          indexProgress.value = ''
          loadStats()
        }
      }, 300000)
    } else {
      ElMessage.error(res.error || '索引启动失败')
      indexing.value = false
      indexProgress.value = ''
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '索引启动失败')
    indexing.value = false
    indexProgress.value = ''
  }
}

onMounted(() => {
  loadTasks()
  loadStats()
})
</script>

<style scoped>
.rag-page { height: calc(100vh - 64px); display: flex; flex-direction: column; }
.rag-layout { display: flex; height: 100%; gap: 0; }

.search-panel {
  width: 320px; min-width: 320px; border-right: 1px solid #e4e7ed;
  background: #fafafa; display: flex; flex-direction: column; overflow-y: auto;
}
.panel-header { padding: 16px 20px 8px; }
.panel-header h3 { margin: 0; font-size: 16px; }
.panel-subtitle { font-size: 12px; color: #909399; }

.search-box { padding: 12px 20px; }
.search-options { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.option-row { display: flex; align-items: center; gap: 8px; }
.option-label { font-size: 12px; color: #606266; white-space: nowrap; }
.option-value { font-size: 12px; color: #409eff; font-weight: bold; min-width: 30px; }

.index-section { padding: 16px 20px; border-top: 1px solid #e4e7ed; margin-top: 12px; }
.section-title { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 14px; font-weight: 500; }
.stats-list { margin-bottom: 12px; }
.stat-item { display: flex; justify-content: space-between; padding: 6px 8px; font-size: 12px; border-radius: 4px; }
.stat-item:hover { background: #f0f0f0; }
.stat-id { color: #606266; font-family: monospace; }
.stat-count { color: #409eff; font-weight: bold; }
.no-stats { text-align: center; padding: 16px; color: #909399; font-size: 12px; }
.index-action { margin-top: 8px; }
.index-progress { margin-top: 8px; font-size: 12px; color: #e6a23c; text-align: center; }

.result-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.result-header {
  padding: 16px 24px; border-bottom: 1px solid #e4e7ed;
  display: flex; align-items: baseline; gap: 12px;
}
.result-header h3 { margin: 0; font-size: 16px; }
.result-meta { font-size: 12px; color: #909399; }

.result-placeholder {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; color: #909399; gap: 12px;
}
.example-queries { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 8px; }
.example-label { font-size: 12px; }
.example-tag { cursor: pointer; }
.example-tag:hover { background: #409eff; color: white; border-color: #409eff; }

.searching-hint {
  flex: 1; display: flex; align-items: center; justify-content: center;
  gap: 12px; color: #909399; font-size: 14px;
}

.result-list { flex: 1; overflow-y: auto; padding: 20px 24px; }

.result-card {
  background: white; border: 1px solid #e4e7ed; border-radius: 8px;
  padding: 16px; margin-bottom: 12px; transition: box-shadow 0.2s;
  animation: fadeInUp 0.3s ease-out both;
}
.result-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.card-title { font-size: 15px; font-weight: 600; color: #303133; }
.card-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.card-salary { font-size: 14px; color: #e6a23c; font-weight: 500; margin-bottom: 8px; }
.card-skills { display: flex; flex-wrap: wrap; gap: 4px; }
.skill-tag { background: #f0f9eb; border-color: #c2e7b0; color: #67c23a; }
</style>
