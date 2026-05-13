<template>
  <div class="resume-page">
    <div class="resume-layout">
      <!-- 左侧：简历输入面板 -->
      <div class="input-panel">
        <div class="panel-header">
          <h3>简历筛选</h3>
          <span class="panel-subtitle">上传简历文件或粘贴文本，匹配职位</span>
        </div>

        <!-- 文件上传区 -->
        <div class="upload-section">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            accept=".docx,.doc,.pdf,.txt"
            :show-file-list="false"
            :on-change="handleFileChange"
            drag
          >
            <div class="upload-zone">
              <el-icon :size="32" color="#667eea"><UploadFilled /></el-icon>
              <div class="upload-text">
                <span>拖拽或<em>点击上传</em>简历文件</span>
                <span class="upload-hint">支持 Word (.docx/.doc)、PDF、TXT，最大 10MB</span>
              </div>
            </div>
          </el-upload>
          <div v-if="fileName" class="uploaded-file">
            <el-icon color="#67c23a"><CircleCheck /></el-icon>
            <span>{{ fileName }}</span>
            <el-button link type="danger" size="small" @click="clearFile">清除</el-button>
          </div>
        </div>

        <div class="divider-text">
          <span>或手动粘贴简历文本</span>
        </div>

        <div class="input-box">
          <el-input
            v-model="resumeText"
            type="textarea"
            :rows="12"
            placeholder="在此粘贴候选人简历文本...&#10;&#10;例如：&#10;张三，5年Java开发经验，熟练掌握Spring Boot、MySQL、Redis，曾负责电商系统后端架构设计，本科毕业于XX大学计算机系..."
          />
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

      <!-- 右侧：匹配结果 -->
      <div class="result-panel">
        <div class="result-header">
          <h3>匹配结果</h3>
          <span v-if="matchResult" class="result-meta">
            共 {{ matchResult.count }} 条 · 耗时 {{ matchTime }}ms
            <template v-if="matchResult.fullTextLength">
              · 解析 {{ matchResult.fullTextLength }} 字符
            </template>
          </span>
        </div>

        <div v-if="!matchResult && !matching && !fileUploading" class="result-placeholder">
          <el-icon :size="48" color="#c0c4cc"><Document /></el-icon>
          <p>上传简历文件或粘贴文本后开始匹配</p>
          <div class="placeholder-tips">
            <span class="tip-label">支持的文件格式：</span>
            <ul>
              <li>Word 文档 (.docx / .doc)</li>
              <li>PDF 文件 (.pdf)</li>
              <li>纯文本 (.txt)</li>
            </ul>
            <span class="tip-label" style="display:block; margin-top:8px;">匹配原理：</span>
            <p style="margin:4px 0 0; font-size:12px; color:#909399;">简历文本 → 语义向量 → 与职位向量库余弦相似度匹配。简历内容越详细，匹配越精准。</p>
          </div>
        </div>

        <div v-if="matching || fileUploading" class="searching-hint">
          <el-icon class="is-loading" :size="24"><Loading /></el-icon>
          <span>{{ fileUploading ? '正在解析文件并匹配职位...' : '正在匹配职位...' }}</span>
        </div>

        <div v-if="matchResult && !matching && !fileUploading" class="result-list">
          <!-- 文件解析文本预览 -->
          <el-alert
            v-if="matchResult.fileName"
            type="success"
            :closable="false"
            show-icon
            style="margin-bottom: 16px"
          >
            <template #title>
              已解析: {{ matchResult.fileName }} ({{ matchResult.fullTextLength }} 字符)
            </template>
          </el-alert>

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
import { Search, Loading, UploadFilled, Document, OfficeBuilding, CircleCheck } from '@element-plus/icons-vue'
import type { UploadFile, UploadInstance } from 'element-plus'
import { matchResume, uploadResume, type RAGSearchResult } from '@/api/llm'

const uploadRef = ref<UploadInstance>()
const resumeText = ref('')
const fileName = ref('')
const matching = ref(false)
const fileUploading = ref(false)
const matchResult = ref<{
  fileName?: string; resumeText: string; fullTextLength?: number;
  results: RAGSearchResult[]; count: number
} | null>(null)
const matchTime = ref(0)
const searchLimit = ref(20)
const minSimilarity = ref(0.3)

async function handleFileChange(file: UploadFile) {
  const raw = file.raw
  if (!raw) return

  // 检查文件大小
  if (raw.size > 10 * 1024 * 1024) {
    ElMessage.error('文件大小不能超过 10MB')
    return
  }

  fileName.value = raw.name
  matchResult.value = null
  fileUploading.value = true
  const start = Date.now()

  try {
    const res: any = await uploadResume(raw, {
      limit: searchLimit.value,
      minSimilarity: minSimilarity.value,
    })
    if (res.success) {
      matchResult.value = res.data
      matchTime.value = Date.now() - start
      resumeText.value = '' // 清除手动输入
      if (res.data.count === 0) {
        ElMessage.info('未找到匹配的职位，请尝试降低相似度阈值')
      } else {
        ElMessage.success(`匹配完成，找到 ${res.data.count} 个职位`)
      }
    } else {
      ElMessage.error(res.error || '匹配失败')
      fileName.value = ''
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || '文件上传或解析失败')
    fileName.value = ''
  } finally {
    fileUploading.value = false
  }
}

function clearFile() {
  fileName.value = ''
  matchResult.value = null
  uploadRef.value?.clearFiles()
}

async function doMatch() {
  const text = resumeText.value.trim()
  if (!text || text.length < 10) {
    ElMessage.warning('简历文本内容太短，请至少输入10个字符')
    return
  }

  fileName.value = ''
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
  width: 380px; min-width: 380px; border-right: 1px solid #e4e7ed;
  background: #fafafa; display: flex; flex-direction: column; overflow-y: auto;
}
.panel-header { padding: 16px 20px 8px; }
.panel-header h3 { margin: 0; font-size: 16px; }
.panel-subtitle { font-size: 12px; color: #909399; }

.upload-section { padding: 12px 20px 0; }
.upload-zone {
  display: flex; flex-direction: column; align-items: center;
  padding: 20px 12px; gap: 10px;
}
.upload-text {
  display: flex; flex-direction: column; align-items: center;
  font-size: 13px; color: #606266; gap: 4px;
}
.upload-text em { color: #667eea; font-style: normal; cursor: pointer; }
.upload-hint { font-size: 11px; color: #c0c4cc; }
.uploaded-file {
  display: flex; align-items: center; gap: 6px; font-size: 13px;
  padding: 8px 12px; margin-top: 8px;
  background: #f0f9eb; border-radius: 6px; color: #67c23a;
}

.divider-text {
  display: flex; align-items: center; padding: 16px 20px 4px;
  font-size: 12px; color: #c0c4cc;
}
.divider-text::before, .divider-text::after {
  content: ''; flex: 1; height: 1px; background: #e4e7ed;
}
.divider-text span { padding: 0 12px; }

.input-box { padding: 8px 20px 0; }

.search-options { padding: 12px 20px 0; display: flex; flex-direction: column; gap: 8px; }
.option-row { display: flex; align-items: center; gap: 8px; }
.option-label { font-size: 12px; color: #606266; white-space: nowrap; }
.option-value { font-size: 12px; color: #409eff; font-weight: bold; min-width: 30px; }

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
.placeholder-tips ul { margin: 6px 0 0; padding-left: 18px; line-height: 1.8; font-size: 13px; }
.tip-label { font-weight: 500; font-size: 13px; }

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
