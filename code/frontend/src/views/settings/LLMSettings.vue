<template>
  <div class="llm-settings">
    <div class="page-header">
      <h2>
        <span class="page-header-icon">
          <el-icon :size="18"><Setting /></el-icon>
        </span>
        模型配置
      </h2>
      <p class="subtitle">配置大模型提供商，为数据增强、智能分析、自然语言查询等功能提供 AI 能力</p>
    </div>

    <div class="main-content">
      <!-- 左侧：快捷卡片区 -->
      <div class="cards-panel">
        <div class="search-box">
          <el-input
            v-model="searchQuery"
            placeholder="搜索模型..."
            clearable
            :prefix-icon="Search"
            size="small"
          />
        </div>
        <div class="card-section">
          <h3 class="section-title">本地模型</h3>
          <div class="provider-cards">
            <div
              v-for="card in localCards"
              :key="card.provider"
              class="provider-card"
              :class="{ 'is-configured': card.configured }"
              @click="card.configured ? editConfig(card.config!) : quickAdd(card.provider)"
            >
              <div class="card-icon">
                <el-avatar :size="36" :style="{ background: card.color }">
                  <span class="avatar-text">{{ (card.sublabel || card.label)[0] }}</span>
                </el-avatar>
              </div>
              <div class="card-body">
                <div class="card-title">{{ card.label }}</div>
                <template v-if="card.configured">
                  <div class="card-model">{{ card.sublabel }}</div>
                </template>
                <div v-else class="card-hint">点击配置</div>
              </div>
              <div class="card-action">
                <el-button
                  :type="card.configured ? 'primary' : 'success'"
                  size="small"
                  :plain="!card.configured"
                  circle
                  class="card-action-btn"
                >
                  <el-icon :size="14">
                    <Check v-if="card.configured" />
                    <Plus v-else />
                  </el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>

        <div class="card-section">
          <h3 class="section-title">远程模型</h3>
          <div class="provider-cards">
            <div
              v-for="card in remoteCards"
              :key="card.provider"
              class="provider-card"
              :class="{ 'is-configured': card.configured }"
              @click="card.configured ? editConfig(card.config!) : quickAdd(card.provider)"
            >
              <div class="card-icon">
                <el-avatar :size="36" :style="{ background: card.color }">
                  <span class="avatar-text">{{ (card.sublabel || card.label)[0] }}</span>
                </el-avatar>
              </div>
              <div class="card-body">
                <div class="card-title">{{ card.label }}</div>
                <template v-if="card.configured">
                  <div class="card-model">{{ card.sublabel }}</div>
                </template>
                <div v-else class="card-hint">点击配置</div>
              </div>
              <div class="card-action">
                <el-button
                  :type="card.configured ? 'primary' : 'success'"
                  size="small"
                  :plain="!card.configured"
                  circle
                  class="card-action-btn"
                >
                  <el-icon :size="14">
                    <Check v-if="card.configured" />
                    <Plus v-else />
                  </el-icon>
                </el-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：表格区 -->
      <div class="table-panel">
        <div class="action-bar">
          <el-button type="primary" @click="showAddDialog">
            <el-icon><Plus /></el-icon>
            添加模型
          </el-button>
        </div>

        <el-table :data="configs" stripe v-loading="loading" class="config-table">
          <el-table-column prop="provider" label="提供商" width="120">
            <template #default="{ row }">
              <el-tag :type="providerTagType(row.provider)" effect="dark" size="small">
                {{ providerLabel(row.provider) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="modelName" label="模型名称" min-width="200" show-overflow-tooltip />
          <el-table-column prop="baseUrl" label="API 端点" min-width="240" show-overflow-tooltip>
            <template #default="{ row }">
              <span v-if="row.baseUrl" class="endpoint-text">{{ row.baseUrl }}</span>
              <span v-else class="default-text">{{ getDefaultUrl(row.provider) }}</span>
            </template>
          </el-table-column>
          <el-table-column label="分配任务" min-width="180">
            <template #default="{ row }">
              <div class="task-tags">
                <el-tag
                  v-for="task in row.taskRouting"
                  :key="task"
                  size="small"
                  :type="taskTagType(task)"
                  class="task-tag"
                >
                  {{ taskLabel(task) }}
                </el-tag>
                <span v-if="!row.taskRouting?.length" class="text-muted">未分配</span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="70" align="center">
            <template #default="{ row }">
              <el-switch v-model="row.isActive" size="small" @change="handleStatusChange(row)" />
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <div class="action-buttons">
                <el-button link type="primary" size="small" @click="testConnection(row)">
                  <el-icon class="action-icon"><Link /></el-icon>测试
                </el-button>
                <el-button link type="primary" size="small" @click="editConfig(row)">
                  <el-icon class="action-icon"><Edit /></el-icon>编辑
                </el-button>
                <el-button link type="danger" size="small" @click="handleDelete(row)">
                  <el-icon class="action-icon"><Delete /></el-icon>删除
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑模型配置' : '添加模型配置'"
      width="680px"
      destroy-on-close
      class="form-dialog"
    >
      <template #header>
        <div class="dialog-header">
          <span class="dialog-header-icon">
            <el-icon :size="18"><Cpu /></el-icon>
          </span>
          <span>{{ editingId ? '编辑模型配置' : '添加模型配置' }}</span>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="100px"
        label-position="left"
        class="edit-form"
      >
        <!-- 提供商信息 -->
        <div class="form-section">
          <div class="form-section-title">
            <span class="section-icon"><el-icon><InfoFilled /></el-icon></span>
            <span>提供商信息</span>
          </div>

          <el-form-item label="提供商" prop="provider">
            <el-select
              v-model="form.provider"
              placeholder="选择提供商"
              style="width: 100%"
              @change="onProviderChange"
            >
              <el-option-group label="云端模型">
                <el-option
                  v-for="opt in remoteProviderOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-option-group>
              <el-option-group label="本地模型">
                <el-option
                  v-for="opt in localProviderOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-option-group>
            </el-select>
          </el-form-item>

          <el-form-item label="模型名称" prop="modelName">
            <el-select
              v-model="form.modelName"
              filterable
              allow-create
              default-first-option
              :placeholder="loadingModels ? '正在加载模型列表...' : '选择或输入模型名称'"
              :loading="loadingModels"
              style="width: 100%"
            >
              <el-option
                v-for="m in availableModels"
                :key="m"
                :label="m"
                :value="m"
              />
            </el-select>
            <div class="field-hint">
              <template v-if="form.provider === 'ollama'">
                <span v-if="loadingModels">正在从 Ollama 获取部署模型列表...</span>
                <span v-else-if="availableModels.length > 0">已从 Ollama 获取 {{ availableModels.length }} 个本地模型</span>
                <span v-else style="color: #e6a23c">无法连接 Ollama 服务，请确认服务已启动。也可手动输入模型名</span>
              </template>
              <span v-else>可从预设列表选择，也可手动输入自定义模型名</span>
            </div>
          </el-form-item>

          <el-form-item v-if="form.provider !== 'ollama'" label="API Key" prop="apiKeyEncrypted">
            <el-input
              v-model="form.apiKeyEncrypted"
              type="password"
              show-password
              placeholder="输入 API Key"
              :prefix-icon="Key"
            />
            <div class="field-hint">
              {{ editingId && !form.apiKeyEncrypted ? '留空则保持原 API Key 不变' : 'API Key 将加密存储，不会在页面明文展示' }}
            </div>
          </el-form-item>

          <el-form-item label="API 端点" prop="baseUrl">
            <el-input
              v-model="form.baseUrl"
              :placeholder="getDefaultUrl(form.provider)"
              :prefix-icon="Link"
            />
            <div class="field-hint">默认端点已自动填入，可手动修改为代理或镜像地址</div>
          </el-form-item>
        </div>

        <el-divider margin="20px 0" />

        <!-- 任务分配 -->
        <div class="form-section">
          <div class="form-section-title">
            <span class="section-icon"><el-icon><Switch /></el-icon></span>
            <span>任务分配</span>
            <span class="section-badge">{{ form.taskRouting.length }} 项已选</span>
          </div>

          <el-checkbox-group v-model="form.taskRouting" class="task-checkbox-group">
            <el-checkbox
              v-for="task in taskOptions"
              :key="task.value"
              :label="task.value"
              :value="task.value"
              class="task-checkbox-card"
            >
              <span class="task-checkcard-inner">
                <span class="task-checkcard-icon" :style="{ background: task.bg, color: task.color }">
                  <el-icon :size="15"><component :is="task.icon" /></el-icon>
                </span>
                <span class="task-checkcard-label">{{ task.label }}</span>
                <span class="task-checkcard-desc">{{ task.desc }}</span>
              </span>
            </el-checkbox>
          </el-checkbox-group>

          <div class="task-hint">
            <el-icon :size="14"><InfoFilled /></el-icon>
            <span>本地模型推荐用于数据增强、反爬检测和文本向量化；云端模型推荐用于智能洞察和自然语言查询</span>
          </div>
        </div>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false" :disabled="saving" size="default">取消</el-button>
          <el-button type="primary" size="default" @click="handleSave" :loading="saving">
            <el-icon v-if="!saving"><Check /></el-icon>
            <span>{{ saving ? '保存中...' : (editingId ? '保存修改' : '添加配置') }}</span>
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 测试结果对话框 -->
    <el-dialog
      v-model="testDialogVisible"
      title="连接测试"
      width="480px"
      class="form-dialog"
    >
      <template #header>
        <div class="dialog-header">
          <span class="dialog-header-icon" :style="{ background: testing ? 'rgba(230,162,60,0.12)' : (testResult?.ok ? 'rgba(19,206,102,0.12)' : 'rgba(245,108,108,0.12)') }">
            <el-icon :size="18">
              <Loading v-if="testing" class="is-loading" />
              <CircleCheckFilled v-else-if="testResult?.ok" color="#13ce66" />
              <CircleCloseFilled v-else color="#f56c6c" />
            </el-icon>
          </span>
          <span>连接测试</span>
        </div>
      </template>

      <div v-if="testing" class="test-loading">
        <el-icon class="is-loading" :size="40" color="#667eea"><Loading /></el-icon>
        <p>正在测试连接...</p>
        <span class="test-loading-hint">请稍候，这可能需要几秒钟</span>
      </div>
      <div v-else-if="testResult">
        <div class="test-result-card" :class="testResult.ok ? 'is-success' : 'is-error'">
          <div class="test-result-status">
            <el-icon :size="24" :color="testResult.ok ? '#13ce66' : '#f56c6c'">
              <CircleCheckFilled v-if="testResult.ok" />
              <CircleCloseFilled v-else />
            </el-icon>
            <span class="test-result-title">{{ testResult.ok ? '连接成功' : '连接失败' }}</span>
          </div>
          <div class="test-result-details">
            <div class="test-detail-item">
              <span class="test-detail-label">延迟</span>
              <span class="test-detail-value" :class="{ 'is-good': testResult.latency < 500, 'is-slow': testResult.latency >= 500 }">
                {{ testResult.latency }}ms
              </span>
            </div>
            <div v-if="testResult.error" class="test-detail-item">
              <span class="test-detail-label">错误信息</span>
              <span class="test-detail-value error-text">{{ testResult.error }}</span>
            </div>
          </div>
        </div>
        <div v-if="testResult.models.length > 0" class="test-models">
          <div class="test-models-title">可用模型</div>
          <div class="test-models-list">
            <el-tag v-for="m in testResult.models" :key="m" size="small" class="test-model-tag">
              {{ m }}
            </el-tag>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  Plus, Loading, Link, Edit, Delete, Search, Setting, Cpu,
  InfoFilled, Key, Switch, Check, CircleCheckFilled, CircleCloseFilled,
  DataAnalysis, TrendCharts, ChatDotRound, Monitor, Grid,
} from '@element-plus/icons-vue'
import {
  listLLMConfigs, saveLLMConfig, deleteLLMConfig, checkLLMHealth, fetchProviderModels,
  type LLMConfig, type HealthCheckResult
} from '@/api/llm'

const configs = ref<LLMConfig[]>([])
const loading = ref(false)
const saving = ref(false)
const dialogVisible = ref(false)
const editingId = ref<number | null>(null)
const testDialogVisible = ref(false)
const testing = ref(false)
const testResult = ref<HealthCheckResult | null>(null)
const searchQuery = ref('')
const loadingModels = ref(false)
const providerModels = ref<string[]>([])
const formRef = ref<FormInstance>()

const defaultForm: LLMConfig = {
  provider: 'openai',
  modelName: '',
  apiKeyEncrypted: '',
  baseUrl: '',
  isActive: true,
  taskRouting: [],
}

const form = ref<LLMConfig>({ ...defaultForm })

const rules: FormRules = {
  provider: [
    { required: true, message: '请选择提供商', trigger: 'change' },
  ],
  modelName: [
    { required: true, message: '请选择或输入模型名称', trigger: 'change' },
  ],
}

// 提供商选项分组
const remoteProviderOptions = [
  { label: 'DeepSeek', value: 'deepseek' },
  { label: 'OpenAI (GPT-4o 等)', value: 'openai' },
  { label: 'Anthropic (Claude)', value: 'anthropic' },
  { label: '智谱 AI (GLM)', value: 'zhipu' },
  { label: '通义千问 (Qwen)', value: 'qwen' },
  { label: '文心一言 (ERNIE)', value: 'baidu' },
  { label: '豆包 (Doubao)', value: 'bytedance' },
  { label: '月之暗面 (Moonshot)', value: 'moonshot' },
]

const localProviderOptions = [
  { label: 'Ollama (本地模型)', value: 'ollama' },
]

// 任务选项
const taskOptions = [
  { value: 'enrichment', label: '数据增强', desc: '标准化薪资、提取技能标签', icon: DataAnalysis, color: '#409eff', bg: '#ecf5ff' },
  { value: 'insights', label: '智能洞察', desc: '多维分析报告生成', icon: TrendCharts, color: '#67c23a', bg: '#f0f9eb' },
  { value: 'query', label: 'NL 查询', desc: '中文提问转 SQL 查询', icon: ChatDotRound, color: '#e6a23c', bg: '#fdf6ec' },
  { value: 'anti-crawl', label: '反爬检测', desc: '验证码识别与反爬对抗', icon: Monitor, color: '#f56c6c', bg: '#fef0f0' },
  { value: 'embedding', label: '文本向量化', desc: '职位文本转向量(Embedding)', icon: Grid, color: '#9b59b6', bg: '#f5f0ff' },
]

const taskLabelMap: Record<string, string> = {
  'enrichment': '数据增强',
  'insights': '智能洞察',
  'query': 'NL查询',
  'anti-crawl': '反爬检测',
  'embedding': '向量化',
}

function taskLabel(key: string): string {
  return taskLabelMap[key] || key
}

const taskTagTypeMap: Record<string, string> = {
  'enrichment': 'primary',
  'insights': 'success',
  'query': 'warning',
  'anti-crawl': 'danger',
  'embedding': '',
}

function taskTagType(key: string): string {
  return taskTagTypeMap[key] || 'info'
}

function providerLabel(p: string): string {
  const map: Record<string, string> = {
    openai: 'OpenAI', anthropic: 'Anthropic',
    deepseek: 'DeepSeek', zhipu: '智谱',
    qwen: '通义千问', baidu: '文心一言',
    bytedance: '豆包', moonshot: '月之暗面',
    ollama: 'Ollama'
  }
  return map[p] || p
}

// 模型提供商快捷卡片
const remoteCardDefs = [
  { provider: 'deepseek',  label: 'DeepSeek',     color: '#4a6cf7' },
  { provider: 'openai',    label: 'OpenAI',       color: '#10a37f' },
  { provider: 'anthropic', label: 'Anthropic',    color: '#d97757' },
  { provider: 'zhipu',     label: '智谱 AI',      color: '#5b5ea6' },
  { provider: 'qwen',      label: '通义千问',     color: '#3b5998' },
  { provider: 'baidu',     label: '文心一言',     color: '#2468e0' },
  { provider: 'bytedance', label: '豆包',         color: '#3772ff' },
  { provider: 'moonshot',  label: '月之暗面',     color: '#8b5cf6' },
]

const localCardDefs = [
  { provider: 'ollama',   label: 'Ollama',   color: '#f59e0b' },
]

const remoteCards = computed(() => {
  const q = searchQuery.value.toLowerCase()
  const providerConfigMap = new Map<string, LLMConfig>()
  configs.value.filter(c => c.provider !== 'ollama' && c.isActive).forEach(c => {
    if (!providerConfigMap.has(c.provider)) providerConfigMap.set(c.provider, c)
  })

  return remoteCardDefs
    .filter(def => {
      if (!q) return true
      return def.label.toLowerCase().includes(q)
        || def.provider.toLowerCase().includes(q)
    })
    .map(def => {
      const config = providerConfigMap.get(def.provider)
      return {
        provider: def.provider,
        label: def.label,
        sublabel: config ? config.modelName : '',
        configured: !!config as (true | false),
        config: config || null,
        color: def.color,
      }
    })
})

const localCards = computed(() => {
  const ollamaConfig = configs.value.find(c => c.provider === 'ollama' && c.isActive)
  return [{
    provider: 'ollama',
    label: 'Ollama',
    sublabel: ollamaConfig ? ollamaConfig.modelName : '',
    configured: !!ollamaConfig as (true | false),
    config: ollamaConfig || null,
    color: '#f59e0b',
  }]
})

const modelPresets: Record<string, string[]> = {
  deepseek:  ['deepseek-v4-pro', 'deepseek-chat', 'deepseek-reasoner'],
  openai:    ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o3-mini', 'o1', 'o1-mini'],
  anthropic: ['claude-opus-4-7', 'claude-sonnet-4-6', 'claude-haiku-4-5', 'claude-3-5-sonnet'],
  zhipu:     ['glm-4-plus', 'glm-4-flash', 'glm-4-long', 'glm-4v-plus'],
  qwen:      ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen3-235b-a22b', 'qwq-32b'],
  baidu:     ['ernie-4.5', 'ernie-4.0-turbo', 'ernie-3.5', 'ernie-speed'],
  bytedance: ['doubao-pro-256k', 'doubao-lite-32k', 'doubao-vision-pro'],
  moonshot:  ['kimi-k2', 'moonshot-v1-128k', 'moonshot-v1-32k', 'kimi-thinking'],
  ollama:    ['qwen3:14b', 'qwen3:4b', 'llama3:8b', 'nomic-embed-text', 'mistral:7b', 'deepseek-r1:8b'],
}

// 可用模型列表：Ollama 从 API 动态获取，云端模型用预设
const availableModels = computed(() => {
  if (form.value.provider === 'ollama' && providerModels.value.length > 0) {
    return providerModels.value
  }
  return modelPresets[form.value.provider] || []
})

async function fetchOllamaModels() {
  loadingModels.value = true
  providerModels.value = []
  try {
    const res = await fetchProviderModels('ollama')
    if ((res as any).success && Array.isArray((res as any).data)) {
      providerModels.value = (res as any).data
    }
  } catch { /* ignore, fallback to presets */ }
  finally { loadingModels.value = false }
}

async function onProviderChange(provider: string) {
  if (!form.value.baseUrl) {
    form.value.baseUrl = getDefaultUrl(provider)
  }
  if (form.value.taskRouting.length === 0) {
    form.value.taskRouting = provider === 'ollama'
      ? ['enrichment', 'anti-crawl']
      : ['enrichment', 'insights', 'query']
  }
  if (provider === 'ollama') {
    fetchOllamaModels()
  } else {
    providerModels.value = []
  }
}

function quickAdd(provider: string) {
  editingId.value = null
  form.value = {
    ...defaultForm,
    provider,
    baseUrl: getDefaultUrl(provider),
    taskRouting: provider === 'ollama' ? ['enrichment', 'anti-crawl'] : ['enrichment', 'insights', 'query'],
  }
  formRef.value?.resetFields()
  if (provider === 'ollama') {
    fetchOllamaModels()
  } else {
    providerModels.value = []
  }
  dialogVisible.value = true
}

function providerTagType(p: string): string {
  const map: Record<string, string> = {
    openai: 'success', anthropic: '',
    deepseek: 'primary', zhipu: 'danger',
    qwen: 'info', baidu: '', bytedance: 'primary', moonshot: 'warning',
    ollama: 'warning'
  }
  return map[p] || 'info'
}

function getDefaultUrl(p: string): string {
  const map: Record<string, string> = {
    openai: 'https://api.openai.com',
    anthropic: 'https://api.anthropic.com',
    deepseek: 'https://api.deepseek.com',
    zhipu: 'https://open.bigmodel.cn/api/paas/v4',
    qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    baidu: 'https://qianfan.baidubce.com/v2',
    bytedance: 'https://ark.cn-beijing.volces.com/api/v3',
    moonshot: 'https://api.moonshot.cn/v1',
    ollama: 'http://localhost:11434',
  }
  return map[p] || ''
}

async function loadConfigs() {
  loading.value = true
  try {
    const res = await listLLMConfigs()
    configs.value = (res as any).data || []
  } catch (e: any) {
    ElMessage.error('加载配置失败: ' + (e.message || '未知错误'))
  } finally {
    loading.value = false
  }
}

function showAddDialog() {
  editingId.value = null
  form.value = {
    ...defaultForm,
    baseUrl: getDefaultUrl(defaultForm.provider),
  }
  formRef.value?.resetFields()
  dialogVisible.value = true
}

function editConfig(row: LLMConfig) {
  editingId.value = row.id || null
  form.value = {
    provider: row.provider,
    modelName: row.modelName,
    apiKeyEncrypted: '',
    baseUrl: row.baseUrl || '',
    isActive: row.isActive,
    taskRouting: [...(row.taskRouting || [])],
  }
  formRef.value?.resetFields()
  dialogVisible.value = true
}

async function handleSave() {
  if (!formRef.value) return
  await formRef.value.validate(async (valid) => {
    if (!valid) return
    if (!form.value.taskRouting.length) {
      ElMessage.warning('请至少选择一个任务类型')
      return
    }
    saving.value = true
    try {
      const payload: any = { ...form.value }
      if (editingId.value) {
        payload.id = editingId.value
      }
      await saveLLMConfig(payload)
      ElMessage.success(editingId.value ? '配置已更新' : '配置已创建')
      dialogVisible.value = false
      await loadConfigs()
    } catch (e: any) {
      ElMessage.error('保存失败: ' + (e.message || '未知错误'))
    } finally {
      saving.value = false
    }
  })
}

async function handleDelete(row: LLMConfig) {
  try {
    await ElMessageBox.confirm(
      `确定要删除 ${row.modelName} 的配置吗？删除后不可恢复，依赖该模型的任务将受影响。`,
      '确认删除',
      { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }
    )
    await deleteLLMConfig(row.id!)
    ElMessage.success('已删除')
    await loadConfigs()
  } catch { /* cancelled */ }
}

async function handleStatusChange(row: LLMConfig) {
  try {
    await saveLLMConfig({
      ...row,
      apiKeyEncrypted: undefined,
    })
  } catch (e: any) {
    ElMessage.error('状态更新失败: ' + (e.message || '未知错误'))
    row.isActive = !row.isActive
  }
}

async function testConnection(row: LLMConfig) {
  testDialogVisible.value = true
  testing.value = true
  testResult.value = null
  try {
    const res = await checkLLMHealth(row.provider)
    testResult.value = (res as any).data
  } catch (e: any) {
    const errMsg = e?.response?.data?.error || e?.message || '网络请求失败'
    testResult.value = { ok: false, models: [], latency: 0, error: errMsg }
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  loadConfigs()
})
</script>

<style scoped>
.llm-settings {
  padding: 24px;
}

/* ===== 页面头部 ===== */
.page-header {
  margin-bottom: 20px;
}

.page-header h2 {
  margin: 0 0 6px;
  font-size: 22px;
  font-weight: 700;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 10px;
}

.page-header-icon {
  width: 34px;
  height: 34px;
  border-radius: 9px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.12) 0%, rgba(118, 75, 162, 0.12) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #667eea;
}

.subtitle {
  color: #909399;
  margin: 0;
  font-size: 14px;
  padding-left: 44px;
}

/* ===== 双栏主布局 ===== */
.main-content {
  display: flex;
  gap: 24px;
  align-items: flex-start;
}

.cards-panel {
  flex-shrink: 0;
  width: 240px;
  max-height: calc(100vh - 200px);
  overflow-y: auto;
  padding-right: 4px;
}

.cards-panel::-webkit-scrollbar { width: 4px; }
.cards-panel::-webkit-scrollbar-track { background: transparent; }
.cards-panel::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 2px; }
.cards-panel::-webkit-scrollbar-thumb:hover { background: #9ca3af; }

.table-panel {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

@media (max-width: 900px) {
  .main-content { flex-direction: column; }
  .cards-panel { width: 100%; max-height: none; overflow-y: visible; }
  .provider-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); }
  .table-panel { min-width: 0; width: 100%; overflow: visible; }
}

/* 搜索框 */
.search-box { margin-bottom: 16px; }

/* ===== 提供商快捷卡片 ===== */
.card-section { margin-bottom: 16px; }

.section-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
  padding-left: 2px;
}

.section-title::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 14px;
  background: #667eea;
  border-radius: 2px;
  margin-right: 8px;
  vertical-align: middle;
  position: relative;
  top: -1px;
}

.provider-cards {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.provider-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.provider-card:hover {
  border-color: rgba(102, 126, 234, 0.3);
  box-shadow: 0 4px 14px rgba(102, 126, 234, 0.1);
  transform: translateY(-1px);
}

.provider-card:active { transform: scale(0.98); }

.provider-card.is-configured {
  border-color: rgba(102, 126, 234, 0.15);
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.02) 0%, rgba(118, 75, 162, 0.02) 100%);
}

.card-icon { flex-shrink: 0; }

.avatar-text {
  font-size: 15px;
  font-weight: 700;
  color: #fff;
  user-select: none;
}

.card-body { flex: 1; min-width: 0; }

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 1px;
}

.card-model {
  font-size: 11px;
  color: #667eea;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 500;
}

.card-hint {
  font-size: 11px;
  color: #c0c4cc;
  margin-top: 2px;
}

.card-action { flex-shrink: 0; }

.card-action-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  transition: all 0.2s;
}

.card-action-btn:hover {
  transform: scale(1.1);
}

/* ===== 表格 ===== */
.action-bar { margin-bottom: 16px; }

.config-table { margin-top: 0; }

.endpoint-text {
  font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
  font-size: 12px;
  color: #606266;
}

.task-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.task-tag {
  margin: 0;
}

.text-muted {
  color: #c0c4cc;
  font-size: 13px;
}

.default-text {
  color: #c0c4cc;
  font-style: italic;
}

.action-buttons {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 2px;
}

.action-icon {
  margin-right: 3px;
  font-size: 14px;
}
</style>

<style>
/* ===== 全局对话框样式 ===== */
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

/* 对话框头部 */
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

/* 表单分区标题 */
.form-section {
  margin-bottom: 4px;
}

.form-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: #667eea;
  margin-bottom: 16px;
  padding-left: 2px;
}

.section-icon {
  display: flex;
  align-items: center;
  font-size: 14px;
}

.section-badge {
  margin-left: auto;
  font-size: 11px;
  font-weight: 500;
  color: #909399;
  background: #f3f4f6;
  padding: 2px 8px;
  border-radius: 10px;
}

/* 字段提示 */
.field-hint {
  display: block;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
  margin-top: 4px;
}

/* 表单项调整 */
.edit-form .el-form-item {
  margin-bottom: 18px;
}

.edit-form .el-form-item__label {
  color: #4b5563;
  font-weight: 500;
}

.edit-form .el-input__wrapper,
.edit-form .el-select__wrapper {
  border-radius: 8px;
  box-shadow: 0 0 0 1px #e5e7eb inset;
  transition: all 0.2s;
}

.edit-form .el-input__wrapper:hover,
.edit-form .el-select__wrapper:hover {
  box-shadow: 0 0 0 1px #d1d5db inset;
}

.edit-form .el-input.is-focus .el-input__wrapper,
.edit-form .el-select.is-focus .el-select__wrapper {
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.3) inset;
}

/* ===== 任务分配卡片式复选框 ===== */
.task-checkbox-group {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.task-checkbox-card {
  margin-right: 0 !important;
  padding: 12px 14px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #fafbfc;
  transition: all 0.2s;
  height: auto;
  display: flex;
  align-items: center;
}

.task-checkbox-card:hover {
  border-color: rgba(102, 126, 234, 0.25);
  background: #fff;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.06);
}

.task-checkbox-card.is-checked {
  border-color: rgba(102, 126, 234, 0.3);
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.04) 0%, rgba(118, 75, 162, 0.04) 100%);
  box-shadow: 0 2px 10px rgba(102, 126, 234, 0.08);
}

.task-checkcard-inner {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}

.task-checkcard-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.task-checkcard-label {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  white-space: nowrap;
}

.task-checkcard-desc {
  font-size: 11px;
  color: #909399;
  margin-left: auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 任务提示 */
.task-hint {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-top: 12px;
  padding: 10px 14px;
  background: linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(118, 75, 162, 0.03) 100%);
  border-radius: 8px;
  border: 1px solid rgba(102, 126, 234, 0.08);
  font-size: 12px;
  color: #909399;
  line-height: 1.6;
}

.task-hint .el-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: #667eea;
}

/* ===== 对话框底部 ===== */
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

/* ===== 测试连接对话框 ===== */
.test-loading {
  text-align: center;
  padding: 32px 24px;
}

.test-loading p {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin: 16px 0 4px;
}

.test-loading-hint {
  font-size: 13px;
  color: #909399;
}

.test-result-card {
  padding: 20px;
  border-radius: 12px;
  border: 1px solid #ebeef5;
  margin-bottom: 16px;
}

.test-result-card.is-success {
  background: linear-gradient(135deg, rgba(19,206,102,0.04) 0%, rgba(19,206,102,0.02) 100%);
  border-color: rgba(19,206,102,0.2);
}

.test-result-card.is-error {
  background: linear-gradient(135deg, rgba(245,108,108,0.04) 0%, rgba(245,108,108,0.02) 100%);
  border-color: rgba(245,108,108,0.2);
}

.test-result-status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.test-result-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.test-result-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.test-detail-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.test-detail-label {
  font-size: 13px;
  color: #909399;
  width: 60px;
  flex-shrink: 0;
}

.test-detail-value {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  font-family: 'SF Mono', 'Consolas', 'Monaco', monospace;
}

.test-detail-value.is-good { color: #13ce66; }
.test-detail-value.is-slow { color: #e6a23c; }
.test-detail-value.error-text {
  color: #f56c6c;
  font-weight: 400;
  font-family: inherit;
  font-size: 13px;
}

.test-models {
  padding: 14px;
  background: #fafbfc;
  border-radius: 10px;
  border: 1px solid #ebeef5;
}

.test-models-title {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 10px;
}

.test-models-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.test-model-tag {
  margin: 0;
}
</style>
