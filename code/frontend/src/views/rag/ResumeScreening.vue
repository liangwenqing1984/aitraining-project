<template>
  <div class="resume-page">
    <div class="resume-layout">
      <!-- 左侧：简历输入面板 -->
      <div class="input-panel">
        <div class="panel-header">
          <h3>简历筛选</h3>
          <span class="panel-subtitle">粘贴简历文本，匹配最合适的职位</span>
        </div>

        <div class="input-box">
          <el-input
            v-model="resumeText"
            type="textarea"
            :rows="14"
            placeholder="在此粘贴候选人简历文本...&#10;&#10;例如：&#10;张三，5年Java开发经验，熟练掌握Spring Boot、MySQL、Redis，曾负责电商系统后端架构设计，本科毕业于XX大学计算机系..."
          />
          <div class="file-upload">
            <el-upload
              :auto-upload="false"
              :limit="1"
              accept=".txt"
              :show-file-list="false"
              :on-change="handleFileChange"
            >
              <el-button size="small" text type="primary">
                <el-icon><Upload /></el-icon> 上传 .txt 简历文件
              </el-button>
            </el-upload>
            <span v-if="fileName" class="file-name">{{ fileName }}</span>
          </div>

          <div class="search-options">
            <div class="option-row">
              <span class="option-label">返回数量</span>
              <el-slider v-model="searchLimit" :min="5" :max="50" :step="5" show-stops size="small" style="width: 140px" />
              <span class="option-value">{{ searchLimit }}</span>
            </div>
            <div class="option-row">
              <span class="option-label">相似度 ≥</span>
              <el-slider v-model="minSimilarity" :min="0.3" :max="0.9" :step="0.05" show-stops size="small" style="width: 140px" />
              <span class="option-value">{{ (minSimilarity * 100).toFixed(0) }}%</span>
            </div>
          </div>

          <el-button
            type="primary"
            :loading="matching"
            :disabled="!resumeText.trim() || resumeText.trim().length < 10"
            @click="doMatch"
            style="width: 100%; margin-top: 12px"
          >
            <el-icon><Search /></el-icon> 开始匹配职位
          </el-button>
        </div>

        <div class="tips-section">
          <div class="tips-title">
            <el-icon><InfoFilled /></el-icon> 匹配原理
          </div>
          <p>系统将简历文本转化为语义向量，在职位向量库中做余弦相似度计算，找出最匹配的职位。匹配质量取决于简历和职位描述的详细程度。</p>
        </div>
      </div>

      <!-- 右侧：匹配结果 -->
      <div class="result-panel">
        <div class="result-header">
          <h3>匹配结果</h3>
          <span v-if="matchResult" class="result-meta">
            共 {{ matchResult.count }} 条 · 耗时 {{ matchTime }}ms
          </span>
        </div>

        <div v-if="!matchResult && !matching" class="result-placeholder">
          <el-icon :size="48" color="#c0c4cc"><Document /></el-icon>
          <p>粘贴简历文本后点击"开始匹配职位"</p>
          <div class="placeholder-tips">
            <span class="tip-label">提示：</span>
            <ul>
              <li>简历内容越详细，匹配越精准</li>
              <li>支持 .txt 文件上传</li>
              <li>可调整相似度阈值过滤低分结果</li>
            </ul>
          </div>
        </div>

        <div v-if="matching" class="searching-hint">
          <el-icon class="is-loading" :size="24"><Loading /></el-icon>
          <span>正在匹配职位...</span>
        </div>

        <div v-if="matchResult && !matching" class="result-list">
          <div
            v-for="(item, idx) in matchResult.results"
            :key="item.job_id"
            class="result-card"
            :style="{ animationDelay: idx * 0.05 + 's' }"
          >
            <div class="card-header">
              <span class="card-title">{{ item.job_name || '未知职位' }}</span>
              <el-tag
                :type="item.similarity > 0.8 ? 'success' : item.similarity > 0.6 ? 'warning' : 'info'"
                size="small"
              >
                匹配度 {{ (item.similarity * 100).toFixed(0) }}%
              </el-tag>
            </div>
            <div class="card-company" v-if="item.company_name">
              <el-icon><OfficeBuilding /></el-icon> {{ item.company_name }}
            </div>
            <div class="card-tags">
              <el-tag v-if="item.job_category_l1" size="small" effect="plain">{{ item.job_category_l1 }}</el-tag>
              <el-tag v-if="item.job_category_l2" size="small" effect="plain">{{ item.job_category_l2 }}</el-tag>
              <el-tag v-if="item.company_industry" size="small" effect="plain" type="success">{{ item.company_industry }}</el-tag>
              <el-tag v-if="item.work_city" size="small" effect="plain" type="warning">{{ item.work_city }}</el-tag>
            </div>
            <div class="card-text" v-if="item.text_content">
              {{ truncateText(item.text_content, 200) }}
            </div>
          </div>

          <el-empty v-if="matchResult.results.length === 0" description="未找到匹配的职位，请尝试调整相似度阈值或提供更详细的简历描述" :image-size="80" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Loading, Upload, Document, InfoFilled, OfficeBuilding } from '@element-plus/icons-vue'
import type { UploadFile } from 'element-plus'
import { matchResume, type RAGSearchResult } from '@/api/llm'

const resumeText = ref('')
const fileName = ref('')
const matching = ref(false)
const matchResult = ref<{ resumeText: string; results: RAGSearchResult[]; count: number } | null>(null)
const matchTime = ref(0)
const searchLimit = ref(20)
const minSimilarity = ref(0.3)

function handleFileChange(file: UploadFile) {
  const reader = new FileReader()
  reader.onload = (e) => {
    resumeText.value = (e.target?.result as string) || ''
    fileName.value = file.name
    ElMessage.success(`已读取文件: ${file.name}`)
  }
  reader.onerror = () => {
    ElMessage.error('文件读取失败')
  }
  reader.readAsText(file.raw as Blob)
}

async function doMatch() {
  const text = resumeText.value.trim()
  if (!text || text.length < 10) {
    ElMessage.warning('简历文本内容太短，请至少输入10个字符')
    return
  }

  matching.value = true
  matchResult.value = null
  const start = Date.now()

  try {
    const res: any = await matchResume(text, {
      limit: searchLimit.value,
      minSimilarity: minSimilarity.value,
    })
    if (res.success) {
      matchResult.value = res.data
      matchTime.value = Date.now() - start
      if (res.data.count === 0) {
        ElMessage.info('未找到匹配的职位，请尝试降低相似度阈值或提供更详细的简历描述')
      }
    } else {
      ElMessage.error(res.error || '匹配失败')
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '匹配失败，请检查服务状态')
  } finally {
    matching.value = false
  }
}

function truncateText(text: string, maxLen: number): string {
  if (!text) return ''
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text
}
</script>

<style scoped>
.resume-page { height: calc(100vh - 64px); display: flex; flex-direction: column; }
.resume-layout { display: flex; height: 100%; gap: 0; }

.input-panel {
  width: 360px; min-width: 360px; border-right: 1px solid #e4e7ed;
  background: #fafafa; display: flex; flex-direction: column; overflow-y: auto;
}
.panel-header { padding: 16px 20px 8px; }
.panel-header h3 { margin: 0; font-size: 16px; }
.panel-subtitle { font-size: 12px; color: #909399; }

.input-box { padding: 12px 20px; }
.file-upload { margin-top: 8px; display: flex; align-items: center; gap: 8px; }
.file-name { font-size: 12px; color: #67c23a; }

.search-options { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.option-row { display: flex; align-items: center; gap: 8px; }
.option-label { font-size: 12px; color: #606266; white-space: nowrap; }
.option-value { font-size: 12px; color: #409eff; font-weight: bold; min-width: 30px; }

.tips-section {
  padding: 16px 20px; margin: 12px 20px;
  background: #f0f9eb; border-radius: 8px; border: 1px solid #e1f3d8;
}
.tips-title { font-size: 13px; font-weight: 500; color: #67c23a; display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
.tips-section p { margin: 0; font-size: 12px; color: #606266; line-height: 1.6; }

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
.placeholder-tips { font-size: 12px; color: #909399; }
.placeholder-tips ul { margin: 6px 0 0; padding-left: 18px; line-height: 1.8; }
.tip-label { font-weight: 500; }

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

.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
.card-title { font-size: 15px; font-weight: 600; color: #303133; }
.card-company { font-size: 13px; color: #606266; margin-bottom: 8px; display: flex; align-items: center; gap: 4px; }
.card-tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.card-text { font-size: 12px; color: #909399; line-height: 1.5; word-break: break-all; }
</style>
