<template>
  <div class="llm-settings">
    <div class="page-header">
      <h2>模型配置</h2>
      <p class="subtitle">配置大模型提供商，为数据增强、智能分析、自然语言查询等功能提供 AI 能力</p>
    </div>

    <!-- 远程模型快捷卡片 -->
    <div class="card-section">
      <h3 class="section-title">远程模型</h3>
      <div class="provider-cards provider-cards--remote">
        <div
          v-for="card in remoteCards"
          :key="card.provider"
          class="provider-card"
          :class="{ 'is-configured': card.configured }"
          @click="card.configured ? editConfig(card.config!) : quickAdd(card.provider)"
        >
          <div class="card-icon">
            <el-avatar :size="40" :style="{ background: card.color }">
              <span class="avatar-text">{{ card.label[0] }}</span>
            </el-avatar>
          </div>
          <div class="card-body">
            <div class="card-title">{{ card.label }}</div>
            <template v-if="card.configured">
              <div class="card-model">{{ card.config!.modelName }}</div>
            </template>
            <div v-else class="card-hint">点击配置</div>
          </div>
          <div class="card-action">
            <el-button
              type="success"
              size="small"
              plain
            >
              添加
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 本地模型快捷卡片 -->
    <div class="card-section">
      <h3 class="section-title">本地模型</h3>
      <div class="provider-cards provider-cards--local">
        <div
          v-for="card in localCards"
          :key="card.provider"
          class="provider-card"
          :class="{ 'is-configured': card.configured }"
          @click="card.configured ? editConfig(card.config!) : quickAdd(card.provider)"
        >
          <div class="card-icon">
            <el-avatar :size="40" :style="{ background: card.color }">
              <span class="avatar-text">{{ card.label[0] }}</span>
            </el-avatar>
          </div>
          <div class="card-body">
            <div class="card-title">{{ card.label }}</div>
            <template v-if="card.configured">
              <div class="card-model">{{ card.config!.modelName }}</div>
            </template>
            <div v-else class="card-hint">点击配置</div>
          </div>
          <div class="card-action">
            <el-button
              type="success"
              size="small"
              plain
            >
              添加
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <div class="action-bar">
      <el-button type="primary" @click="showAddDialog">
        <el-icon><Plus /></el-icon>
        添加模型
      </el-button>
    </div>

    <el-table :data="configs" stripe v-loading="loading" class="config-table">
      <el-table-column prop="provider" label="提供商" width="120">
        <template #default="{ row }">
          <el-tag :type="providerTagType(row.provider)">{{ providerLabel(row.provider) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="modelName" label="模型名称" min-width="200" />
      <el-table-column prop="baseUrl" label="API 端点" min-width="250">
        <template #default="{ row }">
          <span v-if="row.baseUrl">{{ row.baseUrl }}</span>
          <span v-else class="default-text">{{ getDefaultUrl(row.provider) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="分配任务" min-width="200">
        <template #default="{ row }">
          <el-tag
            v-for="task in row.taskRouting"
            :key="task"
            size="small"
            class="task-tag"
          >{{ taskLabel(task) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-switch v-model="row.isActive" @change="handleStatusChange(row)" />
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

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑模型配置' : '添加模型配置'"
      width="560px"
      destroy-on-close
    >
      <el-form :model="form" label-width="100px" label-position="left">
        <el-form-item label="提供商" required>
          <el-select v-model="form.provider" placeholder="选择提供商" style="width: 100%" @change="onProviderChange">
            <el-option label="OpenAI (GPT-4o 等)" value="openai" />
            <el-option label="Anthropic (Claude)" value="anthropic" />
            <el-option label="DeepSeek" value="deepseek" />
            <el-option label="智谱 (GLM)" value="zhipu" />
            <el-option label="通义千问 (Qwen)" value="qwen" />
            <el-option label="文心一言 (ERNIE)" value="baidu" />
            <el-option label="豆包 (Doubao)" value="bytedance" />
            <el-option label="月之暗面 (Moonshot)" value="moonshot" />
            <el-option label="Ollama (本地模型)" value="ollama" />
          </el-select>
        </el-form-item>

        <el-form-item label="模型名称" required>
          <el-select
            v-model="form.modelName"
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入模型名称"
            style="width: 100%"
          >
            <el-option
              v-for="m in modelPresets[form.provider] || []"
              :key="m"
              :label="m"
              :value="m"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="API Key">
          <el-input
            v-model="form.apiKeyEncrypted"
            type="password"
            show-password
            :placeholder="form.provider === 'ollama' ? '本地模型无需填写' : '输入 API Key'"
          />
        </el-form-item>

        <el-form-item label="API 端点">
          <el-input
            v-model="form.baseUrl"
            :placeholder="getDefaultUrl(form.provider)"
          />
          <div class="form-tip">默认端点已自动填入，可按需修改</div>
        </el-form-item>

        <el-form-item label="任务分配" required>
          <el-checkbox-group v-model="form.taskRouting">
            <el-checkbox label="enrichment">数据增强</el-checkbox>
            <el-checkbox label="insights">智能洞察</el-checkbox>
            <el-checkbox label="query">自然语言查询</el-checkbox>
            <el-checkbox label="anti-crawl">反爬检测</el-checkbox>
          </el-checkbox-group>
          <div class="form-tip">勾选此模型负责处理的任务类型。本地模型推荐用于数据增强和反爬检测，云端模型推荐用于智能洞察和自然语言查询。</div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 测试结果对话框 -->
    <el-dialog v-model="testDialogVisible" title="连接测试" width="480px">
      <div v-if="testing" class="test-loading">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p>正在测试连接...</p>
      </div>
      <div v-else-if="testResult">
        <el-alert
          :type="testResult.ok ? 'success' : 'error'"
          :title="testResult.ok ? '连接成功' : '连接失败'"
          :description="testResult.ok ? `延迟: ${testResult.latency}ms` : (testResult.error || `延迟: ${testResult.latency}ms`)"
          show-icon
          :closable="false"
        />
        <div v-if="testResult.models.length > 0" style="margin-top: 16px">
          <h4>可用模型：</h4>
          <el-tag v-for="m in testResult.models" :key="m" size="small" style="margin: 4px">{{ m }}</el-tag>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Loading, Link, Edit, Delete } from '@element-plus/icons-vue'
import {
  listLLMConfigs, saveLLMConfig, deleteLLMConfig, checkLLMHealth,
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

const defaultForm: LLMConfig = {
  provider: 'openai',
  modelName: '',
  apiKeyEncrypted: '',
  baseUrl: '',
  isActive: true,
  taskRouting: [],
}

const form = ref<LLMConfig>({ ...defaultForm })

const taskLabelMap: Record<string, string> = {
  'enrichment': '数据增强',
  'insights': '智能洞察',
  'query': 'NL查询',
  'anti-crawl': '反爬检测',
}

function taskLabel(key: string): string {
  return taskLabelMap[key] || key
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

// 模型提供商快捷卡片（远程 8 个 = 4列×2行）
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

const remoteCards = computed(() =>
  remoteCardDefs.map(def => {
    const config = configs.value.find(c => c.provider === def.provider && c.isActive)
    return { ...def, configured: !!config, config: config || null }
  })
)

const localCards = computed(() =>
  localCardDefs.map(def => {
    const config = configs.value.find(c => c.provider === def.provider && c.isActive)
    return { ...def, configured: !!config, config: config || null }
  })
)

// 各提供商的预设模型列表
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

function onProviderChange(provider: string) {
  // 自动填入默认端点
  if (!form.value.baseUrl) {
    form.value.baseUrl = getDefaultUrl(provider)
  }
  // 自动推荐任务分配
  if (form.value.taskRouting.length === 0) {
    form.value.taskRouting = provider === 'ollama'
      ? ['enrichment', 'anti-crawl']
      : ['enrichment', 'insights', 'query']
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
  dialogVisible.value = true
}

async function handleSave() {
  if (!form.value.provider || !form.value.modelName) {
    ElMessage.warning('请填写提供商和模型名称')
    return
  }
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
}

async function handleDelete(row: LLMConfig) {
  try {
    await ElMessageBox.confirm(`确定要删除 ${row.modelName} 的配置吗？`, '确认删除', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    await deleteLLMConfig(row.id!)
    ElMessage.success('已删除')
    await loadConfigs()
  } catch { /* cancelled */ }
}

async function handleStatusChange(row: LLMConfig) {
  try {
    await saveLLMConfig({
      ...row,
      apiKeyEncrypted: undefined, // don't overwrite existing key
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
  max-width: 1100px;
}

.page-header h2 {
  margin: 0 0 8px;
  font-size: 22px;
}

.subtitle {
  color: #909399;
  margin: 0 0 20px;
}

/* ========== 提供商快捷卡片 ========== */
.card-section {
  margin-bottom: 20px;
}
.section-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
  color: #606266;
  padding-left: 2px;
}
.section-title::before {
  content: '';
  display: inline-block;
  width: 4px;
  height: 14px;
  background: #409eff;
  border-radius: 2px;
  margin-right: 8px;
  vertical-align: middle;
  position: relative;
  top: -1px;
}

.provider-cards {
  display: grid;
  gap: 16px;
}

/* 远程模型：固定 4 列，8 卡满两行 */
.provider-cards--remote {
  grid-template-columns: repeat(4, 1fr);
}

/* 本地模型：自适应 */
.provider-cards--local {
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
}

.provider-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  height: 100%;
  background: #fff;
  border: 1px solid #e4e7ed;
  border-radius: 10px;
  cursor: pointer;
  transition: all 200ms ease-out;
}
.provider-card:hover {
  border-color: #409eff;
  box-shadow: 0 4px 16px rgba(64, 158, 255, 0.12);
  transform: translateY(-2px);
}
.provider-card:active {
  transform: scale(0.98);
}

.provider-card.is-configured {
  border-color: #e0ecf5;
  background: #fafcff;
}

.card-icon {
  flex-shrink: 0;
}
.avatar-text {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
  user-select: none;
}

.card-body {
  flex: 1;
  min-width: 0;
}
.card-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 2px;
}
.card-model {
  font-size: 13px;
  color: #606266;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-hint {
  font-size: 12px;
  color: #c0c4cc;
  margin-top: 4px;
}

.card-action {
  flex-shrink: 0;
}

.action-bar {
  margin-bottom: 16px;
}

.config-table {
  margin-top: 8px;
}

.task-tag {
  margin: 2px 4px 2px 0;
}

.form-tip {
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
}

.default-text {
  color: #c0c4cc;
  font-style: italic;
}

.test-loading {
  text-align: center;
  padding: 24px;
}

/* 操作列按钮 */
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
