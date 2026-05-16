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
            :multiple="true"
            :limit="10"
            accept=".docx,.doc,.pdf,.txt"
            :show-file-list="false"
            :on-change="handleFileChange"
            drag
          >
            <div class="upload-zone">
              <el-icon :size="32" color="#667eea"><UploadFilled /></el-icon>
              <div class="upload-text">
                <span>拖拽或<em>点击上传</em>简历文件</span>
                <span class="upload-hint">支持多文件批量上传，单次最多 10 个文件</span>
              </div>
            </div>
          </el-upload>
          <div v-if="fileName" class="uploaded-file">
            <el-icon color="#67c23a"><CircleCheck /></el-icon>
            <span>{{ fileCount > 1 ? `已选 ${fileCount} 个文件` : fileName }}</span>
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
          <div class="option-row mode-switch">
            <span class="option-label">处理模式</span>
            <el-radio-group v-model="screenMode" size="small" @change="clearFile">
              <el-radio-button value="screen">内部筛选</el-radio-button>
              <el-radio-button value="parse">结构解析</el-radio-button>
            </el-radio-group>
          </div>
          <div v-if="screenMode === 'parse'" class="parse-mode-hint">
            <el-icon><InfoFilled /></el-icon>
            <span>上传简历后，AI 将自动提取学历、技能、工作经验等结构化信息</span>
          </div>
          <div v-else-if="screenMode === 'screen'" class="screen-options">
            <div class="option-row">
              <span class="option-label">目标岗位</span>
              <el-select v-model="selectedJobId" placeholder="全部岗位" clearable style="width: 180px" @focus="loadInternalJobs">
                <el-option v-for="j in internalJobs" :key="j.id" :label="j.title" :value="j.id" />
              </el-select>
            </div>
            <div class="option-row">
              <span class="option-label">返回数量</span>
              <el-slider v-model="searchLimit" :min="5" :max="50" :step="5" show-stops size="small" style="width: 140px" />
              <span class="option-value">{{ searchLimit }}</span>
            </div>
            <el-button type="primary" :loading="screening" :disabled="parsedResumes.length === 0 && (!resumeText.trim() || resumeText.trim().length < 10)" @click="doScreen" style="width:100%; margin-top: 8px">
              <el-icon><Search /></el-icon> 开始智能筛选
            </el-button>
          </div>
        </div>

      </div>

      <!-- 右侧：匹配结果 -->
      <div class="result-panel">
        <div class="result-header">
          <h3>匹配结果</h3>
          <span v-if="screeningResult" class="result-meta">
            共 {{ screeningResult.totalJobsCompared }} 个岗位参与筛选
          </span>
        </div>

        <div v-if="parsedResumes.length === 0 && !screeningResult && !screening && !fileUploading" class="result-placeholder">
          <el-icon :size="48" color="#c0c4cc"><Document /></el-icon>
          <p>上传简历文件或粘贴文本后开始处理</p>
          <div class="placeholder-tips">
            <span class="tip-label">支持的文件格式：</span>
            <ul>
              <li>Word 文档 (.docx / .doc)</li>
              <li>PDF 文件 (.pdf)</li>
              <li>纯文本 (.txt)</li>
            </ul>
            <span class="tip-label" style="display:block; margin-top:8px;">两种处理模式：</span>
            <p style="margin:4px 0 0; font-size:12px; color:#909399;"><b>内部筛选：</b>LLM解析简历 → 硬规则过滤 + 语义打分 + 技能加分 → 综合推荐等级</p>
            <p style="margin:4px 0 0; font-size:12px; color:#909399;"><b>结构解析：</b>AI 自动提取学历、技能、工作经验等 20+ 结构化字段</p>
          </div>
        </div>

        <div v-if="fileUploading" class="searching-hint">
          <el-icon class="is-loading" :size="24"><Loading /></el-icon>
          <span>正在解析文件...</span>
        </div>

        <!-- 结构化解析结果 -->
        <div v-if="parsedResumes.length > 0 && !fileUploading && !(screenMode === 'screen' && screeningResult)" class="parsed-result">
          <el-alert type="success" :closable="false" show-icon style="margin-bottom: 12px">
            <template #title>
              解析完成 · {{ parsedResumes.length }} 份简历
            </template>
          </el-alert>

          <el-collapse v-model="expandResumeId" accordion>
            <el-collapse-item v-for="(pr, idx) in parsedResumes" :key="pr.id || idx" :name="String(pr.id || idx)">
              <template #title>
                <div style="display:flex; align-items:center; gap:12px; width:100%">
                  <span style="font-weight:600">{{ pr.name || '简历 ' + (idx + 1) }}</span>
                  <el-tag size="small" v-if="pr.educationLevel">{{ pr.educationLevel }}</el-tag>
                  <el-tag size="small" type="info" v-if="pr.workYears != null">{{ pr.workYears }}年经验</el-tag>
                  <span style="font-size:12px; color:#909399; margin-left:auto">置信度 {{ (pr.parseConfidence * 100).toFixed(0) }}%</span>
                </div>
              </template>

              <div class="parsed-section">
                <h4 class="section-title">基本信息</h4>
                <el-descriptions :column="2" size="small" border>
                  <el-descriptions-item label="姓名">{{ pr.name || '--' }}</el-descriptions-item>
                  <el-descriptions-item label="学历">{{ pr.educationLevel || '--' }}</el-descriptions-item>
                  <el-descriptions-item label="邮箱">{{ pr.email || '--' }}</el-descriptions-item>
                  <el-descriptions-item label="电话">{{ pr.phone || '--' }}</el-descriptions-item>
                  <el-descriptions-item label="毕业院校">{{ pr.school || '--' }}</el-descriptions-item>
                  <el-descriptions-item label="专业">{{ pr.major || '--' }}</el-descriptions-item>
                  <el-descriptions-item label="毕业年份">{{ pr.graduationYear || '--' }}</el-descriptions-item>
                  <el-descriptions-item label="工作年限">{{ pr.workYears != null ? pr.workYears + ' 年' : '--' }}</el-descriptions-item>
                </el-descriptions>
              </div>

              <div class="parsed-section" v-if="pr.desiredPosition || pr.desiredCity">
                <h4 class="section-title">求职意向</h4>
                <el-descriptions :column="3" size="small" border>
                  <el-descriptions-item label="期望岗位">{{ pr.desiredPosition || '--' }}</el-descriptions-item>
                  <el-descriptions-item label="期望城市">{{ pr.desiredCity || '--' }}</el-descriptions-item>
                  <el-descriptions-item label="工作类型">{{ pr.jobType || '--' }}</el-descriptions-item>
                </el-descriptions>
              </div>

              <div class="parsed-section" v-if="pr.skills.length">
                <h4 class="section-title">技能标签</h4>
                <div class="skill-tags">
                  <el-tag v-for="skill in pr.skills" :key="skill" size="small" effect="plain" style="margin:2px">{{ skill }}</el-tag>
                </div>
              </div>

              <div class="parsed-section" v-if="pr.projects?.length">
                <h4 class="section-title">项目经验</h4>
                <div v-for="(proj, pidx) in pr.projects" :key="pidx" style="margin-bottom:8px; padding:8px; background:#f5f7fa; border-radius:4px">
                  <div style="font-weight:600">{{ proj.name || '项目 ' + (pidx + 1) }}</div>
                  <div v-if="proj.role || proj.duration" style="font-size:12px; color:#606266; margin:4px 0">
                    <span v-if="proj.role">{{ proj.role }}</span>
                    <span v-if="proj.role && proj.duration"> · </span>
                    <span v-if="proj.duration">{{ proj.duration }}</span>
                  </div>
                  <div v-if="proj.description" style="font-size:12px; color:#909399">{{ proj.description }}</div>
                  <div v-if="proj.techStack?.length" style="margin-top:4px">
                    <el-tag v-for="t in proj.techStack" :key="t" size="small" style="margin:1px">{{ t }}</el-tag>
                  </div>
                </div>
              </div>

              <div class="parsed-section" v-if="pr.certifications?.length">
                <h4 class="section-title">证书</h4>
                <el-tag v-for="c in pr.certifications" :key="c" size="small" type="success" style="margin:2px">{{ c }}</el-tag>
              </div>

              <div class="parsed-section" v-if="pr.languages?.length">
                <h4 class="section-title">语言能力</h4>
                <el-tag v-for="(lang, lidx) in pr.languages" :key="lidx" size="small" type="info" style="margin:2px">{{ lang.name }}: {{ lang.level }}</el-tag>
              </div>

              <div class="parsed-section" v-if="pr.selfEvaluation">
                <h4 class="section-title">自我评价</h4>
                <p class="self-eval-text">{{ pr.selfEvaluation }}</p>
              </div>
            </el-collapse-item>
          </el-collapse>
        </div>

        <!-- 智能筛选结果 -->
        <div v-if="screeningResult && !screening" class="screening-result">
          <el-alert type="success" :closable="false" show-icon style="margin-bottom: 12px">
            <template #title>
              {{ screeningResult.resumeName }} · 比较 {{ screeningResult.totalJobsCompared }} 个岗位，返回 {{ screeningResult.results.length }} 条
            </template>
          </el-alert>
          <div style="display:flex; gap:8px; margin-bottom:16px">
            <el-button type="primary" size="small" :loading="savingHistory" @click="saveToHistory">
              <el-icon><FolderAdd /></el-icon> 保存到历史
            </el-button>
            <el-button size="small" @click="exportCurrentScreening">
              <el-icon><Download /></el-icon> 导出 Excel
            </el-button>
          </div>

          <div v-if="screeningResult.results.length === 0" style="text-align:center; padding: 40px; color: #909399;">
            没有符合筛选条件的岗位，请尝试放宽筛选标准
          </div>

          <template v-for="group in groupedScreeningResults" :key="`group_${group.resumeId}`">
            <div class="resume-group-header">
              <el-icon><User /></el-icon>
              <span>{{ group.resumeName }}</span>
              <span class="group-count">{{ group.results.length }} 条匹配</span>
            </div>

            <div v-for="item in group.results" :key="`${item._resumeId || 0}_${item.internalJobId || 0}`" class="screen-card" :class="{ 'hard-failed': !item.hardRules.passed }">
              <div class="screen-card-header">
                <div>
                  <span class="screen-job-title">{{ item.internalJobTitle }}</span>
                  <span v-if="item.department" class="screen-dept">{{ item.department }}</span>
                </div>
              <div style="display:flex; align-items:center; gap: 8px;">
                <el-tag
                  :type="item.recommendation === 'strong' ? 'success' : item.recommendation === 'moderate' ? 'warning' : item.recommendation === 'weak' ? 'info' : 'danger'"
                  size="small"
                >
                  {{ item.recommendation === 'strong' ? '强烈推荐' : item.recommendation === 'moderate' ? '一般推荐' : item.recommendation === 'weak' ? '勉强匹配' : '不推荐' }}
                </el-tag>
                <span class="total-score" :class="item.recommendation">{{ item.totalScore.toFixed(1) }}</span>
              </div>
            </div>

            <!-- 评分明细 -->
            <el-collapse style="margin-top: 8px;">
              <el-collapse-item title="评分明细" name="1">
                <div class="score-detail">
                  <div class="detail-row">
                    <span>硬性规则（{{ item.hardRules.passed ? '通过' : '淘汰' }}）</span>
                    <span class="score-num">{{ item.scoreBreakdown.hardRuleScore }}</span>
                  </div>
                  <div class="check-item" v-if="item.hardRules.education.required">
                    <el-icon :color="item.hardRules.education.passed ? '#67c23a' : '#f56c6c'">
                      <CircleCheck v-if="item.hardRules.education.passed" /><CircleClose v-else />
                    </el-icon>
                    学历: 要求{{ item.hardRules.education.required }}，候选人{{ item.hardRules.education.actual || '未知' }}
                  </div>
                  <div class="check-item" v-if="item.hardRules.experience.requiredMin > 0">
                    <el-icon :color="item.hardRules.experience.passed ? '#67c23a' : '#f56c6c'">
                      <CircleCheck v-if="item.hardRules.experience.passed" /><CircleClose v-else />
                    </el-icon>
                    工作年限: 要求≥{{ item.hardRules.experience.requiredMin }}年，候选人{{ item.hardRules.experience.actual }}年
                  </div>
                  <div class="check-item" v-if="item.hardRules.requiredSkills.required.length > 0">
                    <el-icon :color="item.hardRules.requiredSkills.passed ? '#67c23a' : '#f56c6c'">
                      <CircleCheck v-if="item.hardRules.requiredSkills.passed" /><CircleClose v-else />
                    </el-icon>
                    必备技能({{ item.hardRules.requiredSkills.mode === 'all' ? '全部' : '任一' }}):
                    <el-tag v-for="s in item.hardRules.requiredSkills.matched" :key="s" size="small" type="success" style="margin:1px">{{ s }}</el-tag>
                    <el-tag v-for="s in item.hardRules.requiredSkills.missing" :key="s" size="small" type="danger" style="margin:1px">{{ s }}</el-tag>
                  </div>
                  <div class="detail-row">
                    <span>语义相似度</span>
                    <span class="score-num">{{ item.scoreBreakdown.similarityScore.toFixed(1) }} ({{ item.softMatch.similarity.toFixed(0) }}%)</span>
                  </div>
                  <div class="detail-row">
                    <span>技能加分
                      <el-tag v-for="s in item.softMatch.matchedSkills" :key="s" size="small" type="primary" style="margin:1px">{{ s }}</el-tag>
                    </span>
                    <span class="score-num">{{ item.scoreBreakdown.skillBonus }}</span>
                  </div>
                  <div class="detail-row total-row">
                    <span>综合得分</span>
                    <span class="score-num total">{{ item.totalScore.toFixed(1) }}</span>
                  </div>
                </div>
              </el-collapse-item>
            </el-collapse>
          </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Search, Loading, UploadFilled, Document, OfficeBuilding, CircleCheck, CircleClose, InfoFilled, FolderAdd, Download, User } from '@element-plus/icons-vue'
import type { UploadFile, UploadInstance } from 'element-plus'
import { parseResume, screenResume, saveScreeningResult, exportScreeningExcel, type ParsedResume, type ScreeningResponse } from '@/api/llm'
import { listInternalJobs, type InternalJob } from '@/api/internalJob'

const uploadRef = ref<UploadInstance>()
const resumeText = ref('')
const fileName = ref('')
const fileCount = ref(0)
const fileUploadingCount = ref(0)
const fileUploading = computed(() => fileUploadingCount.value > 0)
const processingUids = new Set<number>()
const savingHistory = ref(false)
const searchLimit = ref(20)
const screenMode = ref<'parse' | 'screen'>('screen')
const parsedResumes = ref<ParsedResume[]>([])
const parsedResume = computed(() => parsedResumes.value[0] || null)
const expandResumeId = ref('')
const parsing = ref(false)

// 内部筛选模式
const internalJobs = ref<InternalJob[]>([])
const selectedJobId = ref<number | null>(null)
const screening = ref(false)
const screeningResult = ref<ScreeningResponse | null>(null)
// 多简历结果按 _resumeId 分组
const groupedScreeningResults = computed(() => {
  if (!screeningResult.value) return []
  const groups: { resumeId: number; resumeName: string; results: any[] }[] = []
  const seen = new Map<number, any[]>()
  for (const r of screeningResult.value.results) {
    const key = r._resumeId || 0
    if (!seen.has(key)) {
      seen.set(key, [])
      groups.push({ resumeId: key, resumeName: r._resumeName || `简历 #${key}`, results: seen.get(key)! })
    }
    seen.get(key)!.push(r)
  }
  return groups
})

async function loadInternalJobs() {
  try {
    const res: any = await listInternalJobs({ status: 'open', pageSize: 100 })
    if (res.success) internalJobs.value = res.data.list
  } catch { /* ignore */ }
}

async function doScreen() {
  const text = resumeText.value.trim()
  const hasParsedResumes = parsedResumes.value.length > 0
  if (!hasParsedResumes && (!text || text.length < 10)) {
    ElMessage.warning('请先上传简历文件进行解析，或粘贴简历文本')
    return
  }

  screening.value = true
  screeningResult.value = null

  try {
    if (hasParsedResumes) {
      // 逐份筛选，合并结果
      let totalCompared = 0
      const allResults: any[] = []
      let failCount = 0

      for (const pr of parsedResumes.value) {
        if (!pr.id) continue
        try {
          const res: any = await screenResume({
            resumeId: pr.id,
            internalJobId: selectedJobId.value || undefined,
            limit: searchLimit.value,
          })
          if (res.success) {
            totalCompared += res.data.totalJobsCompared
            for (const r of res.data.results) {
              r._resumeName = pr.name || `简历 #${pr.id}`
              r._resumeId = pr.id
            }
            allResults.push(...res.data.results)
          }
        } catch (_e: any) {
          failCount++
          console.error('[doScreen] 单份简历筛选失败:', _e?.message || _e)
        }
      }

      // 按总分降序重排
      allResults.sort((a, b) => {
        if (a.hardRules?.passed !== b.hardRules?.passed) return a.hardRules?.passed ? -1 : 1
        return b.totalScore - a.totalScore
      })

      screeningResult.value = {
        resumeId: 0,
        resumeName: `${parsedResumes.value.length} 份简历`,
        totalJobsCompared: totalCompared,
        results: allResults.slice(0, searchLimit.value),
      } as any

      const hint = failCount > 0 ? `（${failCount} 份筛选失败）` : ''
      ElMessage.success(`筛选完成：${parsedResumes.value.length} 份简历 × ${totalCompared} 个岗位，返回 ${allResults.length} 条${hint}`)
    } else {
      const res: any = await screenResume({
        resumeText: text,
        internalJobId: selectedJobId.value || undefined,
        limit: searchLimit.value,
      })
      if (res.success) {
        screeningResult.value = res.data
        ElMessage.success(`筛选完成，${res.data.totalJobsCompared} 个岗位中返回 ${res.data.results.length} 条结果`)
      } else {
        ElMessage.error(res.error || '筛选失败')
      }
    }
  } catch (_e: any) {
    // 错误提示已由全局拦截器处理
  } finally {
    screening.value = false
  }
}

async function handleFileChange(file: UploadFile) {
  if (!file || !file.raw) {
    console.error('[ResumeScreening] handleFileChange: file 或 file.raw 为空', file)
    ElMessage.error('文件读取失败，请重试或刷新页面')
    return
  }

  // 防止 Element Plus drag 模式重复触发 on-change
  if (processingUids.has(file.uid)) return
  processingUids.add(file.uid)

  const raw = file.raw

  if (raw.size > 10 * 1024 * 1024) {
    ElMessage.error('文件大小不能超过 10MB')
    return
  }

  const files = uploadRef.value?.uploadFiles || []
  fileCount.value = files.length
  fileName.value = files.map(f => f.name).join(', ')

  if (files.length === 1) {
    parsedResumes.value = []
  }
  screeningResult.value = null
  fileUploadingCount.value++

  try {
    const res: any = await parseResume(raw)
    if (res.success) {
      // 防止同一简历重复加入（同 ID）
      if (res.data?.id && parsedResumes.value.some(pr => pr.id === res.data.id)) {
        ElMessage.info(`${raw.name} 已存在，跳过重复添加 (${parsedResumes.value.length}/${files.length})`)
      } else {
        parsedResumes.value.push(res.data)
        resumeText.value = ''
        if (res.data?.duplicate) {
          ElMessage.info(`${raw.name} 已解析过，返回已有记录 (${parsedResumes.value.length}/${files.length})`)
        } else {
          ElMessage.success(`简历解析成功 (${parsedResumes.value.length}/${files.length})`)
        }
      }
    } else {
      ElMessage.error(res.error || `${raw.name} 解析失败`)
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.error || `${raw.name} 解析失败`)
  } finally {
    fileUploadingCount.value--
  }
}

function clearFile() {
  fileName.value = ''
  fileCount.value = 0
  parsedResumes.value = []
  screeningResult.value = null
  processingUids.clear()
  uploadRef.value?.clearFiles()
}

async function saveToHistory() {
  if (!screeningResult.value) return
  savingHistory.value = true
  try {
    // 每条结果携带自己的 resumeId（从 _resumeId 获取）
    const resultsWithResumeId = screeningResult.value.results.map((item: any) => ({
      ...item,
      resumeId: item._resumeId || parsedResumes.value[0]?.id || null,
    }))
    const res: any = await saveScreeningResult({
      resumeId: parsedResumes.value[0]?.id || 0,
      results: resultsWithResumeId,
    })
    if (res.success) {
      ElMessage.success(`已保存 ${res.data.saved} 条筛选结果到历史`)
    } else {
      ElMessage.error(res.error || '保存失败')
    }
  } catch {
    ElMessage.error('保存失败')
  } finally {
    savingHistory.value = false
  }
}

async function exportCurrentScreening() {
  try {
    // 先保存到历史（确保 DB 有数据供导出）
    if (screeningResult.value && screeningResult.value.results.length > 0) {
      savingHistory.value = true
      try {
        const resultsWithResumeId = screeningResult.value.results.map((item: any) => ({
          ...item,
          resumeId: item._resumeId || parsedResumes.value[0]?.id || null,
        }))
        await saveScreeningResult({
          resumeId: parsedResumes.value[0]?.id || 0,
          results: resultsWithResumeId,
        })
      } catch { /* 保存失败不影响导出 */ }
      savingHistory.value = false
    }

    // 多简历筛选时传多个 resumeId，单简历传单一 ID
    const resumeIds = [...new Set(
      screeningResult.value?.results
        .map((r: any) => r._resumeId)
        .filter(Boolean) || []
    )] as number[]
    const exportParams: any = {}
    if (resumeIds.length === 1) {
      exportParams.resumeId = resumeIds[0]
    } else if (resumeIds.length > 1) {
      exportParams.resumeIds = resumeIds.join(',')
    }

    const blob = await exportScreeningExcel(exportParams)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `筛选结果_${new Date().toISOString().slice(0, 10)}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } catch {
    ElMessage.error('导出失败')
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

.mode-switch { margin-bottom: 4px; }
.parse-mode-hint {
  display: flex; align-items: center; gap: 6px;
  font-size: 12px; color: #909399; padding: 8px 0;
}

.parsed-result { flex: 1; overflow-y: auto; padding: 20px 24px; }
.parsed-section { margin-bottom: 16px; }
.parsed-section .section-title {
  font-size: 14px; font-weight: 600; color: #303133;
  margin: 0 0 8px; padding-bottom: 6px; border-bottom: 1px solid #ebeef5;
}
.skill-tags { display: flex; flex-wrap: wrap; gap: 4px; }
.self-eval-text {
  font-size: 13px; color: #606266; line-height: 1.6;
  background: #f5f7fa; padding: 12px; border-radius: 6px;
  white-space: pre-wrap;
}

.screen-options { display: flex; flex-direction: column; gap: 4px; }

.screening-result { flex: 1; overflow-y: auto; padding: 20px 24px; }
.resume-group-header {
  display: flex; align-items: center; gap: 8px;
  padding: 10px 16px; margin: 16px 0 8px;
  background: #ecf5ff; border-left: 3px solid #409eff;
  border-radius: 4px; font-size: 14px; font-weight: 600; color: #303133;
}
.resume-group-header:first-child { margin-top: 0; }
.group-count { font-size: 12px; font-weight: 400; color: #909399; margin-left: auto; }
.screen-card {
  border: 1px solid #e4e7ed; border-radius: 8px;
  padding: 16px; margin-bottom: 12px;
  transition: box-shadow 0.2s;
}
.screen-card:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
.screen-card.hard-failed { border-color: #fde2e2; border-left: 3px solid #f56c6c; }
.screen-card-header {
  display: flex; justify-content: space-between; align-items: center;
}
.screen-job-title { font-size: 15px; font-weight: 600; color: #303133; }
.screen-dept { font-size: 12px; color: #909399; margin-left: 8px; }
.total-score {
  font-size: 24px; font-weight: 700;
  &.strong { color: #67c23a; }
  &.moderate { color: #e6a23c; }
  &.weak { color: #909399; }
  &.rejected { color: #f56c6c; }
}
.score-detail { font-size: 13px; }
.detail-row {
  display: flex; justify-content: space-between; align-items: center;
  padding: 4px 0; border-bottom: 1px solid #f0f0f0;
}
.detail-row.total-row { font-weight: 600; border-bottom: none; color: #303133; }
.score-num { font-weight: 600; color: #606266; }
.score-num.total { color: #409eff; font-size: 16px; }
.check-item {
  display: flex; align-items: center; gap: 4px;
  padding: 2px 0 2px 16px; font-size: 12px; color: #606266;
}
</style>
